# Implementation & Testing Plan

## Overview
This document outlines the step-by-step implementation plan for the Lottery system MVP, including development phases, testing strategies, and deployment procedures.

**Key Technologies**:
- Next.js 16.1.4 (App Router)
- Node.js 24.13.0
- PostgreSQL 16+ with Drizzle ORM
- Redis 7+ (required for authentication)
- TypeScript 5.x
- TailwindCSS 3.x + shadcn/ui
- Vitest (unit testing)

**Architecture Decisions**:
- BIGSERIAL IDs for internal references, UUIDs for external
- Redis-based JWT session management
- Query-first draw algorithm
- API versioning: `/api/v1/*`
- Admin namespace: `/api/v1/admin/*`
- Payment page with state-based success view

---

## Development Phases

### Phase 0: Project Setup (Week 1, Days 1-2)

#### Tasks
1. **Initialize Next.js Project**
   - [ ] Create Next.js 16.1.4 project with TypeScript
   - [ ] Configure App Router structure
   - [ ] Set up ESLint + Prettier
   - [ ] Configure Tailwind CSS
   - [ ] Install shadcn/ui CLI and initialize
   - [ ] Set up Git repository

2. **Database Setup (Native PostgreSQL)**
   - [ ] Install PostgreSQL 16 locally via Homebrew (macOS)
   - [ ] Create database: `createdb lottery_dev`
   - [ ] Install Drizzle ORM and dependencies
   - [ ] Configure database connection
   - [ ] Set up Drizzle Kit for migrations

3. **Redis Setup (Native Installation)**
   - [ ] Install Redis 7 via Homebrew (macOS)
   - [ ] Start Redis: `brew services start redis`
   - [ ] Test connection: `redis-cli ping`
   - [ ] Install `ioredis` client package

4. **Environment Configuration**
   - [ ] Create `.env.local` file
   - [ ] Set up environment variables validation (Zod)
   - [ ] Add required variables:
     ```
     DATABASE_URL=postgresql://localhost:5432/lottery_dev
     REDIS_URL=redis://localhost:6379
     JWT_SECRET=<generate-secure-secret>
     SENDGRID_API_KEY=<to-be-configured>
     SEPAY_WEBHOOK_JWT_SECRET=<generate-secure-secret>
     ```

5. **Project Structure**
   ```
   lottery/
   ├── src/
   │   ├── app/                    # Next.js App Router pages
   │   │   ├── (public)/          # Public pages group
   │   │   ├── (admin)/           # Admin pages group
   │   │   └── api/               # API routes
   │   │       └── v1/            # API version 1
   │   │           ├── admin/     # Admin endpoints
   │   │           ├── campaigns/ # Public campaign endpoints
   │   │           ├── tickets/   # Ticket endpoints
   │   │           ├── orders/    # Order endpoints
   │   │           └── webhooks/  # Webhook endpoints
   │   ├── components/            # React components
   │   │   ├── admin/             # Admin components
   │   │   ├── campaign/          # Campaign components
   │   │   └── ui/                # shadcn/ui components
   │   ├── lib/                   # Utilities, helpers
   │   │   ├── hooks/             # Custom React hooks
   │   │   └── utils/             # Utility functions
   │   ├── services/              # Business logic services
   │   ├── db/                    # Database schema & client
   │   │   ├── schema/            # Drizzle schema files
   │   │   ├── migrations/        # Migration files
   │   │   └── index.ts           # DB client
   │   ├── types/                 # TypeScript types
   │   └── config/                # App configuration
   ├── public/                    # Static assets
   ├── docs/                      # Documentation
   └── scripts/                   # Utility scripts (seed, etc.)
   ```

6. **Development Tools**
   - [ ] Set up Husky for git hooks (optional for MVP)
   - [ ] Configure lint-staged (optional)
   - [ ] Create npm scripts in package.json:
     ```json
     {
       "scripts": {
         "dev": "next dev",
         "build": "next build",
         "start": "next start",
         "lint": "next lint",
         "db:generate": "drizzle-kit generate",
         "db:push": "drizzle-kit push",
         "db:migrate": "drizzle-kit migrate",
         "db:seed": "tsx scripts/seed.ts",
         "test": "vitest",
         "test:ui": "vitest --ui"
       }
     }
     ```

7. **Testing Setup (Vitest)**
   - [ ] Install Vitest and testing dependencies
   - [ ] Create `vitest.config.ts`
   - [ ] Set up test utilities and helpers
   - [ ] Create sample test file

**Deliverable**: Working Next.js project with proper structure and configuration

**Testing**:
- Run `npm run dev` → App loads on localhost:3000
- Run `npm run lint` → No errors
- Test database connection
- Test Redis connection: `redis-cli ping` returns `PONG`

---

### Phase 1: Database & Core Models (Week 1, Days 3-5)

#### Tasks
1. **Define Database Schema (Drizzle)**

   Create schema files with **BIGSERIAL IDs + UUID**:

   - [ ] Create `src/db/schema/users.ts`
     ```typescript
     {
       id: bigserial (PRIMARY KEY)
       uuid: uuid (UNIQUE, for external ref)
       name, email, password_digest, phone
       status: enum('active', 'inactive')
       role: enum('admin', 'user')
       created_at, updated_at
     }
     ```

   - [ ] Create `src/db/schema/campaigns.ts`
     ```typescript
     {
       id: bigserial (PRIMARY KEY)
       uuid: uuid (UNIQUE)
       title, slug, description
       start_time, end_time
       ticket_price (integer, VND)
       payment_type: enum('direct', 'transfer')
       bank_name_or_code, account_number, account_holder_name
       sepay_gateway
       status: enum('active', 'drawing', 'completed', 'canceled')
       exclude_winning_numbers (boolean, default true)
       canceled_at
       created_at, updated_at
     }
     ```

   - [ ] Create `src/db/schema/campaign_prizes.ts`
     ```typescript
     {
       id: bigserial (PRIMARY KEY)
       uuid: uuid (UNIQUE)
       campaign_id: bigint (FK → campaigns.id)
       title, prizes_count, matching_digits (1-6)
       prize_value
       created_at, updated_at
     }
     ```

   - [ ] Create `src/db/schema/tickets.ts`
     ```typescript
     {
       id: bigserial (PRIMARY KEY)
       uuid: uuid (UNIQUE)
       campaign_id: bigint (FK)
       user_id: bigint (FK)
       ticket_number: varchar(6)
       is_winning: boolean (default false)
       created_at, updated_at
     }
     ```

   - [ ] Create `src/db/schema/orders.ts`
     ```typescript
     {
       id: bigserial (PRIMARY KEY)
       uuid: uuid (UNIQUE)
       campaign_id: bigint (FK)
       user_id: bigint (FK)
       tickets_count, total_amount
       payment_reference_id (unique)
       expires_at (for transfer payments)
       payment_type: enum
       payment_status: enum('pending', 'success', 'failed')
       error_message
       sepay_transaction_id
       received_at
       created_at, updated_at
     }
     ```

   - [ ] Create `src/db/schema/order_tickets.ts`
     ```typescript
     {
       id: bigserial (PRIMARY KEY)
       order_id: bigint (FK → orders.id)
       ticket_id: bigint (FK → tickets.id)
       created_at, updated_at
       UNIQUE(order_id, ticket_id)
     }
     ```

   - [ ] Create `src/db/schema/winning_numbers.ts`
     ```typescript
     {
       id: bigserial (PRIMARY KEY)
       uuid: uuid (UNIQUE)
       campaign_prize_id: bigint (FK)
       number: varchar (WITHOUT left-padding, e.g., "321")
       created_at, updated_at
     }
     ```

