import { Duration } from 'aws-cdk-lib';
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { Rule } from 'aws-cdk-lib/aws-events';
import { SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { prefix, type StageConfig } from '../config.ts';

/**
 * Email alerts. Infra adds the API 5xx alarm and failed-job rule; each service
 * adds its own error alarm to this topic (published as `alerts/topic-arn`).
 */
export class Alerts extends Construct {
  readonly topic: Topic;

  constructor(scope: Construct, id: string, props: { config: StageConfig; httpApi: HttpApi }) {
    super(scope, id);
    const { config, httpApi } = props;
    const name = prefix(config.stage);

    this.topic = new Topic(this, 'Topic', { topicName: `${name}-alerts`, displayName: `Catasto ${config.stage} alerts` });
    if (config.alerts.email) {
      this.topic.addSubscription(new EmailSubscription(config.alerts.email));
    }

    this.addAlarm(
      new Alarm(this, 'Api5xxAlarm', {
        alarmName: `${name}-api-5xx`,
        alarmDescription: '5 or more API 5xx responses in 5 minutes',
        metric: httpApi.metricServerError({ period: Duration.minutes(5), statistic: 'Sum' }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      }),
    );

    // Any Step Functions run in this stage that fails, times out or is aborted.
    new Rule(this, 'FailedJobRule', {
      ruleName: `${name}-failed-jobs`,
      eventPattern: {
        source: ['aws.states'],
        detailType: ['Step Functions Execution Status Change'],
        detail: {
          status: ['FAILED', 'TIMED_OUT', 'ABORTED'],
          stateMachineArn: [{ wildcard: `*:stateMachine:${name}-*` }],
        },
      },
      targets: [new SnsTopic(this.topic)],
    });
  }

  addAlarm(alarm: Alarm): void {
    alarm.addAlarmAction(new SnsAction(this.topic));
  }
}
