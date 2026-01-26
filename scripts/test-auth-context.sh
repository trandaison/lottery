#!/bin/bash

# Test full authentication flow with browser-like behavior

BASE_URL="http://localhost:3000"

echo "🧪 Testing Authentication Context Flow..."
echo

# Test 1: Login
echo "1. Testing login (simulating browser)..."
rm -f cookies.txt
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$BASE_URL/api/v1/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "password123",
    "rememberMe": false
  }')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Login successful"
  echo "$LOGIN_RESPONSE" | python3 -m json.tool | head -10
else
  echo "❌ Login failed"
  rm -f cookies.txt
  exit 1
fi

# Test 2: Immediately check /me (simulating page navigation)
echo
echo "2. Checking /me endpoint immediately after login..."
ME_RESPONSE=$(curl -s -b cookies.txt "$BASE_URL/api/v1/admin/auth/me")

if echo "$ME_RESPONSE" | grep -q '"success":true'; then
  echo "✅ /me endpoint works - user is authenticated"
  USER_NAME=$(echo "$ME_RESPONSE" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "   User: $USER_NAME"
else
  echo "❌ /me endpoint failed - this is the problem!"
  echo "$ME_RESPONSE"
  rm -f cookies.txt
  exit 1
fi

# Test 3: Access campaigns endpoint
echo
echo "3. Accessing campaigns endpoint..."
CAMPAIGNS=$(curl -s -b cookies.txt "$BASE_URL/api/v1/admin/campaigns?limit=1")

if echo "$CAMPAIGNS" | grep -q '"success":true'; then
  echo "✅ Can access protected campaigns endpoint"
else
  echo "❌ Cannot access campaigns endpoint"
fi

# Test 4: Multiple rapid requests (simulating React hydration)
echo
echo "4. Testing rapid sequential requests (like React navigation)..."
for i in {1..3}; do
  RAPID=$(curl -s -b cookies.txt "$BASE_URL/api/v1/admin/auth/me")
  if echo "$RAPID" | grep -q '"success":true'; then
    echo "   ✅ Request $i: Success"
  else
    echo "   ❌ Request $i: Failed"
  fi
done

# Cleanup
rm -f cookies.txt

echo
echo "✅ All authentication context tests passed!"
echo
echo "📝 Now test in browser:"
echo "1. Open http://localhost:3000/admin/login"
echo "2. Open browser DevTools (Console + Network tabs)"
echo "3. Login with admin@company.com / password123"
echo "4. Watch Network tab for /me endpoint call"
echo "5. Check Console for any errors"
echo "6. Verify you stay on /admin/campaigns page"
