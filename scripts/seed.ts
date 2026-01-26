import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

// Import schema after env is loaded
import { users, campaigns, campaignPrizes } from '../src/db/schema';

// Create database client directly without env validation
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { 
  schema: { users, campaigns, campaignPrizes } 
});

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    // Check if admin user already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@company.com'))
      .limit(1);

    if (existingAdmin.length === 0) {
      // Hash password with bcrypt (salt rounds = 10)
      const passwordHash = await bcrypt.hash('password123', 10);

      // Create admin user
      const [admin] = await db
        .insert(users)
        .values({
          email: 'admin@company.com',
          name: 'Admin User',
          role: 'admin',
          status: 'active',
          passwordDigest: passwordHash,
          phone: '0901234567',
        })
        .returning();

      console.log('✅ Admin user created:', {
        id: admin.id,
        uuid: admin.uuid,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      });
    } else {
      console.log('ℹ️  Admin user already exists, skipping...');
    }

    // Optional: Create a sample campaign for testing
    const existingCampaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.slug, 'sample-campaign'))
      .limit(1);

    if (existingCampaign.length === 0) {
      const now = new Date();
      const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
      const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Next week

      const [campaign] = await db
        .insert(campaigns)
        .values({
          title: 'Sample Campaign',
          slug: 'sample-campaign',
          description: 'This is a sample campaign for testing purposes.',
          startTime,
          endTime,
          ticketPrice: 10000, // 10,000 VND
          paymentType: 'direct',
          status: 'active',
          excludeWinningNumbers: true,
        })
        .returning();

      console.log('✅ Sample campaign created:', {
        id: campaign.id,
        uuid: campaign.uuid,
        title: campaign.title,
        slug: campaign.slug,
      });

      // Create sample prizes for the campaign
      const prizes = await db
        .insert(campaignPrizes)
        .values([
          {
            campaignId: campaign.id,
            title: 'First Prize',
            prizesCount: 1,
            matchingDigits: 6,
            prizeValue: 1000000, // 1,000,000 VND
          },
          {
            campaignId: campaign.id,
            title: 'Second Prize',
            prizesCount: 2,
            matchingDigits: 5,
            prizeValue: 500000, // 500,000 VND
          },
          {
            campaignId: campaign.id,
            title: 'Third Prize',
            prizesCount: 5,
            matchingDigits: 4,
            prizeValue: 200000, // 200,000 VND
          },
          {
            campaignId: campaign.id,
            title: 'Consolation Prize',
            prizesCount: 10,
            matchingDigits: 3,
            prizeValue: 50000, // 50,000 VND
          },
        ])
        .returning();

      console.log(`✅ Created ${prizes.length} prizes for sample campaign`);
    } else {
      console.log('ℹ️  Sample campaign already exists, skipping...');
    }

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📝 Admin credentials:');
    console.log('   Email: admin@company.com');
    console.log('   Password: password123');
    console.log('\n⚠️  Remember to change the admin password in production!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
