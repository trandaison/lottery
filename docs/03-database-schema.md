# Database Schema

## Overview
- **Database**: PostgreSQL 16+
- **ORM**: Drizzle ORM
- **Migration Tool**: Drizzle Kit
- **Naming Convention**: snake_case for tables and columns

---

## Tables

### 1. users

Stores information about all users (both admin and regular users/guests).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-incrementing user ID |
| uuid | UUID | NOT NULL, UNIQUE, DEFAULT gen_random_uuid() | User unique identifier (for external references) |
| name | VARCHAR(255) | NOT NULL | User's full name or nickname |
| email | VARCHAR(255) | NOT NULL, UNIQUE | User's email address |
| password_digest | VARCHAR(255) | NULLABLE | Hashed password (only for admin) |
| phone | VARCHAR(20) | NOT NULL | User's phone number |
| status | ENUM('active', 'inactive') | NOT NULL, DEFAULT 'active' | Account status |
| role | ENUM('admin', 'user') | NOT NULL, DEFAULT 'user' | User role |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Indexes**:
- `idx_users_uuid` on `uuid` (unique)
- `idx_users_email` on `email` (unique)
- `idx_users_role` on `role`

**Notes**:
- `id` is auto-incrementing primary key, used for internal foreign key references
- `uuid` is for external system integration if needed
- Guest users created automatically when purchasing tickets
- password_digest is NULL for regular users (guests)
- Only admin accounts have password_digest

---

### 2. campaigns

Stores lottery campaign information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-incrementing campaign ID |
| uuid | UUID | NOT NULL, UNIQUE, DEFAULT gen_random_uuid() | Campaign unique identifier (for external references) |
| title | VARCHAR(255) | NOT NULL | Campaign title |
| slug | VARCHAR(255) | NOT NULL, UNIQUE | URL-friendly identifier |
| description | TEXT | NULLABLE | Campaign description (markdown) |
| start_time | TIMESTAMP | NOT NULL | Campaign start datetime |
| end_time | TIMESTAMP | NOT NULL | Campaign end datetime |
| ticket_price | INTEGER | NOT NULL | Price per ticket in VND |
| payment_type | ENUM('direct', 'transfer') | NOT NULL | Payment method |
| bank_name_or_code | VARCHAR(100) | NULLABLE | Bank name or code for QR |
| account_number | VARCHAR(50) | NULLABLE | Bank account number |
| account_holder_name | VARCHAR(255) | NULLABLE | Account holder name |
| sepay_gateway | VARCHAR(255) | NULLABLE | SePay gateway URL |
| status | ENUM('active', 'drawing', 'completed', 'canceled') | NOT NULL, DEFAULT 'active' | Campaign status |
| exclude_winning_numbers | BOOLEAN | NOT NULL, DEFAULT true | Exclude winning tickets from subsequent draws |
| canceled_at | TIMESTAMP | NULLABLE | Time when campaign was canceled |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Indexes**:
- `idx_campaigns_uuid` on `uuid` (unique)
- `idx_campaigns_slug` on `slug` (unique)
- `idx_campaigns_status` on `status`
- `idx_campaigns_dates` on `start_time, end_time`

**Constraints**:
- CHECK: `end_time > start_time`
- CHECK: `ticket_price > 0`
- CHECK: If `payment_type = 'transfer'`, then `bank_name_or_code`, `account_number`, `account_holder_name`, `sepay_gateway` must be NOT NULL

**Notes**:
- slug is auto-generated from title but can be edited
- Bank info only required if payment_type = 'transfer'
- Campaign status flow:
  - `active`: Default after creation, can purchase tickets
  - `drawing`: Admin started drawing prizes (popup confirm)
  - `completed`: All prizes drawn and confirmed (popup confirm)
  - `canceled`: Admin canceled campaign (any time before completed)
- Only `active` campaigns allow ticket purchases
- Only `drawing` campaigns allow prize draws
- `canceled` and `completed` campaigns are final states

---

### 3. campaign_prizes

Stores prize configuration for each campaign.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-incrementing prize ID |
| uuid | UUID | NOT NULL, UNIQUE, DEFAULT gen_random_uuid() | Prize unique identifier (for external references) |
| campaign_id | BIGINT | NOT NULL, FOREIGN KEY → campaigns(id) ON DELETE CASCADE | Reference to campaign |
| title | VARCHAR(255) | NOT NULL | Prize title/name |
| prizes_count | INTEGER | NOT NULL | Number of prizes for this tier |
| matching_digits | INTEGER | NOT NULL | Number of digits that must match (1-6) |
| prize_value | INTEGER | NOT NULL | Value of each prize in VND |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Indexes**:
- `idx_campaign_prizes_uuid` on `uuid` (unique)
- `idx_campaign_prizes_campaign_id` on `campaign_id`
- `idx_campaign_prizes_matching_digits` on `campaign_id, matching_digits`

**Constraints**:
- CHECK: `prizes_count > 0`
- CHECK: `matching_digits >= 1 AND matching_digits <= 6`
- CHECK: `prize_value >= 0`

