import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { campaigns, campaignPrizes } from '../src/db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create database client
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, {
  schema: { campaigns, campaignPrizes }
});

/**
 * Create Test Campaigns
 *
 * Creates campaigns with different statuses and time ranges for testing:
 * 1. Active campaign (ongoing) - within time range
 * 2. Active campaign (not started) - countdown timer
 * 3. Active campaign (ended) - ended message
 * 4. Drawing campaign
 * 5. Completed campaign
 * 6. Canceled campaign
 */
async function createTestCampaigns() {
  try {
    console.log('🧪 Creating Test Campaigns...\n');

    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneHourMs = 60 * 60 * 1000;

    const testCampaigns = [
      {
        slug: 'active-ongoing',
        title: 'Campaign Đang Diễn Ra',
        description: `# Campaign Đang Diễn Ra

Đây là campaign đang trong thời gian mua vé. Bạn có thể mua vé ngay bây giờ!

## Thông tin chi tiết

- **Thời gian**: Đang diễn ra
- **Trạng thái**: Active
- **Form mua vé**: Hiển thị

## Cách tham gia

1. Chọn số lượng vé muốn mua
2. Điền thông tin cá nhân
3. Thanh toán và nhận vé`,
        startTime: new Date(now.getTime() - oneDayMs), // Started yesterday
        endTime: new Date(now.getTime() + 5 * oneDayMs), // Ends in 5 days
        status: 'active' as const,
      },
      {
        slug: 'active-not-started',
        title: 'Campaign Chưa Bắt Đầu',
        description: 'Campaign này sẽ bắt đầu trong tương lai. Vui lòng chờ countdown!',
        startTime: new Date(now.getTime() + 2 * oneDayMs), // Starts in 2 days
        endTime: new Date(now.getTime() + 7 * oneDayMs), // Ends in 7 days
        status: 'active' as const,
      },
      {
        slug: 'active-ended',
        title: 'Campaign Đã Kết Thúc Mua Vé',
        description: 'Campaign này đã kết thúc thời gian mua vé.',
        startTime: new Date(now.getTime() - 7 * oneDayMs), // Started 7 days ago
        endTime: new Date(now.getTime() - oneHourMs), // Ended 1 hour ago
        status: 'active' as const,
      },
      {
        slug: 'drawing-campaign',
        title: 'Campaign Đang Quay Số',
        description: 'Campaign này đang trong quá trình quay số. Vui lòng theo dõi kết quả!',
        startTime: new Date(now.getTime() - 7 * oneDayMs),
        endTime: new Date(now.getTime() - oneDayMs),
        status: 'drawing' as const,
      },
      {
        slug: 'completed-campaign',
        title: 'Campaign Đã Hoàn Thành',
        description: 'Campaign này đã hoàn thành và công bố kết quả.',
        startTime: new Date(now.getTime() - 14 * oneDayMs),
        endTime: new Date(now.getTime() - 7 * oneDayMs),
        status: 'completed' as const,
      },
      {
        slug: 'canceled-campaign',
        title: 'Campaign Đã Bị Hủy',
        description: 'Campaign này đã bị hủy bởi admin.',
        startTime: new Date(now.getTime() - oneDayMs),
        endTime: new Date(now.getTime() + 5 * oneDayMs),
        status: 'canceled' as const,
        canceledAt: new Date(now.getTime() - oneHourMs),
      },
    ];

    const createdCampaigns = [];

    for (const campaignData of testCampaigns) {
      // Check if campaign already exists
      const existing = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.slug, campaignData.slug))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  Campaign "${campaignData.title}" already exists, skipping...`);
        createdCampaigns.push(existing[0]);
        continue;
      }

      // Create campaign
      const [campaign] = await db
        .insert(campaigns)
        .values({
          title: campaignData.title,
          slug: campaignData.slug,
          description: campaignData.description,
          startTime: campaignData.startTime,
          endTime: campaignData.endTime,
          ticketPrice: 20000, // 20,000 VND
          paymentType: 'direct',
          status: campaignData.status,
          excludeWinningNumbers: true,
          canceledAt: campaignData.canceledAt || null,
        })
        .returning();

      console.log(`✅ Created campaign: ${campaign.title} (${campaign.slug})`);

      // Create prizes for each campaign
      await db
        .insert(campaignPrizes)
        .values([
          {
            campaignId: campaign.id,
            title: 'Giải Nhất',
            prizesCount: 1,
            matchingDigits: 6,
            prizeValue: '5000000',
          },
          {
            campaignId: campaign.id,
            title: 'Giải Nhì',
            prizesCount: 3,
            matchingDigits: 5,
            prizeValue: '1000000',
          },
          {
            campaignId: campaign.id,
            title: 'Giải Ba',
            prizesCount: 10,
            matchingDigits: 4,
            prizeValue: '200000',
          },
        ]);

      createdCampaigns.push(campaign);
    }

    console.log('\n✅ Test campaigns created successfully!\n');
    console.log('📋 Test URLs:');
    createdCampaigns.forEach((c) => {
      console.log(`   http://localhost:3000/campaigns/${c.slug}`);
    });
    console.log('\n🎯 Test Cases:');
    console.log('   1. Active (ongoing)     → Should show purchase form');
    console.log('   2. Active (not started) → Should show countdown timer');
    console.log('   3. Active (ended)       → Should show "Campaign ended" message');
    console.log('   4. Drawing              → Should show "Drawing in progress" message');
    console.log('   5. Completed            → Should show "Campaign completed" message');
    console.log('   6. Canceled             → Should show "Campaign canceled" message');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test campaigns:', error);
    process.exit(1);
  }
}

createTestCampaigns();
