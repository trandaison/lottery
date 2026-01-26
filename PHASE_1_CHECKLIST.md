# Phase 1: Database & Core Models - Checklist

## Status: ✅ COMPLETED

## Tasks Completed

### 1. Define Database Schema (Drizzle) ✅
- [x] Created `src/db/schema/users.ts` with BIGSERIAL ID + UUID
  - Fields: id (BIGSERIAL), uuid, name, email, password_digest, phone, status, role
  - Enums: user_status (active/inactive), user_role (admin/user)
  - Indexes: email, role
  
- [x] Created `src/db/schema/campaigns.ts` with BIGSERIAL ID + UUID
  - Fields: id, uuid, title, slug, description, start_time, end_time, ticket_price, payment_type, bank details, status, exclude_winning_numbers
  - Enums: campaign_status (active/drawing/completed/canceled), payment_type (direct/transfer)
  - Indexes: slug, status, start_time
  
- [x] Created `src/db/schema/campaign-prizes.ts` with BIGSERIAL ID + UUID
  - Fields: id, uuid, campaign_id (FK), title, prizes_count, matching_digits, prize_value
  - Indexes: campaign_id, matching_digits
  
- [x] Created `src/db/schema/tickets.ts` with BIGSERIAL ID + UUID
  - Fields: id, uuid, campaign_id (FK), user_id (FK), ticket_number, is_winning
  - Unique constraint: (campaign_id, ticket_number)
  - Indexes: campaign_id, user_id, ticket_number, is_winning
  
- [x] Created `src/db/schema/orders.ts` with BIGSERIAL ID + UUID
  - Fields: id, uuid, campaign_id (FK), user_id (FK), tickets_count, total_amount, payment_reference_id, expires_at, payment_type, payment_status, error_message, sepay_transaction_id, received_at
  - Enum: payment_status (pending/success/failed)
  - Indexes: campaign_id, user_id, payment_reference_id, payment_status
  
- [x] Created `src/db/schema/order-tickets.ts` with BIGSERIAL ID
  - Fields: id, order_id (FK → orders.id), ticket_id (FK → tickets.id)
  - Unique constraint: (order_id, ticket_id)
  - Indexes: order_id, ticket_id
  
- [x] Created `src/db/schema/winning-numbers.ts` with BIGSERIAL ID + UUID
  - Fields: id, uuid, campaign_prize_id (FK), number (WITHOUT left-padding)
  - Indexes: campaign_prize_id

### 2. Create Indexes ✅
- [x] Added indexes on all foreign keys
- [x] Added indexes on: campaign_id, user_id, payment_reference_id, ticket_number, slug
- [x] Added unique indexes on uuid fields
- [x] Verified indexes in database

### 3. Create Initial Migration ✅
- [x] Generated migration: `0000_parallel_doctor_faustus.sql`
- [x] Generated indexes migration: `0001_clumsy_warlock.sql`
- [x] Applied schema to database using `npm run db:push`
- [x] Verified tables in PostgreSQL

### 4. Seed Data Script ✅
- [x] Created `scripts/seed.ts`
- [x] Seeded admin user:
  - Email: admin@company.com
  - Password: password123 (hashed with bcrypt, salt rounds = 10)
  - Name: Admin User
  - Role: admin
  - Status: active
  - ID: 1 (BIGSERIAL), UUID: auto-generated
  
- [x] Seeded sample campaign for testing:
  - Title: Sample Campaign
  - Slug: sample-campaign
  - Status: active
  - Ticket Price: 10,000 VND
  - ID: 1 (BIGSERIAL), UUID: auto-generated
  
- [x] Seeded 4 sample prizes:
  - First Prize: 1x, 6 digits, 1,000,000 VND
  - Second Prize: 2x, 5 digits, 500,000 VND
  - Third Prize: 5x, 4 digits, 200,000 VND
  - Consolation Prize: 10x, 3 digits, 50,000 VND

