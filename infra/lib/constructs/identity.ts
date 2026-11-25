import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  AccountRecovery,
  FeaturePlan,
  Mfa,
  UserPool,
  UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { prefix, type StageConfig } from '../config.ts';

/**
 * Sign-in and MFA. Accounts are created by the backend when someone accepts an
 * invitation (AdminCreateUser), never by self sign-up. TOTP MFA is required for everyone.
 */
export class Identity extends Construct {
  readonly userPool: UserPool;
  readonly webClient: UserPoolClient;

  constructor(scope: Construct, id: string, config: StageConfig) {
    super(scope, id);
    const name = prefix(config.stage);

    this.userPool = new UserPool(this, 'UserPool', {
      userPoolName: `${name}-users`,
      featurePlan: FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      mfa: Mfa.REQUIRED,
      mfaSecondFactor: { otp: true, sms: false },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: Duration.days(3),
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Public client for the Next.js app: SRP sign-in, no client secret, revocable refresh tokens.
    this.webClient = this.userPool.addClient('WebClient', {
      userPoolClientName: `${name}-web`,
      generateSecret: false,
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.minutes(config.identity.accessTokenMinutes),
      idTokenValidity: Duration.minutes(config.identity.accessTokenMinutes),
      refreshTokenValidity: Duration.hours(config.identity.refreshTokenHours),
    });

    new CfnOutput(scope, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(scope, 'UserPoolClientId', { value: this.webClient.userPoolClientId });
  }
}
