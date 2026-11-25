import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import type { ISecurityGroup, IVpc, SubnetSelection } from 'aws-cdk-lib/aws-ec2';
import { Architecture, LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { prefix, type StageConfig } from '../config.ts';

export interface NodeFunctionProps {
  config: StageConfig;
  /** Short name; the function is called `catasto-<stage>-<name>`. */
  name: string;
  /** Path to the handler's TypeScript entry file. */
  entry: string;
  environment?: Record<string, string>;
  memorySize?: number;
  timeout?: Duration;
  /** Attach to the VPC (data Lambdas only). Omit for Lambdas that need the internet. */
  vpc?: { vpc: IVpc; subnets: SubnetSelection; securityGroup: ISecurityGroup };
  /** Extra modules esbuild should leave out of the bundle. */
  externalModules?: string[];
}

/** The shared shape for infra's own Lambdas: Node 24 on arm64, JSON logs, bundled ESM. */
export class NodeFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props: NodeFunctionProps) {
    const functionName = `${prefix(props.config.stage)}-${props.name}`;
    const logGroup = new LogGroup(scope, `${id}Logs`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: props.config.logRetention,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    super(scope, id, {
      functionName,
      entry: props.entry,
      handler: 'handler',
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: props.memorySize ?? 256,
      timeout: props.timeout ?? Duration.seconds(5),
      loggingFormat: LoggingFormat.JSON,
      logGroup,
      environment: { STAGE: props.config.stage, ...props.environment },
      vpc: props.vpc?.vpc,
      vpcSubnets: props.vpc?.subnets,
      securityGroups: props.vpc ? [props.vpc.securityGroup] : undefined,
      bundling: {
        format: OutputFormat.ESM,
        minify: true,
        sourceMap: true,
        target: 'node24',
        externalModules: ['@aws-sdk/*', ...(props.externalModules ?? [])],
        // Lets bundled CommonJS dependencies call require() inside an ES module.
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    });
  }
}
