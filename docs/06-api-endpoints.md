# API Endpoints

## Overview
This document defines all API endpoints for the Lottery system. All endpoints use JSON for request/response bodies unless otherwise specified.

**Base URL**: `/api/v1`

**API Structure**:
- Public endpoints: `/api/v1/*`
- Admin endpoints: `/api/v1/admin/*`

**Authentication**: Admin endpoints require JWT token in `Authorization` header or HttpOnly cookie.

---

## Authentication Endpoints

### POST /api/v1/admin/auth/login
Admin login with email and password. Creates session in Redis.

**Access**: Public

**Request Body**:
```json
{
  "email": "admin@company.com",
  "password": "password123",
  "rememberMe": true
}
```

**Implementation Flow**:
1. Validate credentials (bcrypt compare)
2. Generate token_base (UUID v4)
3. Store in Redis: 
   - Key: `session:{token_base}`
   - Value: `{id, role, timestamp, remember_me}`
   - TTL: 7 days if remember_me, else 2 hours
4. Generate JWT with token_base as subject
5. Set HttpOnly cookie with JWT
6. Return user info and token

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Admin User",
      "email": "admin@company.com",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Note**: 
- `id` is internal BIGSERIAL primary key
- `uuid` is for external references if needed

**Response** (401 Unauthorized):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email hoặc mật khẩu không đúng"
  }
}
```

**Cookies Set**:
- `auth_token`: JWT token (HttpOnly, Secure, SameSite=Lax)

---

### POST /api/v1/admin/auth/logout
Logout current admin user and invalidate Redis session.

**Access**: Admin only

**Implementation Flow**:
1. Extract JWT from cookie
2. Decode JWT to get token_base from subject
3. Delete key from Redis: `session:{token_base}`
4. Clear auth_token cookie
5. Return success

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Đăng xuất thành công"
}
```

**Cookies Cleared**:
- `auth_token`

**Redis Operations**:
- DELETE `session:{token_base}`

---

### GET /api/v1/admin/auth/me
Get current authenticated user information.

**Access**: Admin only

**Implementation Flow**:
1. Extract JWT from cookie
2. Decode JWT to get token_base
3. GET from Redis: `session:{token_base}`
4. If not found → return 401
5. If found → update TTL based on remember_me flag
6. Return user info

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Admin User",
      "email": "admin@company.com",
      "role": "admin"
    }
  }
}
```

**Response** (401 Unauthorized):
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Vui lòng đăng nhập"
  }
}
```

**Redis Operations**:
- GET `session:{token_base}`
- If found and remember_me=true: EXPIRE 7 days
- If found and remember_me=false: EXPIRE 2 hours

---

## Campaign Endpoints

### GET /api/v1/admin/campaigns
List all campaigns (admin view with filters).

**Access**: Admin only

**Query Parameters**:
- `status` (optional): `active` | `drawing` | `completed` | `canceled`
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": 1,
        "uuid": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Sổ Số Tết 2026",
        "slug": "so-so-tet-2026",
        "startTime": "2026-01-15T00:00:00Z",
        "endTime": "2026-01-31T23:59:59Z",
        "status": "active",
        "ticketPrice": 20000,
        "ticketsSold": 150,
        "participantsCount": 42,
        "createdAt": "2026-01-10T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

### POST /api/v1/admin/campaigns
Create a new campaign.

**Access**: Admin only

**Request Body**:
```json
{
  "title": "Sổ Số Tết 2026",
  "slug": "so-so-tet-2026",
  "description": "# Chương trình...",
  "startTime": "2026-01-15T00:00:00Z",
  "endTime": "2026-01-31T23:59:59Z",
  "ticketPrice": 20000,
  "paymentType": "transfer",
  "bankNameOrCode": "MB Bank",
  "accountNumber": "0123456789",
  "status": "active",
  "excludeWinningNumbers": true,
  "prizes": [
    {
      "title": "Giải khuyến khích",
      "prizesCount": 10,
      "matchingDigits": 2,
      "prizeValue": 100000
    },
    {
      "title": "Giải ba",
      "prizesCount": 5,
      "matchingDigits": 3,
      "prizeValue": 500000
    },
    {
      "title": "Giải nhì",
      "prizesCount": 2,
      "matchingDigits": 4,
      "prizeValue": 2000000
    },
    {
      "title": "Giải nhất",
      "prizesCount": 1,
      "matchingDigits": 6,
      "prizeValue": 10000000
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Sổ Số Tết 2026",
      "slug": "so-so-tet-2026",
      "// ...": "other fields"
    }
  }
}
```

