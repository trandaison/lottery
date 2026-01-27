#!/bin/bash

# Example script to test SePay webhook endpoint
# This demonstrates how to send a mock webhook request

# NOTE: This is for testing purposes only
# In production, webhooks come from SePay servers

# Configuration
BASE_URL="http://localhost:3000"
WEBHOOK_URL="${BASE_URL}/api/v1/webhooks/sepay"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}SePay Webhook Testing Examples${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Example 1: Get campaign UUID from database
echo -e "${YELLOW}Step 1: Get Campaign UUID${NC}"
echo "Run this SQL query to get a campaign UUID:"
echo ""
echo "  psql lottery_dev -c \"SELECT uuid, title FROM campaigns LIMIT 1;\""
echo ""
echo "Example output:"
echo "  uuid: 550e8400-e29b-41d4-a716-446655440000"
echo ""

# Example 2: Generate JWT token
echo -e "${YELLOW}Step 2: Generate JWT Token${NC}"
echo "You can get the JWT token from the campaign edit page (for transfer payment type)"
echo "OR generate it programmatically:"
echo ""
cat << 'EOF'
import jwt from 'jsonwebtoken';
const campaignUuid = '550e8400-e29b-41d4-a716-446655440000';
const secret = process.env.SEPAY_WEBHOOK_JWT_SECRET;
const token = jwt.sign({ sub: campaignUuid }, secret);
console.log(token);
EOF
echo ""

# Example 3: Create a test order
echo -e "${YELLOW}Step 3: Create a Test Order${NC}"
echo "Create an order with a known payment reference ID (e.g., LTR000001)"
echo "This will be easier once Phase 5 is implemented."
echo ""

# Example 4: Send webhook request
echo -e "${YELLOW}Step 4: Send Mock Webhook Request${NC}"
echo ""
echo "Example curl command:"
echo ""
cat << 'EOF'
curl -X POST http://localhost:3000/api/v1/webhooks/sepay \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey YOUR_JWT_TOKEN_HERE" \
  -d '{
    "gateway": "Vietcombank",
    "transactionDate": "2026-01-27 08:45:29",
    "accountNumber": "0706213188",
    "subAccount": null,
    "code": "LTR000001",
    "content": "LTR000001",
    "transferType": "in",
    "description": null,
    "transferAmount": 10000,
    "referenceCode": "510787.270126.084529",
    "accumulated": 10000,
    "id": 241439
  }'
EOF
echo ""
echo ""

# Example test cases
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Cases${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${GREEN}Test Case 1: Valid Payment${NC}"
echo "Expected: 200 OK, order status updated, tickets created"
echo ""
echo "Request:"
cat << 'EOF'
{
  "gateway": "Vietcombank",
  "transactionDate": "2026-01-27 10:00:00",
  "accountNumber": "0706213188",  // Must match campaign account
  "code": "LTR000001",             // Existing order reference
  "transferAmount": 50000,         // Must match order total_amount
  "referenceCode": "123456.270126.100000"
}
EOF
echo ""
echo "Expected Response:"
cat << 'EOF'
{
  "message": "Payment processed successfully",
  "tickets": 5
}
EOF
echo ""
echo ""

echo -e "${GREEN}Test Case 2: Idempotency (Already Processed)${NC}"
echo "Expected: 208 Already Reported"
echo ""
echo "Send the same request as Test Case 1 again"
echo ""
echo "Expected Response:"
cat << 'EOF'
{
  "message": "Already processed"
}
EOF
echo ""
echo ""

echo -e "${RED}Test Case 3: Amount Mismatch${NC}"
echo "Expected: 203 Non-Authoritative, order marked as failed"
echo ""
echo "Request:"
cat << 'EOF'
{
  "gateway": "Vietcombank",
  "transactionDate": "2026-01-27 10:00:00",
  "accountNumber": "0706213188",
  "code": "LTR000002",
  "transferAmount": 30000,         // Wrong amount (expected 50000)
  "referenceCode": "123457.270126.100001"
}
EOF
echo ""
echo "Expected Response:"
cat << 'EOF'
{
  "error": "Reconciliation failed",
  "details": [
    "Amount mismatch: expected 50000, got 30000"
  ]
}
EOF
echo ""
echo "Order status will be set to 'failed' with error message"
echo ""
echo ""

echo -e "${RED}Test Case 4: Invalid JWT${NC}"
echo "Expected: 203 Non-Authoritative"
echo ""
echo "Request with invalid or missing Authorization header"
echo ""
echo "Expected Response:"
cat << 'EOF'
{
  "error": "Invalid token"
}
EOF
echo ""
echo ""

echo -e "${RED}Test Case 5: Campaign Not Found${NC}"
echo "Expected: 203 Non-Authoritative"
echo ""
echo "Request with JWT containing non-existent campaign UUID"
echo ""
echo "Expected Response:"
cat << 'EOF'
{
  "error": "Campaign not found"
}
EOF
echo ""
echo ""

echo -e "${RED}Test Case 6: Order Not Found${NC}"
echo "Expected: 203 Non-Authoritative"
echo ""
echo "Request with non-existent payment reference ID"
echo ""
echo "Expected Response:"
cat << 'EOF'
{
  "error": "Order not found"
}
EOF
echo ""
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo "After successful webhook processing, verify:"
echo ""
echo "1. Check order status:"
echo "   psql lottery_dev -c \"SELECT payment_status, sepay_transaction_id, received_at, transaction_date FROM orders WHERE payment_reference_id = 'LTR000001';\""
echo ""
echo "2. Check created tickets:"
echo "   psql lottery_dev -c \"SELECT COUNT(*) FROM tickets WHERE id IN (SELECT ticket_id FROM order_tickets WHERE order_id = YOUR_ORDER_ID);\""
echo ""
echo "3. Check order_tickets links:"
echo "   psql lottery_dev -c \"SELECT * FROM order_tickets WHERE order_id = YOUR_ORDER_ID;\""
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Testing Complete${NC}"
echo -e "${BLUE}========================================${NC}"
