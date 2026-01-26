import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local' });

const client = postgres(process.env.DATABASE_URL!);

async function verify() {
  try {
    console.log('🔍 Verifying database schema...\n');

    // List all tables
    const tables = await client`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('📋 Tables:');
    tables.forEach((table) => {
      console.log(`  ✓ ${table.table_name}`);
    });

    // Check admin user
    console.log('\n👤 Admin User:');
    const [admin] = await client`
      SELECT id, uuid, email, name, role, status, created_at
      FROM users
      WHERE role = 'admin'
      LIMIT 1
    `;
    console.log(`  ID: ${admin.id} (BIGSERIAL)`);
    console.log(`  UUID: ${admin.uuid}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Name: ${admin.name}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`  Status: ${admin.status}`);

    // Check sample campaign
    console.log('\n🎯 Sample Campaign:');
    const [campaign] = await client`
      SELECT id, uuid, title, slug, status, ticket_price, start_time, end_time
      FROM campaigns
      LIMIT 1
    `;
    console.log(`  ID: ${campaign.id} (BIGSERIAL)`);
    console.log(`  UUID: ${campaign.uuid}`);
    console.log(`  Title: ${campaign.title}`);
    console.log(`  Slug: ${campaign.slug}`);
    console.log(`  Status: ${campaign.status}`);
    console.log(`  Ticket Price: ${campaign.ticket_price} VND`);

    // Check prizes
    console.log('\n🏆 Campaign Prizes:');
    const prizes = await client`
      SELECT id, title, prizes_count, matching_digits, prize_value
      FROM campaign_prizes
      WHERE campaign_id = ${campaign.id}
      ORDER BY matching_digits DESC
    `;
    prizes.forEach((prize) => {
      console.log(`  • ${prize.title}: ${prize.prizes_count}x prizes, ${prize.matching_digits} digits, ${prize.prize_value} VND`);
    });

    // Verify indexes
    console.log('\n📊 Indexes:');
    const indexes = await client`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `;
    const groupedIndexes = indexes.reduce((acc, idx) => {
      if (!acc[idx.tablename]) acc[idx.tablename] = [];
      acc[idx.tablename].push(idx.indexname);
      return acc;
    }, {} as Record<string, string[]>);

    Object.entries(groupedIndexes).forEach(([table, idxList]) => {
      console.log(`  ${table}: ${idxList.length} indexes`);
      idxList.forEach(idx => console.log(`    - ${idx}`));
    });

    console.log('\n✅ Database verification complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verify();
