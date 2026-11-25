import { RetentionDays } from 'aws-cdk-lib/aws-logs';

/**
 * Every per-environment value lives here. Only production exists for now; add a
 * `test` entry to `stages` (and to `StageName`) when a second environment is needed.
 */

export type StageName = 'prod';

export interface StageConfig {
  stage: StageName;
  /** 12-digit AWS account id. Leave empty until known: the stack then synthesizes account-agnostic. */
  account: string;
  region: string;
  /** Deletion guard for the base stack. */
  terminationProtection: boolean;

  /**
   * No NAT and no internet gateway. Lambdas in the VPC ("data" Lambdas) reach only
   * the database and S3 (gateway endpoint). Everything that calls the internet or
   * other AWS APIs runs outside the VPC ("integration" Lambdas).
   */
  network: {
    cidr: string;
    maxAzs: number;
  };

  api: {
    /** Custom domain, e.g. `api.catasto.com`. Leave undefined to use only the execute-api URL. */
    domainName?: string;
    /** Existing ACM certificate for `domainName` (same region). If unset, a DNS-validated one is created. */
    certificateArn?: string;
    /** Route 53 zone for `domainName`. Without it, point a CNAME at the `ApiCnameTarget` output by hand. */
    hostedZone?: { id: string; name: string };
    disableDefaultEndpoint: boolean;
    /** Origins (the Next.js app) allowed to call the API and to use signed S3 links. */
    corsOrigins: string[];
    throttle: { rateLimit: number; burstLimit: number };
  };

  identity: {
    /** Lifetime of access and ID tokens, in minutes (5 to 1440). */
    accessTokenMinutes: number;
    /** Lifetime of refresh tokens, in hours. */
    refreshTokenHours: number;
  };

  authorizer: {
    /** How long API Gateway caches a yes/no answer for one Authorization header. */
    cacheTtlSeconds: number;
  };

  database: {
    /** RDS instance class and size, e.g. `t4g.small`. */
    instanceType: string;
    multiAz: boolean;
    allocatedStorageGb: number;
    maxAllocatedStorageGb: number;
    backupRetentionDays: number;
    /** Secrets Manager name for the generated admin credentials. Used only by the one-time db-setup. */
    secretName: string;
    /** Login role services use, through IAM database authentication (no password). */
    appUser: string;
  };

  storage: {
    /** Delete incomplete multipart uploads after this many days. */
    abortIncompleteUploadDays: number;
  };

  email: {
    /** Domain verified in SES for invitations, e.g. `catasto.com`. Leave undefined until DNS is ready. */
    domain?: string;
    /** Sender for invitations, e.g. `no-reply@catasto.com`. Must be on `domain`. */
    fromAddress?: string;
  };

  docusign: {
    /** Hand-made secret holding the integration key, user id, account id, RSA key and Connect HMAC key. */
    secretName: string;
    /** `account.docusign.com` for production, `account-d.docusign.com` for the developer sandbox. */
    oauthHost: string;
  };

  alerts: {
    /** Who gets alarm emails. Leave empty to create the topic with no subscription. */
    email: string;
  };

  logRetention: RetentionDays;
}

export const stages: Record<StageName, StageConfig> = {
  prod: {
    stage: 'prod',
    account: '364928451978',
    // The organization's SCP (p-7s1atk2e) allows full access only in us-east-2.
    region: 'us-east-2',
    terminationProtection: true,

    network: {
      cidr: '10.20.0.0/16',
      maxAzs: 2,
    },

    api: {
      domainName: undefined, // TODO: e.g. 'api.catasto.com'
      certificateArn: undefined,
      hostedZone: undefined,
      disableDefaultEndpoint: false,
      corsOrigins: [], // TODO: e.g. ['https://app.catasto.com']
      throttle: { rateLimit: 100, burstLimit: 200 },
    },

    identity: {
      accessTokenMinutes: 60,
      refreshTokenHours: 12,
    },

    authorizer: {
      cacheTtlSeconds: 300,
    },

    database: {
      // Pilot size. Move to 't4g.small' when CPU credits run low or memory stays under ~100 MB.
      instanceType: 't4g.micro',
      multiAz: true,
      allocatedStorageGb: 20,
      maxAllocatedStorageGb: 100,
      backupRetentionDays: 14,
      secretName: 'catasto/prod/database',
      appUser: 'catasto_app',
    },

    storage: {
      abortIncompleteUploadDays: 7,
    },

    email: {
      domain: undefined, // TODO: e.g. 'catasto.com'
      fromAddress: undefined, // TODO: e.g. 'no-reply@catasto.com'
    },

    docusign: {
      secretName: 'catasto/prod/docusign',
      oauthHost: 'account.docusign.com',
    },

    alerts: {
      email: 'parthghanshyambhaip@smu.edu',
    },

    logRetention: RetentionDays.ONE_MONTH,
  },
};

export interface PipelineConfig {
  /** Account the pipeline runs in. Defaults to the production account. */
  account: string;
  region: string;
  repo: { owner: string; name: string; branch: string };
  /** CodeConnections (CodeStar) ARN for GitHub. The pipeline stack is created only once this is set. */
  connectionArn: string;
  /** Who approves production deploys and hears about failed runs. */
  notificationEmail: string;
}

export const pipeline: PipelineConfig = {
  account: stages.prod.account,
  region: stages.prod.region,
  repo: { owner: '', name: '', branch: 'main' }, // TODO: GitHub repo holding infra/
  connectionArn: '', // TODO: arn:aws:codeconnections:<region>:<account>:connection/<id>
  notificationEmail: '', // TODO
};

/** `catasto-<stage>`: the prefix for every named resource in a stage. */
export const prefix = (stage: StageName): string => `catasto-${stage}`;

/** `/catasto/<stage>/<name>`: where shared ids are published for services. */
export const paramPath = (stage: StageName, name: string): string => `/catasto/${stage}/${name}`;

/** Cognito issuer URL for a user pool. */
export const cognitoIssuer = (region: string, userPoolId: string): string =>
  `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

export const isAccountId = (value: string): boolean => /^\d{12}$/.test(value);
