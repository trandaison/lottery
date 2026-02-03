# Kế hoạch: Giá trị giải thưởng dạng text và % doanh thu

## 1. Tổng quan yêu cầu

1. **Ô giá trị giải thưởng cho phép chữ + số**
   Giải thưởng có thể không phải tiền (ví dụ: "1 iPhone", "Voucher 500k"). Giá trị chỉ dùng để hiển thị, nên nhập số tiền hoặc text đều được — lưu chung trong một trường kiểu string.

2. **Giá trị giải thưởng theo % doanh thu**
   Trong màn create/edit campaign, cho phép set giá trị giải theo % tổng doanh thu (ví dụ: giải 4 = 10% doanh thu).
   - Công thức: `giá_trị_tổng_giải = totalRevenue * (percent / 100)`; `giá_trị_mỗi_giải = giá_trị_tổng_giải / prizesCount`.
   - Làm tròn hiển thị: **floor** đến **10.000** gần nhất (ví dụ: 2.500.000 → giữ; 2.549.000 → 2.540.000).

---

## 2. Phạm vi ảnh hưởng (scout)

| Khu vực | File / thành phần | Ghi chú |
|--------|--------------------|--------|
| DB schema | `src/db/schema/campaign-prizes.ts` | Đổi `prize_value` sang string; thêm type, percent |
| Migration | `src/db/migrations/` | Migration: alter prize_value → varchar, thêm 2 cột |
| Validation | `src/lib/validations/campaign.ts` | prizeSchema: prizeValue (string), type, percent |
| Form admin | `src/components/admin/CampaignForm.tsx` | Input giá trị: text (string) + toggle % doanh thu |
| Types | `src/types/index.ts` | CampaignPrizeDTO, PrizeWithDrawStatus: prizeValue string, type, percent |
| Hiển thị công khai | `src/components/campaign/PrizeTable.tsx` | Hiển thị giá trị: string as-is hoặc VND từ % |
| Hiển thị admin | `src/components/admin/ResultsTable.tsx` | Cột giá trị giải: cùng logic hiển thị |
| API/Service | `src/services/campaign.service.ts`, API prizes | Đọc/ghi prize_value (string), type, percent |
| Seed | `scripts/seed.ts`, CSV seeds | Cập nhật mẫu: prize_value string, prize_value_type |

---

## 3. Thiết kế dữ liệu

### 3.1. Kiểu giá trị giải thưởng

- **`fixed`**: Giá trị cố định — lưu trong `prize_value` (string): có thể là số tiền (ví dụ "1000000") hoặc text (ví dụ "1 iPhone"). Chỉ dùng để hiển thị.
- **`percent`**: Giá trị = % doanh thu; lưu % trong `prize_value_percent`; tính tại thời điểm hiển thị từ `totalRevenue` của campaign.

### 3.2. Schema đề xuất (`campaign_prizes`)

| Cột | Kiểu | Ràng buộc | Mô tả |
|-----|------|-----------|--------|
| `prize_value_type` | `varchar(20)` | NOT NULL, default `'fixed'` | `'fixed'` \| `'percent'` |
| `prize_value` | `varchar(255)` | NOT NULL (có thể '' khi type = percent) | Khi type = fixed: nội dung hiển thị (số tiền hoặc text). Khi type = percent: thường bỏ qua hoặc để trống. |
| `prize_value_percent` | `integer` | NULLable, 0–100 | Khi type = percent: % doanh thu (ví dụ 10 = 10%). |

**Quy tắc nghiệp vụ:**

- Nếu `prize_value_type = 'fixed'`: hiển thị nguyên `prize_value` (có thể format VND nếu chuỗi parse được thành số).
- Nếu `prize_value_type = 'percent'`: dùng `prize_value_percent` và `totalRevenue`, `prizesCount`:
  - `totalPrizeValue = totalRevenue * prize_value_percent / 100`
  - `perPrize = floor(totalPrizeValue / prizesCount / 10000) * 10000`
  - Hiển thị ví dụ: "2.500.000 VNĐ/giải (10% doanh thu)" hoặc tương đương.

### 3.3. Migration & backward compatibility

- Đổi cột `prize_value` từ `integer` sang `varchar(255)` (hoặc `text`): trong migration cast giá trị cũ sang string (ví dụ `CAST(prize_value AS varchar)`).
- Thêm 2 cột: `prize_value_type` (default `'fixed'`), `prize_value_percent` (nullable).
- Dữ liệu cũ: sau khi cast, `prize_value` thành string; set `prize_value_type = 'fixed'`, `prize_value_percent = null`. Hiển thị như hiện tại.

---

## 4. Kế hoạch thực hiện từng bước

### Bước 1: Database & schema

- Tạo migration:
  - Đổi `prize_value` từ integer sang varchar(255), backfill từ cột cũ (cast to string).
  - Thêm `prize_value_type` (default `'fixed'`).
  - Thêm `prize_value_percent` (nullable, check 0–100).
- Cập nhật `src/db/schema/campaign-prizes.ts`: `prizeValue` kiểu string (varchar), thêm `prizeValueType`, `prizeValuePercent`, cập nhật type/export.

