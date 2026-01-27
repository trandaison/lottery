# System Architecture

## Overview
The Lottery system follows a **monolithic architecture** using Next.js as a full-stack framework. This architecture is suitable for the expected scale (~100 users, ~500 tickets) and provides simplicity in development and deployment.

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ Admin Panel  │  │ Guest Portal │  │  Email Client       │   │
│  │  (Browser)   │  │  (Browser)   │  │  (Gmail/Outlook)    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────▲──────────┘   │
└─────────┼──────────────────┼──────────────────────┼──────────────┘
          │                  │                      │
          │ HTTPS            │ HTTPS                │ SMTP
          │                  │                      │
┌─────────▼──────────────────▼──────────────────────┼──────────────┐
│                   Next.js Application              │              │
│  ┌────────────────────────────────────────────┐   │              │
│  │         Frontend (React Components)         │   │              │
│  │  ├─ Admin: Campaign CRUD, Draw Interface   │   │              │
│  │  ├─ Guest: Campaign View, Ticket Purchase  │   │              │
│  │  └─ Shared: Auth, Forms, UI Components     │   │              │
│  └────────────────────────────────────────────┘   │              │
│                         │                          │              │
│  ┌────────────────────────────────────────────┐   │              │
│  │         Backend (API Routes)                │   │              │
│  │  ├─ /api/auth/* - Authentication (Redis)   │   │              │
│  │  ├─ /api/campaigns/* - Campaign CRUD       │   │              │
│  │  ├─ /api/tickets/* - Ticket Purchase       │   │              │
│  │  ├─ /api/orders/* - Order Status (Polling) │   │              │
│  │  ├─ /api/draw/* - Drawing Logic (Query)    │   │              │
│  │  └─ /api/webhooks/* - Payment Webhooks     │   │              │
│  └────────────────────────────────────────────┘   │              │
│                         │                          │              │
│  ┌────────────────────────────────────────────┐   │              │
│  │         Service Layer                       │   │              │
│  │  ├─ AuthService (JWT, bcrypt, Redis)       │   │              │
│  │  ├─ CampaignService (CRUD, validation)     │   │              │
│  │  ├─ TicketService (generation, validation) │   │              │
│  │  ├─ OrderService (create, status update)   │   │              │
│  │  ├─ DrawService (query-first lottery)      │   │              │
│  │  ├─ PaymentService (QR gen, webhook)       │   │              │
│  │  └─ EmailService (SendGrid integration)    │───┼──────────────┘
│  └────────────────────────────────────────────┘   │
│                         │                          │
│  ┌────────────────────────────────────────────┐   │
│  │         Data Access Layer (Drizzle ORM)     │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────┬──────────────────────────────┘
                      │
        ┌─────────────┴─────────────┬──────────────────┐
        │                           │                  │
┌───────▼────────┐        ┌─────────▼────────┐  ┌─────▼──────┐
│   PostgreSQL   │        │   Redis Cache    │  │  SendGrid  │
│   (Database)   │        │   (Required for  │  │  (Email)   │
│                │        │ Authentication)  │  │            │
└────────────────┘        └──────────────────┘  └────────────┘
        ▲                                              
        │ Webhook                                      
┌───────┴────────┐                                     
│     SePay      │                                     
│   (Payment)    │                                     
└────────────────┘                                     
```

---

## Architecture Layers

### 1. Presentation Layer (Frontend)

**Technology**: React 19 + Next.js 16.1.4 App Router

**Responsibilities**:
- Render UI components
- Handle user interactions
- Client-side validation
- State management (Zustand + React Query)
- Route protection (middleware)

**Key Pages**:

#### Admin Pages (`/admin/*`)
- `/admin/login` - Admin authentication
- `/admin/campaigns` - Campaign list
- `/admin/campaigns/new` - Create campaign
- `/admin/campaigns/:id/edit` - Edit campaign
- `/admin/campaigns/:id/draw` - Live draw interface

#### Guest Pages (`/campaigns/*`)
- `/campaigns/:slug` - Campaign detail & ticket purchase
- `/orders/:reference_id` - Order status (future)

**Component Structure**:
```
src/
├── app/
│   ├── (admin)/
│   │   ├── admin/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── campaigns/
│   │   │       ├── page.tsx
│   │   │       ├── new/
│   │   │       │   └── page.tsx
│   │   │       └── [id]/
│   │   │           ├── edit/
│   │   │           │   └── page.tsx
│   │   │           └── draw/
│   │   │               └── page.tsx
│   │   └── layout.tsx (auth check)
│   │
│   ├── campaigns/
│   │   └── [slug]/
│   │       └── page.tsx
│   │
│   ├── layout.tsx (root layout)
│   └── page.tsx (landing page)
│
├── components/
│   ├── admin/
│   │   ├── CampaignForm.tsx
│   │   ├── DrawInterface.tsx
│   │   ├── ScrollingMeter.tsx
│   │   └── ResultsTable.tsx
│   ├── campaign/
│   │   ├── CampaignDetail.tsx
│   │   ├── TicketPurchaseForm.tsx
│   │   └── PaymentQR.tsx
│   └── ui/ (shadcn components)
│
└── lib/
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useCampaigns.ts
    │   └── useDrawing.ts
    └── stores/
        └── authStore.ts
```

---

### 2. Application Layer (Backend API)

**Technology**: Next.js API Routes (App Router)

**Responsibilities**:
- Request validation (Zod)
- Authentication & authorization (JWT)
- Business logic orchestration
- Response formatting
- Error handling

**API Structure**:
```
src/app/api/
├── auth/
│   ├── login/route.ts          # POST - Admin login
│   ├── logout/route.ts         # POST - Admin logout
│   └── me/route.ts             # GET - Current user
│
├── campaigns/
│   ├── route.ts                # GET (list), POST (create)
│   ├── [id]/route.ts           # GET, PUT, DELETE
│   └── slug/[slug]/route.ts    # GET - Public campaign view
│
├── tickets/
│   ├── purchase/route.ts       # POST - Purchase tickets
│   └── generate/route.ts       # POST - Generate ticket numbers
│
├── orders/
│   ├── route.ts                # GET (list)
│   ├── [id]/route.ts           # GET (detail)
│   └── [reference_id]/status/route.ts  # GET - Check status
│
├── draw/
│   ├── [campaignId]/
│   │   ├── start/route.ts      # POST - Start draw for prize
│   │   ├── stop/route.ts       # POST - Stop draw & get result
│   │   ├── save/route.ts       # POST - Save winning numbers
│   │   └── redo/route.ts       # POST - Redo prize draw
│   └── winners/route.ts        # GET - Get winning tickets
│
├── webhooks/
│   └── sepay/route.ts          # POST - SePay payment webhook
│
└── cron/
    └── check-expired-orders/route.ts  # GET - Timeout checker
```

---

### 3. Service Layer (Business Logic)

**Technology**: TypeScript classes/modules

**Responsibilities**:
- Core business logic
- Data validation
- External service integration
- Complex calculations

**Services**:

#### AuthService
```typescript
class AuthService {
  async login(email: string, password: string, rememberMe: boolean): Promise<{ token: string; user: User }>
  async logout(tokenBase: string): Promise<void>
  async verifyToken(token: string): Promise<User>
  async hashPassword(password: string): Promise<string>
  async comparePassword(password: string, hash: string): Promise<boolean>
  
  // Redis session methods
  async createSession(userId: number, rememberMe: boolean): Promise<string>
  async getSession(tokenBase: string): Promise<SessionData | null>
  async updateSessionTTL(tokenBase: string, rememberMe: boolean): Promise<void>
  async deleteSession(tokenBase: string): Promise<void>
}
```

#### CampaignService
```typescript
class CampaignService {
  async create(data: CreateCampaignDTO): Promise<Campaign>
  async update(id: number, data: UpdateCampaignDTO): Promise<Campaign>
  async cancel(id: number): Promise<Campaign>
  async delete(id: number): Promise<void>
  async getById(id: number): Promise<Campaign>
  async getBySlug(slug: string): Promise<Campaign>
  async getStats(campaignId: number): Promise<CampaignStats>
  async updateStatus(id: number, status: CampaignStatus): Promise<Campaign>
}
```

#### TicketService
```typescript
class TicketService {
  async generateTicketNumbers(campaignId: number, count: number): Promise<string[]>
  async isNumberAvailable(campaignId: number, number: string): Promise<boolean>
  async createTickets(userId: number, campaignId: number, ticketNumbers: string[]): Promise<Ticket[]>
  async findMatchingTickets(campaignId: number, winningNumber: string, matchingDigits: number): Promise<Ticket[]>
  async markAsWinning(ticketIds: number[]): Promise<void>
  async unmarkAsWinning(ticketIds: number[]): Promise<void>
}
```

#### OrderService
```typescript
class OrderService {
  async create(data: CreateOrderDTO): Promise<Order>
  async getByReferenceId(referenceId: string): Promise<Order>
  async updatePaymentStatus(referenceId: string, status: PaymentStatus, transactionData?: any): Promise<Order>
  async failExpiredOrders(campaignId: number): Promise<number>
  async linkTickets(orderId: number, ticketIds: number[]): Promise<void>
}
```

#### DrawService
```typescript
class DrawService {
  async queryWinningNumber(campaignId: number, matchingDigits: number, excludeWinning: boolean): Promise<string>
  async getPrizesByOrder(campaignId: number): Promise<Prize[]>
  async saveWinningNumbers(prizeId: number, numbers: string[]): Promise<void>
  async redoDraw(prizeId: number): Promise<void>
  async canStartDrawing(campaignId: number): Promise<boolean>
  async completeCampaign(campaignId: number): Promise<{ campaign: Campaign; failedOrdersCount: number }>
}
```

**Note**: 
- `queryWinningNumber` uses query-first approach (not digit-by-digit)
- Returns a valid number that exists in sold tickets
- Respects exclude_winning_numbers setting

#### PaymentService
```typescript
class PaymentService {
  async generateQRCodeURL(campaignId: number, amount: number, referenceId: string): Promise<string>
  async verifyWebhookJWT(jwt: string): Promise<{ campaignUuid: string } | null>
  async processWebhook(data: SepayWebhookData): Promise<void>
  async generatePaymentReferenceId(): Promise<string>
  async reconcileTransaction(order: Order, webhookData: SepayWebhookData): Promise<{ success: boolean; error?: string }>
}
```

**Note**:
- `generateQRCodeURL` returns URL format: `https://qr.sepay.vn/img?acc={accountNumber}&bank={bankNameOrCode}&amount={amount}&des={referenceId}`
- `verifyWebhookJWT` verifies JWT signature using SEPAY_WEBHOOK_JWT_SECRET and extracts campaign UUID from subject
- `reconcileTransaction` validates transferAmount and accountNumber match order expectations
- `generatePaymentReferenceId` creates counter-based ID in format `/^LTR\d{6}$/`

#### EmailService
```typescript
class EmailService {
  async sendTicketEmail(order: Order, tickets: Ticket[]): Promise<void>
  async generateTicketImage(ticket: Ticket, campaign: Campaign): Promise<Buffer>
}
```

---

### 4. Data Access Layer

**Technology**: Drizzle ORM + PostgreSQL

**Responsibilities**:
- Database queries
- Transaction management
- Schema definition
- Migrations

**Structure**:
```
src/db/
├── schema/
│   ├── users.ts
│   ├── campaigns.ts
│   ├── campaign-prizes.ts
│   ├── tickets.ts
│   ├── orders.ts
│   ├── order-tickets.ts
│   └── winning-numbers.ts
│
├── migrations/
│   └── 0001_initial_schema.sql
│
├── client.ts           # PostgreSQL connection
└── index.ts            # Drizzle instance
```

**Example Schema Definition** (Drizzle):
```typescript
// src/db/schema/tickets.ts
import { pgTable, bigserial, uuid, varchar, timestamp, boolean, bigint } from 'drizzle-orm/pg-core';
import { campaigns } from './campaigns';
import { users } from './users';

export const tickets = pgTable('tickets', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  uuid: uuid('uuid').defaultRandom().notNull().unique(),
  campaignId: bigint('campaign_id', { mode: 'number' }).references(() => campaigns.id).notNull(),
  userId: bigint('user_id', { mode: 'number' }).references(() => users.id).notNull(),
  ticketNumber: varchar('ticket_number', { length: 6 }).notNull(),
  isWinning: boolean('is_winning').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Note**: 
- `id` is BIGSERIAL (auto-increment) used for internal foreign keys
- `uuid` is for external system references if needed
- All foreign keys use `id` (BIGINT) not `uuid`

---

## Data Flow Diagrams

### Flow 1: Guest Purchases Tickets

```
┌────────┐                                                     
│ Guest  │                                                     
└───┬────┘                                                     
    │                                                          
    │ 1. Fill form & submit                                   
    │                                                          
┌───▼────────────────────┐                                    
│ TicketPurchaseForm     │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 2. POST /api/tickets/purchase                           
    │    { email, name, phone, ticketCount }                  
    │                                                          
┌───▼────────────────────┐                                    
│ API Route Handler      │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 3. Validate input (Zod)                                 
    │                                                          
┌───▼────────────────────┐                                    
│ OrderService           │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 4. Check/Create user                                    
    │ 5. Create order (pending)                               
    │                                                          
┌───▼────────────────────┐                                    
│ PostgreSQL             │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 6. Return order (no ticket numbers yet for transfer)    
    │                                                          
┌───▼────────────────────┐                                    
│ PaymentService         │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 7. Generate QR URL                                 
    │    https://qr.sepay.vn/img?acc={accountNumber}&bank={bankNameOrCode}&amount={amount}&des={paymentReferenceId}
    │                                                          
┌───▼────────────────────┐                                    
│ Response: QR URL + timer │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 8. Display payment page & start polling                 
    │                                                          
┌───▼────────────────────┐                                    
│ PaymentQR Component    │                                    
└────────────────────────┘                                    
    │                                                          
    │ User scans & pays                                       
    │                                                          
┌───▼────────────────────┐                                    
│ SePay                  │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 9. POST /api/webhooks/sepay                             
    │    Header: Authorization: Apikey {JWT}
    │    Body: { code, referenceCode, transferAmount, accountNumber, transactionDate, ... }               
    │                                                          
┌───▼────────────────────┐                                    
│ Webhook Handler        │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 10. Verify JWT (campaign UUID from subject)
    │ 11. Reconcile transaction (amount & account)
    │ 12. Update order status → success                       
    │ 13. Generate unique ticket numbers (random 6-digits)    
    │ 14. Create tickets in DB                                
    │ 15. Create order_tickets (ticket_id FK)
    │ 16. Save transaction_date from webhook payload                 
    │                                                          
┌───▼────────────────────┐                                    
│ EmailService           │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 17. Generate ticket images                              
    │ 18. Send email with attachments                         
    │                                                          
┌───▼────────────────────┐                                    
│ SendGrid → Gmail       │                                    
└────────────────────────┘                                    
```

**Note**: 
- Ticket numbers generated AFTER payment success (not before)
- Client polls `/api/orders/:referenceId` every 3 seconds
- order_tickets stores ticket_id FK (not ticket_number)
- Webhook uses JWT authentication with campaign UUID in subject
- Reconciliation checks transferAmount and accountNumber
- transaction_date stored from webhook payload

---

### Flow 2: Admin Draws Prize

```
┌────────┐                                                     
│ Admin  │                                                     
└───┬────┘                                                     
    │                                                          
    │ 1. Navigate to /admin/campaigns/:id/draw                
    │                                                          
┌───▼────────────────────┐                                    
│ DrawInterface Page     │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 2. Toggle "Quay thử" = OFF                              
    │ 3. Click "Draw" for prize                               
    │                                                          
    │ 4. POST /api/draw/:campaignId/stop                      
    │    { prizeId, draftMode: false }                        
    │                                                          
┌───▼────────────────────┐                                    
│ DrawService            │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 5. Query DB to determine winning number                 
    │    (query-first approach)                               
    │    SELECT * FROM tickets WHERE...                       
    │    - Must exist in sold tickets                         
    │    - Exclude winning if needed                          
    │                                                          
┌───▼────────────────────┐                                    
│ PostgreSQL             │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 6. Return winning number: "123456"                      
    │                                                          
┌───▼────────────────────┐                                    
│ API Response           │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 7. Client receives predetermined number                 
    │                                                          
┌───▼────────────────────┐                                    
│ ScrollingMeter         │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 8. Start scrolling animation                            
    │ 9. Admin clicks "Stop"                                  
    │ 10. Animate stopping to predetermined number            
    │     (right to left, ~5 seconds)                         
    │                                                          
┌───▼────────────────────┐                                    
│ TicketService          │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 11. Find matching tickets                               
    │     (match last N digits from RIGHT)                    
    │                                                          
┌───▼────────────────────┐                                    
│ DrawService            │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 12. If official mode:                                   
    │     - Save to winning_numbers (no padding)              
    │     - Mark tickets as is_winning = true                 
    │                                                          
┌───▼────────────────────┐                                    
│ PostgreSQL             │                                    
└───┬────────────────────┘                                    
    │                                                          
    │ 13. Return winners list                                 
    │                                                          
┌───▼────────────────────┐                                    
│ WinnerPopup            │                                    
└────────────────────────┘                                    
```

**Key Changes**:
- Winning number determined by DB query FIRST (step 5)
- Client animates to predetermined number (step 10)
- No digit-by-digit API calls during animation
- winning_numbers stored without left padding

---

## Security Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Authentication Flow                     │
└─────────────────────────────────────────────────────────────┘

Admin Login:
  1. POST /api/auth/login { email, password, rememberMe }
  2. Server validates credentials (bcrypt)
  3. Server generates token_base (UUID v4)
  4. Server stores in Redis: key=session:{token_base}, value={user_info}
  5. Server sets Redis TTL: 7 days (rememberMe) or 2 hours
  6. Server generates JWT with token_base as subject
  7. Server sets HttpOnly cookie with JWT

Protected Route Access:
  1. Browser sends request with JWT cookie
  2. Middleware extracts JWT and decodes to get token_base
  3. Middleware fetches from Redis: GET session:{token_base}
  4. If not found in Redis: Return 401 Unauthorized
  5. If found: Update Redis TTL and allow access
  6. If invalid: Redirect to /admin/login

Admin Logout:
  1. Extract token_base from JWT
  2. DELETE session:{token_base} from Redis
  3. Clear JWT cookie
  4. Redirect to /admin/login
```

### Security Measures

| Layer | Security Measure | Implementation |
|-------|-----------------|----------------|
| Transport | HTTPS | Enforced in production |
| Authentication | JWT + Redis | HttpOnly cookies, Redis-backed sessions |
| Session Storage | Redis | token_base → user_info mapping |
| Password | Bcrypt | Salt rounds = 10 |
| Input Validation | Zod | All API routes |
| SQL Injection | ORM | Drizzle parameterized queries |
| XSS | React | Auto-escaping + CSP headers |
| CSRF | SameSite | Cookies with SameSite=Lax |
| Rate Limiting | Express Rate Limit | Public APIs (future) |
| Webhook Verification | HMAC | Signature validation |

---

## Deployment Architecture

### Development Environment

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Machine                        │
│                                                             │
│  ┌──────────────┐     ┌──────────────┐                     │
│  │   Next.js    │────▶│ PostgreSQL   │                     │
│  │ (localhost   │     │ (Native      │                     │
│  │  :3000)      │     │ Installation)│                     │
│  └──────────────┘     └──────────────┘                     │
│         │                                                   │
│         └────────────▶ Redis (Native Installation)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Setup**:
```bash
# Install PostgreSQL (macOS)
brew install postgresql@16
brew services start postgresql@16

# Install Redis
brew install redis
brew services start redis

# Setup database
createdb lottery_dev

# Install dependencies
pnpm install

# Run migrations
pnpm db:migrate

# Seed admin user
pnpm db:seed

# Start dev server (Node.js 24.13.0)
pnpm dev

# Run tests (Vitest)
pnpm test
```

**Note**: 
- No Docker required for local development
- Use native installations for PostgreSQL and Redis
- Node.js version: 24.13.0
- Next.js version: 16.1.4

---

### Production Environment (AWS EC2)

```
┌─────────────────────────────────────────────────────────────┐
│                       AWS EC2 Instance                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Docker Compose Stack                     │  │
│  │                                                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │  │
│  │  │  Next.js │  │ Postgres │  │  Redis   │           │  │
│  │  │  (app)   │  │  (db)    │  │ (cache)  │           │  │
│  │  │16.1.4    │  │   16     │  │    7     │           │  │
│  │  └──────────┘  └──────────┘  └──────────┘           │  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                    ┌─────▼──────┐                           │
│                    │   Nginx    │                           │
│                    │  (Reverse  │                           │
│                    │   Proxy)   │                           │
│                    │  + SSL     │                           │
│                    └────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

**Deployment Steps**:
1. Provision AWS EC2 instance
2. Install Docker and Docker Compose
3. Clone repository to EC2
4. Configure environment variables (.env.production)
5. Build and start services: `docker-compose up -d`
6. Run migrations: `docker-compose exec app pnpm db:migrate`
7. Setup Nginx with SSL (Let's Encrypt)
8. Configure domain DNS
9. Test webhooks with SePay

**Note**: 
- Docker Compose used ONLY for production deployment
- All services containerized for consistency
- Nginx handles SSL/TLS termination
- Deployment details to be implemented in later phase

**docker-compose.yml** (Production):
```yaml
version: '3.8'
services:
  app:
    build: 
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@db:5432/lottery
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
      - SEPAY_WEBHOOK_JWT_SECRET=${SEPAY_WEBHOOK_JWT_SECRET}
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=lottery
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

---

## Performance Optimization Strategy

### Caching Strategy (Redis - Required for Authentication)

| Data | TTL | Invalidation |
|------|-----|--------------|
| User session (token_base) | 7 days / 2 hours | On logout |
| Campaign by slug | 5 min | On campaign update |
| Sold ticket numbers | 1 min | On ticket purchase |
| Ticket count stats | 30 sec | On ticket purchase |

**Note**: Redis is required (not optional) for session-based authentication

### Database Optimization

1. **Indexes**: Already defined in schema
2. **Connection Pooling**: Use `pg-pool` with max 10 connections
3. **Query Optimization**: 
   - Use SELECT specific columns (no SELECT *)
   - Use LIMIT for pagination
   - Use transactions for multi-step operations

### Frontend Optimization

1. **Code Splitting**: Next.js automatic code splitting
2. **Image Optimization**: Next.js Image component
3. **Static Generation**: Use SSG for public campaign pages
4. **Client-side Caching**: React Query with staleTime

---

## Monitoring & Observability

### Logging Strategy

**Log Levels**:
- `ERROR`: Payment failures, email failures, critical errors
- `WARN`: Validation failures, timeout warnings
- `INFO`: Order created, payment success, draw completed
- `DEBUG`: Development debugging

**Log Storage**:
- Development: Console
- Production: AWS CloudWatch or external service (Logtail)

### Metrics to Track

1. **Business Metrics**:
   - Orders created per hour
   - Payment success rate
   - Email delivery rate
   - Tickets sold per campaign

2. **Technical Metrics**:
   - API response time
   - Database query time
   - Error rate by endpoint
   - Uptime percentage

### Alerts (Future)

- Payment webhook failures
- Email sending failures
- Database connection issues
- High error rate (>5% in 5 minutes)

---

## Scalability Considerations

### Current Scale (MVP)
- Users: ~100
- Tickets: ~500 per campaign
- Concurrent users: 20-30 peak
- Infrastructure: Single instance sufficient

### Scale Triggers & Solutions

| Metric | Trigger | Solution |
|--------|---------|----------|
| Response time | >2s | Add Redis caching for campaigns |
| Database CPU | >70% | Add read replica |
| API errors | >1% | Add retry logic + monitoring |
| Email delays | >5min | Add job queue (BullMQ) |
| Concurrent users | >100 | Scale horizontally (add EC2 instances) |

### Future Architecture (If needed)

```
                    ┌──────────────┐
                    │ Load Balancer│
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼────┐    ┌──────▼────┐   ┌──────▼────┐
    │ Next.js  │    │ Next.js   │   │ Next.js   │
    │Instance 1│    │Instance 2 │   │Instance 3 │
    └──────────┘    └───────────┘   └───────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                    ┌──────▼───────┐
                    │   Redis      │
                    │  (Cache +    │
                    │   Queue)     │
                    └──────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼────┐    ┌──────▼────┐   ┌──────▼────┐
    │PostgreSQL│    │PostgreSQL │   │   S3      │
    │ Primary  │───▶│  Replica  │   │(Tickets)  │
    └──────────┘    └───────────┘   └───────────┘
```

**Note**: This is overkill for current requirements. Stick with monolith.
