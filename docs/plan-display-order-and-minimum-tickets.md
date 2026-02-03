# Kế hoạch: display_order (prizes) + minimum_tickets (campaigns)

## Tổng quan

1. **Prize display_order**: Thêm cột `display_order` (default 0) vào `campaign_prizes`; sắp xếp prize theo cột này khi hiển thị/API/draw results; Prizes Settings có drag & drop + layout compact (1 row: title 5, winners 2, digits 2, value 3) + grab handle.
2. **Campaign minimum_tickets**: Thêm cột `minimum_tickets` vào `campaigns`; chỉ áp dụng cho **lần mua đầu tiên** (số vé đã mua < minimumTickets); thông tin "Số vé tối thiểu" hiển thị ở CampaignStats (khi > 1); form mua vé có lookup theo email (auto-fill, readonly name/phone khi có user), validation minimum theo vé đã mua, không hint trong form.

---

## Phase 1: Schema & Migration

### 1.1 `campaign_prizes` — thêm `display_order`

**File:** `src/db/schema/campaign-prizes.ts`

- Thêm cột:
  - `displayOrder: integer('display_order').notNull().default(0)`
- Thêm index (tùy chọn, cho sort): `index('idx_campaign_prizes_display_order').on(table.displayOrder)` hoặc composite với `campaignId` nếu cần.

**Migration:** Tạo migration mới (ví dụ `0004_*.sql`):

- `ALTER TABLE "campaign_prizes" ADD COLUMN "display_order" integer NOT NULL DEFAULT 0;`
- (Tùy chọn) Backfill: `UPDATE campaign_prizes SET display_order = sub.rn - 1 FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY matching_digits, created_at) AS rn FROM campaign_prizes) AS sub WHERE campaign_prizes.id = sub.id;` để giữ thứ tự hiện tại tương đương.

### 1.2 `campaigns` — thêm `minimum_tickets`

**File:** `src/db/schema/campaigns.ts`

- Thêm cột:
  - `minimumTickets: integer('minimum_tickets').notNull().default(1)` (1 = không bắt buộc tối thiểu > 1).

**Migration:** Cùng hoặc migration riêng:

- `ALTER TABLE "campaigns" ADD COLUMN "minimum_tickets" integer NOT NULL DEFAULT 1;`

---

## Phase 2: Backend — Prizes order by display_order

### 2.1 Nơi query prizes — đổi `orderBy` sang `display_order`

Tất cả chỗ đang `.orderBy(asc(campaignPrizes.matchingDigits), asc(campaignPrizes.createdAt))` cần đổi thành `.orderBy(asc(campaignPrizes.displayOrder), asc(campaignPrizes.matchingDigits), asc(campaignPrizes.createdAt))` (hoặc chỉ `displayOrder` nếu đủ).

**Files cần sửa:**

| File | Vị trí / Ghi chú |
|------|-------------------|
| `src/services/campaign.service.ts` | `getById`: query prizes → orderBy displayOrder, matchingDigits, createdAt |
| `src/services/campaign.service.ts` | `getBySlug`: idem |
| `src/services/campaign.service.ts` | `list`: trong vòng campaignIds, query prizes → orderBy displayOrder |
| `src/services/campaign.service.ts` | `update`: khi “keep existing prizes”, orderBy displayOrder |
| `src/services/draw.service.ts` | `getPrizesWithDrawStatus`: orderBy displayOrder, matchingDigits, createdAt |

### 2.2 Create/Update campaign — truyền `display_order`

- **Types:** `NewCampaignPrize` sẽ có thêm `displayOrder?: number` (default 0).
- **Validation:** `src/lib/validations/campaign.ts` — `prizeSchema` thêm `displayOrder: z.number().int().min(0).optional().default(0)`.
- **campaign.service.ts:**
  - `create`: khi insert prizes, map `displayOrder: prize.displayOrder ?? 0`.
  - `update`: khi replace prizes, map `displayOrder: prize.displayOrder ?? 0`.

### 2.3 API response types (DTO)

- **File:** `src/types/index.ts` — `CampaignPrizeDTO` thêm `displayOrder: number` (để client sort nếu cần; thực tế backend đã sort rồi).

---

## Phase 3: Backend — minimum_tickets (chỉ lần mua đầu tiên)

### 3.1 Validation & check trong purchase API

**File:** `src/app/api/v1/tickets/purchase/route.ts`