**Response** (400 Bad Request):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "details": [
      {
        "field": "slug",
        "message": "Slug đã tồn tại"
      }
    ]
  }
}
```

---

### GET /api/v1/admin/campaigns/:id
Get campaign details by ID.

**Access**: Admin only

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Sổ Số Tết 2026",
      "slug": "so-so-tet-2026",
      "description": "# Chương trình...",
      "startTime": "2026-01-15T00:00:00Z",
      "endTime": "2026-01-31T23:59:59Z",
      "ticketPrice": 20000,
      "paymentType": "transfer",
      "bankNameOrCode": "MB Bank",
      "accountNumber": "0123456789",
      "status": "active",
      "excludeWinningNumbers": true,
      "prizes": [
        {
          "id": 1,
          "uuid": "660e8400-e29b-41d4-a716-446655440001",
          "title": "Giải nhất",
          "prizesCount": 1,
          "matchingDigits": 6,
          "prizeValue": 10000000
        }
      ],
      "createdAt": "2026-01-10T10:00:00Z",
      "updatedAt": "2026-01-10T10:00:00Z"
    }
  }
}
```

---

### PUT /api/v1/admin/campaigns/:id
Update campaign or change status.

**Access**: Admin only

**Request Body**: Same as POST (all fields optional)

**Common Use Cases**:

1. **Update campaign information**:
```json
{
  "title": "Updated Title",
  "description": "Updated description"
}
```

2. **Cancel campaign** (change status to "canceled"):
```json
{
  "status": "canceled"
}
```

**Preconditions for canceling**:
- Current campaign status must be "active" (not "drawing" or "completed")

3. **Complete campaign** (change status to "completed"):
```json
{
  "status": "completed"
}
```

**Preconditions for completing**:
- All prizes have been drawn
- Current campaign status must be "drawing"

**Response** (200 OK): Same as GET

**Response** (400 Bad Request) - Cannot cancel:
```json
{
  "success": false,
  "error": {
    "code": "CANNOT_CANCEL",
    "message": "Không thể hủy campaign đang quay số hoặc đã hoàn thành"
  }
}
```

**Response** (400 Bad Request) - Cannot complete:
```json
{
  "success": false,
  "error": {
    "code": "CANNOT_COMPLETE",
    "message": "Không thể hoàn thành campaign khi chưa quay hết các giải"
  }
}
```

**Side Effects when status = "canceled"**:
- Sets campaign.canceled_at = current timestamp
- Canceled campaigns cannot be reactivated
- No tickets can be purchased
- No draws can be performed

**Side Effects when status = "completed"**:
- Finds all orders with payment_status = "pending"
- Updates those orders:
  - payment_status = "failed"
  - error_message = "Campaign đã hoàn thành, đơn hàng hết hạn"
- No more tickets can be purchased
- No more draws can be performed

---

### GET /api/v1/campaigns/:slug
Get campaign details by slug (public view).

