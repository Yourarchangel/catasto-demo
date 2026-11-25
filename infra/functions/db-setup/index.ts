import pg from 'pg';
import { setupStatements } from './sql.ts';

/**
 * One-time database setup, run inside the VPC.
 *
 * Data Lambdas cannot reach Secrets Manager, so the caller (an operator, outside
 * the VPC) reads the admin password and passes it in the event. It is used for this
 * one connection only and never logged.
 */
export const handler = async (event: { adminPassword?: string }): Promise<{ ok: true; appUser: string }> => {
  if (!event?.adminPassword) throw new Error('adminPassword is required');

  const appUser = process.env.APP_USER!;
  const database = process.env.DB_NAME!;
  const client = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database,
    user: process.env.ADMIN_USER,
    password: event.adminPassword,
    // NODE_EXTRA_CA_CERTS points Node at the Lambda runtime's bundle, which includes the RDS CAs.
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 5000,
  });

  await client.connect();
  try {
    for (const statement of setupStatements(appUser, database)) {
      await client.query(statement);
    }
  } finally {
    await client.end();
  }
  console.log(JSON.stringify({ message: 'Database setup complete', appUser }));
  return { ok: true, appUser };
};
