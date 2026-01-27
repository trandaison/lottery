# Site Map

## Overview
This document outlines the complete site structure for the Lottery system, including all pages, routes, and navigation flows.

---

## Public Pages (Guest Access)

### Landing Page
**Route**: `/`

**Status**: Not implemented in current phase - redirects to `/admin/login`

**Purpose**: Homepage introducing the lottery system

**Implementation**:
- For MVP: Add redirect logic in `app/page.tsx`:
  ```typescript
  export default function Home() {
    redirect('/admin/login');
  }
  ```
- Future phase: Implement full landing page with hero section and campaign cards

**Future Content** (for reference):
- Hero section with system overview
- Current active campaigns (cards)
- How it works section
- Footer with company info

---

### Campaign Detail & Purchase
**Route**: `/campaigns/:slug`

**Purpose**: View campaign details and purchase tickets

**Content**:
- Campaign banner/title
- Description (markdown rendered)
- Prize list table:
  - Prize name
  - Number of prizes
  - Matching digits
  - Prize value
- Statistics:
  - Tickets sold
  - Participants count
  - Time remaining (countdown)
- Purchase form (if campaign active):
  - Name input
  - Email input
  - Phone input
  - Ticket quantity selector
  - Total amount (calculated)
  - Submit button

**States**:
- **Before campaign starts**: Show countdown, disable purchase
- **During campaign**: Show purchase form
- **After campaign ends**: Hide purchase form, show "Campaign đã kết thúc"

**Actions**:
- Submit form → POST /api/tickets/purchase → Navigate to payment page
- If payment_type = "direct" → Show success message immediately
- If payment_type = "transfer" → Navigate to `/orders/:referenceId/payment`

---

### Payment Page
**Route**: `/orders/:referenceId/payment`

**Purpose**: Display payment QR code and wait for payment confirmation

**Content**:
- Order summary:
  - Campaign name
  - Number of tickets
  - Total amount
- Payment instructions
- VietQR code (large, scannable)
- Bank account details:
  - Bank name
  - Account number
  - Account holder
  - Transfer content (payment reference ID)
- Countdown timer (10 minutes)
- Payment status indicator

**States (managed by React state)**:
1. **Pending** (default):
   - Show QR code
   - Show countdown timer
   - Poll for status updates

2. **Success**:
   - Hide QR code and countdown
   - Show success icon/animation
   - Show message: "Thanh toán thành công!"
   - Show order details with ticket numbers
   - Show email notification message:
     - "Vé số đã được gửi đến email: {email}"
     - "Vui lòng kiểm tra hộp thư (kể cả spam)"
   - Show buttons:
     - "Quay về trang chủ" → Navigate to `/`
     - "Xem campaign" → Navigate to `/campaigns/:slug`

3. **Failed**:
   - Show error icon
   - Show error message
   - Show "Thử lại" button

4. **Timeout**:
   - Show timeout message: "Hết thời gian thanh toán"
   - Show "Thử lại" button

**Real-time Behavior**:
- Poll `/api/v1/orders/:referenceId` every 3 seconds while status = "pending"
- When status = "success": Update React state to show success view
- When status = "failed": Update React state to show error view
- When timeout (10 minutes): Update React state to show timeout view
- Stop polling when status is no longer "pending"

**Actions**:
- Submit purchase → Render this page with "pending" state
- Payment confirmed (via polling) → Update state to "success"
- Timeout → Update state to "timeout"

**Note**: No separate `/orders/:referenceId/success` page. Success is a state within this page.

---

### Order Status Page (Future)
**Route**: `/orders/:referenceId`

**Purpose**: Check order status anytime

**Content**:
- Order information
- Payment status
- Ticket numbers (if paid)
- Download tickets button

---

## Admin Pages (Protected)

### Admin Login
**Route**: `/admin/login`

**Purpose**: Authenticate admin users

**Access**: Public (but redirects to dashboard if already logged in)

**Content**:
- Login form:
  - Email input
  - Password input
  - Remember me checkbox
  - Login button
- Company logo/branding