2. **Create Indexes**
   - [ ] Add indexes on foreign keys
   - [ ] Add indexes on: campaign_id, user_id, payment_reference_id, ticket_number, slug
   - [ ] Add unique indexes on uuid fields

3. **Create Initial Migration**
   - [ ] Run `npm run db:generate`
   - [ ] Review generated SQL
   - [ ] Run `npm run db:push`
   - [ ] Verify tables in PostgreSQL: `psql lottery_dev`

4. **Seed Data Script**
   - [ ] Create `scripts/seed.ts`
   - [ ] Seed admin user:
     ```typescript
     {
       email: "admin@company.com",
       password: "password123" (hashed with bcrypt),
       name: "Admin User",
       role: "admin",
       status: "active"
     }
     ```
   - [ ] Seed sample campaign (optional, for testing)
   - [ ] Add seed command: `npm run db:seed`

5. **Create TypeScript Types**
   - [ ] Generate types from Drizzle schema
   - [ ] Create DTOs (Data Transfer Objects) in `src/types/`
   - [ ] Create API request/response types

**Deliverable**: Database with all tables (BIGSERIAL + UUID), seed data, TypeScript types

**Testing**:
- Verify tables exist: `psql lottery_dev -c "\dt"`
- Verify schema: Check id (bigserial) and uuid columns
- Run seed script: `npm run db:seed`
- Query admin user: `SELECT * FROM users WHERE role = 'admin';`
- Verify foreign key relationships

---

### Phase 2: Authentication System with Redis (Week 2, Days 1-3)

#### Tasks
1. **Redis Client Setup**
   - [ ] Install `ioredis` package
   - [ ] Create `src/lib/redis.ts` client
   - [ ] Test Redis connection
   - [ ] Create Redis utility functions

2. **Auth Service with Redis Sessions**
   - [ ] Create `src/services/auth.service.ts`
   - [ ] Implement password hashing (bcrypt, salt rounds = 10)
   - [ ] Implement token_base generation (UUID v4)
   - [ ] Implement Redis session management:
     ```typescript
     // Create session
     async createSession(userId: number, rememberMe: boolean) {
       const tokenBase = uuidv4();
       const ttl = rememberMe ? 7 * 24 * 3600 : 2 * 3600; // 7 days or 2 hours
       await redis.set(
         `session:${tokenBase}`,
         JSON.stringify({ userId, rememberMe, timestamp: Date.now() }),
         'EX',
         ttl
       );
       return tokenBase;
     }

     // Get session
     async getSession(tokenBase: string) {
       const data = await redis.get(`session:${tokenBase}`);
       return data ? JSON.parse(data) : null;
     }

     // Delete session (logout)
     async deleteSession(tokenBase: string) {
       await redis.del(`session:${tokenBase}`);
     }

     // Update TTL (on each request)
     async updateSessionTTL(tokenBase: string, rememberMe: boolean) {
       const ttl = rememberMe ? 7 * 24 * 3600 : 2 * 3600;
       await redis.expire(`session:${tokenBase}`, ttl);
     }
     ```
   - [ ] Implement JWT generation with token_base as subject
   - [ ] Implement JWT verification + Redis lookup

3. **Auth API Routes** (`/api/v1/admin/auth/*`)
   - [ ] Create `/api/v1/admin/auth/login/route.ts`
     ```typescript
     POST /api/v1/admin/auth/login
     Request: { email, password, rememberMe }
     Flow:
     1. Validate credentials (bcrypt.compare)
     2. Generate token_base (UUID v4)
     3. Store in Redis: session:{token_base} with TTL
     4. Generate JWT with token_base as subject
     5. Set HttpOnly cookie with JWT
     6. Return user info + token
     ```

   - [ ] Create `/api/v1/admin/auth/logout/route.ts`
     ```typescript
     POST /api/v1/admin/auth/logout
     Flow:
     1. Extract JWT from cookie
     2. Decode to get token_base
     3. Delete from Redis: DEL session:{token_base}
     4. Clear cookie
     5. Return success
     ```

   - [ ] Create `/api/v1/admin/auth/me/route.ts`
     ```typescript
     GET /api/v1/admin/auth/me
     Flow:
     1. Extract JWT from cookie
     2. Verify JWT and decode token_base
     3. GET from Redis: session:{token_base}
     4. If not found → return 401
     5. Update TTL based on rememberMe flag
     6. Return user info
     ```

   - [ ] Add request validation (Zod schemas)
   - [ ] Add error handling (401, 500)

4. **Auth Middleware**
   - [ ] Create `src/middleware.ts`
   - [ ] Implement JWT verification
   - [ ] Implement Redis session lookup
   - [ ] Protect `/admin/*` routes (except `/admin/login`)
   - [ ] Add redirect logic: unauthenticated → `/admin/login`
   - [ ] Handle session expiration (SESSION_EXPIRED error)

5. **Admin Login Page**
   - [ ] Create `/app/admin/login/page.tsx`
   - [ ] Use minimal layout (no sidebar)
   - [ ] Create login form component
   - [ ] Use React Hook Form + Zod validation
   - [ ] Add fields: email, password, rememberMe checkbox
   - [ ] Implement form submission (call login API)
   - [ ] Handle errors (invalid credentials, session expired)
   - [ ] Redirect to `/admin/campaigns` on success

6. **Auth State Management**
   - [ ] Create `useAuth` hook
   - [ ] Implement client-side auth checks
   - [ ] Handle logout functionality

**Deliverable**: Working Redis-backed authentication system

**Testing**:
- Login with seeded admin → Should redirect to `/admin/campaigns`
- Check Redis: `redis-cli GET "session:{token_base}"` → Should return session data
- Test invalid credentials → Should show error
- Test protected route without login → Should redirect to `/admin/login`
- Logout → Redis session deleted, redirect to login
- Login with "Remember me" → Redis TTL = 7 days (604800s)
- Login without "Remember me" → Redis TTL = 2 hours (7200s)
- Access `/api/v1/admin/auth/me` → TTL should be updated
- Manually delete Redis session → Next request returns 401

---

### Phase 3: Campaign Management (Week 2, Days 4-5 + Week 3, Days 1-2)

#### Tasks
1. **Campaign Service**
   - [ ] Create `src/services/campaign.service.ts`
   - [ ] Implement CRUD operations (using BIGINT IDs)
   - [ ] Implement slug generation from title
   - [ ] Implement validation logic
   - [ ] Add statistics calculation (tickets sold, participants)
   - [ ] Implement status transitions:
     - `active` → `drawing` (when first draw starts)
     - `active` → `canceled` (admin cancels)
     - `drawing` → `completed` (admin completes)

2. **Campaign API Routes** (`/api/v1/admin/campaigns/*`)
   - [ ] Create `/api/v1/admin/campaigns/route.ts` (GET list, POST create)
   - [ ] Create `/api/v1/admin/campaigns/[id]/route.ts` (GET, PUT)
     - PUT handles: update info, cancel (status='canceled'), complete (status='completed')
   - [ ] Create `/api/v1/campaigns/[slug]/route.ts` (public GET)
   - [ ] Add Zod validation schemas
   - [ ] Handle status transition validations:
     - Can only cancel if status = 'active'
     - Can only complete if status = 'drawing' and all prizes drawn
   - [ ] Add error handling

