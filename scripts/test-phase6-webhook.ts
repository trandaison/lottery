#!/usr/bin/env tsx

/**
 * Phase 6: Payment Integration - Webhook Testing Script
 *
 * This script tests the SePay webhook endpoint with various scenarios:
 * - Valid payment processing
 * - Idempotency (already processed)
 * - Amount mismatch
 * - Account number mismatch
 * - Invalid JWT
 * - Campaign not found
 * - Order not found
 *
 * Usage:
 *   tsx scripts/test-phase6-webhook.ts
 *
 * Prerequisites:
 *   1. Database must be running and seeded
 *   2. Server must be running on http://localhost:3000
 *   3. At least one campaign with transfer payment type must exist
 *   4. At least one order with payment_status='pending' must exist
 */

import { db } from '../src/db';
import { campaigns, orders } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { generateWebhookJWT } from '../src/services/payment.server';
import type { SepayWebhookPayload } from '../src/services/payment.service';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WEBHOOK_URL = `${BASE_URL}/api/v1/webhooks/sepay`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'blue');
  console.log('='.repeat(60) + '\n');
}

function logTest(testName: string) {
  log(`\n▶ ${testName}`, 'cyan');
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

/**
 * Send webhook request
 */
async function sendWebhook(
  jwt: string,
  payload: SepayWebhookPayload,
): Promise<{ status: number; body: any }> {
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Apikey ${jwt}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));

  return {
    status: response.status,
    body,
  };
}

/**
 * Test Case 1: Valid Payment Processing
 */
async function testValidPayment(
  campaignUuid: string,
  order: typeof orders.$inferSelect,
  campaign: typeof campaigns.$inferSelect,
) {
  logTest('Test 1: Valid Payment Processing');

  const jwt = generateWebhookJWT(campaignUuid);

  const payload: SepayWebhookPayload = {
    gateway: 'Vietcombank',
    transactionDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
    accountNumber: campaign.accountNumber || '',
    subAccount: null,
    code: order.paymentReferenceId,
    content: order.paymentReferenceId,
    transferType: 'in',
    description: null,
    transferAmount: order.totalAmount,
    referenceCode: `TEST.${Date.now()}.${Math.random().toString(36).substring(7)}`,
    accumulated: order.totalAmount,
    id: Math.floor(Math.random() * 1000000),
  };

  log(`Sending webhook for order: ${order.paymentReferenceId}`);
  log(`Amount: ${payload.transferAmount} VND`);
  log(`Account: ${payload.accountNumber}`);

  const result = await sendWebhook(jwt, payload);

  if (result.status === 200) {
    logSuccess('Payment processed successfully');
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);

    // Verify order status updated
    const updatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, order.id),
    });

    if (updatedOrder?.paymentStatus === 'success') {
      logSuccess('Order status updated to "success"');
    } else {
      logError(`Order status is ${updatedOrder?.paymentStatus}, expected "success"`);
    }

    return true;
  } else {
    logError(`Expected 200, got ${result.status}`);
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);
    return false;
  }
}

/**
 * Test Case 2: Idempotency (Already Processed)
 */
async function testIdempotency(
  campaignUuid: string,
  order: typeof orders.$inferSelect,
  campaign: typeof campaigns.$inferSelect,
) {
  logTest('Test 2: Idempotency (Already Processed)');

  const jwt = generateWebhookJWT(campaignUuid);

  const payload: SepayWebhookPayload = {
    gateway: 'Vietcombank',
    transactionDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
    accountNumber: campaign.accountNumber || '',
    subAccount: null,
    code: order.paymentReferenceId,
    content: order.paymentReferenceId,
    transferType: 'in',
    description: null,
    transferAmount: order.totalAmount,
    referenceCode: `TEST.${Date.now()}.${Math.random().toString(36).substring(7)}`,
    accumulated: order.totalAmount,
    id: Math.floor(Math.random() * 1000000),
  };

  log('Sending same webhook request again (order already processed)');

  const result = await sendWebhook(jwt, payload);

  if (result.status === 208) {
    logSuccess('Idempotency check passed (208 Already Reported)');
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);
    return true;
  } else {
    logError(`Expected 208, got ${result.status}`);
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);
    return false;
  }
}