**Actions**:
- Submit → POST /api/auth/login
- Success → Redirect to `/admin/campaigns`
- Failed → Show error message

**Layout**: Minimal (no nav, full-width centered form)

---

### Admin Dashboard / Campaigns List
**Route**: `/admin/campaigns`

**Purpose**: View and manage all campaigns

**Access**: Admin only

**Content**:
- Page header:
  - Title: "Quản lý Campaigns"
  - Button: "Tạo Campaign Mới" → Navigate to `/admin/campaigns/new`
- Filters:
  - Status dropdown (All, Active, Inactive)
  - Search by title
- Campaigns table:
  - Columns:
    - Title
    - Slug
    - Start Date
    - End Date
    - Status badge
    - Tickets Sold
    - Actions (Edit, Draw, Delete icons)
  - Pagination

**Actions**:
- Click "Tạo Campaign Mới" → Navigate to `/admin/campaigns/new`
- Click "Edit" → Navigate to `/admin/campaigns/:id/edit`
- Click "Draw" → Navigate to `/admin/campaigns/:id/draw`
- Click "Delete" → Show confirmation modal → DELETE /api/campaigns/:id

**Layout**: Admin layout (sidebar nav)

---

### Create Campaign
**Route**: `/admin/campaigns/new`

**Purpose**: Create a new lottery campaign

**Access**: Admin only

**Content**:
- Page header: "Tạo Campaign Mới"
- Campaign form:
  - **Basic Info Section**:
    - Title (text input)
    - Slug (text input, auto-generated from title)
    - Description (markdown editor)
    - Start Date & Time (datetime picker)
    - End Date & Time (datetime picker)
    - Ticket Price (number input, VND)
    - Status (radio: Active/Inactive)
    - Exclude Winning Numbers (checkbox)
  
  - **Payment Info Section**:
    - Payment Type (radio: Direct/Transfer)
    - If Transfer selected:
      - Bank Name or Code
      - Account Number
      - SePay Webhook API Key (read-only, auto-generated JWT with campaign UUID as subject)
  
  - **Prizes Section** (dynamic array):
    - Add Prize button (adds new row)
    - For each prize:
      - Title (text input)
      - Number of Prizes (number input)
      - Matching Digits (select 1-6)
      - Prize Value (number input, VND)
      - Remove button (deletes row)
  
  - **Actions**:
    - Save button (primary)
    - Cancel button (secondary) → Navigate back

**Validation**:
- Real-time validation on blur
- Show errors inline below each field
- Disable submit if validation fails

**Actions**:
- Submit → POST /api/campaigns
- Success → Redirect to `/admin/campaigns/:id/edit` with success toast
- Failed → Show error messages

**Layout**: Admin layout (sidebar nav)

---

### Edit Campaign
**Route**: `/admin/campaigns/:id/edit`

**Purpose**: Edit existing campaign

**Access**: Admin only

**Content**: Same as Create Campaign, but:
- Pre-filled with existing data
- Page header: "Chỉnh sửa Campaign: {title}"
- Additional button: "Xem trang quay số" → Navigate to `/admin/campaigns/:id/draw`

**Actions**:
- Submit → PUT /api/campaigns/:id
- Success → Show success toast, stay on page
- Failed → Show error messages

**Layout**: Admin layout (sidebar nav)

---

### Draw Interface
**Route**: `/admin/campaigns/:id/draw`

**Purpose**: Conduct live lottery draw

**Access**: Admin only

**Layout**: **Full-screen layout** (not admin sidebar layout) - for optimal UX during live drawing

**Content**:
- Page header:
  - Back button → Navigate to `/admin/campaigns/:id/edit`
  - Campaign title (centered)
  - Toggle switch: "Quay thử" (Draft Mode) - ON by default
  - Warning badge when draft mode ON: "Chế độ quay thử (kết quả sẽ không được lưu)"
  - Logout button (top-right corner)