3. **Admin Campaigns List Page**
   - [ ] Create `/app/admin/campaigns/page.tsx`
   - [ ] Use admin layout with sidebar
   - [ ] Create campaigns table component
   - [ ] Add status filter: all, active, drawing, completed, canceled
   - [ ] Display status badges with colors:
     - active: green
     - drawing: blue
     - completed: gray
     - canceled: red
   - [ ] Add search by title
   - [ ] Add pagination
   - [ ] Add actions: Edit, Draw, Cancel/Complete
   - [ ] Add cancel confirmation modal
   - [ ] Show "Go to Draw" button for active/drawing campaigns

4. **Admin Campaign Form (Create/Edit)**
   - [ ] Create `/app/admin/campaigns/new/page.tsx`
   - [ ] Create `/app/admin/campaigns/[id]/edit/page.tsx`
   - [ ] Create campaign form component with **3 sections**:

     **Section 1: Campaign Info**
     - Title (auto-generate slug)
     - Slug (editable)
     - Description (markdown editor)
     - Start Date & Time (dayjs datetime picker)
     - End Date & Time
     - Ticket Price (VND)
     - Status (active/inactive radio)

     **Section 2: Prizes Settings**
     - Dynamic array of prizes
     - Fields: title, prizes_count, matching_digits (1-6), prize_value
     - Add/Remove prize buttons
     - Validation: at least 1 prize required

     **Section 3: Payment Settings**
     - Payment Type (direct/transfer radio)
     - Conditional fields (show only if transfer):
       - Bank Name or Code
       - Account Number
       - Account Holder Name
       - SePay Gateway URL
     - Exclude Winning Numbers (checkbox, default true)

   - [ ] Implement form validation (React Hook Form + Zod)
   - [ ] Handle form submission
   - [ ] Add "Cancel Campaign" button (edit page only, status check)
   - [ ] Add "Complete Campaign" button (edit page only, for status='drawing')

5. **shadcn/ui Components**
   - [ ] Install components: Button, Input, Form, Select, Textarea, Dialog, Table, Badge, Switch
   - [ ] Customize theme colors

**Deliverable**: Complete campaign management system

**Testing**:
- Create campaign → Verify in DB (id=BIGSERIAL, uuid generated, status='active')
- Edit campaign info → Changes saved
- Cancel campaign (status='active') → Should succeed, status='canceled', canceled_at set
- Try cancel campaign (status='drawing') → Should fail with CANNOT_CANCEL error
- Try cancel campaign (status='completed') → Should fail
- Test slug uniqueness validation
- Test date validation (end > start)
- Test payment type conditional fields (only show for transfer)
- Verify 3-section form layout
- Test dynamic prizes array (add/remove)

---

### Phase 4: Public Campaign View (Week 3, Days 3-4)

#### Tasks
1. **Campaign Detail Page (Public)**
   - [ ] Create `/app/campaigns/[slug]/page.tsx`
   - [ ] Fetch campaign by slug (SSR)
   - [ ] Render markdown description
   - [ ] Display prize list table
   - [ ] Show statistics (tickets sold, participants count)
   - [ ] Add countdown timer (before start_time)
   - [ ] Show/hide purchase form based on:
     - Campaign status must be 'active'
     - Current time must be between start_time and end_time
   - [ ] If campaign canceled: Show "Campaign đã bị hủy"
   - [ ] If campaign drawing/completed: Show "Campaign đã kết thúc"

2. **Campaign Stats Service**
   - [ ] Add method to count tickets sold (by campaign_id)
   - [ ] Add method to count unique participants (DISTINCT user_id)
   - [ ] Use efficient queries with indexes

3. **UI Components**
   - [ ] Create prize table component
   - [ ] Create countdown timer component (using dayjs)
   - [ ] Create campaign header component

**Deliverable**: Public-facing campaign detail page

**Testing**:
- Visit `/campaigns/:slug` → Should display campaign
- Check stats → Should show correct counts
- Before start_time → Show countdown, hide purchase form
- Between start/end time, status='active' → Show purchase form
- After end_time → Hide purchase form
- Status='canceled' → Show canceled message
- Status='drawing' or 'completed' → Hide purchase form
- Invalid slug → Show 404

---

### Phase 4.1: Payment Integration Updates (Week 3, Day 5)

#### Tasks
1. **Update Campaign Schema & Payment Settings**
   - [ ] Remove `account_holder_name` field from campaigns table
   - [ ] Remove `sepay_gateway` field from campaigns table
   - [ ] Update campaign edit form to remove these fields
   - [ ] Add `SEPAY_WEBHOOK_JWT_SECRET` to environment variables

2. **Update Campaign Edit Form - Payment Section**
   - [ ] Remove "Account Holder Name" field
   - [ ] Remove "SePay Gateway URL" field
   - [ ] Add "SePay Webhook API Key" field (read-only)
   - [ ] Generate JWT token with campaign UUID as subject using `SEPAY_WEBHOOK_JWT_SECRET`
   - [ ] Display generated JWT token in the field for admin to copy

3. **Update Order Payment Reference ID Generation**
   - [ ] Change format from `ORD-{timestamp}-{random}` to `LTR{6-digit-number}`
   - [ ] Implement counter-based generation: Find highest number, increment by 1
   - [ ] Handle initial case (no orders yet): Start from `LTR000001`
   - [ ] Ensure uniqueness with database constraint

4. **Update QR Code Generation**
   - [ ] Change VietQR URL to use `https://qr.sepay.vn/img`
   - [ ] Update query parameters:
     - `acc`: accountNumber from campaign
     - `bank`: bankNameOrCode from campaign
     - `amount`: totalAmount from order
     - `des`: paymentReferenceId (e.g., "LTR102969")
   - [ ] Example: `https://qr.sepay.vn/img?acc=0706213188&bank=Vietcombank&amount=100000&des=LTR102969`

5. **Update Webhook Endpoint (`/api/v1/webhooks/sepay/route.ts`)**
   - [ ] Implement JWT authentication:
     - Extract API key from header: `Authorization: Apikey {JWT}`
     - Verify JWT using `SEPAY_WEBHOOK_JWT_SECRET` (skip expiration check)
     - Decode JWT to get campaign UUID from `sub` claim
     - Find campaign by UUID (any status is acceptable)
     - If campaign not found: Return 203

   - [ ] Update payload extraction to match new format:
     ```typescript
     {
       gateway: string,
       transactionDate: string,
       accountNumber: string,
       subAccount: string | null,
       code: string,  // This is paymentReferenceId
       content: string,
       transferType: string,
       description: string | null,
       transferAmount: number,
       referenceCode: string,  // This is sepayTransactionId
       accumulated: number,
       id: number
     }
     ```

   - [ ] Implement reconciliation logic:
     - Find order by `payload.code` (paymentReferenceId)
     - Check `payload.transferAmount` === `order.totalAmount`
     - Check `payload.accountNumber` === `order.campaign.accountNumber`
     - If mismatch:
       - Set order.payment_status = 'failed'
       - Set order.error_message = stringify({ ...payload, reconciliationResult: "mismatch details" })
       - Return 203
     - If match and order.payment_status = 'success':
       - Return 208 (already processed, idempotency)
     - If match and order.payment_status = 'pending':
       - Set order.payment_status = 'success'
       - Set order.sepay_transaction_id = payload.referenceCode
       - Set order.received_at = new Date()
       - Set order.transaction_date = payload.transactionDate
       - Generate and create tickets
       - Trigger email job
       - Return 200

6. **Add transaction_date Column to Orders Table**
   - [ ] Add `transaction_date` column (TIMESTAMP, NULLABLE) to orders table
   - [ ] Create migration file
   - [ ] Update Drizzle schema

**Deliverable**: Updated payment integration with SePay webhook and new QR format