**Notes**:
- Matching is from RIGHT to LEFT (e.g., 3 digits means last 3 digits)
- Lower matching_digits = smaller prizes (drawn first)

---

### 4. tickets

Stores issued tickets (after successful payment).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-incrementing ticket ID |
| uuid | UUID | NOT NULL, UNIQUE, DEFAULT gen_random_uuid() | Ticket unique identifier (for external references) |
| campaign_id | BIGINT | NOT NULL, FOREIGN KEY → campaigns(id) ON DELETE CASCADE | Reference to campaign |
| user_id | BIGINT | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE | Reference to user |
| ticket_number | VARCHAR(6) | NOT NULL | 6-digit ticket number |
| is_winning | BOOLEAN | NOT NULL, DEFAULT false | Whether ticket has won |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Indexes**:
- `idx_tickets_uuid` on `uuid` (unique)
- `idx_tickets_campaign_id` on `campaign_id`
- `idx_tickets_user_id` on `user_id`
- `idx_tickets_ticket_number` on `campaign_id, ticket_number` (unique)
- `idx_tickets_is_winning` on `campaign_id, is_winning`

**Constraints**:
- UNIQUE: `(campaign_id, ticket_number)`
- CHECK: `LENGTH(ticket_number) = 6`

**Notes**:
- Ticket numbers must be unique per campaign
- is_winning flag used for exclude_winning_numbers logic
- Only created after successful payment

---

### 5. orders

Stores purchase orders (created immediately when user clicks "Purchase").

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-incrementing order ID |
| uuid | UUID | NOT NULL, UNIQUE, DEFAULT gen_random_uuid() | Order unique identifier (for external references) |
| campaign_id | BIGINT | NOT NULL, FOREIGN KEY → campaigns(id) ON DELETE CASCADE | Reference to campaign |
| user_id | BIGINT | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE | Reference to user |
| tickets_count | INTEGER | NOT NULL | Number of tickets purchased |
| total_amount | INTEGER | NOT NULL | Total amount in VND |
| payment_reference_id | VARCHAR(100) | NOT NULL, UNIQUE | Unique reference for payment matching |
| expires_at | TIMESTAMP | NOT NULL | Payment expiration time |
| payment_type | ENUM('direct', 'transfer') | NOT NULL | Payment method |
| payment_status | ENUM('pending', 'success', 'failed') | NOT NULL, DEFAULT 'pending' | Payment status |
| error_message | TEXT | NULLABLE | Error message if payment failed |
| sepay_transaction_id | VARCHAR(255) | NULLABLE | SePay transaction ID from webhook |
| received_at | TIMESTAMP | NULLABLE | Time payment was received |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Indexes**:
- `idx_orders_uuid` on `uuid` (unique)
- `idx_orders_payment_reference_id` on `payment_reference_id` (unique)
- `idx_orders_campaign_id` on `campaign_id`
- `idx_orders_user_id` on `user_id`
- `idx_orders_payment_status` on `payment_status`
- `idx_orders_expires_at` on `expires_at` (for timeout cleanup)

**Constraints**:
- CHECK: `tickets_count > 0`
- CHECK: `total_amount > 0`
- CHECK: `expires_at > created_at`

**Notes**:
- payment_reference_id format: `ORD-{timestamp}-{random}` (e.g., "ORD-20260126123045-ABC123")
- expires_at = created_at + 10 minutes
- Order created before payment, tickets created after payment success

---

### 6. order_tickets

Stores references to tickets for an order (after payment confirmation).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-incrementing record ID |
| uuid | UUID | NOT NULL, UNIQUE, DEFAULT gen_random_uuid() | Record unique identifier (for external references) |
| order_id | BIGINT | NOT NULL, FOREIGN KEY → orders(id) ON DELETE CASCADE | Reference to order |
| ticket_id | BIGINT | NOT NULL, FOREIGN KEY → tickets(id) ON DELETE CASCADE | Reference to ticket |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Indexes**:
- `idx_order_tickets_uuid` on `uuid` (unique)
- `idx_order_tickets_order_id` on `order_id`
- `idx_order_tickets_ticket_id` on `ticket_id`
- `idx_order_tickets_order_ticket` on `order_id, ticket_id` (unique)

**Constraints**:
- UNIQUE: `(order_id, ticket_id)`

**Notes**:
- Created after payment is successful and tickets are generated
- Links orders to their tickets via ticket_id foreign key
- Replaces the old design that stored ticket_number directly

---

### 7. winning_numbers

Stores winning numbers for each prize draw.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-incrementing winning number ID |
| uuid | UUID | NOT NULL, UNIQUE, DEFAULT gen_random_uuid() | Winning number unique identifier (for external references) |
| campaign_prize_id | BIGINT | NOT NULL, FOREIGN KEY → campaign_prizes(id) ON DELETE CASCADE | Reference to prize |
| number | VARCHAR(6) | NOT NULL | Winning number (variable length, no left padding) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Time number was drawn |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last update time |

**Indexes**:
- `idx_winning_numbers_uuid` on `uuid` (unique)
- `idx_winning_numbers_campaign_prize_id` on `campaign_prize_id`
- `idx_winning_numbers_number` on `campaign_prize_id, number`

