# Use Cases

## Actor Definitions

### Admin
- Vai trò: Quản trị viên hệ thống
- Quyền hạn: Full access đến admin panel, quản lý campaigns, thực hiện quay số
- Authentication: Required (JWT-based)

### Guest
- Vai trò: Người tham gia chương trình (nhân viên công ty)
- Quyền hạn: Xem campaign, mua vé
- Authentication: Not required (tracked by email)

---

## UC01: Admin Login

**Actor**: Admin

**Preconditions**:
- Admin account đã được import sẵn trong database
- Admin chưa đăng nhập

**Main Flow**:
1. Admin truy cập `/admin/login`
2. System hiển thị form đăng nhập (email, password)
3. Admin nhập credentials
4. Admin chọn "Remember me" (optional)
5. Admin click "Login"
6. System validates credentials (bcrypt compare)
7. System generates token_base (random UUID)
8. System stores in Redis: key=token_base, value={id, role, timestamp, remember_me}
9. System sets Redis TTL: 7 days if remember_me, else 2 hours
10. System generates JWT token with token_base as subject
11. System sets HttpOnly cookie with JWT
12. System redirects to `/admin/campaigns`

**Postconditions**: Admin đã đăng nhập và có thể truy cập admin panel

**Alternative Flows**:
- **6a. Invalid credentials**: System shows error message "Email hoặc password không đúng"
- **6b. Account inactive**: System shows error message "Tài khoản đã bị vô hiệu hóa"

**Business Rules**:
- Session-based authentication with Redis
- Token base stored in Redis as key-value (key: token_base, value: user info)
- Token base TTL: 7 days (với Remember me), 2 hours (không Remember me)
- Token base used as JWT subject
- On token verification: decode JWT → get token_base from sub → fetch from Redis
- If not found in Redis → return 401
- If found → update Redis EXPIRE time (7 days if remember_me, 2 hours otherwise)
- On logout → delete token_base from Redis
- Max failed attempts: No limit (MVP)

---

## UC02: Admin Logout

**Actor**: Admin

**Preconditions**: Admin đã đăng nhập

**Main Flow**:
1. Admin clicks "Logout" button
2. System extracts token_base from JWT
3. System deletes token_base from Redis
4. System clears JWT cookie
5. System redirects to `/admin/login`

**Postconditions**: Admin đã đăng xuất và session invalidated

---

## UC03: Admin Create Campaign

**Actor**: Admin

**Preconditions**: Admin đã đăng nhập

**Main Flow**:
1. Admin navigates to `/admin/campaigns`
2. Admin clicks "Create Campaign"
3. System displays campaign creation form with 3 sections:
   
   **Section 1: Campaign Info**
   - Campaign title
   - Slug (auto-generated from title, editable)
   - Description (markdown editor)
   - Start time (datetime picker)
   - End time (datetime picker)
   - Ticket price (VND)
   
   **Section 2: Prizes Settings**
   - Dynamic array of prizes:
     - Prize title
     - Number of prizes
     - Matching digits (1-6)
     - Prize value (VND)
   - Add/Remove prize buttons
   
   **Section 3: Payment Settings**
   - Payment type (direct/transfer radio)
   - If transfer selected:
     - Bank name or code
     - Account number
     - Account holder name
     - SePay gateway URL
   - Exclude winning numbers (checkbox, default: true)

4. Admin fills in all required information
5. Admin clicks "Create"
6. System validates all fields
7. System saves campaign to database with status = "active"
8. System redirects to campaign list page
9. System shows success message

**Postconditions**: New campaign created and visible in campaign list

**Alternative Flows**:
- **8a. Validation fails**: Show validation errors inline
- **8b. Slug already exists**: Show error "Slug đã tồn tại, vui lòng chọn slug khác"
- **8c. End time < Start time**: Show error "Thời gian kết thúc phải sau thời gian bắt đầu"

**Business Rules**:
- Slug must be unique and URL-friendly
- Start time can be in the past (for flexibility)
- At least 1 prize required
- Matching digits: 1-6 only
- Prize count must be > 0

---

## UC04: Admin Update Campaign

**Actor**: Admin

**Preconditions**:
- Admin đã đăng nhập
- Campaign exists

**Main Flow**:
1. Admin navigates to `/admin/campaigns/:id/edit`
2. System loads campaign data and displays edit form
3. Admin updates desired fields
4. Admin clicks "Save"
5. System validates changes
6. System updates campaign in database
7. System redirects back to campaign detail
8. System shows success message

**Postconditions**: Campaign updated successfully

