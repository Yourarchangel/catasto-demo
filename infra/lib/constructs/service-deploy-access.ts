import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  ArnPrincipal,
  Effect,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { prefix, type StageConfig } from '../config.ts';

export interface ServiceDeployAccessProps {
  config: StageConfig;
  /** Account whose `catasto-pipeline-*` roles may assume the deployer role. */
  pipelineAccount: string;
  apiId: string;
  documentsBucketArn: string;
  userPoolArn: string;
  databaseResourceId: string;
  /** The admin secret. Integration roles are explicitly denied it. */
  databaseSecretArn: string;
  /** SES identity and configuration set ARNs, when email is configured. */
  sesArns?: string[];
}

/**
 * Least-privilege deploys for services:
 * - a deploy bucket for Serverless artifacts
 * - two permissions boundaries, one per kind of Lambda. Every service role must carry one.
 *     data:        in the VPC. Database (IAM auth as the app user), documents, SQS consume. Nothing else.
 *     integration: outside the VPC. DocuSign secret, SES, Cognito admin, documents, invoke/queue/jobs.
 *                  It cannot attach to the VPC or connect to the database.
 * - a CloudFormation role that can only create `catasto-<stage>-*` resources
 * - a deployer role the pipeline assumes, limited to `catasto-<stage>-svc-*` stacks
 */
export class ServiceDeployAccess extends Construct {
  readonly bucket: Bucket;
  readonly dataBoundary: ManagedPolicy;
  readonly integrationBoundary: ManagedPolicy;
  readonly cloudFormationRole: Role;
  readonly deployerRole: Role;