### 5. Create TypeScript Types ✅
- [x] Created `src/db/schema/index.ts` to export all schemas
- [x] Updated `src/db/index.ts` to include schema
- [x] Created `src/types/index.ts` with comprehensive DTOs:
  - Database types (User, Campaign, Ticket, Order, etc.)
  - API response types
  - Campaign DTOs with relations
  - Order DTOs with tickets
  - Purchase request/response types
  - Draw DTOs

### 6. Additional Files Created ✅
- [x] Created `scripts/verify-db.ts` for database verification

## Verification Results ✅

### Database Tables (7 tables created):
- ✓ users
- ✓ campaigns
- ✓ campaign_prizes
- ✓ tickets
- ✓ orders
- ✓ order_tickets
- ✓ winning_numbers

### Database Verification:
- ✓ All tables use BIGSERIAL for id (primary key)
- ✓ All tables have UUID column with gen_random_uuid() default
- ✓ All foreign keys reference id (BIGINT), not uuid
- ✓ Admin user created successfully with bcrypt hashed password
- ✓ Sample campaign and prizes created
- ✓ All indexes created (18 indexes total)

### Schema Validation:
- ✓ BIGSERIAL + UUID pattern implemented correctly
- ✓ Foreign key relationships use id (not uuid)
- ✓ Enums created for status fields
- ✓ Timestamps with timezone
- ✓ Unique constraints on critical fields
- ✓ Cascade delete configured

## Testing Checklist ✅

- [x] Run `npm run db:seed` → Admin user and sample data created
- [x] Verify tables exist → All 7 tables present
- [x] Verify schema → BIGSERIAL id + UUID confirmed
- [x] Query admin user → Returns correct data with role='admin'
- [x] Verify foreign key relationships → All FKs reference id column
- [x] Verify indexes → 18 indexes created across all tables

## Key Implementation Notes

1. **BIGSERIAL + UUID Pattern**: 
   - All tables use `id: bigserial` as PRIMARY KEY
   - All tables have `uuid` column for external references
   - Foreign keys always reference `id` (BIGINT), never `uuid`

2. **Winning Numbers Storage**:
   - Stored WITHOUT left-padding (e.g., "321" not "000321")
   - VARCHAR(6) to accommodate numbers of different lengths

3. **Indexes**:
   - Comprehensive indexing on all foreign keys
   - Additional indexes on frequently queried fields
   - Unique indexes on uuid, email, slug, payment_reference_id

4. **Enums**:
   - user_status: active, inactive
   - user_role: admin, user
   - campaign_status: active, drawing, completed, canceled
   - payment_type: direct, transfer
   - payment_status: pending, success, failed

5. **Constraints**:
   - Unique constraint on (campaign_id, ticket_number) in tickets
   - Unique constraint on (order_id, ticket_id) in order_tickets
   - Cascade delete on all foreign key relationships

## Files Created/Modified

### Created:
- `src/db/schema/users.ts`
- `src/db/schema/campaigns.ts`
- `src/db/schema/campaign-prizes.ts`
- `src/db/schema/tickets.ts`
- `src/db/schema/orders.ts`
- `src/db/schema/order-tickets.ts`
- `src/db/schema/winning-numbers.ts`
- `src/db/schema/index.ts`
- `src/types/index.ts`
- `scripts/verify-db.ts`
- `src/db/migrations/0000_parallel_doctor_faustus.sql`
- `src/db/migrations/0001_clumsy_warlock.sql`

### Modified:
- `src/db/index.ts` - Added schema import
- `scripts/seed.ts` - Implemented seed logic

## Next Steps (Phase 2)

Phase 2 will implement the Authentication System with Redis:
- Redis client setup
- JWT + Redis session management
- Auth service with bcrypt password hashing
- Auth API routes (login, logout, me)
- Auth middleware
- Admin login page

## Admin Credentials (Development)

```
Email: admin@company.com
Password: password123
```

⚠️ **IMPORTANT**: Change this password in production!
