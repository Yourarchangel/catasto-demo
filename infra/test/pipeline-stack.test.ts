import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { pipeline, stages } from '../lib/config.ts';
import { PipelineStack } from '../lib/pipeline-stack.ts';

const account = '111111111111';
const prod = { ...stages.prod, account };
const stack = new PipelineStack(new App(), 'catasto-pipeline', {
  env: { account, region: prod.region },
  pipeline: {
    ...pipeline,
    account,
    repo: { owner: 'example', name: 'catasto', branch: 'main' },
    connectionArn: `arn:aws:codeconnections:${prod.region}:${account}:connection/abc`,
    notificationEmail: 'ops@example.com',
  },
  stages: [prod],
});
const template = Template.fromStack(stack);

describe('pipeline', () => {
  it('runs Source, Checks, then prod behind a manual approval', () => {
    const [pipe] = Object.values(template.findResources('AWS::CodePipeline::Pipeline'));
    const names = pipe.Properties.Stages.map((s: { Name: string }) => s.Name);
    assert.deepEqual(names, ['Source', 'Checks', 'ApproveProd', 'DeployProd']);
    const approve = pipe.Properties.Stages[2].Actions[0];
    assert.equal(approve.ActionTypeId.Category, 'Approval');
    assert.equal(pipe.Properties.PipelineType, 'V2');
  });

  it('lets the deploy project assume exactly the three expected roles', () => {
    const roles = template.findResources('AWS::IAM::Role', { Properties: { RoleName: 'catasto-pipeline-deploy' } });
    const roleId = Object.keys(roles)[0];
    const policies = Object.values(template.findResources('AWS::IAM::Policy')).filter((p) =>
      JSON.stringify(p.Properties.Roles).includes(roleId),
    );
    const assume = policies
      .flatMap((p) => p.Properties.PolicyDocument.Statement)
      .filter((s: { Action: string | string[] }) => [s.Action].flat().includes('sts:AssumeRole'));
    const resources = assume.flatMap((s: { Resource: unknown }) => [s.Resource].flat()).map((r) => JSON.stringify(r));
    assert.equal(resources.length, 3);
    assert.ok(resources.some((r) => r.includes(`cdk-hnb659fds-deploy-role-${account}-${prod.region}`)));
    assert.ok(resources.some((r) => r.includes(`cdk-hnb659fds-file-publishing-role-${account}-${prod.region}`)));
    assert.ok(resources.some((r) => r.includes('catasto-prod-service-deployer')));
  });

  it('emails the notification topic when a run fails', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: { detail: { state: ['FAILED'] } },
    });
    template.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email', Endpoint: 'ops@example.com' });
  });
});