**Alternative Flows**:
- **5a. Validation fails**: Show validation errors
- **3a. Campaign has tickets sold**: Show warning "Campaign đã có vé bán, thay đổi có thể ảnh hưởng đến kết quả"

**Business Rules**:
- Cannot change slug if campaign has started
- Cannot reduce ticket_price if tickets already sold
- Cannot change payment type if orders exist

---

## UC05: Admin Cancel Campaign

**Actor**: Admin

**Preconditions**:
- Admin đã đăng nhập
- Campaign exists
- Campaign status is not "completed"

**Main Flow**:
1. Admin clicks "Cancel" button on campaign
2. System shows confirmation dialog:
   - "Bạn có chắc chắn muốn hủy campaign này?"
   - Warning: "Campaign đã hủy sẽ không thể mua vé và quay số được nữa"
3. Admin confirms
4. System updates campaign:
   - status = "canceled"
   - canceled_at = current timestamp
5. System redirects to campaigns list
6. System shows success message

**Postconditions**: Campaign canceled and cannot be used

**Alternative Flows**:
- **4a. Campaign is drawing or completed**: Show error "Không thể hủy campaign đang quay số hoặc đã hoàn thành"

**Business Rules**:
- Can cancel any campaign that has not started drawing (status = "active")
- Canceled campaigns cannot be reactivated
- Users cannot purchase tickets for canceled campaigns
- Cannot draw numbers for canceled campaigns

---

## UC06: Guest View Campaign

**Actor**: Guest

**Preconditions**: Campaign exists

**Main Flow**:
1. Guest navigates to `/campaigns/:slug`
2. System loads campaign data
3. System displays:
   - Campaign title
   - Campaign status
   - Description (rendered markdown)
   - Prize list với số lượng giải
   - Number of tickets sold
   - Number of participants (distinct email count)
   - Start and end time
   - Ticket price
4. System shows "Buy Tickets" button if current time is between start_time and end_time and status = active

**Postconditions**: Guest can see campaign details

**Alternative Flows**:
- **2a. Campaign not found**: Show 404 page
- **4a. Campaign not started**: Show countdown timer
- **4b. Campaign ended**: Hide "Buy Tickets" button, show "Campaign đã kết thúc" và button "View Results (comming soon)"

---

## UC07: Guest Purchase Tickets

**Actor**: Guest

**Preconditions**:
- Campaign is active
- Current time is between campaign start_time and end_time

**Main Flow**:
1. Guest clicks "Buy Tickets" on campaign page
2. System displays purchase form with fields:
   - Nickname (required)
   - Email (required, validated)
   - Phone number (required)
   - Number of tickets (required, min: 1)
   - Total amount (auto-calculated, read-only)
3. Guest fills in information
4. Guest selects number of tickets
5. System calculates and displays total: `tickets * campaign.ticket_price`
6. Guest clicks "Purchase"
7. System validates input
8. System checks if user exists by email:
   - If not exists: Create new user
   - If exists: Use existing user
9. System creates order with payment_status = "pending"
10. System generates payment_reference_id
11. System sets order.expires_at = now + 10 minutes (for transfer type only)
12. If payment_type = "direct":
    - System immediately updates order.payment_status = "success"
    - Go to step 15
13. If payment_type = "transfer":
    - System generates VietQR code with payment_reference_id
    - System displays payment page with QR code and bank info
    - System shows countdown timer (10 minutes)
    - System starts polling order status every 3 seconds
    - Guest scans QR and transfers money
    - System waits for webhook to update order status
14. When order.payment_status becomes "success":
15. System generates unique ticket numbers (6 digits each, random)
16. System creates tickets in tickets table with generated numbers
17. System triggers email sending job
18. System displays success page with ticket numbers
19. Guest receives email with ticket images

**Note on Polling**: 
- Frontend polls `/api/orders/:referenceId` every 3 seconds
- Webhook updates order status in background
- When status = "success", redirect to success page
- When status = "failed", show error message
- When timeout (10 minutes), show timeout error

**Postconditions**:
- Order created
- Tickets generated (after payment success)
- Email sent

**Alternative Flows**:
- **7a. Validation fails**: Show inline errors
- **8a. Email invalid**: Show "Email không hợp lệ"
- **15a. Cannot generate unique numbers**: Show error "Hết vé số, vui lòng thử lại sau"
- **13a. Payment timeout (10 minutes)**: Polling detects timeout, show error "Hết thời gian thanh toán. Vui lòng thử lại"
- **13b. Payment failed**: Webhook updates status to "failed", polling detects and shows error
- **17a. Email sending fails**: Log error, but don't fail transaction (retry later)

