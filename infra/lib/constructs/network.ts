import {
  GatewayVpcEndpointAwsService,
  IpAddresses,
  SecurityGroup,
  SubnetType,
  Vpc,
  type SubnetSelection,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { prefix, type StageConfig } from '../config.ts';

/**
 * The private network. It has no NAT gateway and no internet gateway.
 * - app subnets: data Lambdas. Their only routes are the VPC itself and S3 (gateway endpoint).
 * - database subnets: RDS.
 *
 * Integration Lambdas (DocuSign, SES, Cognito admin, secrets) run outside the VPC,
 * where Lambda gives them internet access at no cost. Calls go one way only:
 * from outside the VPC in (invoke, Step Functions, SQS), never from inside out.
 */
export class Network extends Construct {
  readonly vpc: Vpc;
  readonly lambdaSecurityGroup: SecurityGroup;
  readonly appSubnets: SubnetSelection = { subnetGroupName: 'app' };
  readonly databaseSubnets: SubnetSelection = { subnetGroupName: 'database' };

  constructor(scope: Construct, id: string, config: StageConfig) {
    super(scope, id);
    const name = prefix(config.stage);

    this.vpc = new Vpc(this, 'Vpc', {
      vpcName: name,
      ipAddresses: IpAddresses.cidr(config.network.cidr),
      maxAzs: config.network.maxAzs,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'app', subnetType: SubnetType.PRIVATE_ISOLATED, cidrMask: 20 },
        { name: 'database', subnetType: SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
      // Free. The only way out of the app subnets: documents in S3.
      gatewayEndpoints: {
        s3: { service: GatewayVpcEndpointAwsService.S3, subnets: [this.appSubnets] },
      },
    });

    this.lambdaSecurityGroup = new SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `${name}-lambda`,
      description: 'Data Lambdas: outbound only (routes allow just the VPC and S3)',
      allowAllOutbound: true,
    });
  }
}
