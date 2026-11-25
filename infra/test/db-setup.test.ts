import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setupStatements } from '../functions/db-setup/sql.ts';

describe('setupStatements', () => {
  const sql = setupStatements('catasto_app', 'catasto');

  it('creates the role only if missing, so it is safe to rerun', () => {
    assert.match(sql[0], /IF NOT EXISTS \(SELECT FROM pg_roles WHERE rolname = 'catasto_app'\)/);
    assert.match(sql.join('\n'), /CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION catasto_app/);
  });

  it('makes the admin a member of the role before creating the schema it owns (Postgres 16+)', () => {
    const grant = sql.indexOf('GRANT catasto_app TO CURRENT_USER');
    const schema = sql.findIndex((s) => s.startsWith('CREATE SCHEMA'));
    assert.ok(grant >= 0 && grant < schema);
  });

  it('turns on IAM database auth for the role', () => {
    assert.ok(sql.includes('GRANT rds_iam TO catasto_app'));
  });

  it('never gives the role a password', () => {
    assert.doesNotMatch(sql.join('\n'), /PASSWORD/i);
  });

  it('rejects names that are not plain identifiers', () => {
    assert.throws(() => setupStatements("x'; DROP TABLE y; --", 'catasto'));
    assert.throws(() => setupStatements('catasto_app', 'Catasto'));
  });
});