**Business Rules**:
- Email uniquely identifies a user across purchases
- Ticket numbers must be unique per campaign
- Payment timeout: 10 minutes
- No limit on tickets per person
- Cannot purchase after campaign ends

---

## UC08: System Process Payment Webhook

**Actor**: SePay System (automated)

**Preconditions**:
- Order exists with payment_status = pending
- Guest has transferred money

**Main Flow**:
1. SePay sends webhook to `/api/webhooks/sepay`
2. System validates webhook signature
3. System extracts payment_reference_id
4. System finds matching order
5. If payment successful:
   - System updates order.payment_status = "success"
   - System saves order.sepay_transaction_id
   - System saves order.received_at = webhook.timestamp
   - System creates tickets in tickets table
   - System triggers email job
6. If payment failed:
   - System updates order.payment_status = "failed"
   - System saves order.error_message
7. System responds 200 OK to webhook

**Postconditions**: Order payment status updated

**Alternative Flows**:
- **2a. Invalid signature**: Respond 401, log security event
- **4a. Order not found**: Respond 404, log warning
- **4b. Order already processed**: Respond 200, skip processing (idempotency)
- **4c. Order expired**: Update status to "failed", error_message = "Timeout"

**Business Rules**:
- Webhook must be idempotent
- Process within 30 seconds
- Retry if ticket creation fails

---

## UC09: System Send Ticket Email

**Actor**: System (automated)

**Preconditions**:
- Order payment_status = success
- Tickets created in database

**Main Flow**:
1. System retrieves order and tickets
2. For each ticket:
   - System loads ticket template image
   - System renders ticket number on canvas
   - System renders user name on canvas
   - System generates image buffer
3. System composes email:
   - Subject: "Vé số của bạn - [Campaign Title]"
   - Body: Campaign info, ticket numbers list, terms
   - Attachments: All ticket images
4. System sends email via SendGrid
5. System logs email sent status

**Postconditions**: User receives email with tickets

**Alternative Flows**:
- **4a. SendGrid fails**: Retry up to 3 times with exponential backoff
- **4b. Still fails after retries**: Log error, flag for manual review

**Business Rules**:
- Send within 3 minutes of payment success
- Each ticket = 1 image attachment
- Email must include all ticket numbers in both text and images

---

## UC10: Admin Navigate to Draw Page

**Actor**: Admin

**Preconditions**:
- Admin logged in
- Campaign exists
- Campaign has tickets sold

**Main Flow**:
1. Admin navigates to `/admin/campaigns/:id/draw`
2. System loads campaign and prizes
3. System displays draw interface with:
   - Left side: 6-digit scrolling meter
   - Right side: Prize results table
   - Top: "Quay thử" toggle switch (default: ON)
4. Prize table shows:
   - Each row = 1 prize type
   - Prize name and "Draw" button
   - Placeholder underscores for each prize count

**Postconditions**: Admin ready to draw

---

## UC11: Admin Draw Prize (Draft Mode)

**Actor**: Admin

**Preconditions**:
- On draw page
- "Quay thử" toggle = ON
- Prize not yet drawn

**Main Flow**:
1. Admin clicks draw button next to prize
2. System determines matching_digits for this prize
3. System sets left padding digits to 0 (if matching_digits < 6)
4. System activates scrolling animation:
   - All required digits scroll 0-9 continuously
5. Admin clicks "Stop" button
6. System queries database to determine winning number:
   - Find a valid ticket number that exists in sold tickets
   - Consider exclude_winning_numbers setting
   - Algorithm ensures result matches at least one ticket
7. System animates digits stopping from right to left:
   - Each digit decelerates and stops at predetermined value
   - Total animation time ~5 seconds
8. All digits stopped, showing final winning number
9. System finds all matching tickets for this number
10. System displays popup:
   - Winning number (large display)
   - List of winners (nicknames + ticket numbers)
   - Buttons: "Đóng" và "Quay giải tiếp"
11. Admin clicks "Đóng" or "Quay giải tiếp"
12. System does NOT save results (draft mode)
13. Prize row shows winning number với "Redo" button

**Postconditions**: Prize drawn in draft mode, not saved

**Business Rules**:
- Draft draws are not saved to database
- Can redo unlimited times in draft mode
- Winning number must match at least 1 sold ticket

---

## UC12: Admin Draw Prize (Official Mode)

**Actor**: Admin

**Preconditions**:
- On draw page
- "Quay thử" toggle = OFF
- Prize not yet officially drawn

