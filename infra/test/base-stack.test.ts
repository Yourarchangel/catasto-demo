import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { BaseStack } from '../lib/base-stack.ts';
import { paramPath, stages, type StageConfig } from '../lib/config.ts';

const account = '111111111111';
const pipelineAccount = '222222222222';

function synth(overrides: Partial<StageConfig> = {}): Template {
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } }); // skip esbuild in tests
  const config = { ...stages.prod, account, ...overrides };
  const stack = new BaseStack(app, 'catasto-prod-base', {
    config,
    env: { account, region: config.region },
    pipelineAccount,
  });
  return Template.fromStack(stack);
}

const asArray = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);
type Statement = { Effect: string; Action: string | string[]; Condition?: Record<string, unknown>; Sid?: string };

const template = synth();

describe('network', () => {
  it('has 2 app and 2 database subnets, none public', () => {
    template.resourceCountIs('AWS::EC2::Subnet', 4);
    assert.equal(Object.keys(template.findResources('AWS::EC2::Subnet', { Properties: { MapPublicIpOnLaunch: true } })).length, 0);
  });

  it('has no way to the internet: no NAT gateway, NAT instance, Elastic IP or internet gateway', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
    template.resourceCountIs('AWS::EC2::Instance', 0);
    template.resourceCountIs('AWS::EC2::EIP', 0);
    template.resourceCountIs('AWS::EC2::InternetGateway', 0);
    template.resourceCountIs('AWS::EC2::EgressOnlyInternetGateway', 0);
  });

  it('has only the free S3 gateway endpoint, on the app subnets only', () => {
    template.resourceCountIs('AWS::EC2::VPCEndpoint', 1);
    const [endpoint] = Object.values(template.findResources('AWS::EC2::VPCEndpoint'));
    assert.equal(endpoint.Properties.VpcEndpointType, 'Gateway');
    assert.equal(endpoint.Properties.RouteTableIds.length, 2);
  });

  it('puts the database in the database subnets only', () => {
    const [group] = Object.values(template.findResources('AWS::RDS::DBSubnetGroup'));
    const subnets = template.findResources('AWS::EC2::Subnet');
    const ids = group.Properties.SubnetIds.map((s: { Ref: string }) => s.Ref);
    assert.equal(ids.length, 2);
    for (const id of ids) assert.match(subnets[id].Properties.CidrBlock, /\/24$/);
  });
});

describe('api and login check', () => {
  it('throttles prod at 100/200', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: { ThrottlingRateLimit: 100, ThrottlingBurstLimit: 200 },
    });
  });

  it('caches the cognito-login authorizer for 300 s with simple responses', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      Name: 'cognito-login',
      AuthorizerType: 'REQUEST',
      AuthorizerResultTtlInSeconds: 300,
      EnableSimpleResponses: true,
      IdentitySource: ['$request.header.Authorization'],
    });
  });

  it('serves GET /health', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'GET /health' });
  });
});

describe('identity', () => {
  it('requires TOTP MFA, admin-only sign-up and deletion protection', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      MfaConfiguration: 'ON',
      EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      DeletionProtection: 'ACTIVE',
    });
  });

  it('gives the web app a public SRP client', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
      ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_SRP_AUTH']),
      EnableTokenRevocation: true,
    });
  });
});

describe('data', () => {
  it('runs encrypted, private, Multi-AZ PostgreSQL with deletion protection', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      PubliclyAccessible: false,
      StorageEncrypted: true,
      DeletionProtection: true,
      MultiAZ: true,
    });
    template.hasResource('AWS::RDS::DBInstance', { DeletionPolicy: 'Snapshot' });
  });

  it('opens 5432 only to the Lambda security group', () => {
    const ingress = Object.values(template.findResources('AWS::EC2::SecurityGroupIngress'));
    assert.equal(ingress.length, 1);
    assert.equal(ingress[0].Properties.FromPort, 5432);
    assert.ok(ingress[0].Properties.SourceSecurityGroupId, 'source must be a security group, not a CIDR');
  });

  it('keeps the documents bucket private, versioned and retained', () => {
    template.hasResource('AWS::S3::Bucket', {
      Properties: Match.objectLike({
        BucketName: Match.stringLikeRegexp('documents'),
        VersioningConfiguration: { Status: 'Enabled' },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      }),
      DeletionPolicy: 'Retain',
    });
  });
});

