#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(__dirname, '../.env.local') });

import { campaignService } from '../src/services/campaign.service';
import { db } from '../src/db';

/**
 * Test Campaign Service
 * 
 * This script tests all Campaign CRUD operations and validations
 */

async function testCampaignService() {
  console.log('🧪 Testing Campaign Service...\n');

  try {
    // Test 1: Create Campaign
    console.log('1. Creating a test campaign...');
    const campaign = await campaignService.create(
      {
        title: 'Test Campaign ' + Date.now(),
        slug: '', // Will be auto-generated
        description: '# Test Campaign\n\nThis is a test campaign for Phase 3.',
        startTime: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
        endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days from now
        ticketPrice: 10000,
        paymentType: 'direct',
        status: 'active',
        excludeWinningNumbers: true,
      },
      [
        {
          title: 'Giải nhất',
          prizesCount: 1,
          matchingDigits: 6,
          prizeValue: 1000000,
        },
        {
          title: 'Giải nhì',
          prizesCount: 2,
          matchingDigits: 5,
          prizeValue: 500000,
        },
        {
          title: 'Giải ba',
          prizesCount: 3,
          matchingDigits: 4,
          prizeValue: 200000,
        },
      ]
    );
    console.log('✅ Campaign created:', {
      id: campaign.id,
      title: campaign.title,
      slug: campaign.slug,
      prizesCount: campaign.prizes.length,
    });

    // Test 2: Get Campaign by ID
    console.log('\n2. Getting campaign by ID...');
    const fetchedCampaign = await campaignService.getById(campaign.id);
    if (fetchedCampaign) {
      console.log('✅ Campaign fetched:', fetchedCampaign.title);
    } else {
      throw new Error('Campaign not found');
    }

    // Test 3: Get Campaign by Slug
    console.log('\n3. Getting campaign by slug...');
    const campaignBySlug = await campaignService.getBySlug(campaign.slug);
    if (campaignBySlug) {
      console.log('✅ Campaign fetched by slug:', campaignBySlug.title);
    } else {
      throw new Error('Campaign not found by slug');
    }

    // Test 4: List Campaigns
    console.log('\n4. Listing campaigns...');
    const { campaigns, total } = await campaignService.list({
      status: 'active',
      limit: 10,
    });
    console.log(`✅ Found ${total} campaign(s)`);

    // Test 5: Update Campaign
    console.log('\n5. Updating campaign...');
    const updatedCampaign = await campaignService.update(campaign.id, {
      title: campaign.title + ' (Updated)',
      ticketPrice: 20000,
    });
    console.log('✅ Campaign updated:', {
      title: updatedCampaign.title,
      ticketPrice: updatedCampaign.ticketPrice,
    });

    // Test 6: Get Statistics
    console.log('\n6. Getting campaign statistics...');
    const stats = await campaignService.getStats(campaign.id);
    console.log('✅ Statistics:', stats);

    // Test 7: Test Status Transitions
    console.log('\n7. Testing status transitions...');

    // Try to complete an active campaign (should fail)
    console.log('   - Trying to complete active campaign (should fail)...');
    try {
      await campaignService.complete(campaign.id);
      console.log('❌ Should have failed but succeeded');
    } catch (error) {
      if (error instanceof Error && error.message.includes('CANNOT_COMPLETE')) {
        console.log('   ✅ Correctly prevented completing active campaign');
      } else {
        throw error;
      }
    }

    // Update status to drawing
    console.log('   - Updating status to drawing...');
    await campaignService.updateStatus(campaign.id, 'drawing');
    console.log('   ✅ Status updated to drawing');

    // Try to cancel a drawing campaign (should fail)
    console.log('   - Trying to cancel drawing campaign (should fail)...');
    try {
      await campaignService.cancel(campaign.id);
      console.log('   ❌ Should have failed but succeeded');
    } catch (error) {
      if (error instanceof Error && error.message.includes('CANNOT_CANCEL')) {
        console.log('   ✅ Correctly prevented canceling drawing campaign');
      } else {
        throw error;
      }
    }

    // Test 8: Validation Tests
    console.log('\n8. Testing validations...');

    // Test invalid date range
    console.log('   - Testing invalid date range...');
    try {
      await campaignService.create(
        {
          title: 'Invalid Campaign',
          slug: 'invalid-campaign-' + Date.now(),
          description: 'Invalid',
          startTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          endTime: new Date(Date.now()), // End before start
          ticketPrice: 10000,
          paymentType: 'direct',
          status: 'active',
          excludeWinningNumbers: true,
        },
        [
          {
            title: 'Test Prize',
            prizesCount: 1,
            matchingDigits: 6,
            prizeValue: 100000,
          },
        ]
      );
      console.log('   ❌ Should have failed but succeeded');
    } catch (error) {
      if (error instanceof Error && error.message.includes('INVALID_DATES')) {
        console.log('   ✅ Correctly validated date range');
      } else {
        throw error;
      }
    }

    // Test no prizes
    console.log('   - Testing no prizes validation...');
    try {
      await campaignService.create(
        {
          title: 'No Prizes Campaign',
          slug: 'no-prizes-' + Date.now(),
          description: 'No prizes',
          startTime: new Date(Date.now() + 1000 * 60 * 60),
          endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          ticketPrice: 10000,
          paymentType: 'direct',
          status: 'active',
          excludeWinningNumbers: true,
        },
        [] // No prizes
      );
      console.log('   ❌ Should have failed but succeeded');
    } catch (error) {
      if (error instanceof Error && error.message.includes('INVALID_PRIZES')) {
        console.log('   ✅ Correctly validated prizes requirement');
      } else {
        throw error;
      }
    }

    // Test duplicate slug
    console.log('   - Testing duplicate slug validation...');
    try {
      await campaignService.create(
        {
          title: 'Duplicate Slug',
          slug: campaign.slug, // Same slug as earlier campaign
          description: 'Duplicate',
          startTime: new Date(Date.now() + 1000 * 60 * 60),
          endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          ticketPrice: 10000,
          paymentType: 'direct',
          status: 'active',
          excludeWinningNumbers: true,
        },
        [
          {
            title: 'Test Prize',
            prizesCount: 1,
            matchingDigits: 6,
            prizeValue: 100000,
          },
        ]
      );
      console.log('   ❌ Should have failed but succeeded');
    } catch (error) {
      if (error instanceof Error && error.message.includes('SLUG_EXISTS')) {
        console.log('   ✅ Correctly validated slug uniqueness');
      } else {
        throw error;
      }
    }

    // Test 9: Cleanup
    console.log('\n9. Cleaning up test data...');
    await campaignService.delete(campaign.id);
    console.log('✅ Test campaign deleted');

    console.log('\n✅ All tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

// Run tests
testCampaignService();
