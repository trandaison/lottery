import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as schema from './schema';

if (!env) {
  throw new Error('Environment variables not validated. Call validateEnv() before using db.');
}
// Create PostgreSQL connection
const client = postgres(env.DATABASE_URL);

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

// Export schema for external use
export { schema };
