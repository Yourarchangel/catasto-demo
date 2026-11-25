# Catasto infra

AWS CDK app (TypeScript) for the infrastructure every Catasto backend service shares. Only production exists for now (account 364928451978, region us-east-2; the organization allows only us-east-2): one base stack, `catasto-prod-base`, and one optional deploy pipeline, `catasto-pipeline`.

The backend Lambdas are not defined here. Each service deploys separately and finds these shared pieces by name in SSM Parameter Store under `/catasto/prod/`.

```
infra/
├── bin/app.ts             entry point: which stacks exist
├── lib/
│   ├── config.ts          every per-environment value
│   ├── base-stack.ts      one environment's shared stack
│   ├── pipeline-stack.ts  the CI/CD pipeline
│   └── constructs/        building blocks used by the base stack
├── functions/             the Lambdas infra owns (login check, health, db-setup)
├── buildspecs/            what CodeBuild runs in the pipeline
├── test/                  tests that build the stacks in memory and inspect them
├── cdk.json, cdk.context.json, package.json, tsconfig.json
```

## What the base stack builds

| Construct | What it creates |
|---|---|
| `network.ts` | VPC `10.20.0.0/16` in 2 zones with **no NAT and no internet gateway**. App subnets (data Lambdas) and database subnets, all isolated. A free S3 gateway endpoint is the only way out of the app subnets. |
| `identity.ts` | Cognito user pool. Email sign-in, TOTP MFA required, no self sign-up (accounts are created when an invitation is accepted), deletion protection. A public SRP client for the Next.js app. |
| `api.ts` | HTTP API `catasto-prod` with CORS, throttling (100/s, bursts of 200), JSON access logs, `GET /health`, and an optional custom domain. |
| `authorizer.ts` | REQUEST authorizer `cognito-login`. It accepts only Cognito access tokens from the web client and passes `{ userId, username }` to services. Results are cached for 5 minutes. |
| `database.ts` | PostgreSQL 17, Multi-AZ, encrypted, TLS required, in the database subnets. Only the Lambda security group can connect. Services log in as `catasto_app` with IAM auth tokens. Admin credentials (`catasto/prod/database`) are used once, by `db-setup`. CPU and storage alarms. |
| `storage.ts` | Private, versioned, encrypted documents bucket. The browser reaches files only through signed links. |
| `email.ts` | SES domain identity and configuration set for invitations. Created only once `email.domain` is set. |
| `alerts.ts` | SNS topic `catasto-prod-alerts`, an API 5xx alarm, and a rule for failed Step Functions runs. |
| `service-deploy-access.ts` | Deploy bucket, a data boundary and an integration boundary, a CloudFormation role, and a deployer role that only `catasto-pipeline-*` roles can assume. |
| `node-function.ts` | Shared Lambda shape: Node 24, arm64, JSON logs, bundled ESM. |

## Two kinds of Lambda

Nothing in the VPC can reach the internet or any AWS API except S3. So every service Lambda is one of two kinds, and each role must carry the matching permissions boundary:

| | Data Lambda | Integration Lambda |
|---|---|---|
| Runs | In the VPC (`vpc/private-subnet-ids`, `vpc/lambda-security-group-id`) | Outside the VPC (no VPC config) |
| Boundary | `deploy/data-boundary-arn` | `deploy/integration-boundary-arn` |
| May use | The database as `catasto_app`, documents in S3, consuming SQS queues | DocuSign secret, SES, Cognito admin, documents in S3, invoking Lambdas, SQS, Step Functions |
| Cannot | Call Secrets Manager, SES, Cognito, SQS, Step Functions, other Lambdas or the internet | Attach to the VPC, connect to the database, read the admin secret |

The boundaries enforce this. Lambda refuses to put a function in a VPC unless its role can create network interfaces, and only the data boundary allows that.

**Calls go one way: from outside the VPC in.** A data Lambda never calls out. When a feature needs both sides, orchestrate it from outside:

- **Step Functions** (also usable straight from an API route): step 1 is the data Lambda, step 2 is the integration Lambda. Example: "invite": write the invite, then send the email.
- **An integration Lambda invokes a data Lambda.** Example: the DocuSign completion webhook stores the signed form in S3, then invokes a data Lambda to record it.
- **SQS**: an integration Lambda sends, and a data Lambda consumes through an event source mapping.

