#!/bin/bash

# Test authentication flow to verify no redirect loop

BASE_URL="http://localhost:3000"

echo "🧪 Testing Authentication Flow..."
echo

# Test 1: Login
echo "1. Testing login..."
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$BASE_URL/api/v1/admin/auth/login" \
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
  rm -f cookies.txt
  exit 1
fi

# Test 2: Check /me endpoint
echo
echo "2. Checking /me endpoint..."
ME_RESPONSE=$(curl -s -b cookies.txt "$BASE_URL/api/v1/admin/auth/me")

if echo "$ME_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Authentication verified"
  USER_EMAIL=$(echo "$ME_RESPONSE" | grep -o '"email":"[^"]*"' | cut -d'"' -f4)
  echo "   Logged in as: $USER_EMAIL"
else
  echo "❌ Authentication check failed"
fi

# Test 3: Access protected endpoint
echo
echo "3. Testing access to campaigns endpoint..."
CAMPAIGNS_RESPONSE=$(curl -s -b cookies.txt "$BASE_URL/api/v1/admin/campaigns?limit=1")

if echo "$CAMPAIGNS_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Can access protected endpoint"
else
  echo "❌ Cannot access protected endpoint"
fi

# Test 4: Logout
echo
echo "4. Testing logout..."
LOGOUT_RESPONSE=$(curl -s -b cookies.txt -X POST "$BASE_URL/api/v1/admin/auth/logout")

if echo "$LOGOUT_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Logout successful"
else
  echo "❌ Logout failed"
fi

# Test 5: Verify cannot access after logout
echo
echo "5. Verifying cannot access protected endpoint after logout..."
PROTECTED_RESPONSE=$(curl -s -b cookies.txt "$BASE_URL/api/v1/admin/auth/me")

if echo "$PROTECTED_RESPONSE" | grep -q '"success":false'; then
  echo "✅ Correctly denied access after logout"
else
  echo "❌ Still has access after logout (should be denied)"
fi

# Cleanup
rm -f cookies.txt

echo
echo "✅ Authentication flow tests completed!"
echo
echo "📝 Manual verification steps:"
echo "1. Open browser to http://localhost:3000/admin/login"
echo "2. Login with admin@company.com / password123"
echo "3. Verify redirect to /admin/campaigns (should NOT loop)"
echo "4. Check browser console for any errors"
echo "5. Verify no infinite redirects"
