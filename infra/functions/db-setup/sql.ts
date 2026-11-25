/**
 * Idempotent statements that create the app login role. Safe to run any number of times.
 *
 * The role logs in only through IAM database authentication (`rds_iam`), so data
 * Lambdas never need a password or Secrets Manager. It owns the `app` schema, so
 * migrations can run as this role too.
 */
export function setupStatements(appUser: string, database: string): string[] {
  const ident = /^[a-z_][a-z0-9_]*$/;
  if (!ident.test(appUser) || !ident.test(database)) {
    throw new Error('Role and database names must be lowercase SQL identifiers');
  }

  return [
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${appUser}') THEN
         CREATE ROLE ${appUser} LOGIN;
       END IF;
     END $$`,
    `GRANT rds_iam TO ${appUser}`,
    `GRANT CONNECT ON DATABASE ${database} TO ${appUser}`,
    // Postgres 16+: the RDS admin is not a superuser, so it must be a member of
    // the role before it can create a schema owned by it.
    `GRANT ${appUser} TO CURRENT_USER`,
    `CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION ${appUser}`,
    `ALTER ROLE ${appUser} SET search_path = app`,
  ];
}
