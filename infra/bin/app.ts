import { App } from 'aws-cdk-lib';
import { BaseStack } from '../lib/base-stack.ts';
import { isAccountId, pipeline, prefix, stages } from '../lib/config.ts';
import { PipelineStack } from '../lib/pipeline-stack.ts';

const app = new App();
const prod = stages.prod;

// The base stack always exists. Until `account` is set it synthesizes account-agnostic.
new BaseStack(app, `${prefix('prod')}-base`, {
  config: prod,
  env: { account: isAccountId(prod.account) ? prod.account : undefined, region: prod.region },
  pipelineAccount: isAccountId(pipeline.account) ? pipeline.account : undefined,
});

// The pipeline exists only once real account ids and a GitHub connection are configured.
if (isAccountId(prod.account) && isAccountId(pipeline.account) && pipeline.connectionArn && pipeline.repo.owner && pipeline.repo.name) {
  new PipelineStack(app, 'catasto-pipeline', {
    env: { account: pipeline.account, region: pipeline.region },
    pipeline,
    stages: [prod],
  });
}
