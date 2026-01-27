#!/bin/bash

# Test script for Phase 4.1 implementation
# Tests the updated payment integration with SePay webhook and new QR format

set -e  # Exit on error

BASE_URL="http://localhost:3000"
API_BASE="${BASE_URL}/api/v1"

echo "🧪 Phase 4.1 Testing Script"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function for test results
pass_test() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((TESTS_PASSED++))
}

fail_test() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    ((TESTS_FAILED++))
}

info() {
    echo -e "${YELLOW}ℹ INFO:${NC} $1"
}

echo "1. Testing Payment Service Functions"
echo "------------------------------------"

# Test 1: Check if payment service exists
if [ -f "src/services/payment.service.ts" ]; then
    pass_test "Payment service file exists"
else
    fail_test "Payment service file not found"
fi

# Test 2: Verify JWT generation function exists
if grep -q "generateWebhookJWT" src/services/payment.service.ts; then
    pass_test "generateWebhookJWT function exists"
else
    fail_test "generateWebhookJWT function not found"
fi

# Test 3: Verify QR URL generation function exists
if grep -q "generateQRUrl" src/services/payment.service.ts; then
    pass_test "generateQRUrl function exists"
else
    fail_test "generateQRUrl function not found"
fi

# Test 4: Verify reconciliation function exists
if grep -q "reconcilePayment" src/services/payment.service.ts; then
    pass_test "reconcilePayment function exists"
else
    fail_test "reconcilePayment function not found"
fi

echo ""
echo "2. Testing Schema Updates"
echo "-------------------------"

# Test 5: Verify campaigns schema removed old fields
if grep -q "accountHolderName" src/db/schema/campaigns.ts; then
    fail_test "accountHolderName field still exists in campaigns schema"
else
    pass_test "accountHolderName field removed from campaigns schema"
fi

if grep -q "sepayGateway" src/db/schema/campaigns.ts; then
    fail_test "sepayGateway field still exists in campaigns schema"
else
    pass_test "sepayGateway field removed from campaigns schema"
fi

# Test 6: Verify orders schema has transaction_date
if grep -q "transactionDate" src/db/schema/orders.ts; then
    pass_test "transactionDate field added to orders schema"
else
    fail_test "transactionDate field not found in orders schema"
fi

echo ""
echo "3. Testing Webhook Implementation"
echo "----------------------------------"

# Test 7: Verify webhook route has JWT verification
if grep -q "verifyWebhookJWT" src/app/api/v1/webhooks/sepay/route.ts; then
    pass_test "Webhook uses JWT verification"
else
    fail_test "Webhook JWT verification not found"
fi

# Test 8: Verify webhook has reconciliation logic
if grep -q "reconcilePayment" src/app/api/v1/webhooks/sepay/route.ts; then
    pass_test "Webhook has reconciliation logic"
else
    fail_test "Webhook reconciliation logic not found"
fi

# Test 9: Verify webhook handles idempotency (208 status)
if grep -q "208" src/app/api/v1/webhooks/sepay/route.ts; then
    pass_test "Webhook handles idempotency with 208 status"
else
    fail_test "Webhook idempotency check not found"
fi

# Test 10: Verify webhook creates tickets after payment success
if grep -q "insert(tickets)" src/app/api/v1/webhooks/sepay/route.ts; then
    pass_test "Webhook creates tickets after payment success"
else
    fail_test "Webhook ticket creation not found"
fi

echo ""
echo "4. Testing Form Updates"
echo "------------------------"

# Test 11: Verify CampaignForm removed old fields
if grep -q "accountHolderName" src/components/admin/CampaignForm.tsx; then
    fail_test "accountHolderName field still in CampaignForm"
else
    pass_test "accountHolderName field removed from CampaignForm"
fi

if grep -q "sepayGateway" src/components/admin/CampaignForm.tsx; then
    fail_test "sepayGateway field still in CampaignForm"
else
    pass_test "sepayGateway field removed from CampaignForm"
fi

# Test 12: Verify CampaignForm has JWT webhook display
if grep -q "generateWebhookJWT" src/components/admin/CampaignForm.tsx; then
    pass_test "CampaignForm displays JWT webhook key"
else
    fail_test "CampaignForm JWT webhook display not found"
fi

echo ""
echo "5. Testing Validation Updates"
echo "------------------------------"

# Test 13: Verify validation schema updated
if grep -q "accountHolderName" src/lib/validations/campaign.ts; then
    fail_test "accountHolderName still in validation schema"
else
    pass_test "accountHolderName removed from validation schema"
fi

if grep -q "sepayGateway" src/lib/validations/campaign.ts; then
    fail_test "sepayGateway still in validation schema"
else
    pass_test "sepayGateway removed from validation schema"
fi

echo ""
echo "6. Testing Environment Variables"
echo "---------------------------------"

# Test 14: Verify SEPAY_WEBHOOK_JWT_SECRET in env config
if grep -q "SEPAY_WEBHOOK_JWT_SECRET" src/config/env.ts; then
    pass_test "SEPAY_WEBHOOK_JWT_SECRET added to env config"
else
    fail_test "SEPAY_WEBHOOK_JWT_SECRET not found in env config"
fi

echo ""
echo "7. Testing Migration Files"
echo "---------------------------"

# Test 15: Check if migration was generated
if [ -f "src/db/migrations/0002_nifty_mathemanic.sql" ]; then
    pass_test "Migration file generated"

    # Verify migration content
    if grep -q "DROP COLUMN \"account_holder_name\"" src/db/migrations/0002_nifty_mathemanic.sql; then
        pass_test "Migration drops account_holder_name column"
    else
        fail_test "Migration doesn't drop account_holder_name column"
    fi

    if grep -q "DROP COLUMN \"sepay_gateway\"" src/db/migrations/0002_nifty_mathemanic.sql; then
        pass_test "Migration drops sepay_gateway column"
    else
        fail_test "Migration doesn't drop sepay_gateway column"
    fi

    if grep -q "ADD COLUMN \"transaction_date\"" src/db/migrations/0002_nifty_mathemanic.sql; then
        pass_test "Migration adds transaction_date column"
    else
        fail_test "Migration doesn't add transaction_date column"
    fi
else
    fail_test "Migration file not found"
fi

echo ""
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Phase 4.1 implementation looks good.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the implementation.${NC}"
    exit 1
fi
