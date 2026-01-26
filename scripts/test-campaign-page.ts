import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { campaigns, campaignPrizes, tickets, orders } from '../src/db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create database client
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, {
  schema: { campaigns, campaignPrizes, tickets, orders }
});

/**
 * Test Campaign Page Data Fetching
 * 
 * This script tests:
 * 1. Fetching campaign by slug
 * 2. Getting campaign statistics
 * 3. Verifying all data needed for public page
 */
async function testCampaignPage() {
  try {
    console.log('🧪 Testing Campaign Page Data...\n');

    // Test 1: Get campaign by slug
    console.log('1️⃣ Testing campaign fetch by slug...');
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.slug, 'sample-campaign'))
      .limit(1);

    if (!campaign) {
      console.log('❌ Campaign not found! Run seed script first: npm run db:seed');
      process.exit(1);
    }

    console.log('✅ Campaign found:', {
      id: campaign.id,
      title: campaign.title,
      slug: campaign.slug,
      status: campaign.status,
      startTime: campaign.startTime,
      endTime: campaign.endTime,
      ticketPrice: campaign.ticketPrice,
    });

    // Test 2: Get campaign prizes
    console.log('\n2️⃣ Testing prizes fetch...');
    const prizes = await db
      .select()
      .from(campaignPrizes)
      .where(eq(campaignPrizes.campaignId, campaign.id));

    console.log(`✅ Found ${prizes.length} prizes`);
    prizes.forEach((prize, idx) => {
      console.log(`   Prize ${idx + 1}: ${prize.title} - ${prize.prizesCount}x - ${prize.matchingDigits} digits - ${prize.prizeValue} VND`);
    });

    // Test 3: Get statistics
    console.log('\n3️⃣ Testing statistics...');
    
    // Count tickets
    const ticketsResult = await db
      .select()
      .from(tickets)
      .where(eq(tickets.campaignId, campaign.id));
    const ticketsSold = ticketsResult.length;

    // Count unique participants
    const uniqueUsers = new Set(ticketsResult.map(t => t.userId));
    const participantsCount = uniqueUsers.size;

    // Calculate revenue
    const successOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.campaignId, campaign.id));
    
    const totalRevenue = successOrders
      .filter(o => o.paymentStatus === 'success')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    console.log('✅ Statistics:', {
      ticketsSold,
      participantsCount,
      totalRevenue,
    });

    // Test 4: Check time-based logic
    console.log('\n4️⃣ Testing time-based logic...');
    const now = new Date();
    const startTime = new Date(campaign.startTime);
    const endTime = new Date(campaign.endTime);
    const hasStarted = now >= startTime;
    const hasEnded = now >= endTime;
    const isWithinTimeRange = hasStarted && !hasEnded;

    console.log('✅ Time checks:', {
      now: now.toISOString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      hasStarted,
      hasEnded,
      isWithinTimeRange,
      canPurchase: campaign.status === 'active' && isWithinTimeRange,
    });

    // Test 5: Status-based display logic
    console.log('\n5️⃣ Testing status-based display...');
    const statusMessages = {
      active: isWithinTimeRange 
        ? '✅ Should show purchase form'
        : hasEnded 
          ? '⏰ Should show "Campaign ended" message'
          : '⏰ Should show countdown timer',
      drawing: '🎲 Should show "Campaign closed, drawing in progress" message',
      completed: '✅ Should show "Campaign completed" message',
      canceled: '❌ Should show "Campaign canceled" message',
    };

    console.log(`Status: ${campaign.status}`);
    console.log(statusMessages[campaign.status]);

    console.log('\n✅ All tests passed!\n');
    console.log('📋 Summary:');
    console.log(`   - Campaign: ${campaign.title}`);
    console.log(`   - URL: /campaigns/${campaign.slug}`);
    console.log(`   - Status: ${campaign.status}`);
    console.log(`   - Prizes: ${prizes.length}`);
    console.log(`   - Tickets Sold: ${ticketsSold}`);
    console.log(`   - Participants: ${participantsCount}`);
    console.log('\n🚀 You can now visit http://localhost:3000/campaigns/sample-campaign\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testCampaignPage();