describe('service deploy access', () => {
  const roles = template.findResources('AWS::IAM::Role');
  const role = (name: string) => Object.values(roles).find((r) => r.Properties.RoleName === name)!;

  const policies = template.findResources('AWS::IAM::ManagedPolicy');
  const boundaryId = (name: string) => Object.keys(policies).find((k) => policies[k].Properties.ManagedPolicyName === name)!;
  const allowed = (name: string): string[] =>
    (policies[boundaryId(name)].Properties.PolicyDocument.Statement as Statement[])
      .filter((s) => s.Effect === 'Allow')
      .flatMap((s) => asArray(s.Action));
  const denied = (name: string): string[] =>
    (policies[boundaryId(name)].Properties.PolicyDocument.Statement as Statement[])
      .filter((s) => s.Effect === 'Deny')
      .flatMap((s) => asArray(s.Action));

  it("requires one of the two boundaries on the CloudFormation role's iam:CreateRole", () => {
    const statements: Statement[] = role('catasto-prod-service-cloudformation').Properties.Policies.flatMap(
      (p: { PolicyDocument: { Statement: Statement[] } }) => p.PolicyDocument.Statement,
    );
    const create = statements.filter((s) => s.Effect === 'Allow' && asArray(s.Action).includes('iam:CreateRole'));
    assert.ok(create.length > 0);
    for (const s of create) {
      const condition = JSON.stringify(s.Condition);
      assert.ok(condition.includes(boundaryId('catasto-prod-data-boundary')), 'data boundary must be allowed');
      assert.ok(condition.includes(boundaryId('catasto-prod-integration-boundary')), 'integration boundary must be allowed');
    }
  });

  it('limits data Lambdas to the VPC, the database and documents', () => {
    const actions = allowed('catasto-prod-data-boundary');
    assert.ok(actions.includes('ec2:CreateNetworkInterface'));
    assert.ok(actions.includes('rds-db:connect'));
    for (const forbidden of ['secretsmanager:GetSecretValue', 'ses:SendEmail', 'cognito-idp:AdminCreateUser', 'lambda:InvokeFunction', 'sqs:SendMessage']) {
      assert.ok(!actions.includes(forbidden), `data boundary must not allow ${forbidden}`);
    }
  });

  it('keeps integration Lambdas out of the VPC and away from the database', () => {
    const actions = allowed('catasto-prod-integration-boundary');
    assert.ok(actions.includes('secretsmanager:GetSecretValue'));
    assert.ok(actions.includes('lambda:InvokeFunction'));
    for (const forbidden of ['ec2:CreateNetworkInterface', 'rds-db:connect']) {
      assert.ok(!actions.includes(forbidden), `integration boundary must not allow ${forbidden}`);
    }
    assert.ok(denied('catasto-prod-integration-boundary').includes('secretsmanager:*'), 'admin secret must be denied');
  });

  it('lets data Lambdas log in to the database only as the app user', () => {
    const statements = policies[boundaryId('catasto-prod-data-boundary')].Properties.PolicyDocument.Statement as Statement[];
    const connect = statements.find((s) => asArray(s.Action).includes('rds-db:connect'))!;
    assert.match(JSON.stringify(connect), /\/catasto_app/);
  });

  it("lets only the pipeline account's catasto-pipeline-* roles assume the deployer", () => {
    const trust = role('catasto-prod-service-deployer').Properties.AssumeRolePolicyDocument.Statement[0];
    assert.match(JSON.stringify(trust.Principal), new RegExp(`${pipelineAccount}:root`));
    assert.match(JSON.stringify(trust.Condition), new RegExp(`${pipelineAccount}:role/catasto-pipeline-\\*`));
  });
});

describe('ssm contract', () => {
  it('publishes every parameter services depend on', () => {
    const names = [
      'vpc/private-subnet-ids',
      'vpc/lambda-security-group-id',
      'api/id',
      'api/url',
      'api/authorizer-id',
      'identity/user-pool-id',
      'identity/user-pool-arn',
      'identity/user-pool-client-id',
      'database/endpoint',
      'database/port',
      'database/name',
      'database/app-user',
      'database/resource-id',
      'storage/documents-bucket',
      'docusign/secret-name',
      'docusign/oauth-host',
      'alerts/topic-arn',
      'deploy/bucket',
      'deploy/cloudformation-role-arn',
      'deploy/data-boundary-arn',
      'deploy/integration-boundary-arn',
    ];
    for (const name of names) {
      template.hasResourceProperties('AWS::SSM::Parameter', { Name: paramPath('prod', name) });
    }
  });

  it('does not publish the admin database secret to services', () => {
    const params = Object.values(template.findResources('AWS::SSM::Parameter')).map((p) => p.Properties.Name);
    assert.ok(!params.includes(paramPath('prod', 'database/secret-arn')));
  });
});

describe('db-setup', () => {
  it('runs in the VPC and cannot read any secret', () => {
    const fns = template.findResources('AWS::Lambda::Function', { Properties: { FunctionName: 'catasto-prod-db-setup' } });
    const [id] = Object.keys(fns);
    assert.ok(fns[id].Properties.VpcConfig, 'db-setup must be in the VPC');
    const roleRef = fns[id].Properties.Role['Fn::GetAtt'][0];
    const attached = Object.values(template.findResources('AWS::IAM::Policy')).filter((p) =>
      JSON.stringify(p.Properties.Roles).includes(roleRef),
    );
    assert.ok(!JSON.stringify(attached).includes('secretsmanager'));
  });

  it('keeps infra Lambdas that need the internet out of the VPC', () => {
    for (const name of ['catasto-prod-authorizer', 'catasto-prod-health']) {
      const [fn] = Object.values(template.findResources('AWS::Lambda::Function', { Properties: { FunctionName: name } }));
      assert.equal(fn.Properties.VpcConfig, undefined, `${name} must not be in the VPC`);
    }
  });
});

describe('alerts', () => {
  it('has the failed-job rule and the API 5xx alarm', () => {
    template.hasResourceProperties('AWS::Events::Rule', { Name: 'catasto-prod-failed-jobs' });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', { AlarmName: 'catasto-prod-api-5xx' });
  });
});

describe('optional pieces', () => {
  it('creates no SES identity until an email domain is configured', () => {
    template.resourceCountIs('AWS::SES::EmailIdentity', 0);
  });

  it('adds SES and its parameters when email is configured', () => {
    const t = synth({ email: { domain: 'example.com', fromAddress: 'no-reply@example.com' } });
    t.resourceCountIs('AWS::SES::EmailIdentity', 1);
    t.hasResourceProperties('AWS::SSM::Parameter', { Name: paramPath('prod', 'email/from-address') });
  });

  it('maps a custom domain and prints the CNAME target when there is no hosted zone', () => {
    const t = synth({ api: { ...stages.prod.api, domainName: 'api.example.com' } });
    t.hasResourceProperties('AWS::ApiGatewayV2::DomainName', { DomainName: 'api.example.com' });
    t.hasOutput('ApiCnameTarget', {});
  });
});
