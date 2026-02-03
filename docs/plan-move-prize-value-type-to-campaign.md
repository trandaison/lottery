# Kế hoạch: Chuyển `prize_value_type` sang bảng Campaign

## 1. Mục tiêu

Hiện tại `prize_value_type` ('fixed' | 'percent') nằm ở **campaign_prizes** (mỗi giải có thể chọn type riêng). Chuyển sang **campaigns**: cả campaign dùng chung một kiểu — hoặc toàn bộ giải là giá trị cố định (fixed), hoặc toàn bộ giải theo % doanh thu (percent).

**Lợi ích:** Cấu hình rõ ràng theo campaign; không lặp type trên từng dòng prize; dễ validate và hiển thị.

---

## 2. Thay đổi schema

### 2.1. Bảng `campaigns`

| Cột mới | Kiểu | Ràng buộc | Mô tả |
|--------|------|-----------|--------|
| `prize_value_type` | `varchar(20)` | NOT NULL, default `'fixed'` | `'fixed'` \| `'percent'` — áp dụng cho mọi giải trong campaign. |

### 2.2. Bảng `campaign_prizes`

| Thay đổi | Mô tả |
|----------|--------|
| **Xóa** cột `prize_value_type` | Type lấy từ campaign. |
| Giữ nguyên | `prize_value` (string), `prize_value_percent` (nullable). |

**Quy tắc nghiệp vụ (không đổi):**

- Campaign `prize_value_type = 'fixed'`: mỗi prize dùng `prize_value` (string) để hiển thị.
- Campaign `prize_value_type = 'percent'`: mỗi prize dùng `prize_value_percent` + `totalRevenue`, `prizesCount` để tính và hiển thị (floor 10.000).

---

## 3. Migration

1. **Thêm** vào `campaigns`: `prize_value_type` varchar(20) NOT NULL DEFAULT 'fixed'.
2. **Backfill** (nếu cần): có thể lấy giá trị từ một prize bất kỳ của campaign (hiện đang có type trên từng prize), ví dụ `UPDATE campaigns c SET prize_value_type = (SELECT prize_value_type FROM campaign_prizes WHERE campaign_id = c.id LIMIT 1) WHERE NOT EXISTS (...)`. Hoặc để default 'fixed' cho toàn bộ.
3. **Xóa** khỏi `campaign_prizes`: cột `prize_value_type`.

---

## 4. Phạm vi ảnh hưởng (code)

| Khu vực | File / thành phần | Thay đổi |
|--------|--------------------|----------|
| DB schema | `src/db/schema/campaigns.ts` | Thêm `prizeValueType`. |
| DB schema | `src/db/schema/campaign-prizes.ts` | Xóa `prizeValueType`. |
| Migration | `src/db/migrations/` | Migration mới: add (campaigns), drop (campaign_prizes). |
| Validation | `src/lib/validations/campaign.ts` | Campaign body: thêm `prizeValueType`; prizeSchema: bỏ `prizeValueType`, refine theo **campaign** type (fixed → prizeValue bắt buộc; percent → prizeValuePercent bắt buộc). |
| Types | `src/types/index.ts` | CampaignWithPrizes (và CampaignDTO nếu dùng): thêm `prizeValueType`; CampaignPrizeDTO / PrizeWithDrawStatus: bỏ `prizeValueType` (hoặc giữ optional từ campaign khi cần). |
| Form | `src/components/admin/CampaignForm.tsx` | Select "Giá trị" chuyển lên **cấp campaign** (một lần cho cả form); phần prize chỉ còn: khi campaign type = fixed → input value (string); khi campaign type = percent → input % (0–100). Bỏ `prizeValueType` khỏi từng prize. |
| Service | `src/services/campaign.service.ts` | Create/update campaign: đọc/ghi `prizeValueType` trên campaign; insert/update prizes: không còn `prizeValueType`. Trả về campaign có `prizeValueType`. |
| API | `src/app/api/v1/admin/campaigns/*` | Request/response campaign có `prizeValueType`; response prizes không có `prizeValueType` (hoặc chỉ để backward compat từ campaign). |
| Helper | `src/lib/utils/prize-value.ts` | `formatPrizeValueDisplay(prize, totalRevenue?, campaignPrizeValueType?)`: tham số type lấy từ **campaign** (hoặc từ prize nếu vẫn truyền từ campaign xuống). |
| PrizeTable | `src/components/campaign/PrizeTable.tsx` | Nhận thêm `prizeValueType` (từ campaign); gọi helper với type từ campaign. |
| ResultsTable | `src/components/admin/ResultsTable.tsx` | Nhận `prizeValueType` (từ campaign hoặc từ API kèm campaign); gọi helper với type từ campaign. |
| Draw page / API prizes | `src/app/admin/campaigns/[id]/draw/page.tsx`, API prizes | Trả về hoặc lấy `campaign.prizeValueType` để truyền vào ResultsTable. |
| Seed | `scripts/seed.ts`, CSV | Campaign: thêm `prize_value_type`; prize: bỏ `prize_value_type`. |