- Sau khi có `campaign` và `user` (sau bước findOrCreate):
  - Đọc `campaign.minimumTickets` (default 1).
  - Nếu `minimumTickets > 1`: kiểm tra “user đã từng mua vé campaign này chưa?”
    - Query: tồn tại bản ghi trong `tickets` (hoặc `order_tickets` + `orders`) với `userId = user.id` và `campaignId = campaign.id`. Có thể dùng `ticketService` hoặc query trực tiếp.
  - Nếu **chưa từng mua** và `validatedData.ticketsCount < campaign.minimumTickets` → trả về 400, message kiểu: "Số vé tối thiểu là {minimumTickets} vé".
  - Nếu đã từng mua → không áp dụng minimum_tickets.

**Gợi ý:** Thêm trong `ticket.service.ts` (hoặc `campaign.service.ts`) hàm `hasUserPurchasedCampaign(userId: number, campaignId: number): Promise<boolean>` (exists ticket với userId + campaignId).

### 3.2 Campaign validation & types

- **Backend validation:** `src/lib/validations/campaign.ts` — schema campaign (create/update) thêm `minimumTickets: z.number().int().min(1).optional().default(1)`.
- **Admin API:** Khi create/update campaign, nhận và lưu `minimumTickets`.
- **Types:** `Campaign` / DTO có `minimumTickets: number`.

---

## Phase 4: Admin — Prizes Settings (drag & drop + layout compact)

### 4.1 Drag & drop

- Cài thư viện: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (hoặc tương đương).
- **File:** `src/components/admin/CampaignForm.tsx` — phần Prizes:
  - Dùng `useFieldArray` như hiện tại, nhưng bọc danh sách prize cards trong sortable context (theo thứ tự `display_order`).
  - Mỗi card là sortable item; khi kết thúc kéo, cập nhật `displayOrder` theo index (0, 1, 2, …) và sync vào form (reorder `fields` / values của `prizes`).
  - Form schema và default values: mỗi prize có `displayOrder: number` (default theo index).

### 4.2 Layout compact — 1 row, 4 cột

- Trong mỗi prize card:
  - 1 row grid: **Prize title** (5 cols), **Winners** (2 cols), **Digits** (2 cols), **Prize value** (3 cols) — tổng 12 (Tailwind grid-cols-12).
  - Thêm **grab handle** (icon GripVertical) bên trái hoặc đầu row để kéo thứ tự; chỉ dùng cho sortable, không submit.

### 4.3 Form schema (CampaignForm) & default

- `campaignFormSchema` prizes item thêm `displayOrder: z.number().int().min(0)`.
- Khi load campaign: `campaign.prizes` đã được backend sort theo `display_order`, map `displayOrder: p.displayOrder ?? index`.
- Khi thêm prize mới: `displayOrder: fields.length`.
- Submit: gửi `displayOrder` trong từng prize lên API (backend đã xử lý ở Phase 2.2).

---

## Phase 5: Public — Form mua vé, lookup user theo email, minimum_tickets

### 5.1 API lookup user theo email (cho campaign)

- **Endpoint:** `GET /api/v1/campaigns/[slug]/lookup?email=...` (hoặc `POST .../lookup` body `{ email }`).
- **Response (200):**
  - Nếu **không** có user với email đó: `{ user: null, ticketsCountForCampaign: 0 }`.
  - Nếu có user: `{ user: { name, email, phone }, ticketsCountForCampaign: number }` (số vé user đã mua cho campaign này).
- **Backend:** Validate email; tìm user theo email; đếm số ticket của user đó cho campaign (theo slug → campaignId). Trả về không cần auth (public), chỉ trả thông tin cần thiết (name, phone, ticketsCountForCampaign).
- **File gợi ý:** `src/app/api/v1/campaigns/[slug]/lookup/route.ts`; dùng `userService.findByEmail`, `ticketService.countByUserAndCampaign(userId, campaignId)` (hoặc query trực tiếp).

### 5.2 Campaign page — truyền minimumTickets, hiển thị thông tin "Số vé tối thiểu"

- **File:** `src/app/campaigns/[slug]/page.tsx`
  - Truyền `<PurchaseForm ... minimumTickets={campaign.minimumTickets ?? 1} />`.
  - Truyền `<CampaignStats stats={stats} minimumTickets={campaign.minimumTickets ?? 1} />`.
