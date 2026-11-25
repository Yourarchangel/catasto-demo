import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWTPayload } from 'jose';
import { createTokenVerifier, readBearerToken, toCaller } from '../functions/authorizer/verify.ts';

const issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool';
const clientId = 'web-client-id';

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let verify: ReturnType<typeof createTokenVerifier>;

const sign = (claims: JWTPayload, opts: { key?: CryptoKey; iss?: string; exp?: string | number } = {}) =>
  new SignJWT({ token_use: 'access', client_id: clientId, username: 'user-1', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('user-1-sub')
    .setIssuer(opts.iss ?? issuer)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '5m')
    .sign(opts.key ?? signingKey);

before(async () => {
  const pair = await generateKeyPair('RS256');
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair('RS256')).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  verify = createTokenVerifier({ issuer, clientIds: [clientId], keys: createLocalJWKSet({ keys: [jwk] }) });
});

describe('createTokenVerifier', () => {
  it('accepts a valid access token from the web client', async () => {
    const payload = await verify(await sign({}));
    assert.equal(payload.sub, 'user-1-sub');
  });

  it('rejects an ID token', async () => {
    await assert.rejects(verify(await sign({ token_use: 'id', aud: clientId })), /Not an access token/);
  });

  it('rejects a token for another app client', async () => {
    await assert.rejects(verify(await sign({ client_id: 'someone-else' })), /another app client/);
  });

  it('rejects an expired token', async () => {
    await assert.rejects(verify(await sign({}, { exp: Math.floor(Date.now() / 1000) - 60 })), /exp/);
  });

  it('rejects a token from another user pool', async () => {
    await assert.rejects(verify(await sign({}, { iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Other' })), /iss/);
  });

  it('rejects a token signed with a key the pool does not publish', async () => {
    await assert.rejects(verify(await sign({}, { key: otherKey })), /signature/);
  });

  it('rejects a shared-secret (HS256) token', async () => {
    const token = await new SignJWT({ token_use: 'access', client_id: clientId })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
      .setSubject('x')
      .setIssuer(issuer)
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('a-shared-secret-of-sufficient-length!!'));
    await assert.rejects(verify(token));
  });
});

describe('toCaller', () => {
  it('maps sub and username', () => {
    assert.deepEqual(toCaller({ sub: 'abc', username: 'jane' }), { userId: 'abc', username: 'jane' });
  });

  it('falls back to sub when username is missing', () => {
    assert.deepEqual(toCaller({ sub: 'abc' }), { userId: 'abc', username: 'abc' });
  });
});

describe('readBearerToken', () => {
  it('accepts only a well-formed Bearer header', () => {
    assert.equal(readBearerToken('Bearer aaa.bbb.ccc'), 'aaa.bbb.ccc');
    assert.equal(readBearerToken('bearer aaa.bbb.ccc'), undefined);
    assert.equal(readBearerToken('Basic dXNlcjpwYXNz'), undefined);
    assert.equal(readBearerToken('Bearer not-a-jwt'), undefined);
    assert.equal(readBearerToken('Bearer aaa.bbb.ccc extra'), undefined);
    assert.equal(readBearerToken(undefined), undefined);
  });
});