**Testing**:
- Edit campaign → Verify removed fields not shown
- Edit campaign → Verify JWT token generated and displayed
- Create order → Verify paymentReferenceId format is LTR + 6 digits
- Generate QR → Verify new URL format with correct params
- Mock webhook with valid JWT → Should succeed
- Mock webhook with invalid JWT → Should return 203
- Mock webhook with valid data → Should update order and create tickets
- Mock webhook with mismatched amount → Should fail order with error message
- Mock webhook for already processed order → Should return 208
- Verify transaction_date saved correctly from webhook

---

### Phase 5: Ticket Purchase Flow (Week 3, Day 5 + Week 4, Days 1-3)

#### Tasks
1. **User Service**
   - [ ] Create `src/services/user.service.ts`
   - [ ] Implement find or create user by email
   - [ ] Handle user data validation

2. **Ticket Service**
   - [ ] Create `src/services/ticket.service.ts`
   - [ ] Implement unique 6-digit ticket number generation
   - [ ] Algorithm: Random generation + check uniqueness in DB
   - [ ] Implement ticket creation (batch insert)
   - [ ] Add method to check number availability

3. **Order Service**
   - [ ] Create `src/services/order.service.ts`
   - [ ] Implement order creation
   - [ ] Implement payment reference ID generation (updated in Phase 4.1):
     - Format: `/^LTR\d{6}$/` (e.g., "LTR000001", "LTR102969")
     - Algorithm: Counter-based generation
       1. Query highest existing payment_reference_id matching pattern
       2. Extract number part and increment by 1
       3. If no orders exist yet, start from "LTR000001"
       4. Format: `LTR${number.toString().padStart(6, '0')}`
     - Ensure uniqueness with database constraint
   - [ ] Set expires_at = now + 10 minutes (for transfer)
   - [ ] Implement status update methods
   - [ ] Implement order_tickets linking (ticket_id FK)

4. **Purchase API**
   - [ ] Create `/api/v1/tickets/purchase/route.ts`
   - [ ] Implement purchase flow:
     ```typescript
     1. Validate input (Zod)
     2. Check campaign status = 'active'
     3. Check current time within campaign start/end
     4. Find/create user by email
     5. Create order (payment_status = 'pending', id/uuid generated)
     6. Generate payment_reference_id
     7. Set expires_at (now + 10 min, for transfer only)

     IF payment_type = 'direct':
       8a. Set payment_status = 'success'
       8b. Generate unique ticket numbers
       8c. Create tickets in DB (id/uuid auto-generated)
       8d. Create order_tickets (ticket_id FK)
       8e. Trigger email job
       8f. Return order with tickets

    IF payment_type = 'transfer':
      8a. Generate QR URL (updated in Phase 4.1):
          Format: https://qr.sepay.vn/img?acc={accountNumber}&bank={bankNameOrCode}&amount={totalAmount}&des={paymentReferenceId}
      8b. Return payment info + QR URL
      8c. Client will poll for status updates
     ```
   - [ ] Add comprehensive error handling
   - [ ] Handle concurrent purchases (ticket number uniqueness)

5. **Order Status API (for polling)**
   - [ ] Create `/api/v1/orders/[referenceId]/route.ts`
   - [ ] Return order with:
     - payment_status
     - tickets (if payment_status = 'success')
     - error_message (if payment_status = 'failed')
   - [ ] Handle all states: pending, success, failed

6. **Purchase Form Component**
   - [ ] Create ticket purchase form
   - [ ] Fields: name, email, phone, tickets_count
   - [ ] Implement quantity selector with price calculation
   - [ ] Use React Hook Form + Zod validation
   - [ ] Phone validation: /^0\d{9}$/
   - [ ] Add form submission
   - [ ] Handle loading states

7. **Payment Page with Success State**
   - [ ] Create `/app/orders/[referenceId]/payment/page.tsx`
   - [ ] Manage 4 states via React state:

     **State 1: Pending** (default for transfer payment)
     - Display QR code (large, scannable)
     - Display bank account details
     - Display payment reference ID
     - Display countdown timer (10 minutes)
     - Implement polling: call `/api/v1/orders/[referenceId]` every 3 seconds
     - Stop polling when status changes

     **State 2: Success** (after webhook updates status)
     - Hide QR and countdown
     - Show success icon/animation
     - Show "Thanh toán thành công!" message
     - Show order details with ticket numbers
     - Show email notification message
     - Show buttons: "Quay về trang chủ", "Xem campaign"

     **State 3: Failed**
     - Show error message
     - Show "Thử lại" button

     **State 4: Timeout** (after 10 minutes)
     - Show "Hết thời gian thanh toán" message
     - Show "Thử lại" button

8. **Direct Payment Flow**
   - [ ] For payment_type = 'direct':
     - Purchase API immediately creates tickets
     - Navigate directly to payment page in "success" state
     - Skip QR code and polling

9. **Polling Implementation**
   - [ ] Create `useOrderPolling` hook
   - [ ] Poll every 3 seconds while status = 'pending'
   - [ ] Stop polling when status changes or component unmounts
   - [ ] Handle network errors gracefully

**Deliverable**: Working ticket purchase flow with state-based success

**Testing**:
- Purchase (direct) → Immediate success, tickets created
- Purchase (transfer) → Show QR, start polling
- Mock webhook update → Payment page updates to success state
- Test polling: verify API called every 3 seconds
- Verify tickets only created after payment success (transfer)
- Verify tickets created immediately (direct)
- Test timeout → After 10 min, show timeout message
- Test concurrent purchases → No duplicate ticket numbers
- Purchase on canceled campaign → Should fail
- Purchase after end_time → Should fail

---

### Phase 6: Payment Integration (Week 4, Days 4-5 + Week 5, Days 1-2)

#### Tasks
1. **Payment Service**
   - [ ] Create `src/services/payment.service.ts`
   - [ ] Implement QR URL generation (updated in Phase 4.1):
     - URL format: `https://qr.sepay.vn/img?acc={accountNumber}&bank={bankNameOrCode}&amount={amount}&des={referenceId}`
     - No need for `qrcode` library, just return URL string
   - [ ] Implement JWT verification for webhook authentication (Phase 4.1)
   - [ ] Implement reconciliation logic (Phase 4.1)
   - [ ] Implement webhook processing logic

2. **Webhook Endpoint** (Updated in Phase 4.1)
   - [ ] Create `/api/v1/webhooks/sepay/route.ts`
   - [ ] Flow:
     ```typescript
     POST /api/v1/webhooks/sepay
     Header: Authorization: Apikey {JWT}

     1. Extract JWT from Authorization header
     2. Verify JWT using SEPAY_WEBHOOK_JWT_SECRET (skip expiration)
     3. Decode JWT to get campaign UUID from subject
     4. Find campaign by UUID (any status)
     5. If campaign not found → Return 203
     6. Extract webhook payload (SePay format)
     7. Find order by payload.code (payment_reference_id)
     8. Reconcile transaction:
        - Check payload.transferAmount === order.totalAmount
        - Check payload.accountNumber === order.campaign.accountNumber
     9. If reconciliation fails:
        - Set payment_status = 'failed'
        - Set error_message = stringify({ ...payload, reconciliationResult })
        - Return 203
     10. If order.payment_status = 'success' → Return 208 (idempotency)
     11. If reconciliation succeeds and status = 'pending':
         - payment_status = 'success'
         - sepay_transaction_id = payload.referenceCode
         - received_at = new Date()
         - transaction_date = payload.transactionDate
         - Generate unique ticket numbers (6 digits, random)
         - Create tickets in tickets table (batch insert)
         - Create order_tickets (ticket_id FK to tickets.id)
         - Trigger email job
         - Return 200 OK
     ```
   - [ ] Implement idempotency (check if already processed)
   - [ ] Add error handling and logging
   - [ ] Handle payment failures

