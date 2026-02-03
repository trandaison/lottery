/**
 * Ensure database is reachable (e.g. before migrate/seed on deploy).
 * Exits 0 if SELECT 1 succeeds, 1 otherwise.
 */
import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

async function ensure() {
  const sql = postgres(url!, { max: 1 });
  try {
    await sql`SELECT 1 as ok`;
    console.log('✅ Database connection OK');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

ensure();
