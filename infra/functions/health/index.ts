import type { APIGatewayProxyResultV2 } from 'aws-lambda';

/** GET /health: proves the API, stage and Lambda integration work. Called after every deploy. */
export const handler = async (): Promise<APIGatewayProxyResultV2> => ({
  statusCode: 200,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify({ status: 'ok', stage: process.env.STAGE }),
});