### Bước 2: Validation & types

- **`src/lib/validations/campaign.ts`**
  - Mở rộng `prizeSchema`:
    - `prizeValueType`: enum `'fixed' | 'percent'`.
    - `prizeValue`: string (dùng khi type = fixed; có thể rỗng khi type = percent).
    - `prizeValuePercent`: optional number 0–100 (bắt buộc khi type = 'percent').
  - Refine: nếu type = 'fixed' thì prizeValue không rỗng; nếu type = 'percent' thì bắt buộc prizeValuePercent.
- **`src/types/index.ts`**
  - `CampaignPrizeDTO`, `PrizeWithDrawStatus` và mọi type có prize: `prizeValue` thành string; thêm `prizeValueType?`, `prizeValuePercent?`.

### Bước 3: Form create/edit campaign (CampaignForm)

- **Ô nhập giá trị giải thưởng**
  - Một input **text** (string): khi type = fixed, nhập số tiền hoặc text đều được, lưu vào `prizeValue`.
  - Thêm **chế độ “Theo % doanh thu”**:
    - Radio/Select: "Giá trị cố định" | "Theo % doanh thu".
    - Khi chọn "Theo % doanh thu": hiện ô nhập % (số 0–100), lưu `prizeValueType = 'percent'`, `prizeValuePercent = value`; prizeValue có thể để trống hoặc không dùng.
- Default khi thêm giải mới: type = 'fixed', prizeValue = '' hoặc "1000000".
- Submit: map prize_value_type, prize_value (string), prize_value_percent vào API/DB.

### Bước 4: API & service

- **Campaign service** (create/update campaign, getById/getBySlug với prizes):
  - Khi ghi: lưu/update 3 field (type, value string, value_percent).
  - Khi đọc: trả về đủ field cho client.
- **API GET campaign (public + admin)**
  - Trả về prizes kèm `prizeValueType`, `prizeValue` (string), `prizeValuePercent`.
- **GET stats (totalRevenue)**
  - Đã có; không đổi. Các nơi hiển thị prize sẽ dùng stats khi cần.

### Bước 5: Hiển thị giá trị giải (logic dùng chung)

- Tạo helper (ví dụ `src/lib/utils/prize-value.ts`):
  - **Input**: prize (type, prizeValue string, prizeValuePercent, prizesCount), totalRevenue (optional).
  - **Output**: string hiển thị.
  - Logic:
    - `percent`: tính totalPrize, perPrize (floor 10k), return format VND + "(X% doanh thu)".
    - `fixed`: return prize_value as-is; nếu chuỗi parse được thành số thì có thể format VND cho thống nhất.

### Bước 6: Cập nhật UI hiển thị

- **PrizeTable** (trang campaign public):
  - Nhận thêm prop `totalRevenue`.
  - Cột “Giá trị”: gọi helper với từng prize + totalRevenue.
- **ResultsTable** (admin):
  - Lấy totalRevenue của campaign; cột giá trị giải dùng cùng helper.
- **Các chỗ khác** dùng `prize.prizeValue`: thay bằng helper (type = percent thì tính từ revenue; type = fixed thì hiển thị prizeValue string).

### Bước 7: Seed & test

- Cập nhật `scripts/seed.ts` và CSV (nếu có): prize_value dạng string (số hoặc text), prize_value_type, prize_value_percent cho vài giải percent.
- Kiểm tra: create/edit campaign (fixed: số, fixed: text, percent); xem trang public và admin; floor 10.000 với % doanh thu.

---

## 5. Tóm tắt rủi ro & lưu ý

- **Backward compatibility**: Migration cast `prize_value` integer → string, set `prize_value_type = 'fixed'`; hiển thị giữ như cũ.
- **Performance**: Tính % theo revenue chỉ khi hiển thị, không lưu kết quả vào DB.
- **Làm tròn**: Chỉ floor đến 10.000 khi **hiển thị** giá trị tính từ %.
- **i18n**: Label "Giá trị", "Theo % doanh thu", "VNĐ/giải" giữ nhất quán (có thể đưa vào file ngôn ngữ sau).

---

## 6. Checklist triển khai

- [ ] Migration: prize_value → varchar, thêm prize_value_type, prize_value_percent
- [ ] Schema campaign_prizes (prizeValue string, prizeValueType, prizeValuePercent)
- [ ] Validation campaign (prize schema + refine)
- [ ] Types (DTO, PrizeWithDrawStatus): prizeValue string, type, percent
- [ ] CampaignForm: input text (string) + chế độ % doanh thu
- [ ] Campaign service + API: đọc/ghi 3 field (type, value string, percent)
- [ ] Helper tính/hiển thị giá trị (fixed: string as-is; percent: floor 10k)
- [ ] PrizeTable: nhận totalRevenue, hiển thị theo helper
- [ ] ResultsTable: lấy totalRevenue, hiển thị theo helper
- [ ] Seed/CSV cập nhật (tùy chọn)
- [ ] Test create/edit/xem campaign (fixed + percent)

Bạn review plan này; sau khi đồng ý có thể bắt đầu từ Bước 1 (DB & schema).
