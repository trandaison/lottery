# Kế hoạch: Trang Orders & Tickets theo Campaign (Admin)

**Tài liệu tham chiếu**: [01-business-overview.md](./01-business-overview.md), [03-database-schema.md](./03-database-schema.md), [06-api-endpoints.md](./06-api-endpoints.md), [07-site-map.md](./07-site-map.md).

**Trạng thái**: Đã triển khai đầy đủ (Orders + Tickets). Trang Tickets đã được thêm để sửa 404.

---

## Tổng quan

Triển khai 2 trang admin:

1. **Danh sách Orders** của một campaign: `/admin/campaigns/:id/orders`
2. **Danh sách Tickets** đã bán của một campaign: `/admin/campaigns/:id/tickets`

Điều hướng: từ màn hình **Admin Campaigns** có thể chuyển đến danh sách orders hoặc tickets của từng campaign.

---

## 1. Trang danh sách Orders

### 1.1 Route & Layout

- **Path**: `/admin/campaigns/[id]/orders`
- **Layout**: Dùng admin layout có sẵn (sidebar + top bar với breadcrumbs).
- **Breadcrumbs**: Campaigns > [Campaign title hoặc ID] > Orders (cần mở rộng `AdminBreadcrumbs` cho segment `orders`).

### 1.2 Điều hướng từ Campaign list

- Trên trang `/admin/campaigns`, mỗi campaign cần thêm 2 link (hoặc 1 dropdown):
  - **"Orders"** → `/admin/campaigns/:id/orders`
  - **"Tickets"** → `/admin/campaigns/:id/tickets`
- Gợi ý: thêm 2 nút nhỏ (icon + text) trong cột Actions, hoặc 1 dropdown "More" chứa Orders / Tickets.

### 1.3 API Backend

**Endpoint**: `GET /api/v1/admin/campaigns/:id/orders`

- **Auth**: Admin only (session/JWT như các admin API khác).
- **Params**:
  - `id` (path): campaign ID.
- **Query**:
  - `page`: number, default 1.
  - `limit`: number, default 30 (cố định 30 records/page theo yêu cầu).
  - `sortBy`: `createdAt` | `paymentStatus` | `userId` | `ticketsCount`, default `createdAt`.
  - `sortOrder`: `asc` | `desc`, default `desc`.

**Logic**:

- Kiểm tra campaign tồn tại và admin có quyền (campaign thuộc hệ thống).
- Query `orders` với `campaign_id = :id`, join `users` để lấy `name`, `email`.
- Phân trang: offset = (page - 1) * limit, limit = 30.
- Sort theo `sortBy`/`sortOrder` (whitelist column để tránh SQL injection).
- Trả về danh sách order kèm thông tin user (nickname, email).