**Connecting from a data Lambda:** set `NODE_EXTRA_CA_CERTS=/var/runtime/ca-cert.pem` so Node trusts the RDS certificate. Generate a password-free token with `@aws-sdk/rds-signer` (`Signer.getAuthToken`, which signs locally and makes no network call). Then connect as `catasto_app` with TLS. Tokens last 15 minutes, so create one per new connection.

## Commands

```sh
npm ci
npm run typecheck
npm test
npm run synth
```

None of these need AWS access.

## Before the first deploy

Fill in the `TODO` values in `lib/config.ts`:

- `stages.prod.account`: the production account id.
- `alerts.email`: who gets alarm emails.
- `api.corsOrigins`: the web app's origin, for example `https://app.catasto.com`.
- Optional: `api.domainName` (and `certificateArn` or `hostedZone`), `email.domain` and `email.fromAddress`.

Then create the DocuSign secret by hand. The code only references it by name:

```sh
aws secretsmanager create-secret --name catasto/prod/docusign --profile catasto-prod --region us-east-2 --secret-string '{"integrationKey":"...","userId":"...","accountId":"...","privateKey":"...","connectHmacKey":"..."}'
```

## Deploy

```sh
aws sts get-caller-identity --profile catasto-prod        # confirm the account
npx cdk bootstrap aws://364928451978/us-east-2 --profile catasto-prod
npx cdk diff catasto-prod-base --profile catasto-prod
npx cdk deploy catasto-prod-base --profile catasto-prod
```

The first synth with a real account looks up availability zones and writes them to `cdk.context.json`. Commit that file so the pipeline can synth without AWS access.

After the deploy:

1. Create the app database role once. It's safe to rerun. The admin password goes straight from Secrets Manager into the invoke payload and is never logged:

   ```sh
   PASSWORD=$(aws secretsmanager get-secret-value --secret-id catasto/prod/database --query SecretString --output text --profile catasto-prod --region us-east-2 \
     | node -pe 'JSON.parse(require("fs").readFileSync(0)).password')
   aws lambda invoke --function-name catasto-prod-db-setup --cli-binary-format raw-in-base64-out \
     --payload "{\"adminPassword\":\"$PASSWORD\"}" --profile catasto-prod --region us-east-2 /dev/stdout
   unset PASSWORD
   ```

1. Confirm the SNS subscription email.
2. If a custom domain is set without a hosted zone, point a CNAME at the `ApiCnameTarget` output.
3. If email is set, add the three `SesDkimRecord*` CNAMEs, then request SES production access.
4. Configure the web app with the `UserPoolId`, `UserPoolClientId` and `ApiUrl` outputs.

## Pipeline

`bin/app.ts` adds `catasto-pipeline` only once `config.ts` has a real account id, a GitHub repo and a CodeConnections ARN. Its stages are Source → Checks → ApproveProd (manual approval, emailed) → DeployProd. Deploy updates the base stack, then deploys services through the least-privilege deployer role, then calls `/health`. The buildspecs expect this folder at `infra/` in the repository.

## Things worth knowing

- **Data is retained.** The user pool and documents bucket are retained on stack deletion. The database is snapshotted and has deletion protection. The stack has termination protection.
- **No NAT.** There is no NAT charge and no single-zone outbound path. The cost is the one-way rule above. If a data Lambda ever truly must call an AWS API, add an interface endpoint for that one service (about $7.30/mo per zone) rather than a NAT.
- **No fixed outbound IP.** Integration Lambdas leave from AWS's shared IP ranges. DocuSign doesn't need an allowlist today. A partner that requires one would need a NAT or a proxy.
- **Database roles.** `catasto_app` owns the `app` schema, so migrations can run as it too, from a data Lambda. The admin login is only for `db-setup` and emergencies.
- **Cognito email.** Cognito sends its own recovery codes with its default sender, which is limited to about 50 per day. Switch it to SES once the domain is verified.
- **No RDS Proxy.** Add one if Lambda concurrency starts to exhaust database connections.
- **Webhooks.** The DocuSign completion webhook is a route the signing service adds. It is unauthenticated at the gateway and must verify DocuSign's HMAC signature itself.
