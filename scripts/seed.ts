import { db } from '../src/db';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    // TODO: Add seed data in Phase 1 when schema is created
    // Example:
    // await db.insert(users).values({
    //   email: 'admin@company.com',
    //   name: 'Admin User',
    //   role: 'admin',
    //   status: 'active',
    //   password_digest: await bcrypt.hash('password123', 10),
    // });

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
