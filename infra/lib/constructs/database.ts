import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { InstanceType, Port, SecurityGroup, type IVpc, type ISecurityGroup, type SubnetSelection } from 'aws-cdk-lib/aws-ec2';
import {
  CaCertificate,
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  ParameterGroup,
  PostgresEngineVersion,
  StorageType,
} from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { join } from 'node:path';
import { prefix, type StageConfig } from '../config.ts';
import { NodeFunction } from './node-function.ts';

export interface DatabaseProps {
  config: StageConfig;
  vpc: IVpc;
  subnets: SubnetSelection;
  /** Where data Lambdas (and db-setup) run. */
  appSubnets: SubnetSelection;
  /** Only this security group (data Lambdas) may connect on 5432. */
  clientSecurityGroup: ISecurityGroup;
}

/**
 * PostgreSQL in the database subnets. Reachable only from data Lambdas, TLS required.
 * Services log in as `appUser` with IAM auth tokens, so they never need the admin secret.
 */
export class Database extends Construct {
  readonly instance: DatabaseInstance;
  readonly alarms: Alarm[];
  /** Stable id used in rds-db:connect ARNs (always set for an instance this stack creates). */
  readonly resourceId: string;
  readonly setupFunction: NodeFunction;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);
    const { config, vpc, clientSecurityGroup } = props;
    const name = prefix(config.stage);
    const db = config.database;

    const securityGroup = new SecurityGroup(this, 'SecurityGroup', {
      vpc,
      securityGroupName: `${name}-database`,
      description: 'PostgreSQL: inbound from service Lambdas only',
      allowAllOutbound: false,
    });
    securityGroup.addIngressRule(clientSecurityGroup, Port.tcp(5432), 'Service Lambdas to PostgreSQL');

    const engine = DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_17 });

    this.instance = new DatabaseInstance(this, 'Instance', {
      instanceIdentifier: name,
      engine,
      instanceType: new InstanceType(db.instanceType),
      databaseName: 'catasto',
      credentials: Credentials.fromGeneratedSecret('catasto_admin', { secretName: db.secretName }),
      parameterGroup: new ParameterGroup(this, 'Parameters', {
        engine,
        parameters: { 'rds.force_ssl': '1' },
      }),
      caCertificate: CaCertificate.RDS_CA_RSA2048_G1,
      vpc,
      vpcSubnets: props.subnets,
      securityGroups: [securityGroup],
      publiclyAccessible: false,
      multiAz: db.multiAz,
      storageType: StorageType.GP3,
      allocatedStorage: db.allocatedStorageGb,
      maxAllocatedStorage: db.maxAllocatedStorageGb,
      storageEncrypted: true,
      iamAuthentication: true,
      enablePerformanceInsights: true,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: config.logRetention,
      autoMinorVersionUpgrade: true,
      backupRetention: Duration.days(db.backupRetentionDays),
      copyTagsToSnapshot: true,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });

    this.resourceId = this.instance.instanceResourceId!;

    // One-time setup of the IAM-authenticated app role. See functions/db-setup.
    this.setupFunction = new NodeFunction(this, 'Setup', {
      config,
      name: 'db-setup',
      entry: join(import.meta.dirname, '../../functions/db-setup/index.ts'),
      timeout: Duration.seconds(30),
      vpc: { vpc, subnets: props.appSubnets, securityGroup: clientSecurityGroup },
      externalModules: ['pg-native'],
      environment: {
        DB_HOST: this.instance.dbInstanceEndpointAddress,
        DB_PORT: this.instance.dbInstanceEndpointPort,
        DB_NAME: 'catasto',
        ADMIN_USER: 'catasto_admin',
        APP_USER: db.appUser,
        NODE_EXTRA_CA_CERTS: '/var/runtime/ca-cert.pem',
      },
    });

    this.alarms = [
      new Alarm(this, 'CpuAlarm', {
        alarmName: `${name}-database-cpu`,
        alarmDescription: 'Database CPU above 80% for 15 minutes',
        metric: this.instance.metricCPUUtilization({ period: Duration.minutes(5) }),
        threshold: 80,
        evaluationPeriods: 3,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      }),
      new Alarm(this, 'StorageAlarm', {
        alarmName: `${name}-database-storage`,
        alarmDescription: 'Database free storage below 2 GiB',
        metric: this.instance.metricFreeStorageSpace({ period: Duration.minutes(5) }),
        threshold: 2 * 1024 ** 3,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.BREACHING,
      }),
    ];
  }
}