**Main Flow**:
1-10. Same as UC11 (including query-first logic)
11. System saves winning numbers to database
12. If `campaign.exclude_winning_numbers = true`:
    - System marks winning tickets as is_winning = true
    - Next draws will exclude these tickets from pool
13. System displays success popup
14. Prize row shows winning number với "Redo" button

**Postconditions**:
- Winning numbers saved to database
- Winning tickets may be excluded from future draws

**Alternative Flows**:
- **9a. No matching tickets found**: Show error "Không tìm thấy vé trúng giải. Vui lòng quay lại"

**Business Rules**:
- Official draws are permanent (until redo)
- Must draw prizes in order: 
  - First by matching_digits (ascending)
  - If same matching_digits, order by created_at (ascending)
- Cannot draw if previous prize not completed
- Winning tickets excluded based on campaign setting
- Algorithm ensures winning number always matches at least one sold ticket

---

## UC13: Admin Redo Prize Draw

**Actor**: Admin

**Preconditions**:
- Prize already drawn (draft or official)

**Main Flow**:
1. Admin clicks "Redo" button next to prize
2. System shows confirmation popup:
   - "Bạn có chắc chắn muốn quay lại giải này?"
   - Warning: "Kết quả hiện tại sẽ bị xóa"
3. Admin confirms
4. System deletes winning_numbers for this prize
5. If official mode was used:
   - System un-marks winning tickets (make them available again)
6. System resets prize row to placeholder state
7. System ready for new draw

**Postconditions**: Prize reset, ready to draw again

---

## UC14: Admin Complete Campaign Drawing

**Actor**: Admin

**Preconditions**:
- Admin on draw page
- All prizes have been drawn
- Campaign status = "drawing"

**Main Flow**:
1. Admin clicks "Hoàn thành quay số" button
2. System shows confirmation popup:
   - "Bạn có chắc chắn muốn hoàn thành quay số?"
   - Warning: "Sau khi hoàn thành, không thể quay lại"
3. Admin confirms
4. System updates campaign status = "completed"
5. System updates all pending orders (payment_status = "pending") to "failed":
   - Set payment_status = "failed"
   - Set error_message = "Campaign đã hoàn thành, đơn hàng hết hạn"
6. System displays success message
7. System redirects to campaigns list

**Postconditions**:
- Campaign marked as completed
- All pending orders marked as failed
- No more tickets can be purchased
- No more draws can be performed

**Business Rules**:
- Can only complete if all prizes drawn
- Completion is permanent
- All pending orders automatically fail

---

## UC15: Guest Check Order Status (Future Enhancement)

**Actor**: Guest

**Preconditions**: Guest has placed order

**Main Flow**:
1. Guest receives order ID after purchase
2. Guest navigates to `/orders/:payment_reference_id`
3. System displays order status:
   - Pending: "Đang chờ thanh toán"
   - Success: "Thanh toán thành công" + ticket numbers
   - Failed: "Thanh toán thất bại" + error message
   - Expired: "Hết thời gian thanh toán"
4. If pending, show remaining time

**Postconditions**: Guest knows order status

---

## UC16: Admin View Campaign Statistics (Future Enhancement)

**Actor**: Admin

**Preconditions**: Admin logged in

**Main Flow**:
1. Admin navigates to `/admin/campaigns/:id`
2. System displays statistics:
   - Total tickets sold
   - Total revenue
   - Unique participants
   - Payment success rate
   - Tickets sold over time chart

**Postconditions**: Admin sees campaign metrics

---

## Use Case Summary

| ID | Use Case | Actor | Priority |
|----|----------|-------|----------|
| UC01 | Admin Login (Redis-based) | Admin | High |
| UC02 | Admin Logout | Admin | High |
| UC03 | Admin Create Campaign (3 sections) | Admin | High |
| UC04 | Admin Update Campaign | Admin | High |
| UC05 | Admin Cancel Campaign | Admin | Medium |
| UC06 | Guest View Campaign | Guest | High |
| UC07 | Guest Purchase Tickets (with polling) | Guest | High |
| UC08 | System Process Payment Webhook | System | High |
| UC09 | System Send Ticket Email | System | High |
| UC10 | Admin Navigate to Draw Page | Admin | High |
| UC11 | Admin Draw Prize (Draft, query-first) | Admin | High |
| UC12 | Admin Draw Prize (Official, query-first) | Admin | High |
| UC13 | Admin Redo Prize Draw | Admin | High |
| UC14 | Admin Complete Campaign Drawing | Admin | High |
| UC15 | Guest Check Order Status | Guest | Low (Future) |
| UC16 | Admin View Statistics | Admin | Low (Future) |