- **Main Layout (2 columns, full-screen)**:

  **Left Column: Scrolling Meter**
  - 6-digit display (large, bold digits)
  - Each digit in separate box
  - Start/Stop button (toggle)
  - Animation:
    - When started: All digits scroll 0-9 continuously
    - When stopped: Digits stop from right to left
    - Deceleration animation (~5 seconds)
  - If matching_digits < 6: Left padding digits stay at "0"

  **Right Column: Results Table**
  - Table with prizes sorted by matching_digits (ascending)
  - Columns:
    - Prize Name (with draw icon button)
    - Winning Numbers (placeholders or results)
  
  - For each prize row:
    - **Not drawn yet**:
      - Show underscores placeholders (`______`)
      - Show "Quay giải" icon button
    
    - **Currently drawing**:
      - Show loading spinner (same width as placeholder)
      - Disable all other draw buttons
    
    - **Already drawn**:
      - Show winning number(s)
      - Show "Redo" icon button
      - Expand to show winners list (names)

**Draw Flow**:
1. Admin clicks "Quay giải" icon for Prize A
2. Left meter activates with animation
3. Right table shows loading for Prize A
4. Admin clicks "Stop" button
5. API call: `POST /api/v1/admin/campaigns/:campaignId/draw`
6. Server returns predetermined winning number
7. Meter stops with animation (right to left) to that number
8. When all digits stopped, show popup with results:
   - Winning number (large display)
   - Winners list (nicknames + ticket numbers)
   - If no winners: "Không có vé trúng giải"
   - Buttons: "Đóng" | "Quay giải tiếp"
9. If draft mode OFF: Winning number already saved by API
10. If draft mode ON: Not saved, can redo immediately

**Redo Flow**:
1. Admin clicks "Redo" icon
2. Show confirmation modal:
   - Warning: "Kết quả hiện tại sẽ bị xóa"
   - Confirm/Cancel buttons
3. If confirmed:
   - `DELETE /api/v1/admin/winning_numbers/:id`
   - Reset row to placeholder state

**Actions**:
- Toggle "Quay thử" → Update local state (draftMode flag)
- Click "Quay giải" → Activate meter animation
- Click "Stop" → `POST /api/v1/admin/campaigns/:campaignId/draw` with `draftMode` flag
- API returns winning number → Animate to that number
- Click "Redo" → Show modal → `DELETE /api/v1/admin/winning_numbers/:id`

**Important Notes**:
- Uses **full-screen layout**, NOT admin sidebar layout
- This ensures optimal UX during live drawing
- Similar to a presentation/kiosk mode
- Only minimal navigation: back button and logout

---

## Admin Layout Components

### Sidebar Navigation
- Logo
- Navigation items:
  - Campaigns (icon + text) → `/admin/campaigns`
  - Orders (icon + text) → `/admin/orders` (future)
  - Settings (icon + text) → `/admin/settings` (future)
- Bottom:
  - User info (name + email)
  - Logout button

### Top Bar
- Breadcrumbs
- User avatar dropdown:
  - Profile
  - Settings
  - Logout

**Note**: 
- Search and Notifications are NOT included in MVP
- Can be added in future phases if needed

---

## Navigation Flow Diagrams

### Guest Flow: Campaign → Purchase → Payment (with success state)

```
┌──────────────┐
│   Landing    │
│   Page (/)   │
│              │
│  [Redirects  │
│  to /admin/  │
│   login]     │
└──────────────┘

User accesses campaign directly:

┌─────────────────────────┐
│  Campaign Detail        │
│  /campaigns/:slug       │
│                         │
│  [Purchase Form]        │
└──────┬──────────────────┘
       │
       │ Submit purchase
       │
┌──────▼──────────────────────────────┐
│  Payment Page (Single Page)         │
│  /orders/:ref/payment               │
│                                     │
│  STATE: "pending"                   │
│  ├─ [QR Code]                       │
│  ├─ [Countdown Timer]               │
│  └─ [Polling status...]             │
│                                     │
│  ↓ Payment confirmed (via polling)  │
│                                     │
│  STATE: "success"                   │
│  ├─ [Success Icon]                  │
│  ├─ [Ticket Numbers]                │
│  ├─ [Email Notification Message]    │
│  └─ [Action Buttons]                │
└─────────────────────────────────────┘

Note: No separate success page.
Success is rendered as a state on the same page.
```

