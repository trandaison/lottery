# Database Quick Reference Guide

## Table Relationships

```
users (id)
  ├─→ tickets (user_id)
  ├─→ orders (user_id)

campaigns (id)
  ├─→ campaign_prizes (campaign_id)
  ├─→ tickets (campaign_id)
  ├─→ orders (campaign_id)

campaign_prizes (id)
  └─→ winning_numbers (campaign_prize_id)

orders (id)
  └─→ order_tickets (order_id)

tickets (id)
  └─→ order_tickets (ticket_id)
```

## Common Queries

### Get Campaign with Prizes
```typescript
import { db } from '@/db';
import { campaigns, campaignPrizes } from '@/db/schema';
import { eq } from 'drizzle-orm';

const campaign = await db.query.campaigns.findFirst({
  where: eq(campaigns.slug, 'my-campaign'),
  with: {
    campaignPrizes: true,
  },
});
```

### Get Order with Tickets
```typescript
import { db } from '@/db';
import { orders, orderTickets, tickets } from '@/db/schema';
import { eq } from 'drizzle-orm';

const order = await db.query.orders.findFirst({
  where: eq(orders.paymentReferenceId, 'ORD-123'),
  with: {
    orderTickets: {
      with: {
        ticket: true,
      },
    },
    user: true,
    campaign: true,
  },
});
```

### Get Winning Tickets for Campaign
```typescript
const winningTickets = await db
  .select()
  .from(tickets)
  .where(
    and(
      eq(tickets.campaignId, campaignId),
      eq(tickets.isWinning, true)
    )
  );
```

### Count Tickets Sold
```typescript
import { count } from 'drizzle-orm';

const [result] = await db
  .select({ count: count() })
  .from(tickets)
  .where(eq(tickets.campaignId, campaignId));

const ticketsSold = result.count;
```

### Count Unique Participants
```typescript
import { countDistinct } from 'drizzle-orm';

const [result] = await db
  .select({ count: countDistinct(tickets.userId) })
  .from(tickets)
  .where(eq(tickets.campaignId, campaignId));

const participants = result.count;
```

## Insert Patterns

### Create User (Find or Create)
```typescript
import { users } from '@/db/schema';

// Check if exists
const [existing] = await db
  .select()
  .from(users)
  .where(eq(users.email, email))
  .limit(1);

if (!existing) {
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      name,
      phone,
      role: 'user',
      status: 'active',
    })
    .returning();

  return newUser;
}

return existing;
```

### Create Order with Tickets
```typescript
import { orders, tickets, orderTickets } from '@/db/schema';

// Create order
const [order] = await db
  .insert(orders)
  .values({
    campaignId,
    userId,
    ticketsCount: 5,
    totalAmount: 50000,
    paymentReferenceId: 'ORD-123',
    paymentType: 'direct',
    paymentStatus: 'success',
  })
  .returning();

// Create tickets
const createdTickets = await db
  .insert(tickets)
  .values(
    ticketNumbers.map((number) => ({
      campaignId,
      userId,
      ticketNumber: number,
      isWinning: false,
    }))
  )
  .returning();

// Link tickets to order
await db
  .insert(orderTickets)
  .values(
    createdTickets.map((ticket) => ({
      orderId: order.id,
      ticketId: ticket.id,
    }))
  );
```

### Create Campaign with Prizes
```typescript
import { campaigns, campaignPrizes } from '@/db/schema';

// Create campaign
const [campaign] = await db
  .insert(campaigns)
  .values({
    title: 'New Campaign',
    slug: 'new-campaign',
    description: 'Description',
    startTime: new Date('2024-02-01'),
    endTime: new Date('2024-02-28'),
    ticketPrice: 10000,
    paymentType: 'direct',
    status: 'active',
  })
  .returning();

// Create prizes
await db
  .insert(campaignPrizes)
  .values([
    {
      campaignId: campaign.id,
      title: 'First Prize',
      prizesCount: 1,
      matchingDigits: 6,
      prizeValue: 1000000,
    },
    {
      campaignId: campaign.id,
      title: 'Second Prize',
      prizesCount: 2,
      matchingDigits: 5,
      prizeValue: 500000,
    },
  ]);
```

## Update Patterns

### Update Campaign Status
```typescript
const [updated] = await db
  .update(campaigns)
  .set({
    status: 'drawing',
    updatedAt: new Date(),
  })
  .where(eq(campaigns.id, campaignId))
  .returning();
```

### Mark Tickets as Winning
```typescript
await db
  .update(tickets)
  .set({
    isWinning: true,
    updatedAt: new Date(),
  })
  .where(
    inArray(tickets.id, ticketIds)
  );
```

### Update Order Payment Status
```typescript
await db
  .update(orders)
  .set({
    paymentStatus: 'success',
    sepayTransactionId: 'TXN-123',
    receivedAt: new Date(),
    updatedAt: new Date(),
  })
  .where(eq(orders.paymentReferenceId, referenceId));
```

## Delete Patterns

### Delete Winning Number (Redo)
```typescript
import { winningNumbers, tickets } from '@/db/schema';

// Delete winning number
await db
  .delete(winningNumbers)
  .where(eq(winningNumbers.id, winningNumberId));

// Unmark tickets
await db
  .update(tickets)
  .set({
    isWinning: false,
    updatedAt: new Date(),
  })
  .where(eq(tickets.campaignId, campaignId));
```

