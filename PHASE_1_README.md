# Phase 1: Database & Core Models - Complete ✅

## Overview
Phase 1 successfully implemented the database foundation for the Lottery system using PostgreSQL 16+ with Drizzle ORM, following the BIGSERIAL + UUID architectural pattern.

## What Was Built

### Database Schema (7 Tables)
1. **users** - User accounts with role-based access
2. **campaigns** - Lottery campaigns with payment configuration  
3. **campaign_prizes** - Prize tiers for each campaign
4. **tickets** - Individual lottery tickets
5. **orders** - Purchase orders with payment tracking
6. **order_tickets** - Junction table for order-ticket relationships
7. **winning_numbers** - Drawn numbers (stored without left-padding)

### Key Features
- ✅ BIGSERIAL IDs for internal references (performance)
- ✅ UUIDs for external API responses (security)
- ✅ Foreign keys reference BIGINT IDs (not UUIDs)
- ✅ 18 strategic indexes for query optimization
- ✅ Comprehensive enum types for status fields
- ✅ Unique constraints on critical fields
- ✅ Cascade delete for referential integrity
- ✅ Timestamp tracking (created_at, updated_at)

## Architecture Decisions

### BIGSERIAL + UUID Pattern
```typescript
// Example: users table
{
  id: bigserial (PRIMARY KEY, internal use)
  uuid: uuid (UNIQUE, for API responses)
  // ... other fields
}

// Foreign keys always reference id
tickets.user_id → users.id (BIGINT)
```

**Benefits:**
- Fast joins using numeric IDs
- Secure external references with UUIDs
- Smaller index sizes
- Better query performance

### Winning Numbers Storage
Numbers stored **without left-padding** for flexibility:
- 6 digits: "123456"
- 3 digits: "321" (not "000321")
- 2 digits: "45" (not "000045")

Matching done from **RIGHT to LEFT** (last N digits).

## Database Structure

### Users Table
```sql
id (BIGSERIAL) | uuid | email | name | password_digest | 
phone | status | role | created_at | updated_at
```

**Enums:**
- status: active, inactive
- role: admin, user

**Indexes:** email, role

### Campaigns Table
```sql
id | uuid | title | slug | description | start_time | end_time |
ticket_price | payment_type | bank_name_or_code | account_number |
account_holder_name | sepay_gateway | status | exclude_winning_numbers |
canceled_at | created_at | updated_at
```

**Enums:**
- status: active, drawing, completed, canceled
- payment_type: direct, transfer

**Indexes:** slug, status, start_time

### Campaign Prizes Table
```sql
id | uuid | campaign_id (FK) | title | prizes_count | 
matching_digits | prize_value | created_at | updated_at
```

**Indexes:** campaign_id, matching_digits

### Tickets Table
```sql
id | uuid | campaign_id (FK) | user_id (FK) | ticket_number | 
is_winning | created_at | updated_at
```

**Unique:** (campaign_id, ticket_number)

**Indexes:** campaign_id, user_id, ticket_number, is_winning

### Orders Table
```sql
id | uuid | campaign_id (FK) | user_id (FK) | tickets_count |
total_amount | payment_reference_id | expires_at | payment_type |
payment_status | error_message | sepay_transaction_id | 
received_at | created_at | updated_at
```

**Enum:**
- payment_status: pending, success, failed

**Indexes:** campaign_id, user_id, payment_reference_id, payment_status

### Order Tickets Table
```sql
id | order_id (FK) | ticket_id (FK) | created_at | updated_at
```

**Unique:** (order_id, ticket_id)

**Indexes:** order_id, ticket_id

### Winning Numbers Table
```sql
id | uuid | campaign_prize_id (FK) | number | created_at | updated_at
```

**Indexes:** campaign_prize_id

## Files Created

