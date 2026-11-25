import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  ObjectOwnership,
} from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { prefix, type StageConfig } from '../config.ts';

/**
 * The private documents bucket: household files and signed forms.
 * Never public. The browser reaches objects only through short-lived signed links
 * the backend issues after checking consent.
 */
export class Storage extends Construct {
  readonly documents: Bucket;

  constructor(scope: Construct, id: string, config: StageConfig) {
    super(scope, id);
    const { account } = Stack.of(this);

    this.documents = new Bucket(this, 'Documents', {
      bucketName: `${prefix(config.stage)}-documents-${account}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      minimumTLSVersion: 1.2,
      versioned: true,
      lifecycleRules: [
        { abortIncompleteMultipartUploadAfter: Duration.days(config.storage.abortIncompleteUploadDays) },
      ],
      // Signed links are used straight from the browser (GET to open, PUT to upload).
      cors: config.api.corsOrigins.length
        ? [
            {
              allowedOrigins: config.api.corsOrigins,
              allowedMethods: [HttpMethods.GET, HttpMethods.PUT],
              allowedHeaders: ['content-type'],
              maxAge: 3600,
            },
          ]
        : undefined,
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
