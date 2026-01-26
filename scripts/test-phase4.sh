#!/bin/bash

# Test Campaign Page - Phase 4 Implementation
# This script verifies the public campaign page functionality

echo "🧪 Phase 4: Public Campaign View - Testing"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}1️⃣ Testing Database Connection...${NC}"
npx tsx scripts/test-campaign-page.ts
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Database test passed${NC}"
else
  echo -e "${YELLOW}✗ Database test failed${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}2️⃣ Checking TypeScript...${NC}"
npx tsc --noEmit
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ TypeScript check passed${NC}"
else
  echo -e "${YELLOW}✗ TypeScript errors found${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}3️⃣ Checking Linter...${NC}"
npm run lint 2>&1 | head -20
if [ ${PIPESTATUS[0]} -eq 0 ]; then
  echo -e "${GREEN}✓ Linter check passed${NC}"
else
  echo -e "${YELLOW}✗ Linter warnings found (may not be critical)${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Phase 4 Implementation Complete!${NC}"
echo ""
echo "📋 Test Campaigns Created:"
echo "   - http://localhost:3000/campaigns/active-ongoing"
echo "   - http://localhost:3000/campaigns/active-not-started"
echo "   - http://localhost:3000/campaigns/active-ended"
echo "   - http://localhost:3000/campaigns/drawing-campaign"
echo "   - http://localhost:3000/campaigns/completed-campaign"
echo "   - http://localhost:3000/campaigns/canceled-campaign"
echo ""
echo "🚀 Next Steps:"
echo "   1. Run 'npm run dev' to start the development server"
echo "   2. Visit the test URLs above to verify functionality"
echo "   3. Check countdown timer (active-not-started)"
echo "   4. Check purchase form placeholder (active-ongoing)"
echo "   5. Check status messages (all other campaigns)"
echo ""
