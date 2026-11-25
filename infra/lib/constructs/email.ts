import { CfnOutput } from 'aws-cdk-lib';
import { ConfigurationSet, EmailIdentity, Identity } from 'aws-cdk-lib/aws-ses';
import { Construct } from 'constructs';
import { prefix, type StageConfig } from '../config.ts';

/**
 * Invitation email through SES: a verified domain identity (Easy DKIM) and a
 * configuration set. DNS is manual: add the three DKIM CNAMEs printed as outputs.
 * A new SES account is in the sandbox; request production access before launch.
 */
export class Email extends Construct {
  readonly identity: EmailIdentity;
  readonly configurationSet: ConfigurationSet;
  readonly fromAddress: string;
  readonly configurationSetName: string;

  constructor(scope: Construct, id: string, config: StageConfig & { email: { domain: string; fromAddress: string } }) {
    super(scope, id);
    const { domain, fromAddress } = config.email;
    this.fromAddress = fromAddress;
    this.configurationSetName = prefix(config.stage);

    this.configurationSet = new ConfigurationSet(this, 'ConfigurationSet', {
      configurationSetName: this.configurationSetName,
    });

    this.identity = new EmailIdentity(this, 'Identity', {
      identity: Identity.domain(domain),
      configurationSet: this.configurationSet,
    });

    [
      [this.identity.dkimDnsTokenName1, this.identity.dkimDnsTokenValue1],
      [this.identity.dkimDnsTokenName2, this.identity.dkimDnsTokenValue2],
      [this.identity.dkimDnsTokenName3, this.identity.dkimDnsTokenValue3],
    ].forEach(([name, value], i) => {
      new CfnOutput(scope, `SesDkimRecord${i + 1}`, {
        value: `${name} CNAME ${value}`,
        description: `DKIM record ${i + 1} for ${domain}`,
      });
    });
  }
}