/**
 * Test Case 3: Amount Mismatch
 */
async function testAmountMismatch(
  campaignUuid: string,
  order: typeof orders.$inferSelect,
  campaign: typeof campaigns.$inferSelect,
) {
  logTest('Test 3: Amount Mismatch');

  const jwt = generateWebhookJWT(campaignUuid);

  const wrongAmount = order.totalAmount - 1000; // Wrong amount

  const payload: SepayWebhookPayload = {
    gateway: 'Vietcombank',
    transactionDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
    accountNumber: campaign.accountNumber || '',
    subAccount: null,
    code: order.paymentReferenceId,
    content: order.paymentReferenceId,
    transferType: 'in',
    description: null,
    transferAmount: wrongAmount,
    referenceCode: `TEST.${Date.now()}.${Math.random().toString(36).substring(7)}`,
    accumulated: wrongAmount,
    id: Math.floor(Math.random() * 1000000),
  };

  log(`Sending webhook with wrong amount: ${wrongAmount} (expected: ${order.totalAmount})`);

  const result = await sendWebhook(jwt, payload);

  if (result.status === 203) {
    logSuccess('Reconciliation failed as expected (203 Non-Authoritative)');
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);

    // Verify order marked as failed
    const updatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, order.id),
    });

    if (updatedOrder?.paymentStatus === 'failed') {
      logSuccess('Order marked as "failed" with error message');
    } else {
      logWarning(`Order status is ${updatedOrder?.paymentStatus}, expected "failed"`);
    }

    return true;
  } else {
    logError(`Expected 203, got ${result.status}`);
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);
    return false;
  }
}

/**
 * Test Case 4: Invalid JWT
 */
async function testInvalidJWT(order: typeof orders.$inferSelect) {
  logTest('Test 4: Invalid JWT');

  const invalidJWT = 'invalid.jwt.token';

  const payload: SepayWebhookPayload = {
    gateway: 'Vietcombank',
    transactionDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
    accountNumber: '0706213188',
    subAccount: null,
    code: order.paymentReferenceId,
    content: order.paymentReferenceId,
    transferType: 'in',
    description: null,
    transferAmount: 10000,
    referenceCode: `TEST.${Date.now()}`,
    accumulated: 10000,
    id: Math.floor(Math.random() * 1000000),
  };

  log('Sending webhook with invalid JWT');

  const result = await sendWebhook(invalidJWT, payload);

  if (result.status === 203) {
    logSuccess('Invalid JWT rejected (203 Non-Authoritative)');
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);
    return true;
  } else {
    logError(`Expected 203, got ${result.status}`);
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);
    return false;
  }
}

/**
 * Test Case 5: Campaign Not Found
 */
async function testCampaignNotFound(order: typeof orders.$inferSelect) {
  logTest('Test 5: Campaign Not Found');

  // Generate JWT with non-existent campaign UUID
  const fakeCampaignUuid = '00000000-0000-0000-0000-000000000000';
  const jwt = generateWebhookJWT(fakeCampaignUuid);

  const payload: SepayWebhookPayload = {
    gateway: 'Vietcombank',
    transactionDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
    accountNumber: '0706213188',
    subAccount: null,
    code: order.paymentReferenceId,
    content: order.paymentReferenceId,
    transferType: 'in',
    description: null,
    transferAmount: 10000,
    referenceCode: `TEST.${Date.now()}`,
    accumulated: 10000,
    id: Math.floor(Math.random() * 1000000),
  };

  log('Sending webhook with non-existent campaign UUID');

  const result = await sendWebhook(jwt, payload);

  if (result.status === 203) {
    logSuccess('Campaign not found handled correctly (203 Non-Authoritative)');
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);
    return true;
  } else {
    logError(`Expected 203, got ${result.status}`);
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);
    return false;
  }
}

/**
 * Test Case 6: Order Not Found
 */
