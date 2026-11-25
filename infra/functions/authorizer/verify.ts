import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

export interface TokenVerifierOptions {
  /** `https://cognito-idp.<region>.amazonaws.com/<userPoolId>` */
  issuer: string;
  /** App clients whose access tokens are accepted. */
  clientIds: string[];
  /** Signing keys. Defaults to the user pool's JWKS, fetched once and cached. */
  keys?: JWTVerifyGetKey;
}

export interface Caller {
  userId: string;
  username: string;
}

/**
 * Verifies a Cognito access token: RS256 signature from the pool's keys, issuer,
 * expiry, `token_use: access` (ID tokens are rejected) and an allowed `client_id`.
 * Cognito access tokens carry no `aud`; `client_id` plays that role.
 */
export function createTokenVerifier(options: TokenVerifierOptions): (token: string) => Promise<JWTPayload> {
  const keys = options.keys ?? createRemoteJWKSet(new URL(`${options.issuer}/.well-known/jwks.json`));

  return async (token) => {
    const { payload } = await jwtVerify(token, keys, { issuer: options.issuer, algorithms: ['RS256'] });
    if (payload.token_use !== 'access') throw new Error('Not an access token');
    if (typeof payload.client_id !== 'string' || !options.clientIds.includes(payload.client_id)) {
      throw new Error('Token is for another app client');
    }
    if (!payload.sub) throw new Error('Token has no subject');
    return payload;
  };
}

/** The identity passed to services as authorizer context. */
export function toCaller(payload: JWTPayload): Caller {
  return {
    userId: payload.sub!,
    username: typeof payload.username === 'string' ? payload.username : payload.sub!,
  };
}

/** Returns the token from `Bearer <token>`, or undefined for anything else. */
export function readBearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer ([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/.exec(header ?? '');
  return match?.[1];
}
