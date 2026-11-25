import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import {
  BuildEnvironmentVariableType,
  BuildSpec,
  Cache,
  LinuxBuildImage,
  LocalCacheMode,
  PipelineProject,
} from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline, PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import {
  CodeBuildAction,
  CodeStarConnectionsSourceAction,
  ManualApprovalAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import { SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { prefix, type PipelineConfig, type StageConfig } from './config.ts';

export interface PipelineStackProps extends StackProps {
  pipeline: PipelineConfig;
  /** Stages deployed in order. Prod always waits for a manual approval first. */
  stages: StageConfig[];
}

/** CI/CD: Source → Checks → (per stage: approval for prod → Deploy). */
export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, { ...props, description: 'Catasto CI/CD pipeline' });
    const { pipeline: cfg } = props;

    const notifications = new Topic(this, 'Notifications', { topicName: 'catasto-pipeline-notifications' });
    if (cfg.notificationEmail) {
      notifications.addSubscription(new EmailSubscription(cfg.notificationEmail));
    }

    const useConnection = new PolicyStatement({
      actions: ['codeconnections:UseConnection', 'codestar-connections:UseConnection'],
      resources: [cfg.connectionArn],
    });

    const project = (name: string, buildspec: string, role: Role) =>
      new PipelineProject(this, `${name}Project`, {
        projectName: `catasto-${name.toLowerCase()}`,
        role,
        buildSpec: BuildSpec.fromSourceFilename(`infra/buildspecs/${buildspec}`),
        environment: { buildImage: LinuxBuildImage.STANDARD_7_0 },
        cache: Cache.local(LocalCacheMode.SOURCE, LocalCacheMode.CUSTOM),
        timeout: Duration.minutes(30),
      });

    // ---- Checks ----
    const checksRole = new Role(this, 'ChecksRole', {
      roleName: 'catasto-pipeline-checks',
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
    });
    checksRole.addToPolicy(useConnection);
    const checks = project('Checks', 'checks.yml', checksRole);

    // ---- Deploy: may only assume each stage's CDK bootstrap roles and its service-deployer ----
    const deployRole = new Role(this, 'DeployRole', {
      roleName: 'catasto-pipeline-deploy',
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
    });
    deployRole.addToPolicy(useConnection);
    deployRole.addToPolicy(
      new PolicyStatement({
        sid: 'AssumeStageRoles',
        actions: ['sts:AssumeRole', 'sts:TagSession'],
        resources: props.stages.flatMap((s) => {
          const role = (name: string) => `arn:${this.partition}:iam::${s.account}:role/${name}`;
          return [
            role(`cdk-hnb659fds-deploy-role-${s.account}-${s.region}`),
            role(`cdk-hnb659fds-file-publishing-role-${s.account}-${s.region}`),
            role(`${prefix(s.stage)}-service-deployer`),
          ];
        }),
      }),
    );
    const deploy = project('Deploy', 'deploy.yml', deployRole);

    // ---- Pipeline ----
    const source = new Artifact('Source');
    const pipeline = new Pipeline(this, 'Pipeline', {
      pipelineName: 'catasto-backend',
      pipelineType: PipelineType.V2,
      restartExecutionOnUpdate: false,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new CodeStarConnectionsSourceAction({
              actionName: 'GitHub',
              connectionArn: cfg.connectionArn,
              owner: cfg.repo.owner,
              repo: cfg.repo.name,
              branch: cfg.repo.branch,
              output: source,
              codeBuildCloneOutput: true, // full clone so the deploy step can diff commits
            }),
          ],
        },
        {
          stageName: 'Checks',
          actions: [new CodeBuildAction({ actionName: 'Checks', project: checks, input: source })],
        },
      ],
    });

    for (const stage of props.stages) {
      const title = stage.stage[0].toUpperCase() + stage.stage.slice(1);
      if (stage.stage === 'prod') {
        pipeline.addStage({
          stageName: `Approve${title}`,
          actions: [
            new ManualApprovalAction({
              actionName: 'Approve',
              notificationTopic: notifications,
              additionalInformation: `Deploy to ${prefix(stage.stage)}?`,
            }),
          ],
        });
      }
      pipeline.addStage({
        stageName: `Deploy${title}`,
        actions: [
          new CodeBuildAction({
            actionName: 'Deploy',
            project: deploy,
            input: source,
            environmentVariables: {
              STAGE: { value: stage.stage, type: BuildEnvironmentVariableType.PLAINTEXT },
              ACCOUNT: { value: stage.account, type: BuildEnvironmentVariableType.PLAINTEXT },
              REGION: { value: stage.region, type: BuildEnvironmentVariableType.PLAINTEXT },
            },
          }),
        ],
      });
    }

    pipeline.onStateChange('FailedRun', {
      eventPattern: { detail: { state: ['FAILED'] } },
      target: new SnsTopic(notifications),
    });
  }
}