3. **Testing Webhook**
   - [ ] Create test endpoint or script to mock SePay webhook
   - [ ] Test with real SePay payload structure
   - [ ] Verify JWT authentication works

**Deliverable**: Complete payment integration with SePay webhook

**Testing**:
- Purchase tickets (transfer) → Show QR URL and payment info
- Mock webhook call with valid JWT → Should succeed
- Mock webhook with invalid JWT → Should return 203
- Mock webhook with mismatched amount → Should fail order, return 203
- Mock webhook with mismatched account → Should fail order, return 203
- Test idempotency: send same webhook twice → First 200, second 208
- Verify tickets created only after webhook success
- Verify order_tickets links to ticket_id (not ticket_number)
- Verify transaction_date saved from webhook
- Test timeout scenario (manually set expires_at in past)
- Verify polling updates payment page to success state

---

### Phase 7: Email Notification (Week 5, Days 3-4)

#### Tasks
1. **Email Service**
   - [ ] Create `src/services/email.service.ts`
   - [ ] Set up SendGrid client
   - [ ] Implement email sending method
   - [ ] Add retry logic (3 attempts)
   - [ ] Log success/failure

2. **Ticket Image Generation**
   - [ ] Install `canvas` (node-canvas)
   - [ ] Create ticket template image design
   - [ ] Implement canvas-based generation:
     ```typescript
     async generateTicketImage(ticket: Ticket, campaign: Campaign) {
       // Load template image
       // Draw ticket number on canvas
       // Draw user name
       // Draw campaign title
       // Export as PNG buffer
     }
     ```

3. **Email Template**
   - [ ] Design HTML email template
   - [ ] Include campaign info
   - [ ] List ticket numbers
   - [ ] Add terms and instructions
   - [ ] Make responsive

4. **Email Sending Integration**
   - [ ] Trigger email after payment success (webhook)
   - [ ] Generate ticket images (one per ticket)
   - [ ] Compose email with attachments
   - [ ] Send via SendGrid API
   - [ ] Log results

5. **Background Job (Simple)**
   - [ ] Create in-memory email queue (for MVP)
   - [ ] Add retry mechanism
   - [ ] Log failures for manual review

**Deliverable**: Automatic email delivery with ticket images

**Testing**:
- Complete purchase → Should receive email
- Check inbox (and spam folder)
- Verify ticket images attached (one per ticket)
- Verify ticket numbers match order
- Test SendGrid failure (mock) → Should retry
- Test with 5+ tickets → All images attached
- Verify email template renders correctly

---

### Phase 8: Campaign Drawing Completion (Week 5, Day 5)

#### Tasks
1. **Campaign Status Management**
   - [ ] Update campaign service with status transitions
   - [ ] Implement validation:
     - `active` → `drawing`: allowed
     - `drawing` → `completed`: only if all prizes drawn
     - `active` → `canceled`: allowed
     - Cannot transition out of `canceled` or `completed`

2. **Complete Campaign via PUT**
   - [ ] Update `/api/v1/admin/campaigns/[id]/route.ts` PUT endpoint
   - [ ] Handle `status: 'completed'` update:
     ```typescript
     1. Verify all prizes have winning_numbers
     2. Update campaign status = 'completed'
     3. Find all orders with payment_status = 'pending'
     4. Update to payment_status = 'failed', error_message = "Campaign đã hoàn thành"
     5. Return failedOrdersCount
     ```

3. **Draw Interface Updates**
   - [ ] Add "Bắt đầu quay số" button
     - Show confirm dialog
     - Update campaign status to 'drawing'
   - [ ] Add "Hoàn thành quay số" button (after all prizes drawn)
     - Show confirm dialog with warning
     - Call PUT /api/v1/admin/campaigns/:id with status='completed'
     - Redirect to campaigns list

**Deliverable**: Campaign completion flow

**Testing**:
- Start draw → Status = 'drawing'
- Try purchase on 'drawing' campaign → Should fail
- Complete all draws → "Hoàn thành" button enabled
- Complete campaign → Status = 'completed', pending orders failed
- Try draw on 'completed' campaign → Should fail

---

### Phase 9: Draw System - Backend Logic (Week 6, Days 1-3)

#### Tasks
1. **Draw Service (Query-First Algorithm)**
   - [ ] Create `src/services/draw.service.ts`
   - [ ] Implement query-first algorithm:
     ```typescript
     async queryWinningNumber(
       campaignId: number,
       matchingDigits: number,
       excludeWinning: boolean
     ): Promise<string> {
       // 1. Query distinct suffixes from sold tickets
       // 2. Match from RIGHT (last N digits)
       // 3. Exclude tickets where is_winning=true if excludeWinning
       // 4. Randomly select one suffix
       // 5. Return WITHOUT left-padding (e.g., "321" for matching_digits=3)

       // Example SQL:
       // SELECT DISTINCT RIGHT(ticket_number, ${matchingDigits}) as suffix
       // FROM tickets
       // WHERE campaign_id = ?
       // AND (is_winning = false OR NOT excludeWinning)
     }
     ```
   - [ ] Implement find matching tickets (RIGHT match)
   - [ ] Implement save winning number (store WITHOUT padding)
   - [ ] Implement mark tickets as is_winning = true
   - [ ] Implement redo logic (unmark tickets)
   - [ ] Implement prize ordering:
     ```typescript
     ORDER BY matching_digits ASC, created_at ASC
     ```

2. **Draw API Routes** (`/api/v1/admin/campaigns/:campaignId/*`)
   - [ ] Create `/api/v1/admin/campaigns/[campaignId]/prizes/route.ts`
     - GET: Return prizes with draw status

   - [ ] Create `/api/v1/admin/campaigns/[campaignId]/draw/route.ts`
     - POST: Draw winning number
     ```typescript
     Request: { prizeId, draftMode }
     Flow:
     1. Get prize matching_digits
     2. Call queryWinningNumber (query DB FIRST)
     3. Find matching tickets
     4. If draftMode=false:
        - Save winning_number (WITHOUT padding)
        - Mark tickets as is_winning=true
        - Return savedWinningNumber object with id
     5. If draftMode=true:
        - Just return number and winners
     6. Client animates to this number
     ```

   - [ ] Create `/api/v1/admin/winning_numbers/[id]/route.ts`
     - DELETE: Redo draw
     ```typescript
     1. Delete winning_number by id
     2. Unmark tickets (is_winning=false)
     3. Return success
     ```

   - [ ] Add validation and error handling

3. **Winning Number Storage**
   - [ ] Store numbers WITHOUT left-padding
   - [ ] Examples:
     - matching_digits=3, number="321" (not "000321")
     - matching_digits=6, number="123456"
     - matching_digits=2, number="45" (not "000045")

**Deliverable**: Complete draw backend with query-first approach

**Testing**:
- Create test tickets with known numbers
- Test query algorithm → Always returns existing ticket
- Test matching_digits = 2, 3, 6
- Test exclude_winning_numbers = true → Previous winners excluded
- Test redo (DELETE) → winning_number deleted, tickets unmarked
- Test draft mode → Not saved to DB
- Verify matching from RIGHT: "123321" matches "321"
- Verify prize ordering (matching_digits ASC, created_at ASC)
- Verify winning_number stored without padding

---

### Phase 10: Draw System - Frontend Interface (Week 6, Days 4-5 + Week 7, Days 1-2)