  constructor(scope: Construct, id: string, props: ServiceDeployAccessProps) {
    super(scope, id);
    const { config } = props;
    const stack = Stack.of(this);
    const name = prefix(config.stage);
    const arn = (service: string, resource: string) =>
      `arn:${stack.partition}:${service}:${stack.region}:${stack.account}:${resource}`;
    const roleArn = (roleName: string) => `arn:${stack.partition}:iam::${stack.account}:role/${roleName}`;
    const stageQueues = arn('sqs', `${name}-*`);

    this.bucket = new Bucket(this, 'Bucket', {
      bucketName: `${name}-service-deploys-${stack.account}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(30) }],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // ---- Shared statements ----
    const logs = () =>
      new PolicyStatement({
        sid: 'LogsAndMetrics',
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents', 'cloudwatch:PutMetricData'],
        resources: ['*'],
      });
    const documents = () => [
      new PolicyStatement({
        sid: 'Documents',
        actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:PutObject'],
        resources: [`${props.documentsBucketArn}/*`],
      }),
      new PolicyStatement({ sid: 'DocumentsList', actions: ['s3:ListBucket'], resources: [props.documentsBucketArn] }),
    ];
    const consumeQueues = ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes', 'sqs:ChangeMessageVisibility'];

    // ---- Data boundary: in the VPC, database and documents only ----
    this.dataBoundary = new ManagedPolicy(this, 'DataBoundary', {
      managedPolicyName: `${name}-data-boundary`,
      description: 'Ceiling for data Lambdas (in the VPC)',
      statements: [
        logs(),
        new PolicyStatement({
          sid: 'VpcNetworkInterfaces',
          actions: [
            'ec2:CreateNetworkInterface',
            'ec2:DescribeNetworkInterfaces',
            'ec2:DeleteNetworkInterface',
            'ec2:AssignPrivateIpAddresses',
            'ec2:UnassignPrivateIpAddresses',
          ],
          resources: ['*'],
        }),
        new PolicyStatement({
          sid: 'DatabaseAsAppUser',
          actions: ['rds-db:connect'],
          resources: [arn('rds-db', `dbuser:${props.databaseResourceId}/${config.database.appUser}`)],
        }),
        ...documents(),
        // Event source mappings poll on the function's behalf, so no network path is needed.
        new PolicyStatement({ sid: 'ConsumeStageQueues', actions: consumeQueues, resources: [stageQueues] }),
      ],
    });

    // ---- Integration boundary: outside the VPC, everything that talks to the world ----
    this.integrationBoundary = new ManagedPolicy(this, 'IntegrationBoundary', {
      managedPolicyName: `${name}-integration-boundary`,
      description: 'Ceiling for integration Lambdas, state machines and schedules (outside the VPC)',
      statements: [
        logs(),
        new PolicyStatement({
          sid: 'StageSecretsAndParameters',
          actions: ['secretsmanager:GetSecretValue', 'ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
          resources: [arn('secretsmanager', `secret:catasto/${config.stage}/*`), arn('ssm', `parameter/catasto/${config.stage}/*`)],
        }),
        new PolicyStatement({
          sid: 'NoDatabaseAdminSecret',
          effect: Effect.DENY,
          actions: ['secretsmanager:*'],
          resources: [props.databaseSecretArn],
        }),
        new PolicyStatement({
          sid: 'InvokeStageFunctionsAndJobs',
          actions: ['lambda:InvokeFunction', 'states:StartExecution', 'states:StartSyncExecution', 'states:DescribeExecution'],
          resources: [arn('lambda', `function:${name}-*`), arn('states', `stateMachine:${name}-*`), arn('states', `execution:${name}-*`)],
        }),
        new PolicyStatement({
          sid: 'StageQueues',
          actions: ['sqs:SendMessage', ...consumeQueues],
          resources: [stageQueues],
        }),
        new PolicyStatement({
          sid: 'StepFunctionsLogDelivery',
          actions: [
            'logs:CreateLogDelivery',
            'logs:GetLogDelivery',
            'logs:UpdateLogDelivery',
            'logs:DeleteLogDelivery',
            'logs:ListLogDeliveries',
            'logs:PutResourcePolicy',
            'logs:DescribeResourcePolicies',
            'logs:DescribeLogGroups',
          ],
          resources: ['*'],
        }),
        ...documents(),
        new PolicyStatement({
          sid: 'InvitedUsers',
          actions: [
            'cognito-idp:AdminCreateUser',
            'cognito-idp:AdminGetUser',
            'cognito-idp:AdminSetUserPassword',
            'cognito-idp:AdminUpdateUserAttributes',
            'cognito-idp:AdminDisableUser',
            'cognito-idp:AdminUserGlobalSignOut',
          ],
          resources: [props.userPoolArn],
        }),
        ...(props.sesArns?.length
          ? [new PolicyStatement({ sid: 'SendInvitations', actions: ['ses:SendEmail', 'ses:SendRawEmail'], resources: props.sesArns })]
          : []),
      ],
    });

    // ---- CloudFormation role: what service stacks may create ----
    const boundaryCondition = {
      StringEquals: {
        'iam:PermissionsBoundary': [this.dataBoundary.managedPolicyArn, this.integrationBoundary.managedPolicyArn],
      },
    };
    this.cloudFormationRole = new Role(this, 'CloudFormationRole', {
      roleName: `${name}-service-cloudformation`,
      assumedBy: new ServicePrincipal('cloudformation.amazonaws.com'),
      inlinePolicies: {
        services: new PolicyDocument({
          statements: [
            new PolicyStatement({
              sid: 'StageResources',
              actions: ['lambda:*', 'states:*', 'scheduler:*', 'events:*', 'sqs:*', 'cloudwatch:*Alarm*', 'cloudwatch:TagResource', 'cloudwatch:UntagResource'],
              resources: [
                arn('lambda', `function:${name}-*`),
                arn('states', `stateMachine:${name}-*`),
                arn('scheduler', `schedule/*/${name}-*`),
                arn('scheduler', `schedule-group/${name}-*`),
                arn('events', `rule/${name}-*`),
                stageQueues,
                arn('cloudwatch', `alarm:${name}-*`),
              ],
            }),
            new PolicyStatement({
              sid: 'StageLogGroups',
              actions: ['logs:*'],
              resources: [
                arn('logs', `log-group:/aws/lambda/${name}-*`),
                arn('logs', `log-group:/aws/vendedlogs/states/${name}-*`),
              ],
            }),
            new PolicyStatement({
              sid: 'LambdaVersionsAndLookups',
              actions: [
                'lambda:GetLayerVersion',
                'lambda:CreateEventSourceMapping',
                'lambda:GetEventSourceMapping',
                'lambda:UpdateEventSourceMapping',
                'lambda:DeleteEventSourceMapping',
                'ec2:DescribeSecurityGroups',
                'ec2:DescribeSubnets',
                'ec2:DescribeVpcs',
                'ec2:DescribeNetworkInterfaces',
                'logs:DescribeLogGroups',
              ],
              resources: ['*'],
            }),
            new PolicyStatement({
              sid: 'ThisApiOnly',
              actions: ['apigateway:GET', 'apigateway:POST', 'apigateway:PUT', 'apigateway:PATCH', 'apigateway:DELETE'],
              resources: [
                `arn:${stack.partition}:apigateway:${stack.region}::/apis/${props.apiId}`,
                `arn:${stack.partition}:apigateway:${stack.region}::/apis/${props.apiId}/*`,
              ],
            }),
            new PolicyStatement({
              sid: 'CreateRolesOnlyWithBoundary',
              actions: ['iam:CreateRole', 'iam:PutRolePolicy', 'iam:AttachRolePolicy', 'iam:DetachRolePolicy', 'iam:DeleteRolePolicy'],
              resources: [roleArn(`${name}-*`)],
              conditions: boundaryCondition,
            }),
            new PolicyStatement({
              sid: 'ManageStageRoles',
              actions: ['iam:GetRole', 'iam:GetRolePolicy', 'iam:DeleteRole', 'iam:TagRole', 'iam:UntagRole', 'iam:UpdateAssumeRolePolicy'],
              resources: [roleArn(`${name}-*`)],
            }),
            new PolicyStatement({
              sid: 'PassStageRoles',
              actions: ['iam:PassRole'],
              resources: [roleArn(`${name}-*`)],
              conditions: {
                StringEquals: {
                  'iam:PassedToService': [
                    'lambda.amazonaws.com',
                    'states.amazonaws.com',
                    'scheduler.amazonaws.com',
                    'events.amazonaws.com',
                    'apigateway.amazonaws.com',
                  ],
                },
              },
            }),
            new PolicyStatement({
              sid: 'NoBoundaryChanges',
              effect: Effect.DENY,
              actions: ['iam:DeleteRolePermissionsBoundary', 'iam:PutRolePermissionsBoundary', 'iam:CreatePolicyVersion', 'iam:DeletePolicy'],
              resources: ['*'],
            }),
            new PolicyStatement({
              sid: 'ReadDeployArtifacts',
              actions: ['s3:GetObject'],
              resources: [this.bucket.arnForObjects('*')],
            }),
          ],
        }),
      },
    });

    // ---- Deployer role: what the pipeline can do with services ----
    this.deployerRole = new Role(this, 'DeployerRole', {
      roleName: `${name}-service-deployer`,
      assumedBy: new ArnPrincipal(`arn:${stack.partition}:iam::${props.pipelineAccount}:root`).withConditions({
        ArnLike: { 'aws:PrincipalArn': `arn:${stack.partition}:iam::${props.pipelineAccount}:role/catasto-pipeline-*` },
      }),
      maxSessionDuration: Duration.hours(1),
      inlinePolicies: {
        deploy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              sid: 'ServiceStacks',
              actions: ['cloudformation:*'],
              resources: [arn('cloudformation', `stack/${name}-svc-*/*`)],
            }),
            new PolicyStatement({
              sid: 'CloudFormationReads',
              actions: ['cloudformation:ValidateTemplate', 'cloudformation:ListStacks', 'cloudformation:DescribeStacks'],
              resources: ['*'],
            }),
            new PolicyStatement({
              sid: 'PassCloudFormationRole',
              actions: ['iam:PassRole'],
              resources: [this.cloudFormationRole.roleArn],
            }),
            new PolicyStatement({
              sid: 'DeployBucket',
              actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket', 's3:GetBucketLocation'],
              resources: [this.bucket.bucketArn, this.bucket.arnForObjects('*')],
            }),
            new PolicyStatement({
              sid: 'StageParameters',
              actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath', 'ssm:PutParameter'],
              resources: [arn('ssm', `parameter/catasto/${config.stage}/*`)],
            }),
            new PolicyStatement({
              sid: 'ReadFunctions',
              actions: ['lambda:GetFunction', 'lambda:ListVersionsByFunction'],
              resources: [arn('lambda', `function:${name}-*`)],
            }),
          ],
        }),
      },
    });
  }
}