**Access**: Public

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Sổ Số Tết 2026",
      "slug": "so-so-tet-2026",
      "description": "# Chương trình...",
      "startTime": "2026-01-15T00:00:00Z",
      "endTime": "2026-01-31T23:59:59Z",
      "ticketPrice": 20000,
      "status": "active",
      "prizes": [
        {
          "id": 1,
          "uuid": "660e8400-e29b-41d4-a716-446655440001",
          "title": "Giải nhất",
          "prizesCount": 1,
          "matchingDigits": 6,
          "prizeValue": 10000000
        }
      ],
      "stats": {
        "ticketsSold": 150,
        "participantsCount": 42
      }
    }
  }
}
```

**Note**: Does not include sensitive payment info.

---

## Ticket & Order Endpoints

### POST /api/v1/tickets/purchase
Purchase tickets for a campaign.

**Access**: Public

**Request Body**:
```json
{
  "campaignSlug": "so-so-tet-2026",
  "name": "Nguyen Van B",
  "email": "user@example.com",
  "phone": "0901234567",
  "ticketsCount": 5
}
```

**Implementation Flow**:
1. Validate campaign status = "active" and within time range
2. Find or create user by email
3. Create order with payment_status = "pending"
4. Generate payment_reference_id
5. Set expires_at = now + 10 minutes (for transfer only)
6. If payment_type = "direct":
   - Immediately set payment_status = "success"
   - Generate unique ticket numbers
   - Create tickets in database
   - Skip steps 7-8
7. If payment_type = "transfer":
   - Generate VietQR code
   - Return payment info for display
8. Client polls `/api/v1/orders/:referenceId` every 3 seconds
9. When webhook updates order to "success":
   - Generate unique ticket numbers
   - Create tickets in database
   - Trigger email job

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "order": {
      "id": 1,
      "uuid": "770e8400-e29b-41d4-a716-446655440001",
      "paymentReferenceId": "LTR000001",
      "totalAmount": 100000,
      "ticketsCount": 5,
      "paymentType": "transfer",
      "paymentStatus": "pending",
      "expiresAt": "2026-01-26T12:40:45Z"
    },
    "payment": {
      "qrCodeUrl": "https://qr.sepay.vn/img?acc=0123456789&bank=MB Bank&amount=100000&des=LTR000001",
      "bankInfo": {
        "bankName": "MB Bank",
        "accountNumber": "0123456789",
        "amount": 100000,
        "content": "LTR000001"
      }
    }
  }
}
```

**Note**: 
- Ticket numbers NOT included in response for "transfer" payment
- Ticket numbers generated ONLY after payment success
- For "direct" payment, tickets created immediately and included in response

**Response** (400 Bad Request):
```json
{
  "success": false,
  "error": {
    "code": "CAMPAIGN_NOT_ACTIVE",
    "message": "Campaign không khả dụng"
  }
}
```

**Response** (500 Internal Server Error):
```json
{
  "success": false,
  "error": {
    "code": "TICKET_GENERATION_FAILED",
    "message": "Không thể tạo vé số. Vui lòng thử lại"
  }
}
```

---

### GET /api/v1/orders/:referenceId
Get order status by payment reference ID. Used for polling.

**Access**: Public

