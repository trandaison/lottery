import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/config/env';

// Create PostgreSQL connection
const client = postgres(env.DATABASE_URL);

// Create Drizzle instance
export const db = drizzle(client);