```
src/
├── db/
│   ├── schema/
│   │   ├── index.ts              # Schema exports
│   │   ├── users.ts              # User table
│   │   ├── campaigns.ts          # Campaign table
│   │   ├── campaign-prizes.ts    # Prizes table
│   │   ├── tickets.ts            # Tickets table
│   │   ├── orders.ts             # Orders table
│   │   ├── order-tickets.ts      # Junction table
│   │   └── winning-numbers.ts    # Winning numbers table
│   ├── migrations/
│   │   ├── 0000_parallel_doctor_faustus.sql  # Initial schema
│   │   └── 0001_clumsy_warlock.sql           # Indexes
│   └── index.ts                  # DB client with schema
├── types/
│   └── index.ts                  # TypeScript types & DTOs
scripts/
├── seed.ts                       # Seed admin user & sample data
└── verify-db.ts                  # Database verification script
tests/
└── schema.test.ts               # Schema unit tests
```

## Usage

### Database Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Apply schema to database (requires manual confirmation)
npm run db:push

# Run migrations (alternative to push)
npm run db:migrate

# Seed database with admin user & sample data
npm run db:seed
```

### Verify Database

```bash
npx tsx scripts/verify-db.ts
```

### Run Tests

```bash
npm test schema.test.ts
```

## Seed Data

### Admin User
```
Email: admin@company.com
Password: password123
Role: admin
Status: active
```

⚠️ **Change password in production!**

### Sample Campaign
```
Title: Sample Campaign
Slug: sample-campaign
Ticket Price: 10,000 VND
Status: active
```

### Sample Prizes
1. First Prize: 1x, 6 digits, 1,000,000 VND
2. Second Prize: 2x, 5 digits, 500,000 VND
3. Third Prize: 5x, 4 digits, 200,000 VND
4. Consolation Prize: 10x, 3 digits, 50,000 VND

## TypeScript Types

Comprehensive types available in `src/types/index.ts`:

```typescript
// Database entities
import { User, Campaign, Ticket, Order } from '@/types';

// DTOs with relations
import { CampaignWithPrizes, OrderWithTickets } from '@/types';

// API types
import { ApiResponse, PurchaseTicketRequest } from '@/types';
```

## Testing

All tests passing (12/12):
- ✅ Admin user seeded correctly
- ✅ Password hashed with bcrypt
- ✅ Sample campaign created
- ✅ 4 prizes seeded
- ✅ Foreign key relationships working
- ✅ BIGSERIAL + UUID pattern validated
- ✅ Timestamps working
- ✅ Unique constraints enforced
- ✅ Enums validated

## Performance

### Indexes (18 total)
- **Users:** 2 indexes
- **Campaigns:** 3 indexes
- **Campaign Prizes:** 2 indexes
- **Tickets:** 4 indexes
- **Orders:** 4 indexes
- **Order Tickets:** 2 indexes
- **Winning Numbers:** 1 index

All foreign keys are indexed for fast joins.

## Migration Strategy

Two migrations generated:
1. `0000_parallel_doctor_faustus.sql` - Creates all tables with constraints
2. `0001_clumsy_warlock.sql` - Adds all indexes

Migrations are tracked by Drizzle Kit and can be applied incrementally.

## Next Phase

**Phase 2: Authentication System with Redis**
- Redis client setup
- JWT + Redis session management
- Auth service with bcrypt
- Auth API routes
- Auth middleware
- Admin login page

## Troubleshooting

### Environment Variables Not Loaded
If seed script fails with env validation errors:
```bash
# Check .env.local exists and has correct values
cat .env.local

# Required variables:
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Migration Issues
```bash
# Reset migrations (⚠️ drops all data)
npm run db:push

# Or manually drop and recreate database
dropdb lottery_dev
createdb lottery_dev
npm run db:push
npm run db:seed
```

## Documentation References

- [Implementation Plan](./docs/08-implementation-testing-plan.md)
- [Database Schema Diagram](./docs/03-database-schema.md)
- [Phase 1 Checklist](./PHASE_1_CHECKLIST.md)
- [Phase 1 Summary](./PHASE_1_SUMMARY.md)

---

**Status:** ✅ **COMPLETE**

**Duration:** Implemented in Phase 1 (Days 3-5 of Week 1)

**Ready for Phase 2:** ✅ Yes
