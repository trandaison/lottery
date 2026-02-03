import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as schema from './schema';

if (!env) {
  throw new Error('Environment variables not validated. Call validateEnv() before using db.');
}

// Connection pool options to avoid "max clients reached" on Supabase free tier.
// For Supabase pooler: use Transaction mode (port 6543) in DATABASE_URL instead of
// Session mode (5432) so connections are released after each transaction.
// - max: limit connections per process (serverless = many instances × max)
// - idle_timeout: release idle connections after 20s
// - connect_timeout: fail fast
const client = postgres(env.DATABASE_URL, {
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

// Export schema for external use
export { schema };