**Constraints**:
- CHECK: `LENGTH(number) >= 1 AND LENGTH(number) <= 6`

**Notes**:
- Each prize can have multiple winning numbers (based on prizes_count)
- Number length matches the prize's matching_digits (NO left padding with zeros)
- Examples:
  - Prize with matching_digits=3, drawn number 321 → stored as "321" (not "000321")
  - Prize with matching_digits=6, drawn number 112200 → stored as "112200"
  - Prize with matching_digits=2, drawn number 05 → stored as "05"

---

## Entity Relationship Diagram (ERD)

```
┌─────────────┐
│   users     │
├─────────────┤
│ id (PK)     │
│ uuid        │
│ name        │
│ email       │───┐
│ password    │   │
│ phone       │   │
│ status      │   │
│ role        │   │
└─────────────┘   │
                  │
                  │
      ┌───────────┴───────────┐
      │                       │
      │                       │
┌─────▼──────┐         ┌──────▼─────┐
│  orders    │         │  tickets   │
├────────────┤         ├────────────┤
│ id (PK)    │         │ id (PK)    │
│ uuid       │         │ uuid       │
│ campaign_id│◄────┐   │ campaign_id│◄──────┐
│ user_id    │     │   │ user_id    │       │
│ tickets_   │     │   │ ticket_num │       │
│   count    │     │   │ is_winning │       │
│ total_amt  │     │   └────┬───────┘       │
│ payment_   │     │        │               │
│   ref_id   │     │        │               │
│ expires_at │     │        │               │
│ payment_   │     │        │               │
│   status   │     │        │               │
└────────────┘     │        │               │
      │            │        │               │
      │            │        │               │
┌─────▼──────────┐ │        │               │
│ order_tickets  │ │        │               │
├────────────────┤ │        │               │
│ id (PK)        │ │        │               │
│ uuid           │ │        │               │
│ order_id (FK)  │ │        │               │
│ ticket_id (FK) │◄┼────────┘               │
└────────────────┘ │                        │
                   │   ┌────────────────┐   │
                   │   │   campaigns    │   │
                   │   ├────────────────┤   │
                   │   │ id (PK)        │───┘
                   │   │ uuid           │
                   │   │ title          │
                   │   │ slug           │
                   └───│ description    │
                       │ start_time     │
                       │ end_time       │
                       │ ticket_price   │
                       │ payment_type   │
                       │ bank_info      │
                       │ status         │
                       │ exclude_       │
                       │   winning_nums │
                       └────────────────┘
                                │
                   ┌────────────┴─────────────┐
                   │                          │
         ┌─────────▼────────┐      ┌──────────▼────────┐
         │ campaign_prizes  │      │ winning_numbers   │
         ├──────────────────┤      ├───────────────────┤
         │ id (PK)          │◄─────│ id (PK)           │
         │ uuid             │      │ uuid              │
         │ campaign_id (FK) │      │ campaign_prize_id │
         │ title            │      │ number            │
         │ prizes_count     │      └───────────────────┘
         │ matching_digits  │
         │ prize_value      │
         └──────────────────┘
```

---

## Migration Strategy

### Initial Setup
1. Create database: `lottery_dev` and `lottery_prod`
2. Run migrations using Drizzle Kit
3. Seed initial admin accounts

### Seeding Data

**Admin User** (for development):
```sql
INSERT INTO users (name, email, password_digest, phone, role, status)
VALUES (
  'Admin User',
  'admin@company.com',
  -- bcrypt hash of 'password123'
  '$2b$10$rO6KYLvLpKzZ6qH9Yz9W.eKxK.dqJhPyqA3X9NG7qDxZpKqHYLvLp',
  '0901234567',
  'admin',
  'active'
);
-- Note: id and uuid will be auto-generated
```

### Data Retention
- Keep all data indefinitely for historical purposes
- No automatic cleanup of old campaigns
- Manual archive process if needed in future

---

## Performance Considerations

### Expected Query Patterns
1. **High frequency**:
   - Get campaign by slug
   - Check ticket number uniqueness
   - List tickets for order
   - Find matching winning tickets

2. **Medium frequency**:
   - List campaigns
   - Get user by email
   - Count tickets sold
   - Count unique participants

3. **Low frequency**:
   - Admin CRUD operations
   - Generate ticket numbers
   - Draw winning numbers

### Optimization Strategies
1. **Indexes**: Already defined on frequently queried columns
2. **Caching** (Redis):
   - Campaign details (TTL: 5 minutes)
   - Sold ticket numbers per campaign (TTL: 1 minute)
   - Ticket count statistics (TTL: 30 seconds)
3. **Database**:
   - Use connection pooling (pg-pool)
   - Set appropriate timeout values
   - Monitor slow queries

### Scaling Considerations (Future)
- For 100 users and 500 tickets: Single PostgreSQL instance sufficient
- For >10,000 tickets: Consider read replicas
- For multiple concurrent campaigns: Partition tables by campaign_id