## Transaction Example

```typescript
import { db } from '@/db';

await db.transaction(async (tx) => {
  // Create order
  const [order] = await tx
    .insert(orders)
    .values({ ... })
    .returning();

  // Create tickets
  const createdTickets = await tx
    .insert(tickets)
    .values([...])
    .returning();

  // Link tickets to order
  await tx
    .insert(orderTickets)
    .values([...]);

  // If any step fails, entire transaction rolls back
});
```

## Drizzle Query API

### Using Relations (Recommended)
```typescript
// Define relations in schema (already done)
const campaign = await db.query.campaigns.findFirst({
  where: eq(campaigns.id, 1),
  with: {
    campaignPrizes: {
      with: {
        winningNumbers: true,
      },
    },
    tickets: {
      where: eq(tickets.isWinning, true),
    },
  },
});
```

### Using Joins (More Control)
```typescript
import { campaigns, campaignPrizes } from '@/db/schema';

const result = await db
  .select()
  .from(campaigns)
  .leftJoin(
    campaignPrizes,
    eq(campaigns.id, campaignPrizes.campaignId)
  )
  .where(eq(campaigns.id, campaignId));
```

## Common Filters

### Active Campaigns
```typescript
const active = await db
  .select()
  .from(campaigns)
  .where(eq(campaigns.status, 'active'));
```

### Campaigns Within Date Range
```typescript
import { and, gte, lte } from 'drizzle-orm';

const now = new Date();
const ongoing = await db
  .select()
  .from(campaigns)
  .where(
    and(
      lte(campaigns.startTime, now),
      gte(campaigns.endTime, now),
      eq(campaigns.status, 'active')
    )
  );
```

### Pending Orders
```typescript
const pending = await db
  .select()
  .from(orders)
  .where(
    and(
      eq(orders.paymentStatus, 'pending'),
      eq(orders.paymentType, 'transfer')
    )
  );
```

## Field Access Patterns

### Access BIGSERIAL ID (Internal)
```typescript
const campaign = await db.query.campaigns.findFirst(...);
console.log(campaign.id); // number (BIGSERIAL)
// Use for: foreign keys, joins, internal logic
```

### Access UUID (External/API)
```typescript
const campaign = await db.query.campaigns.findFirst(...);
console.log(campaign.uuid); // string (UUID)
// Use for: API responses, external references, URLs
```

## Validation Rules

### Ticket Number
- Format: 6 digits (string)
- Pattern: `/^\d{6}$/`
- Unique per campaign
- Examples: "123456", "000001", "999999"

### Payment Reference ID
- Format: `ORD-YYYYMMDDHHmmss-XXXXXX`
- Must be unique globally
- Example: "ORD-20240101120000-ABC123"

### Winning Number
- Stored WITHOUT left-padding
- Examples: "321" (3 digits), "45" (2 digits), "123456" (6 digits)
- Matching done from RIGHT

### Phone Number
- Pattern: `/^0\d{9}$/`
- 10 digits starting with 0
- Example: "0901234567"

## Timestamps

All tables have `created_at` and `updated_at`:

```typescript
// Timestamps are auto-managed
const [user] = await db
  .insert(users)
  .values({ ... })
  .returning();

console.log(user.createdAt); // Date (auto-set)
console.log(user.updatedAt); // Date (auto-set)

// On update, updatedAt is automatically updated
await db
  .update(users)
  .set({ name: 'New Name' })
  .where(eq(users.id, userId));
// updatedAt will be set to current timestamp
```

## Enum Values

```typescript
// User Status
type UserStatus = 'active' | 'inactive';

// User Role
type UserRole = 'admin' | 'user';

// Campaign Status
type CampaignStatus = 'active' | 'drawing' | 'completed' | 'canceled';

// Payment Type
type PaymentType = 'direct' | 'transfer';

// Payment Status
type PaymentStatus = 'pending' | 'success' | 'failed';
```

## Performance Tips

1. **Always use indexes for queries**
   - campaign_id, user_id are indexed
   - Use them in WHERE clauses

2. **Limit results when possible**
   ```typescript
   .limit(10)
   .offset(0)
   ```

3. **Select only needed columns**
   ```typescript
   await db
     .select({
       id: campaigns.id,
       title: campaigns.title,
     })
     .from(campaigns);
   ```

4. **Use transactions for multi-step operations**
   - Ensures data consistency
   - Automatic rollback on error

5. **Batch inserts when possible**
   ```typescript
   await db
     .insert(tickets)
     .values([ticket1, ticket2, ticket3]); // Better than 3 separate inserts
   ```

## Error Handling

```typescript
try {
  await db.insert(users).values({ email: 'duplicate@test.com' });
} catch (error) {
  if (error.code === '23505') {
    // Unique constraint violation
    console.error('Email already exists');
  }
  throw error;
}
```

Common PostgreSQL error codes:
- `23505`: Unique constraint violation
- `23503`: Foreign key violation
- `23502`: Not null constraint violation

---

**Quick Reference Version:** 1.0
**Last Updated:** Phase 1 Complete
**Next:** Phase 2 - Authentication System
