import { Duration, Stack } from 'aws-cdk-lib';
import {
  AuthorizerPayloadVersion,
  HttpApi,
  HttpAuthorizer,
  HttpAuthorizerType,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { join } from 'node:path';
import type { StageConfig } from '../config.ts';
import { NodeFunction } from './node-function.ts';

export interface AuthorizerProps {
  config: StageConfig;
  httpApi: HttpApi;
  userPool: UserPool;
  webClient: UserPoolClient;
}

/**
 * The login check: a REQUEST authorizer named `cognito-login` that accepts only
 * Cognito *access* tokens from the web client and answers "who is this".
 * Household, role and consent checks happen in each service.
 *
 * Declared low-level (HttpAuthorizer) so its id exists up front and can be
 * published for the separately deployed services.
 */
export class Authorizer extends Construct {
  readonly authorizer: HttpAuthorizer;

  constructor(scope: Construct, id: string, props: AuthorizerProps) {
    super(scope, id);
    const { config, httpApi, userPool, webClient } = props;

    const fn = new NodeFunction(this, 'Function', {
      config,
      name: 'authorizer',
      entry: join(import.meta.dirname, '../../functions/authorizer/index.ts'),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: webClient.userPoolClientId,
      },
    });

    this.authorizer = new HttpAuthorizer(this, 'Authorizer', {
      authorizerName: 'cognito-login',
      httpApi,
      type: HttpAuthorizerType.LAMBDA,
      identitySource: ['$request.header.Authorization'],
      enableSimpleResponses: true,
      payloadFormatVersion: AuthorizerPayloadVersion.VERSION_2_0,
      resultsCacheTtl: Duration.seconds(config.authorizer.cacheTtlSeconds),
      authorizerUri: `arn:${Stack.of(this).partition}:apigateway:${Stack.of(this).region}:lambda:path/2015-03-31/functions/${fn.functionArn}/invocations`,
    });

    fn.addPermission('ApiGatewayInvoke', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: Stack.of(this).formatArn({
        service: 'execute-api',
        resource: httpApi.apiId,
        resourceName: `authorizers/${this.authorizer.authorizerId}`,
      }),
    });
  }
}