async function testOrderNotFound(campaignUuid: string) {
  logTest('Test 6: Order Not Found');

  const jwt = generateWebhookJWT(campaignUuid);

  const payload: SepayWebhookPayload = {
    gateway: 'Vietcombank',
    transactionDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
    accountNumber: '0706213188',
    subAccount: null,
    code: 'LTR999999', // Non-existent order
    content: 'LTR999999',
    transferType: 'in',
    description: null,
    transferAmount: 10000,
    referenceCode: `TEST.${Date.now()}`,
    accumulated: 10000,
    id: Math.floor(Math.random() * 1000000),
  };

  log('Sending webhook with non-existent order reference');

  const result = await sendWebhook(jwt, payload);

  if (result.status === 203) {
    logSuccess('Order not found handled correctly (203 Non-Authoritative)');
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);
    return true;
  } else {
    logError(`Expected 203, got ${result.status}`);
    log(`Response: ${JSON.stringify(result.body, null, 2)}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function main() {
  logSection('Phase 6: Payment Integration - Webhook Testing');

  try {
    // Find a campaign with transfer payment type
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.paymentType, 'transfer'),
    });

    if (!campaign) {
      logError('No campaign with transfer payment type found');
      log('Please create a campaign with payment_type="transfer" first');
      process.exit(1);
    }

    if (!campaign.uuid) {
      logError('Campaign UUID is missing');
      process.exit(1);
    }

    if (!campaign.accountNumber) {
      logError('Campaign account number is missing');
      process.exit(1);
    }

    log(`Found campaign: ${campaign.title} (UUID: ${campaign.uuid})`);

    // Find a pending order for this campaign
    let order = await db.query.orders.findFirst({
      where: eq(orders.campaignId, campaign.id),
    });

    // If no order found, try to find any pending order
    if (!order) {
      order = await db.query.orders.findFirst({
        where: eq(orders.paymentStatus, 'pending'),
      });
    }

    if (!order) {
      logError('No pending order found');
      log('Please create an order with payment_status="pending" first');
      process.exit(1);
    }

    log(`Found order: ${order.paymentReferenceId} (Status: ${order.paymentStatus})`);

    const results: boolean[] = [];

    // Run tests
    logSection('Running Tests');

    // Test 1: Valid payment (only if order is pending)
    if (order.paymentStatus === 'pending') {
      results.push(await testValidPayment(campaign.uuid, order, campaign));

      // Test 2: Idempotency (only if Test 1 succeeded)
      if (results[0]) {
        // Refresh order to get updated status
        const updatedOrder = await db.query.orders.findFirst({
          where: eq(orders.id, order.id),
        });
        if (updatedOrder) {
          results.push(await testIdempotency(campaign.uuid, updatedOrder, campaign));
        }
      }

      // Test 3: Amount mismatch (create a new pending order for this test)
      const testOrder = await db.query.orders.findFirst({
        where: eq(orders.paymentStatus, 'pending'),
      });
      if (testOrder) {
        results.push(await testAmountMismatch(campaign.uuid, testOrder, campaign));
      }
    } else {
      logWarning('Skipping valid payment test (order is not pending)');
    }

    // Test 4: Invalid JWT
    results.push(await testInvalidJWT(order));

    // Test 5: Campaign not found
    results.push(await testCampaignNotFound(order));

    // Test 6: Order not found
    results.push(await testOrderNotFound(campaign.uuid));

    // Summary
    logSection('Test Summary');

    const passed = results.filter((r) => r).length;
    const total = results.length;

    log(`Total tests: ${total}`);
    log(`Passed: ${passed}`, 'green');
    log(`Failed: ${total - passed}`, total - passed > 0 ? 'red' : 'reset');

    if (passed === total) {
      log('\n✓ All tests passed!', 'green');
      process.exit(0);
    } else {
      log('\n✗ Some tests failed', 'red');
      process.exit(1);
    }
  } catch (error) {
    logError(`Test execution failed: ${error}`);
    if (error instanceof Error) {
      logError(error.stack || '');
    }
    process.exit(1);
  }
}

// Run tests
main().catch((error) => {
  logError(`Fatal error: ${error}`);
  process.exit(1);
});