**Polling**: 
- Client should poll every 3 seconds while payment_status = "pending"
- Stop polling when status changes to "success" or "failed"
- Show timeout error after 10 minutes

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "order": {
      "id": 1,
      "uuid": "770e8400-e29b-41d4-a716-446655440001",
      "paymentReferenceId": "LTR000001",
      "totalAmount": 100000,
      "ticketsCount": 5,
      "paymentStatus": "success",
      "createdAt": "2026-01-26T12:30:45Z",
      "receivedAt": "2026-01-26T12:35:12Z",
      "transactionDate": "2026-01-26T12:35:10Z",
      "expiresAt": "2026-01-26T12:40:45Z",
      "tickets": [
        {
          "id": 1,
          "uuid": "880e8400-e29b-41d4-a716-446655440001",
          "ticketNumber": "123456"
        },
        {
          "id": 2,
          "uuid": "880e8400-e29b-41d4-a716-446655440002",
          "ticketNumber": "234567"
        }
      ]
    }
  }
}
```

**Note**: 
- Response includes full ticket objects (with `id` and `uuid`)
- `ticketNumber` is the 6-digit lottery number

**Possible paymentStatus values**:
- `pending`: Chờ thanh toán (keep polling)
- `success`: Thanh toán thành công (stop polling, show success)
- `failed`: Thanh toán thất bại (stop polling, show error)
- If status = `failed`, also includes `errorMessage`

**Client Implementation**:
```javascript
// Pseudo-code for polling
const pollOrderStatus = async (referenceId) => {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/v1/orders/${referenceId}`);
    const { order } = response.data;
    
    if (order.paymentStatus === 'success') {
      clearInterval(interval);
      redirectToSuccessPage(order);
    } else if (order.paymentStatus === 'failed') {
      clearInterval(interval);
      showError(order.errorMessage);
    } else if (Date.now() > new Date(order.expiresAt)) {
      clearInterval(interval);
      showTimeoutError();
    }
  }, 3000); // Poll every 3 seconds
};
```

---

## Draw Endpoints

### GET /api/v1/admin/campaigns/:campaignId/prizes
Get prizes for a campaign with current draw status.

**Access**: Admin only

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Sổ Số Tết 2026",
      "excludeWinningNumbers": true
    },
    "prizes": [
      {
        "id": 1,
        "uuid": "660e8400-e29b-41d4-a716-446655440001",
        "title": "Giải khuyến khích",
        "prizesCount": 10,
        "matchingDigits": 2,
        "prizeValue": 100000,
        "drawStatus": "not_drawn",
        "winningNumbers": []
      },
      {
        "id": 2,
        "uuid": "660e8400-e29b-41d4-a716-446655440002",
        "title": "Giải nhất",
        "prizesCount": 1,
        "matchingDigits": 6,
        "prizeValue": 10000000,
        "drawStatus": "drawn",
        "winningNumbers": [
          {
            "id": 1,
            "uuid": "990e8400-e29b-41d4-a716-446655440001",
            "number": "123456",
            "winners": [
              {
                "userId": 5,
                "userUuid": "aa0e8400-e29b-41d4-a716-446655440005",
                "name": "Nguyen Van B",
                "email": "user@example.com",
                "ticketNumbers": ["123456"]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**Note**: 
- All IDs are now BIGSERIAL integers
- UUIDs included for external references
- `winningNumbers[].number` stored WITHOUT left-padding zeros

---

### POST /api/v1/admin/campaigns/:campaignId/draw
Draw a winning number for a prize (query-first approach).

**Access**: Admin only

**Request Body**:
```json
{
  "prizeId": 2,
  "draftMode": false
}
```

**Implementation Flow**:
1. Get prize matching_digits (e.g., 3 for "Giải ba")
2. Query database to find valid winning number:
   - Must exist in sold tickets
   - Match last N digits (from RIGHT)
   - Exclude already winning tickets if campaign.exclude_winning_numbers = true
   - Algorithm ensures at least one match exists
3. Return winning number WITHOUT left-padding (e.g., "321" for matching_digits=3)
4. If draftMode = false:
   - Save winning_number to database
   - Mark matching tickets as is_winning = true
   - Return saved winning_number object with ID
5. If draftMode = true:
   - Return winning number without saving
   - Client can animate for preview
6. Client animates digits to winning number (right to left, ~5 seconds)

**Response** (200 OK) - Draft Mode:
```json
{
  "success": true,
  "data": {
    "draftMode": true,
    "winningNumber": "321",
    "matchingDigits": 3,
    "winners": [
      {
        "userId": 5,
        "userUuid": "aa0e8400-e29b-41d4-a716-446655440005",
        "name": "Nguyen Van B",
        "email": "user@example.com",
        "phone": "0901234567",
        "tickets": [
          {
            "id": 123,
            "uuid": "880e8400-e29b-41d4-a716-446655440123",
            "ticketNumber": "123321"
          }
        ]
      }
    ]
  }
}
```

**Response** (200 OK) - Official Mode (saved):
```json
{
  "success": true,
  "data": {
    "draftMode": false,
    "winningNumber": "321",
    "matchingDigits": 3,
    "savedWinningNumber": {
      "id": 1,
      "uuid": "990e8400-e29b-41d4-a716-446655440001",
      "campaignPrizeId": 2,
      "number": "321",
      "createdAt": "2026-01-26T14:30:00Z"
    },
    "winners": [
      {
        "userId": 5,
        "userUuid": "aa0e8400-e29b-41d4-a716-446655440005",
        "name": "Nguyen Van B",
        "email": "user@example.com",
        "phone": "0901234567",
        "tickets": [
          {
            "id": 123,
            "uuid": "880e8400-e29b-41d4-a716-446655440123",
            "ticketNumber": "123321",
            "isWinning": true
          }
        ]
      }
    ]
  }
}
```

**Note**: 
- Winning number determined by server query FIRST
- Winning number stored WITHOUT left-padding zeros (e.g., "321" not "000321")
- Matching is from RIGHT to LEFT (ticket "123321" matches winning "321")
- Client uses this number to animate digits (pad with zeros on left for display)
- No random generation on client side
- If draftMode = false, returns `savedWinningNumber` object with ID for future deletion

---

### DELETE /api/v1/admin/winning_numbers/:id
Delete a winning number (redo/clear a prize draw).

**Access**: Admin only

**Use Case**: Admin wants to "redo" a draw by clearing the previously saved winning number.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Đã xóa kết quả quay số. Có thể quay lại"
}
```

**Side Effects**:
1. Deletes winning_number record by ID
2. Unmarks tickets (sets is_winning = false) that matched this winning number
3. Allows prize to be drawn again

**Response** (404 Not Found):
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Không tìm thấy kết quả quay số"
  }
}
```

**Note**: 
- Use the winning_number `id` returned from `POST /api/v1/admin/campaigns/:campaignId/draw`
- This replaces the old "redo" endpoint

---

## Webhook Endpoints

### POST /api/v1/webhooks/sepay
Receive payment notification from SePay.

**Access**: Public (verified by JWT authentication)

**Headers**:
- `Authorization`: `Apikey {JWT_TOKEN}` - JWT signed with SEPAY_WEBHOOK_JWT_SECRET, subject contains campaign UUID

**JWT Authentication Flow**:
1. Extract JWT from Authorization header (format: "Apikey {JWT}")
2. Verify JWT using SEPAY_WEBHOOK_JWT_SECRET (skip expiration validation)
3. Decode JWT to get campaign UUID from `sub` claim
4. Find campaign by UUID (any status is acceptable)
5. If campaign not found → Return 203
6. If campaign found → Proceed with webhook processing

**Request Body** (SePay format):
```json
{
  "gateway": "Vietcombank",
  "transactionDate": "2026-01-27 08:45:29",
  "accountNumber": "0706213188",
  "subAccount": null,
  "code": "LTR000001",
  "content": "LTR000001",
  "transferType": "in",
  "description": null,
  "transferAmount": 10000,
  "referenceCode": "510787.270126.084529",
  "accumulated": 10000,
  "id": 241439
}
```

**Field Mapping**:
- `code` → payment_reference_id (e.g., "LTR000001")
- `referenceCode` → sepay_transaction_id (e.g., "510787.270126.084529")
- `transferAmount` → total_amount for reconciliation
- `accountNumber` → campaign.account_number for reconciliation
- `transactionDate` → order.transaction_date

**Reconciliation Logic**:
1. Find order by `code` (payment_reference_id)
2. Check `transferAmount` === `order.totalAmount`
3. Check `accountNumber` === `order.campaign.accountNumber`
4. If mismatch:
   - Set order.payment_status = 'failed'
   - Set order.error_message = JSON.stringify({ ...payload, reconciliationResult: "mismatch details" })
   - Return 203
5. If match and order.payment_status = 'success':
   - Return 208 (idempotency - already processed)
6. If match and order.payment_status = 'pending':
   - Set order.payment_status = 'success'
   - Set order.sepay_transaction_id = `referenceCode`
   - Set order.received_at = new Date()
   - Set order.transaction_date = `transactionDate`
   - Generate and create tickets
   - Trigger email job
   - Return 200

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

**Response** (203 Non-Authoritative Information):
Used for various non-critical failures:
```json
{
  "success": false,
  "message": "Campaign not found / Order not found / Reconciliation failed"
}
```

**Response** (208 Already Reported):
Order already processed (idempotency):
```json
{
  "success": true,
  "message": "Order already processed"
}
```

**Side effects**:
1. Updates order payment_status to "success"
2. Generates unique ticket numbers (6 digits, random, not already in DB)
3. Creates tickets in database with:
   - `id` (auto BIGSERIAL)
   - `uuid` (auto generated)
   - `campaign_id`, `user_id`, `ticket_number`
4. Creates order_tickets records linking order to tickets:
   - Stores `ticket_id` (FK to tickets.id), NOT ticket_number
5. Triggers email sending job with ticket images

**Note**: 
- JWT must have campaign UUID as subject
- Webhook response codes:
  - 200: Success
  - 203: Non-critical failure (campaign/order not found, reconciliation failed)
  - 208: Already processed (idempotency)
- `order_tickets` table uses `ticket_id` FK relationship
- Webhook must handle ticket generation atomically (transaction)

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message in Vietnamese",
    "details": [] // Optional, for validation errors
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `SESSION_EXPIRED` | 401 | Redis session not found or expired |
| `FORBIDDEN` | 403 | Permission denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `INTERNAL_ERROR` | 500 | Server error |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `CAMPAIGN_NOT_ACTIVE` | 400 | Campaign not available for purchase |
| `CAMPAIGN_ENDED` | 400 | Cannot purchase, campaign ended |
| `CAMPAIGN_CANCELED` | 400 | Campaign has been canceled |
| `CANNOT_CANCEL` | 400 | Cannot cancel campaign (drawing/completed) |
| `TICKET_GENERATION_FAILED` | 500 | Cannot generate unique tickets |
| `PAYMENT_TIMEOUT` | 400 | Payment expired |
| `CANNOT_DELETE` | 400 | Cannot delete resource |
| `INVALID_SIGNATURE` | 401 | Webhook signature invalid |

---

## Request Validation (Zod Schemas)

### Campaign Creation Schema
```typescript
const createCampaignSchema = z.object({
  title: z.string().min(3).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  ticketPrice: z.number().int().positive(),
  paymentType: z.enum(['direct', 'transfer']),
  bankNameOrCode: z.string().optional(),
  accountNumber: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  excludeWinningNumbers: z.boolean().default(true),
  prizes: z.array(z.object({
    title: z.string().min(1),
    prizesCount: z.number().int().positive(),
    matchingDigits: z.number().int().min(1).max(6),
    prizeValue: z.number().int().min(0),
  })).min(1),
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: "endTime must be after startTime" }
).refine(
  (data) => {
    if (data.paymentType === 'transfer') {
      return data.bankNameOrCode && data.accountNumber;
    }
    return true;
  },
  { message: "Bank info required for transfer payment" }
);
```

### Ticket Purchase Schema
```typescript
const purchaseTicketsSchema = z.object({
  campaignSlug: z.string(),
  name: z.string().min(2).max(255),
  email: z.string().email(),
  phone: z.string().regex(/^0\d{9}$/),
  ticketsCount: z.number().int().min(1).max(100),
});
```

---

## Rate Limiting

### Public Endpoints
- `/api/v1/tickets/purchase`: 10 requests per minute per IP
- `/api/v1/campaigns/:slug`: 60 requests per minute per IP
- `/api/v1/webhooks/sepay`: 100 requests per minute (verified by signature)

### Admin Endpoints
- All admin endpoints: 100 requests per minute per user

**Implementation**: Use `express-rate-limit` or Vercel Edge Config

---

## API Versioning

**Current Version**: v1 (explicit in URL: `/api/v1/*`)

**Future**: If breaking changes needed, use `/api/v2/*`

**Note**: All endpoints must include the version prefix `/api/v1/`

---

## Testing API Endpoints

### Tools
- **Development**: Thunder Client (VS Code), Postman, or curl
- **Integration Tests**: Vitest + MSW (Mock Service Worker)

### Example Test Request (curl)

**Admin Login**:
```bash
curl -X POST http://localhost:3000/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "password123",
    "rememberMe": true
  }'
```

**Create Campaign** (with token):
```bash
curl -X POST http://localhost:3000/api/v1/admin/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d @campaign.json
```

**Purchase Tickets**:
```bash
curl -X POST http://localhost:3000/api/v1/tickets/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "campaignSlug": "so-so-tet-2026",
    "name": "Test User",
    "email": "test@example.com",
    "phone": "0901234567",
    "ticketsCount": 5
  }'
```

---

## API Documentation

### Future Enhancement
- Generate OpenAPI/Swagger documentation
- Use tool: `swagger-jsdoc` + `swagger-ui-express`
- Serve at: `/api/docs`

### Example OpenAPI Spec
```yaml
openapi: 3.0.0
info:
  title: Lottery API
  version: 1.0.0
  description: Internal lottery system API

servers:
  - url: http://localhost:3000/api/v1
    description: Development
  - url: https://lottery.company.com/api/v1
    description: Production

paths:
  /admin/auth/login:
    post:
      summary: Admin login
      tags: [Authentication]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
```