---

### Admin Flow: Login → Campaigns → Create/Edit → Draw

```
┌──────────────┐
│ Admin Login  │
│ /admin/login │
└──────┬───────┘
       │
       │ Login success
       │
┌──────▼──────────────┐
│ Campaigns List      │
│ /admin/campaigns    │
│                     │
│ [Create Button]     │
│ [Campaigns Table]   │
└──────┬──────┬───────┘
       │      │
       │      │ Click "Create"
       │      │
       │   ┌──▼────────────────┐
       │   │ Create Campaign   │
       │   │ /admin/campaigns/ │
       │   │      new           │
       │   │                   │
       │   │ [Campaign Form]   │
       │   └───────────────────┘
       │
       │ Click "Edit"
       │
┌──────▼─────────────────┐
│ Edit Campaign          │
│ /admin/campaigns/:id/  │
│        edit            │
│                        │
│ [Campaign Form]        │
│ [Go to Draw Button]    │
└──────┬─────────────────┘
       │
       │ Click "Go to Draw"
       │
┌──────▼─────────────────┐
│ Draw Interface         │
│ /admin/campaigns/:id/  │
│        draw            │
│                        │
│ [Scrolling Meter]      │
│ [Results Table]        │
│                        │
│ LAYOUT: Full-screen    │
│ (no admin sidebar)     │
└────────────────────────┘
```

---

## URL Structure Summary

### Public URLs
- `/` - Landing page (redirects to `/admin/login` in MVP)
- `/campaigns/:slug` - Campaign detail & purchase
- `/orders/:referenceId/payment` - Payment page (includes success state via React state)
- `/orders/:referenceId` - Order status (future)

### Admin URLs
- `/admin/login` - Admin login
- `/admin/campaigns` - Campaigns list (dashboard)
- `/admin/campaigns/new` - Create campaign
- `/admin/campaigns/:id/edit` - Edit campaign
- `/admin/campaigns/:id/draw` - Draw interface (**full-screen layout**, no sidebar)
- `/admin/orders` - Orders list (future)
- `/admin/settings` - System settings (future)

### API URLs
- See [06-api-endpoints.md](./06-api-endpoints.md)

---

## Responsive Design Notes

### Mobile Considerations

**Public Pages**:
- `/`: Redirect to `/admin/login` (no layout needed)
- `/campaigns/:slug`: Full-width layout, sticky purchase button at bottom
- `/orders/:referenceId/payment`: 
  - Pending state: Larger QR code, single column layout
  - Success state: Center-aligned success message, ticket grid

**Admin Pages**:
- Sidebar collapses to hamburger menu
- `/admin/campaigns/:id/draw`: 
  - Full-screen layout (no sidebar on desktop)
  - Stack meter and results table vertically on mobile
  - Minimize header to essential controls only
- Tables scroll horizontally with sticky first column

---

## SEO & Meta Tags

### Public Pages Meta
```html
<head>
  <title>Sổ Số Vui Xuân - {Campaign Title}</title>
  <meta name="description" content="Tham gia chương trình sổ số vui xuân nội bộ công ty...">
  <meta property="og:title" content="Sổ Số Vui Xuân - {Campaign Title}">
  <meta property="og:description" content="...">
  <meta property="og:image" content="/og-image.png">
  <meta name="robots" content="noindex, nofollow"> <!-- Internal tool -->
</head>
```

### Admin Pages Meta
```html
<head>
  <title>Admin - {Page Title} | Lottery</title>
  <meta name="robots" content="noindex, nofollow">
</head>
```

---

## Future Pages (Post-MVP)

- `/admin/orders` - View all orders with filters
- `/admin/users` - User management
- `/admin/reports` - Campaign reports and statistics
- `/admin/settings` - System configuration
- `/profile` - User profile (if user accounts added)
- `/campaigns` - Public campaigns listing page
- `/about` - About the lottery system
- `/terms` - Terms and conditions
- `/privacy` - Privacy policy