#### Tasks
1. **Scrolling Meter Component**
   - [ ] Create `src/components/admin/ScrollingMeter.tsx`
   - [ ] Implement 6-digit display (large, bold)
   - [ ] Each digit in separate box
   - [ ] Implement scrolling animation (0-9 continuously)
   - [ ] Implement stop animation:
     - Decelerate from right to left
     - Each digit stops at predetermined value
     - ~5 seconds total
   - [ ] Handle padding for matching_digits < 6 (left digits stay "0")
   - [ ] Use Framer Motion or CSS animations

2. **Results Table Component**
   - [ ] Create `src/components/admin/ResultsTable.tsx`
   - [ ] Display prizes (sorted by matching_digits ASC, created_at ASC)
   - [ ] Show placeholders: `______` (underscores, width matches number)
   - [ ] Show loading spinner during draw (same width)
   - [ ] Show winning numbers after draw
   - [ ] Add "Quay giải" icon button for each prize
   - [ ] Add "Redo" icon button (when drawn)
   - [ ] Expand row to show winners list

3. **Draw Interface Page (Full-Screen Layout)**
   - [ ] Create `/app/admin/campaigns/[id]/draw/page.tsx`
   - [ ] Use **full-screen layout** (NO admin sidebar)
   - [ ] Page header:
     - Back button (to campaigns list)
     - Campaign title (centered)
     - Draft mode toggle (default: ON)
     - Warning badge when draft ON
     - Logout button (top-right)
   - [ ] Main layout: 2-column grid
     - Left: ScrollingMeter
     - Right: ResultsTable
   - [ ] Implement draw flow (query-first):
     ```typescript
     1. Admin clicks "Quay giải" for a prize
     2. Call POST /api/v1/admin/campaigns/:id/draw
     3. API queries DB and returns winning number
     4. Start scrolling animation
     5. Admin clicks "Stop"
     6. Animate digits stopping to the returned number (right to left)
     7. Show winner popup
     8. If draftMode=false: Already saved by API
     ```
   - [ ] Add "Bắt đầu quay số" button (first time)
   - [ ] Add "Hoàn thành quay số" button (after all drawn)

4. **Winner Popup Component**
   - [ ] Create winner announcement modal
   - [ ] Display winning number (large, formatted)
   - [ ] List winners with nicknames and ticket numbers
   - [ ] If no winners: "Không có vé trúng giải"
   - [ ] Buttons: "Đóng", "Quay giải tiếp"

5. **Redo Confirmation**
   - [ ] Show confirm dialog on "Redo" click
   - [ ] Warning: "Kết quả hiện tại sẽ bị xóa"
   - [ ] If confirmed: DELETE /api/v1/admin/winning_numbers/:id

6. **State Management**
   - [ ] Create draw state (Zustand or React state)
   - [ ] Track current prize being drawn
   - [ ] Track animation state
   - [ ] Track drawn results

**Deliverable**: Complete draw interface with full-screen UX

**Testing**:
- Navigate to draw page → Loads with full-screen layout (no sidebar)
- Prizes sorted correctly (matching_digits ASC, created_at ASC)
- Toggle draft mode → Warning shows/hides
- Click "Bắt đầu quay số" → Campaign status = 'drawing'
- Click "Quay giải" → API called FIRST, returns number
- Start animation → Digits scroll continuously
- Click "Stop" → Digits animate to predetermined number (right to left)
- Verify winning number displayed without left padding
- Winner popup shows correct winners
- Test redo → Confirmation, then DELETE API called
- Official mode → Saved to DB with correct format
- Complete all draws → "Hoàn thành" button enabled
- Complete campaign → Status = 'completed'

---

### Phase 11: Polish & UX Improvements (Week 7, Days 3-5)

#### Tasks
1. **Landing Page Redirect**
   - [ ] Update `/app/page.tsx`
   - [ ] Implement redirect to `/admin/login`
   ```typescript
   import { redirect } from 'next/navigation';
   export default function Home() {
     redirect('/admin/login');
   }
   ```

2. **UI/UX Enhancements**
   - [ ] Add loading states to all buttons
   - [ ] Add skeleton loaders for data fetching
   - [ ] Add toast notifications (success, error) using sonner
   - [ ] Improve form error messages (inline, clear)
   - [ ] Add confirmation dialogs for destructive actions
   - [ ] Optimize mobile responsiveness
   - [ ] Add loading.tsx files for pages

3. **Error Pages**
   - [ ] Create `/app/not-found.tsx` (404)
   - [ ] Create `/app/error.tsx` (500)
   - [ ] Design error states with helpful messages

4. **Performance Optimization**
   - [ ] Implement React Query caching for campaign data
   - [ ] Add database query optimization (check slow queries)
   - [ ] Optimize images with Next.js Image component
   - [ ] Add proper loading states

5. **Accessibility**
   - [ ] Add ARIA labels to interactive elements
   - [ ] Test keyboard navigation (Tab, Enter, Esc)
   - [ ] Ensure color contrast (WCAG AA)
   - [ ] Add focus indicators

6. **Admin Layout Refinement**
   - [ ] Top Bar: Breadcrumbs + User dropdown (NO search, NO notifications)
   - [ ] Sidebar: Logo, Campaigns, User info, Logout
   - [ ] Responsive: Sidebar collapses to hamburger on mobile

**Deliverable**: Polished, production-ready application

**Testing**:
- Visit `/` → Redirects to `/admin/login`
- Test all pages on mobile (iPhone, Android)
- Test with slow network (Chrome DevTools throttling)
- Test keyboard navigation (all forms, modals)
- Test loading states (all buttons, page loads)
- Test error states (network errors, validation)
- Test accessibility with Lighthouse

---

### Phase 12: Testing & QA (Week 8, Days 1-3)

#### Tasks
1. **Unit Testing (Vitest)**
   - [ ] Test services (auth, campaign, ticket, order, draw)
   - [ ] Test utilities (ticket generation, number validation)
   - [ ] Test API route handlers
   - [ ] Aim for >70% coverage on critical paths

   Example:
   ```typescript
   // src/services/__tests__/ticket.service.test.ts
   describe('TicketService', () => {
     it('generates unique 6-digit numbers', async () => {
       const numbers = await ticketService.generateTicketNumbers(1, 10);
       expect(numbers).toHaveLength(10);
       expect(new Set(numbers).size).toBe(10); // All unique
       numbers.forEach(num => expect(num).toMatch(/^\d{6}$/));
     });
   });
   ```

2. **Manual Testing (All Use Cases)**
   - [ ] UC01: Admin Login (Redis session)
   - [ ] UC02: Admin Logout (Redis cleanup)
   - [ ] UC03-UC06: Campaign CRUD (create, read, update, cancel/complete)
   - [ ] UC07: Guest Purchase Tickets (direct + transfer)
   - [ ] UC08: Payment Webhook Processing
   - [ ] UC09: Order Status Polling
   - [ ] UC10: Email Notification
   - [ ] UC11-UC12: Draw Prize (draft + official)
   - [ ] UC13: Redo Draw (DELETE winning_number)
   - [ ] UC14: Complete Campaign (fail pending orders)

3. **Edge Cases Testing**
   - [ ] Concurrent ticket purchases (no duplicates)
   - [ ] Payment timeout (10 minutes)
   - [ ] Email failures (retry logic)
   - [ ] Draw with no matching tickets (error handling)
   - [ ] Campaign boundary conditions (start/end times)
   - [ ] Redis session expiration
   - [ ] JWT token expiration
   - [ ] Webhook idempotency

4. **Integration Testing**
   - [ ] Complete guest journey (view → purchase → payment → email)
   - [ ] Complete admin journey (login → create → draw → complete)
   - [ ] Webhook integration (mock SePay)
   - [ ] Email integration (SendGrid sandbox)

