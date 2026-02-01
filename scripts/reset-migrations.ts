import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function resetMigrations() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  try {
    console.log('🔄 Resetting migrations...\n');

    // Drop all tables in public schema
    console.log('📋 Dropping all tables...');
    await db.execute(
      sql`DROP SCHEMA IF EXISTS public CASCADE`
    );
    
    // Recreate schema (PostgreSQL will automatically grant permissions to the owner)
    await db.execute(
      sql`CREATE SCHEMA public`
    );
    
    // Grant usage to public role (standard PostgreSQL practice)
    await db.execute(
      sql`GRANT USAGE ON SCHEMA public TO public`
    );
    
    console.log('✅ All tables dropped\n');

    console.log('✅ Database reset successfully!');
    console.log('💡 Run "npm run db:migrate" to apply migrations again.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting migrations:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetMigrations();