**Response** (200):

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 1,
        "paymentReferenceId": "LTR000001",
        "paymentStatus": "pending" | "success" | "failed",
        "errorMessage": null,
        "user": { "id": 1, "name": "Nickname", "email": "user@example.com" },
        "ticketsCount": 5,
        "totalAmount": 100000,
        "sepayTransactionId": null,
        "receivedAt": null,
        "transactionDate": null,
        "createdAt": "2026-01-26T12:00:00Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 30,
      "totalPages": 4
    }
  }
}
```

- Khi `paymentStatus === 'failed'`, frontend cần hiển thị `errorMessage` (qua icon info + tooltip/popover).

### 1.4 Bảng dữ liệu (Frontend)

- **Pagination**: 30 records/page, dùng query `page`, `sortBy`, `sortOrder`.
- **Cột**:

| STT | paymentReferenceId | Status (payment) | User | Ticket count | Total amount | sepayTransactionId | receivedAt | transactionDate | createdAt |
|-----|--------------------|------------------|------|--------------|--------------|--------------------|------------|-----------------|-----------|
| (row index) | text | badge + icon info khi failed | nickname, line 2: email | number | VND formatted | text | datetime | datetime | datetime |

- **Status**:
  - Hiển thị badge: Pending / Success / Failed.
  - Nếu **Failed**: thêm icon info (Lucide `Info`); click/hover hiển thị `errorMessage` (Tooltip hoặc Popover). Có thể dùng component Tooltip từ shadcn nếu đã có, hoặc thêm `@radix-ui/react-tooltip` và component `Tooltip`.
- **User**: 1 dòng nickname (font chính), dòng 2 email (text nhỏ, muted).
- **Total amount**: format VND (ví dụ `100.000 ₫` hoặc `100,000 VND`).
- **Sort**: mặc định `createdAt` desc. Cho phép sort theo: `createdAt`, `paymentStatus`, `userId`, `ticketsCount` (click header cột tương ứng, toggle asc/desc).

### 1.5 File cần tạo/sửa

- **Tạo**:
  - `src/app/api/v1/admin/campaigns/[id]/orders/route.ts` — GET handler, query orders + users, pagination, sort.
  - `src/app/admin/campaigns/[id]/orders/page.tsx` — Trang danh sách orders (fetch API, table, pagination, sort).
  - `src/app/admin/campaigns/[id]/orders/loading.tsx` — Loading skeleton (tùy chọn, thống nhất với các loading admin khác).
- **Sửa**:
  - `src/app/admin/campaigns/page.tsx` — Thêm link "Orders" (và "Tickets") cho mỗi campaign.
  - `src/components/admin/AdminBreadcrumbs.tsx` — Nhận diện segment `orders` (và `tickets`) dưới campaign để hiển thị breadcrumb (Campaigns > [id] > Orders / Tickets). Có thể cần fetch campaign title by id cho breadcrumb hoặc dùng "Orders" / "Tickets" cho segment cuối.

---

## 2. Trang danh sách Tickets

### 2.1 Route & Layout

- **Path**: `/admin/campaigns/[id]/tickets`
- **Layout**: Admin layout (sidebar + top bar).
- **Breadcrumbs**: Campaigns > [Campaign] > Tickets.

### 2.2 API Backend

**Endpoint**: `GET /api/v1/admin/campaigns/:id/tickets`

- **Auth**: Admin only.
- **Query**:
  - `page`: default 1.
  - `limit`: default 100 (cố định 100 records/page).
  - `sortBy`: `createdAt` | `status` | `ticketNumber` | `userName`, default `createdAt`.
  - `sortOrder`: `asc` | `desc`, default `desc`.

**Logic**:

- Lấy danh sách `tickets` với `campaign_id = :id`, join `users` (id, name, email).
- **Trạng thái (tên giải)** cho vé trúng:
  - Bảng `tickets`: `is_winning` (boolean).
  - Bảng `winning_numbers`: `campaign_prize_id`, `number` (số trúng, không pad trái).
  - Matching: từ phải sang trái — vé có `ticket_number` mà suffix khớp với `winning_numbers.number` (ví dụ vé "123456", giải 3 số → số trúng "456" thì khớp).
  - Join: `tickets` → so sánh suffix với `winning_numbers.number` (theo `matching_digits` của prize) → `winning_numbers` → `campaign_prizes` để lấy `title` (tên giải).
  - Cách triển khai: với mỗi ticket có `is_winning = true`, tìm trong `winning_numbers` (qua `campaign_prizes` của cùng campaign) bản ghi nào có `number` bằng suffix của `ticket_number` (độ dài = length(number)); lấy `campaign_prizes.title` tương ứng. (Hoặc query tất cả winning_numbers của campaign, map number → prize title, rồi với mỗi ticket winning, so khớp suffix để gán title.)
- Phân trang: 100 records/page.
- Sort:
  - `createdAt`: thời gian mua vé (ticket.created_at).
  - `status`: có thể sort theo `is_winning` (false trước hoặc true trước) hoặc theo tên giải (nếu có).
  - `ticketNumber`: sort theo `ticket_number`.
  - `userName`: sort theo `users.name`.

**Response** (200):

```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "id": 1,
        "ticketNumber": "123456",
        "user": { "id": 1, "name": "Nickname", "email": "user@example.com" },
        "prizeTitle": "Giải ba",
        "isWinning": true,
        "createdAt": "2026-01-26T12:00:00Z"
      }
    ],
    "pagination": {
      "total": 500,
      "page": 1,
      "limit": 100,
      "totalPages": 5
    }
  }
}
```

- Với vé không trúng: `isWinning: false`, `prizeTitle: null` (hoặc không gửi prizeTitle).

### 2.3 Bảng dữ liệu (Frontend)

- **Pagination**: 100 records/page.
- **Cột**:

| STT | Số vé | Người mua | Trạng thái | Thời gian mua |
|-----|-------|-----------|------------|---------------|
| (row index, không phải ticket id) | ticket_number | nickname, line 2: email (secondary) | Nếu trúng: badge tên giải; không trúng: để trống | createdAt formatted |

- **STT**: số thứ tự theo trang (ví dụ trang 1: 1–100, trang 2: 101–200).
- **Trạng thái**: nếu `isWinning` và có `prizeTitle` → hiển thị badge với text `prizeTitle`; ngược lại ô để trống.
- **Sort**: mặc định `createdAt` desc. Có thể đổi sort theo: trạng thái (status/is_winning hoặc prize), số vé (ticketNumber), nickname (userName).

### 2.4 File cần tạo/sửa

- **Tạo**:
  - `src/app/api/v1/admin/campaigns/[id]/tickets/route.ts` — GET handler: query tickets + users, tính prize title cho winning tickets, pagination, sort.
  - `src/app/admin/campaigns/[id]/tickets/page.tsx` — Trang danh sách tickets.
  - `src/app/admin/campaigns/[id]/tickets/loading.tsx` — Loading (tùy chọn).
- **Sửa**:
  - `src/app/admin/campaigns/page.tsx` — Đã nêu ở 1.5 (link Orders + Tickets).
  - `src/components/admin/AdminBreadcrumbs.tsx` — Thêm segment `tickets` (và `orders` nếu chưa) cho campaign.

---

## 3. Chi tiết kỹ thuật bổ sung

### 3.1 Xác định tên giải cho ticket trúng

- **Schema**: `tickets` (ticket_number, is_winning), `winning_numbers` (campaign_prize_id, number), `campaign_prizes` (id, campaign_id, title, matching_digits).
- **Quy tắc**: Số trúng trong `winning_numbers` không pad trái; so khớp từ phải sang trái với `ticket_number`.
- **Cách làm trong API**:
  1. Lấy tất cả `winning_numbers` của campaign (join `campaign_prizes` where campaign_id = :id), có kèm `campaign_prizes.title` và `matching_digits` (hoặc length of `number`).
  2. Với mỗi ticket có `is_winning = true`: lấy suffix của `ticket_number` có độ dài = độ dài từng `winning_numbers.number`, so sánh; nếu khớp thì gán `prizeTitle = campaign_prizes.title` tương ứng.
  3. Trả về ticket kèm `prizeTitle` (hoặc null nếu không trúng / không map được).

### 3.2 UI components

- **Tooltip**: Để hiển thị `errorMessage` khi status Failed (icon Info). Nếu chưa có, thêm component Tooltip (shadcn/ui hoặc Radix).
- **Badge**: Đã dùng trong admin (campaign status); dùng tương tự cho payment status và tên giải.
- **Table sort**: Click header để đổi sortBy/sortOrder; hiển thị icon mũi tên lên/xuống theo trạng thái sort.

### 3.3 Lỗi & edge case

- Campaign không tồn tại hoặc `:id` không hợp lệ → API 404, trang hiển thị thông báo hoặc redirect.
- Campaign không có order/ticket → Danh sách rỗng, pagination total = 0.
- Breadcrumb campaign title: có thể gọi GET `/api/v1/admin/campaigns/:id` (chỉ title) khi vào orders/tickets page, hoặc dùng segment "Orders"/"Tickets" mà không cần title campaign trên breadcrumb để giảm request.

---

## 4. Thứ tự triển khai gợi ý

1. **API Orders**: Tạo `GET /api/v1/admin/campaigns/[id]/orders` (query, join user, pagination, sort).
2. **Trang Orders**: Tạo page + table + pagination + sort; thêm link "Orders" trên campaigns list; cập nhật breadcrumbs.
3. **Tooltip (nếu chưa có)**: Thêm component Tooltip và dùng cho errorMessage (icon Info khi failed).
4. **API Tickets**: Tạo `GET /api/v1/admin/campaigns/[id]/tickets` (query tickets + users, map prize title cho winning tickets, pagination, sort).
5. **Trang Tickets**: Tạo page + table + pagination + sort; thêm link "Tickets" trên campaigns list; cập nhật breadcrumbs.

---

## 5. Tóm tắt API mới

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/v1/admin/campaigns/:id/orders` | Danh sách orders của campaign, 30/page, sort createdAt \| paymentStatus \| userId \| ticketsCount |
| GET | `/api/v1/admin/campaigns/:id/tickets` | Danh sách tickets đã bán, 100/page, sort createdAt \| status \| ticketNumber \| userName, kèm prize title cho vé trúng |

**Bảng tóm tắt yêu cầu**

| Trang | Path | Page size | Sort mặc định | Sort tùy chọn |
|-------|------|-----------|----------------|----------------|
| Orders | `/admin/campaigns/:id/orders` | 30 | createdAt desc | createdAt, paymentStatus, userId, ticketsCount |
| Tickets | `/admin/campaigns/:id/tickets` | 100 | createdAt desc | createdAt, status, ticketNumber, userName |

Kế hoạch trên đủ để triển khai hai trang và hai API tương ứng; có thể bổ sung test (integration/E2E) và cập nhật `07-site-map.md` / `06-api-endpoints.md` sau khi hoàn thành.