- **File:** `src/components/campaign/CampaignStats.tsx`
  - Props thêm `minimumTickets?: number` (optional).
  - **Chỉ khi `minimumTickets > 1`:** thêm một stat item cùng style với Vé đã bán / Người tham gia: label "Số vé tối thiểu", value "{n} vé" (icon ShoppingBag hoặc Ticket).
  - **Không** hiển thị hint trong form; thông tin minimum chỉ ở đây và trong error message khi validate.

### 5.3 PurchaseForm — thứ tự field, email đầu tiên

- **Thứ tự field:** 1) Email *, 2) Họ và tên *, 3) Số điện thoại *, 4) Số lượng vé *.
- Move field Email lên đầu form (trước Name, Phone).

### 5.4 PurchaseForm — lookup khi nhập xong email

- **Trigger:** onBlur/debounced onChange email → gọi `GET /api/v1/campaigns/{slug}/lookup?email=...`.
- **Có user:** auto-fill name, phone; name và phone → readOnly.
- **Không có user:** name/phone editable.
- Lưu `ticketsCountForCampaign`; state `lookupResult`, loading.

### 5.5 PurchaseForm — validation minimum_tickets theo vé đã mua

- `ticketsCountForCampaign >= minimumTickets` → không validate minimum.
- Chưa mua hoặc đã mua < minimumTickets → require `ticketsCount >= minimumTickets`; error: "Số lượng vé tối thiểu phải mua là {minimumTickets} vé".
- Refine với context hoặc set error thủ công. Chưa lookup → coi ticketsCountForCampaign = 0.

### 5.6 PurchaseForm — không hiển thị hint trong form

- Bỏ hint trong form. Minimum chỉ ở CampaignStats và trong error (5.5).

---


---

## Phase 6: Danh sách kết quả quay giải (draw results)

- Đảm bảo mọi API/component hiển thị **kết quả quay** (draw results) đều dùng cùng nguồn prizes đã sort theo `display_order`:
  - Admin draw page đã dùng `getPrizesWithDrawStatus` → đã sửa orderBy ở Phase 2.1.
  - Nếu có API public “draw results” trả về danh sách giải + số trúng: dùng campaign service hoặc draw service đã order theo `display_order` → không cần sửa thêm logic, chỉ cần backend sort đúng.

---

## Thứ tự thực hiện đề xuất

1. **Phase 1:** Schema + migration (campaign_prizes.display_order, campaigns.minimum_tickets).
2. **Phase 2:** Backend prizes (orderBy, create/update với displayOrder, DTO).
3. **Phase 3:** Backend minimum_tickets (hasUserPurchasedCampaign, check trong purchase API, validation + types).
4. **Phase 4:** Admin Prizes Settings (drag & drop, layout compact, form schema displayOrder).
5. **Phase 5:** Lookup API (email → user + ticketsCountForCampaign), PurchaseForm (email đầu, auto-fill, readonly name/phone, validation minimum theo vé đã mua), CampaignStats hiển thị "Số vé tối thiểu" khi > 1; bỏ hint trong form.
6. **Phase 6:** Kiểm tra draw results (thường đã đúng nếu Phase 2 xong).

---

## Checklist nhanh

- [ ] Schema `campaign_prizes.display_order` (default 0) + migration.
- [ ] Schema `campaigns.minimum_tickets` (default 1) + migration.
- [ ] campaign.service: getById, getBySlug, list, update — order prizes by display_order.
- [ ] draw.service: getPrizesWithDrawStatus — order by display_order.
- [ ] prizeSchema + create/update campaign: displayOrder.
- [ ] CampaignPrizeDTO: displayOrder.
- [ ] ticketService (hoặc tương đương): hasUserPurchasedCampaign.
- [ ] Purchase API: check minimum_tickets cho lần mua đầu tiên.
- [ ] Campaign validation & types: minimumTickets.
- [ ] CampaignForm: prizes drag & drop, 1 row (5+2+2+3), displayOrder trong form.
- [ ] API GET campaigns/[slug]/lookup?email=... (user + ticketsCountForCampaign).
- [ ] ticketService: countByUserAndCampaign (hoặc tương đương).
- [ ] PurchaseForm: email đầu form; onBlur/debounce email → lookup; auto-fill + readonly name/phone khi có user; validation minimum theo ticketsCountForCampaign; prop minimumTickets; không hint trong form.
- [ ] CampaignStats: prop minimumTickets, khi > 1 hiển thị stat "Số vé tối thiểu".
- [ ] Campaign page: truyền minimumTickets vào PurchaseForm và CampaignStats.