5. **Performance Testing**
   - [ ] Measure API response times (<2s target)
   - [ ] Check database query performance
   - [ ] Test with 50 concurrent users (simulate company)
   - [ ] Optimize slow queries

6. **Security Testing**
   - [ ] Test auth bypass attempts
   - [ ] Test SQL injection (Drizzle should prevent)
   - [ ] Test XSS attacks (React should prevent)
   - [ ] Test CSRF (SameSite cookies)
   - [ ] Review environment variable security

7. **Browser Compatibility**
   - [ ] Chrome (latest)
   - [ ] Firefox (latest)
   - [ ] Safari (latest)
   - [ ] Mobile Safari (iOS)
   - [ ] Mobile Chrome (Android)

**Deliverable**: Tested, bug-free application

**Testing Checklist**:
- [ ] All use cases pass
- [ ] No critical bugs
- [ ] Performance meets requirements (<2s)
- [ ] Security vulnerabilities addressed
- [ ] Works on all major browsers
- [ ] Mobile responsive

---

### Phase 13: Deployment & Launch (Week 8, Days 4-5)

#### Tasks
1. **Production Environment Setup (AWS EC2)**
   - [ ] Provision AWS EC2 instance (Ubuntu 22.04 LTS)
   - [ ] Install Docker and Docker Compose
   - [ ] Configure security groups (ports 80, 443, 22)
   - [ ] Set up domain DNS (A record to EC2 IP)

2. **Docker Compose Configuration**
   - [ ] Create `docker-compose.yml`:
     ```yaml
     version: '3.8'
     services:
       app:
         build: .
         ports: ["3000:3000"]
         environment:
           - NODE_ENV=production
           - DATABASE_URL=postgresql://...
           - REDIS_URL=redis://redis:6379
       db:
         image: postgres:16-alpine
         volumes: [postgres_data:/var/lib/postgresql/data]
       redis:
         image: redis:7-alpine
         volumes: [redis_data:/data]
       nginx:
         image: nginx:alpine
         ports: ["80:80", "443:443"]
         volumes: [./nginx.conf:/etc/nginx/nginx.conf]
     ```
   - [ ] Create Dockerfile for Next.js app
   - [ ] Configure Nginx reverse proxy
   - [ ] Set up SSL with Let's Encrypt

3. **Environment Variables**
   - [ ] Create `.env.production` on EC2
   - [ ] Set all required variables:
     - DATABASE_URL
     - REDIS_URL
     - JWT_SECRET (strong, random)
     - SENDGRID_API_KEY (production)
     - SEPAY_API_KEY (production)
     - SEPAY_WEBHOOK_JWT_SECRET
     - NODE_ENV=production

4. **Database Migration**
   - [ ] Run migrations on production database
   - [ ] Seed production admin account
   - [ ] Verify tables and indexes

5. **Deployment Process**
   - [ ] Clone repository to EC2
   - [ ] Build Docker images: `docker-compose build`
   - [ ] Start services: `docker-compose up -d`
   - [ ] Run migrations: `docker-compose exec app npm run db:migrate`
   - [ ] Verify all services running

6. **Monitoring Setup (Optional for MVP)**
   - [ ] Set up AWS CloudWatch logs
   - [ ] Configure log retention
   - [ ] Set up basic alerts (CPU, memory)

7. **Pre-Launch Checklist**
   - [ ] Test production deployment
   - [ ] Verify webhook endpoint accessible from SePay
   - [ ] Test email sending (SendGrid production)
   - [ ] Test with real payment (small amount)
   - [ ] Backup production database
   - [ ] Document rollback procedure

8. **Launch**
   - [ ] Create first campaign
   - [ ] Test end-to-end flow in production
   - [ ] Announce to team
   - [ ] Monitor for errors
   - [ ] Be ready for support

**Deliverable**: Live production application on AWS EC2

**Testing**:
- [ ] Production smoke test (all critical paths)
- [ ] Real payment test (small amount)
- [ ] Real email delivery test
- [ ] Performance test on production
- [ ] Verify all API endpoints work

---

## Testing Strategy

### Unit Testing (Vitest)
**Framework**: Vitest + @testing-library/react

**Coverage Areas**:
- Services (business logic)
- Utilities (ticket generation, validation)
- API route handlers
- React components (critical ones)

**Example Test**:
```typescript
// src/services/__tests__/draw.service.test.ts
describe('DrawService', () => {
  describe('queryWinningNumber', () => {
    it('returns number that exists in sold tickets', async () => {
      // Create test tickets
      await createTestTickets([
        '123456', '234567', '345678'
      ]);

      // Query winning number
      const number = await drawService.queryWinningNumber(
        campaignId,
        3, // matching_digits
        false
      );

      // Should return one of the last 3 digits: '456', '567', '678'
      expect(['456', '567', '678']).toContain(number);
    });

    it('excludes winning tickets when excludeWinning=true', async () => {
      // Mark some tickets as winning
      await markTicketsAsWinning(['123456']);

      const number = await drawService.queryWinningNumber(
        campaignId,
        6,
        true // excludeWinning
      );

      expect(number).not.toBe('123456');
    });
  });
});
```

**Run Tests**:
```bash
npm run test              # Run all tests
npm run test:ui           # Open Vitest UI
npm run test:coverage     # Generate coverage report
```

---

### Integration Testing
**Coverage**:
- API routes with database
- Authentication flow (JWT + Redis)
- Payment webhook processing
- Email sending integration

**Example**:
```typescript
// tests/integration/purchase-flow.test.ts
describe('Ticket Purchase Flow', () => {
  it('creates order and tickets on direct payment', async () => {
    const response = await fetch('/api/v1/tickets/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignSlug: 'test-campaign',
        name: 'Test User',
        email: 'test@example.com',
        phone: '0901234567',
        ticketsCount: 5,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.order.tickets).toHaveLength(5);

    // Verify tickets in database
    const tickets = await db.query.tickets.findMany({
      where: eq(tickets.orderId, data.data.order.id)
    });
    expect(tickets).toHaveLength(5);
  });
});
```

---

### Manual Testing Checklist

#### Authentication
- [ ] Login with correct credentials → Success
- [ ] Login with wrong credentials → Error
- [ ] Login with "Remember me" → Session TTL = 7 days
- [ ] Login without "Remember me" → Session TTL = 2 hours
- [ ] Access protected route without login → Redirect
- [ ] Logout → Redis session deleted
- [ ] Session expiration → Auto logout with message

#### Campaign Management
- [ ] Create campaign → Success, all fields saved
- [ ] Edit campaign → Changes saved
- [ ] Cancel active campaign → Success, status = 'canceled'
- [ ] Try cancel drawing campaign → Error
- [ ] Complete drawing campaign → Success, pending orders failed

#### Ticket Purchase
- [ ] Purchase (direct payment) → Immediate tickets
- [ ] Purchase (transfer payment) → QR code displayed
- [ ] Polling → Status updates after webhook
- [ ] Timeout (10 min) → Error message
- [ ] Purchase on canceled campaign → Error

#### Draw System
- [ ] Navigate to draw page → Full-screen layout
- [ ] Toggle draft mode → Warning appears
- [ ] Start draw → Campaign status = 'drawing'
- [ ] Click draw → API returns number, animation works
- [ ] Stop animation → Stops at correct number
- [ ] Winner popup → Shows correct winners
- [ ] Redo draw → Confirmation, then clears result
- [ ] Complete all draws → "Hoàn thành" button appears

#### Email
- [ ] Purchase success → Email received
- [ ] Email contains all ticket images
- [ ] Images show correct ticket numbers

---

