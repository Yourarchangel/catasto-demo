import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  ApiMapping,
  CfnStage,
  CorsHttpMethod,
  DomainName,
  HttpApi,
  HttpMethod,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Certificate, CertificateValidation, type ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayv2DomainProperties } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { join } from 'node:path';
import { prefix, type StageConfig } from '../config.ts';
import { NodeFunction } from './node-function.ts';

/** The shared HTTP API. Services add their own routes to it; infra owns only `GET /health`. */
export class Api extends Construct {
  readonly httpApi: HttpApi;
  /** The URL clients should use: the custom domain when set, otherwise execute-api. */
  readonly url: string;

  constructor(scope: Construct, id: string, config: StageConfig) {
    super(scope, id);
    const name = prefix(config.stage);
    const { api } = config;

    this.httpApi = new HttpApi(this, 'HttpApi', {
      apiName: name,
      description: `Catasto ${config.stage} API`,
      disableExecuteApiEndpoint: api.disableDefaultEndpoint,
      corsPreflight: api.corsOrigins.length
        ? {
            allowOrigins: api.corsOrigins,
            allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
            allowHeaders: ['authorization', 'content-type'],
            maxAge: Duration.days(1),
          }
        : undefined,
    });

    // Throttling and JSON access logs on the auto-deploying $default stage.
    const accessLogs = new LogGroup(this, 'AccessLogs', {
      logGroupName: `/aws/apigateway/${name}`,
      retention: config.logRetention,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const stage = this.httpApi.defaultStage!.node.defaultChild as CfnStage;
    stage.defaultRouteSettings = {
      throttlingRateLimit: api.throttle.rateLimit,
      throttlingBurstLimit: api.throttle.burstLimit,
    };
    stage.accessLogSettings = {
      destinationArn: accessLogs.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        routeKey: '$context.routeKey',
        status: '$context.status',
        latencyMs: '$context.responseLatency',
        userId: '$context.authorizer.userId',
        error: '$context.error.message',
        integrationError: '$context.integrationErrorMessage',
      }),
    };

    // GET /health: unauthenticated smoke test used after every deploy.
    const health = new NodeFunction(this, 'Health', {
      config,
      name: 'health',
      entry: join(import.meta.dirname, '../../functions/health/index.ts'),
    });
    this.httpApi.addRoutes({
      path: '/health',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('HealthIntegration', health),
    });

    this.url = api.domainName ? `https://${api.domainName}` : this.httpApi.apiEndpoint;

    if (api.domainName) {
      this.addCustomDomain(scope, config, api.domainName);
    }

    new CfnOutput(scope, 'ApiUrl', { value: this.url });
    new CfnOutput(scope, 'ApiDefaultEndpoint', { value: this.httpApi.apiEndpoint });
  }

  private addCustomDomain(scope: Construct, config: StageConfig, domainName: string): void {
    const { api } = config;
    const zone = api.hostedZone
      ? HostedZone.fromHostedZoneAttributes(this, 'Zone', { hostedZoneId: api.hostedZone.id, zoneName: api.hostedZone.name })
      : undefined;

    const certificate: ICertificate = api.certificateArn
      ? Certificate.fromCertificateArn(this, 'Certificate', api.certificateArn)
      : new Certificate(this, 'Certificate', {
          domainName,
          validation: CertificateValidation.fromDns(zone),
        });

    const domain = new DomainName(this, 'Domain', { domainName, certificate });
    new ApiMapping(this, 'Mapping', { api: this.httpApi, domainName: domain, stage: this.httpApi.defaultStage });

    if (zone) {
      new ARecord(this, 'AliasRecord', {
        zone,
        recordName: domainName,
        target: RecordTarget.fromAlias(
          new ApiGatewayv2DomainProperties(domain.regionalDomainName, domain.regionalHostedZoneId),
        ),
      });
    } else {
      new CfnOutput(scope, 'ApiCnameTarget', {
        value: domain.regionalDomainName,
        description: `Point a DNS CNAME for ${domainName} at this`,
      });
    }
  }
}
