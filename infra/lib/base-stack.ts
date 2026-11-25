import { Stack, Tags, type StackProps } from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { paramPath, prefix, type StageConfig } from './config.ts';
import { Alerts } from './constructs/alerts.ts';
import { Api } from './constructs/api.ts';
import { Authorizer } from './constructs/authorizer.ts';
import { Database } from './constructs/database.ts';
import { Email } from './constructs/email.ts';
import { Identity } from './constructs/identity.ts';
import { Network } from './constructs/network.ts';
import { ServiceDeployAccess } from './constructs/service-deploy-access.ts';
import { Storage } from './constructs/storage.ts';

export interface BaseStackProps extends StackProps {
  config: StageConfig;
  /** Account whose `catasto-pipeline-*` roles may deploy services. Defaults to this stack's account. */
  pipelineAccount?: string;
}

/**
 * One environment's shared infrastructure. Services deploy separately and find
 * everything here through the SSM parameters under `/catasto/<stage>/`.
 */
export class BaseStack extends Stack {
  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, {
      ...props,
      terminationProtection: props.config.terminationProtection,
      description: `Catasto ${props.config.stage}: shared network, API, identity, data and deploy access`,
    });
    const { config } = props;
    Tags.of(this).add('Project', 'Catasto');
    Tags.of(this).add('Environment', config.stage);

    // ---- Building blocks ----
    const network = new Network(this, 'Network', config);
    const identity = new Identity(this, 'Identity', config);
    const api = new Api(this, 'Api', config);
    const authorizer = new Authorizer(this, 'Authorizer', {
      config,
      httpApi: api.httpApi,
      userPool: identity.userPool,
      webClient: identity.webClient,
    });
    const database = new Database(this, 'Database', {
      config,
      vpc: network.vpc,
      subnets: network.databaseSubnets,
      appSubnets: network.appSubnets,
      clientSecurityGroup: network.lambdaSecurityGroup,
    });
    const storage = new Storage(this, 'Storage', config);
    const { domain, fromAddress } = config.email;
    const email = domain && fromAddress ? new Email(this, 'Email', { ...config, email: { domain, fromAddress } }) : undefined;

    const alerts = new Alerts(this, 'Alerts', { config, httpApi: api.httpApi });
    database.alarms.forEach((alarm) => alerts.addAlarm(alarm));

    const deployAccess = new ServiceDeployAccess(this, 'ServiceDeployAccess', {
      config,
      pipelineAccount: props.pipelineAccount ?? this.account,
      apiId: api.httpApi.apiId,
      documentsBucketArn: storage.documents.bucketArn,
      userPoolArn: identity.userPool.userPoolArn,
      databaseResourceId: database.resourceId,
      databaseSecretArn: database.instance.secret!.secretArn,
      sesArns: email
        ? [
            this.formatArn({ service: 'ses', resource: 'identity', resourceName: email.identity.emailIdentityName }),
            this.formatArn({ service: 'ses', resource: 'configuration-set', resourceName: email.configurationSetName }),
          ]
        : undefined,
    });

    // ---- SSM parameters: the contract with services ----
    const params: Record<string, string> = {
      // For data Lambdas only. Integration Lambdas must not set a VPC config.
      'vpc/private-subnet-ids': network.vpc.selectSubnets(network.appSubnets).subnetIds.join(','),
      'vpc/lambda-security-group-id': network.lambdaSecurityGroup.securityGroupId,

      'api/id': api.httpApi.apiId,
      'api/url': api.url,
      'api/authorizer-id': authorizer.authorizer.authorizerId,

      'identity/user-pool-id': identity.userPool.userPoolId,
      'identity/user-pool-arn': identity.userPool.userPoolArn,
      'identity/user-pool-client-id': identity.webClient.userPoolClientId,

      'database/endpoint': database.instance.dbInstanceEndpointAddress,
      'database/port': database.instance.dbInstanceEndpointPort,
      'database/name': 'catasto',
      'database/app-user': config.database.appUser,
      'database/resource-id': database.resourceId,

      'storage/documents-bucket': storage.documents.bucketName,

      'docusign/secret-name': config.docusign.secretName,
      'docusign/oauth-host': config.docusign.oauthHost,

      'alerts/topic-arn': alerts.topic.topicArn,

      'deploy/bucket': deployAccess.bucket.bucketName,
      'deploy/cloudformation-role-arn': deployAccess.cloudFormationRole.roleArn,
      'deploy/data-boundary-arn': deployAccess.dataBoundary.managedPolicyArn,
      'deploy/integration-boundary-arn': deployAccess.integrationBoundary.managedPolicyArn,
    };
    if (email) {
      params['email/from-address'] = email.fromAddress;
      params['email/configuration-set'] = email.configurationSetName;
    }

    for (const [name, value] of Object.entries(params)) {
      new StringParameter(this, `Param:${name}`, {
        parameterName: paramPath(config.stage, name),
        stringValue: value,
        description: `${prefix(config.stage)} shared value for services`,
      });
    }
  }
}
