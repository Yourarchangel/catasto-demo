import type { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerWithContextResult } from 'aws-lambda';
import { createTokenVerifier, readBearerToken, toCaller, type Caller } from './verify.ts';

const region = process.env.AWS_REGION!;
const userPoolId = process.env.USER_POOL_ID!;

// Created once per container: the JWKS is fetched on first use and reused.
const verify = createTokenVerifier({
  issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  clientIds: [process.env.USER_POOL_CLIENT_ID!],
});

/** Answers only "who is this". Household, role and consent checks happen in each service. */
export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2,
): Promise<APIGatewaySimpleAuthorizerWithContextResult<Caller | Record<string, never>>> => {
  const token = readBearerToken(event.headers?.authorization);
  if (!token) return { isAuthorized: false, context: {} };

  try {
    const payload = await verify(token);
    return { isAuthorized: true, context: toCaller(payload) };
  } catch (error) {
    // Log only the reason, never the token.
    console.warn(JSON.stringify({ message: 'Token rejected', reason: (error as Error).message }));
    return { isAuthorized: false, context: {} };
  }
};