---

## 5. Các bước thực hiện

### Bước 1: Migration + schema

- Tạo migration: `ALTER TABLE campaigns ADD COLUMN prize_value_type varchar(20) NOT NULL DEFAULT 'fixed';`
  `ALTER TABLE campaign_prizes DROP COLUMN IF EXISTS prize_value_type;`
- Schema: `campaigns` thêm `prizeValueType`; `campaign-prizes` xóa `prizeValueType`.

### Bước 2: Validation + types

- **Campaign** (create/update): thêm field `prizeValueType: z.enum(['fixed', 'percent'])`, default `'fixed'`.
- **Prize** schema: xóa `prizeValueType`; refine theo **campaign** (trong context của create/update campaign): nếu campaign.prizeValueType = 'fixed' thì mỗi prize phải có prizeValue không rỗng; nếu 'percent' thì mỗi prize phải có prizeValuePercent (0–100).
- Types: CampaignWithPrizes (và nơi trả campaign) thêm `prizeValueType`; CampaignPrizeDTO / PrizeWithDrawStatus bỏ `prizeValueType`.

### Bước 3: Form (CampaignForm)

- Một select **ở cấp campaign** (ví dụ trong Section Campaign Info hoặc Section Prizes): "Giá trị giải: Cố định (số hoặc text) | Theo % doanh thu".
- Per-prize: không còn select type; chỉ hiện input value (khi campaign type = fixed) hoặc input % (khi campaign type = percent).
- Default campaign: `prizeValueType: 'fixed'`.
- Submit: gửi `prizeValueType` trong campaign payload; prizes không gửi `prizeValueType`.

### Bước 4: Service + API

- Create campaign: lưu `prizeValueType` vào bảng campaigns; prizes insert không có `prize_value_type`.
- Update campaign: cập nhật `prizeValueType` trên campaigns khi có trong payload; update prizes như hiện tại (không có type).
- GET campaign (by id, by slug, list): trả về campaign có `prizeValueType`.
- API prizes: response campaign đã có `prizeValueType`; prizes không có `prizeValueType`. Draw page lấy `campaign.prizeValueType` (hoặc từ API) truyền vào ResultsTable.

### Bước 5: Helper + UI hiển thị

- `formatPrizeValueDisplay(prize, totalRevenue?, campaignPrizeValueType?)`: tham số thứ 3 là type của **campaign** ('fixed' | 'percent'). Logic: nếu campaign type = 'percent' thì dùng prize.prizeValuePercent + totalRevenue; nếu 'fixed' thì dùng prize.prizeValue.
- PrizeTable: nhận prop `prizeValueType` (từ campaign); gọi helper với campaign type.
- Trang campaign [slug]: truyền `stats.totalRevenue` và `campaign.prizeValueType` vào PrizeTable.
- ResultsTable: nhận `prizeValueType` (từ campaign); gọi helper với campaign type.
- Draw page: API prizes trả về campaign (có prizeValueType); truyền `totalRevenue` và `prizeValueType` vào ResultsTable.

### Bước 6: Seed / script

- Campaign seed: thêm `prize_value_type` (default 'fixed').
- Prize seed: bỏ `prize_value_type`.
- Các script tạo campaign (create-test-campaigns, test-campaign-service): campaign có `prizeValueType: 'fixed'`; prizes không có `prizeValueType`.

---

## 6. Checklist

- [ ] Migration: add `prize_value_type` to campaigns, drop from campaign_prizes
- [ ] Schema: campaigns + prizeValueType, campaign_prizes - prizeValueType
- [ ] Validation: campaign prizeValueType; prize refine theo campaign type
- [ ] Types: CampaignWithPrizes.prizeValueType; bỏ trên DTO prize (hoặc optional từ campaign)
- [ ] CampaignForm: select type ở campaign, per-prize chỉ value hoặc %
- [ ] Service + API: đọc/ghi prizeValueType trên campaign; prizes không type
- [ ] Helper: nhận campaignPrizeValueType; PrizeTable + ResultsTable nhận và truyền type
- [ ] Seed / scripts: campaign có type, prize không có type

Sau khi review, có thể triển khai lần lượt từ Bước 1.