## Quality Assurance Checklist

### Code Quality
- [ ] All TypeScript types defined (no `any`)
- [ ] ESLint passes with no errors
- [ ] Prettier formatting applied consistently
- [ ] No console.logs in production code
- [ ] Proper error handling in all API routes
- [ ] Input validation with Zod on all endpoints
- [ ] BIGSERIAL + UUID pattern used correctly
- [ ] Foreign keys reference `id` (not `uuid`)

### Security
- [ ] `.env` files not committed to git
- [ ] Passwords hashed with bcrypt (salt rounds = 10)
- [ ] JWT tokens use strong secret
- [ ] Redis sessions properly managed
- [ ] Cookies: HttpOnly, Secure (production), SameSite=Lax
- [ ] SQL injection prevented (Drizzle ORM)
- [ ] XSS prevented (React auto-escaping)
- [ ] CSRF protection (SameSite cookies)
- [ ] Rate limiting on public APIs (future)
- [ ] Webhook signatures verified

### Performance
- [ ] Database queries optimized
- [ ] Indexes on: campaign_id, user_id, ticket_number, slug, payment_reference_id
- [ ] No N+1 query problems
- [ ] API response times <2s
- [ ] Images optimized (Next.js Image)
- [ ] Code splitting (Next.js default)

### Accessibility
- [ ] Semantic HTML used
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Color contrast meets WCAG AA
- [ ] Form errors announced clearly
- [ ] Focus indicators visible

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing (unit + manual)
- [ ] Code reviewed (if team)
- [ ] Database migrations prepared
- [ ] Environment variables documented
- [ ] Backup plan in place
- [ ] Rollback procedure documented

### Deployment Steps
1. [ ] Provision EC2 instance
2. [ ] Install Docker + Docker Compose
3. [ ] Clone repository
4. [ ] Create `.env.production`
5. [ ] Build images: `docker-compose build`
6. [ ] Start services: `docker-compose up -d`
7. [ ] Run migrations: `docker-compose exec app npm run db:migrate`
8. [ ] Verify all services running
9. [ ] Configure Nginx + SSL
10. [ ] Point domain to EC2

### Post-Deployment
- [ ] Smoke test production (all critical paths)
- [ ] Test with real payment (small amount)
- [ ] Test email delivery
- [ ] Monitor logs for errors
- [ ] Verify webhook accessible from SePay
- [ ] Test performance
- [ ] Announce to users

---

## Monitoring & Maintenance

### Daily Monitoring
- [ ] Check logs (Docker logs or CloudWatch)
- [ ] Monitor payment webhook success rate
- [ ] Monitor email delivery rate
- [ ] Check Redis memory usage
- [ ] Check database performance

### Weekly Review
- [ ] Review user feedback
- [ ] Check system performance metrics
- [ ] Review and fix non-critical bugs
- [ ] Plan improvements

### Incident Response
1. **Detection**: Monitor logs and errors
2. **Assessment**: Determine severity (critical, high, medium, low)
3. **Response**: Fix or rollback
4. **Communication**: Notify affected users if needed
5. **Post-mortem**: Document and prevent recurrence

---

## Success Metrics

### Technical Metrics
- [ ] Uptime: >99.5%
- [ ] API response time: <2s (95th percentile)
- [ ] Error rate: <1%
- [ ] Payment webhook success rate: >98%
- [ ] Email delivery rate: >95%

### Business Metrics
- [ ] User participation: >50% of employees
- [ ] Tickets sold: Meet campaign target
- [ ] Payment success rate: >90%
- [ ] User satisfaction: >4/5 (feedback)

---

## Risk Mitigation

### Technical Risks
| Risk | Mitigation | Contingency |
|------|------------|-------------|
| Database failure | Regular backups (daily) | Restore from backup |
| Redis failure | Redis persistence enabled | Restart service, sessions recreated |
| Payment webhook failure | Idempotency + retry logic | Manual admin verification |
| Email service failure | Queue with retry (3 attempts) | Manual resend if needed |
| High traffic | Rate limiting, efficient queries | Scale EC2 instance |

### Business Risks
| Risk | Mitigation | Contingency |
|------|------------|-------------|
| Low adoption | Internal marketing, clear communication | Extend campaign dates |
| Payment disputes | Clear terms, support channel | Manual refund process |
| Drawing transparency concerns | Record video, public livestream | Save draw results + screenshots |

---

## Timeline Summary

| Phase | Duration | Key Deliverable |
|-------|----------|----------------|
| Phase 0: Setup | 2 days | Project initialized with Vitest |
| Phase 1: Database | 3 days | Schema with BIGSERIAL + UUID |
| Phase 2: Auth | 3 days | Redis-backed JWT authentication |
| Phase 3: Campaign CRUD | 4 days | Campaign management (3-section form) |
| Phase 4: Public Campaign | 2 days | Public campaign page |
| Phase 4.1: Payment Updates | 1 day | Updated payment integration with new QR & webhook |
| Phase 5: Purchase | 4 days | Ticket purchase with polling |
| Phase 6: Payment | 4 days | SePay webhook integration |
| Phase 7: Email | 2 days | Email with ticket images |
| Phase 8: Campaign Completion | 1 day | Complete campaign flow |
| Phase 9: Draw Backend | 3 days | Query-first draw algorithm |
| Phase 10: Draw Frontend | 4 days | Full-screen draw interface |
| Phase 11: Polish | 3 days | Landing redirect, UX improvements |
| Phase 12: Testing | 3 days | Vitest + manual QA |
| Phase 13: Deployment | 2 days | AWS EC2 production launch |

**Total Estimated Time**: 8 weeks + 1 day (41 working days)

**Note**: Timeline assumes 1 developer working full-time. Adjust for team size.

---

## Post-MVP Enhancements (Future)

### Phase 14: Admin Dashboard
- Campaign statistics and analytics
- Revenue reports
- User participation metrics
- Export functionality (CSV/Excel)

### Phase 15: Enhanced UX
- User profiles with order history
- Winning history view
- Notification preferences
- SMS notifications (optional)

### Phase 16: Performance Optimization
- Redis caching for campaign data
- Database read replicas (if needed)
- CDN for static assets
- Image storage in S3

### Phase 17: Advanced Features
- Multiple concurrent campaigns
- Real-time draw updates (WebSocket)
- Mobile app (React Native)
- Advanced analytics dashboard

---

## Conclusion

This implementation plan provides a structured approach to building the Lottery MVP with:

✅ **Modern Tech Stack**: Next.js 16.1.4, Node 24.13.0, Drizzle ORM, Redis, Vitest

✅ **Robust Architecture**: BIGSERIAL + UUID, Redis sessions, query-first draw, API versioning

✅ **Complete Features**: Authentication, campaign management, ticket purchase, payment integration, draw system, email notifications

✅ **Quality Assurance**: Unit testing with Vitest, manual QA, security checks

✅ **Production Ready**: AWS EC2 deployment with Docker Compose

**Key Success Factors**:
1. Follow phases sequentially - test each phase before proceeding
2. Stick to MVP scope - avoid feature creep
3. Test thoroughly - especially Redis sessions and draw algorithm
4. Document as you go - update docs with any changes
5. Monitor production closely after launch
6. Gather user feedback for improvements

**Critical Implementation Notes**:
- Always use BIGSERIAL `id` for FKs, UUID for external references
- Store winning numbers WITHOUT left-padding
- Match tickets from RIGHT to LEFT
- Redis is REQUIRED for authentication (not optional)
- Payment page uses React state for success view (no separate route)
- Draw interface uses full-screen layout (no admin sidebar)

Good luck with the implementation! 🎉🚀
