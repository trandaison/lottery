#!/bin/bash

# Test Campaign CRUD via API
# This script tests all Campaign operations through the REST API

BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api/v1"

echo "🧪 Testing Campaign Management API..."
echo

# First, login to get auth cookie
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$API_URL/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "password123",
    "rememberMe": false
  }')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Login successful"
else
  echo "❌ Login failed: $LOGIN_RESPONSE"
  exit 1
fi

# Test 2: Create Campaign
echo
echo "2. Creating a test campaign..."
CREATE_RESPONSE=$(curl -s -b cookies.txt -X POST "$API_URL/admin/campaigns" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Campaign $(date +%s)\",
    \"description\": \"# Test Campaign\\n\\nThis is a test campaign for Phase 3.\",
    \"startTime\": \"$(date -u -v+1H +%Y-%m-%dT%H:%M:%S.000Z)\",
    \"endTime\": \"$(date -u -v+7d +%Y-%m-%dT%H:%M:%S.000Z)\",
    \"ticketPrice\": 10000,
    \"paymentType\": \"direct\",
    \"status\": \"active\",
    \"excludeWinningNumbers\": true,
    \"prizes\": [
      {
        \"title\": \"Giải nhất\",
        \"prizesCount\": 1,
        \"matchingDigits\": 6,
        \"prizeValue\": 1000000
      },
      {
        \"title\": \"Giải nhì\",
        \"prizesCount\": 2,
        \"matchingDigits\": 5,
        \"prizeValue\": 500000
      }
    ]
  }")

if echo "$CREATE_RESPONSE" | grep -q '"success":true'; then
  CAMPAIGN_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
  CAMPAIGN_SLUG=$(echo "$CREATE_RESPONSE" | grep -o '"slug":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "✅ Campaign created: ID=$CAMPAIGN_ID, Slug=$CAMPAIGN_SLUG"
else
  echo "❌ Campaign creation failed: $CREATE_RESPONSE"
  rm cookies.txt
  exit 1
fi

# Test 3: Get Campaign by ID
echo
echo "3. Getting campaign by ID..."
GET_RESPONSE=$(curl -s -b cookies.txt "$API_URL/admin/campaigns/$CAMPAIGN_ID")

if echo "$GET_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Campaign fetched by ID"
else
  echo "❌ Failed to fetch campaign by ID"
fi

# Test 4: Get Campaign by Slug (Public)
echo
echo "4. Getting campaign by slug (public)..."
SLUG_RESPONSE=$(curl -s "$API_URL/campaigns/$CAMPAIGN_SLUG")

if echo "$SLUG_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Campaign fetched by slug"
else
  echo "❌ Failed to fetch campaign by slug"
fi

# Test 5: List Campaigns
echo
echo "5. Listing campaigns..."
LIST_RESPONSE=$(curl -s -b cookies.txt "$API_URL/admin/campaigns?status=active&limit=10")

if echo "$LIST_RESPONSE" | grep -q '"success":true'; then
  TOTAL=$(echo "$LIST_RESPONSE" | grep -o '"total":[0-9]*' | cut -d: -f2)
  echo "✅ Campaigns listed: Total=$TOTAL"
else
  echo "❌ Failed to list campaigns"
fi

# Test 6: Update Campaign
echo
echo "6. Updating campaign..."
UPDATE_RESPONSE=$(curl -s -b cookies.txt -X PUT "$API_URL/admin/campaigns/$CAMPAIGN_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Test Campaign",
    "ticketPrice": 20000
  }')

if echo "$UPDATE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Campaign updated"
else
  echo "❌ Failed to update campaign: $UPDATE_RESPONSE"
fi

# Test 7: Test Status Transitions
echo
echo "7. Testing status transitions..."

# Try to complete active campaign (should fail)
echo "   - Trying to complete active campaign (should fail)..."
COMPLETE_FAIL=$(curl -s -b cookies.txt -X PUT "$API_URL/admin/campaigns/$CAMPAIGN_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}')

if echo "$COMPLETE_FAIL" | grep -q 'CANNOT_COMPLETE'; then
  echo "   ✅ Correctly prevented completing active campaign"
else
  echo "   ❌ Should have failed: $COMPLETE_FAIL"
fi

# Update to drawing status
echo "   - Updating status to drawing..."
DRAWING=$(curl -s -b cookies.txt -X PUT "$API_URL/admin/campaigns/$CAMPAIGN_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "drawing"}')

if echo "$DRAWING" | grep -q '"success":true'; then
  echo "   ✅ Status updated to drawing"
else
  echo "   ❌ Failed to update to drawing"
fi

# Try to cancel drawing campaign (should fail)
echo "   - Trying to cancel drawing campaign (should fail)..."
CANCEL_FAIL=$(curl -s -b cookies.txt -X PUT "$API_URL/admin/campaigns/$CAMPAIGN_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "canceled"}')

if echo "$CANCEL_FAIL" | grep -q 'CANNOT_CANCEL'; then
  echo "   ✅ Correctly prevented canceling drawing campaign"
else
  echo "   ❌ Should have failed: $CANCEL_FAIL"
fi

# Test 8: Delete Campaign
echo
echo "8. Deleting test campaign..."
DELETE_RESPONSE=$(curl -s -b cookies.txt -X DELETE "$API_URL/admin/campaigns/$CAMPAIGN_ID")

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Campaign deleted"
else
  echo "❌ Failed to delete campaign"
fi

# Cleanup
rm cookies.txt

echo
echo "✅ All API tests completed!"
echo
