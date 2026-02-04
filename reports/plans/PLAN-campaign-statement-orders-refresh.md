# Implementation Plan: Campaign Statement & Orders Refresh

## Overview

Add (1) a public "Sao kê" section on the campaign slug page—on-demand statement table with masked email and status-based row styling—and (2) a refresh button on the admin campaign orders page. Constraints: RESEARCH (public API by slug, reuse orderService, mask email server-side), SCOUT (new route under `[slug]/statement`, client component for statement, same Table/format conventions).

## Prerequisites

- [x] RESEARCH and SCOUT deliverables read; constraints extracted.
- [ ] No DB migrations (reuse existing orders/users).

## Phase 1: Public Statement API

### Tasks

- [x] **Task 1.1:** Create `src/app/api/v1/campaigns/[slug]/statement/route.ts`.
  - Agent: `backend-engineer`
  - Acceptance: GET handler; await params for `slug`; resolve campaign via `campaignService.getBySlug(slug)`; if not found return 404 with ApiResponse error; call `orderService.listByCampaign(campaign.id, { sortBy: 'createdAt', sortOrder: 'desc', page: 1, limit: 100 })` (or 50); map each order to statement row: `{ paymentReferenceId, paymentStatus, emailMasked, ticketsCount, totalAmount, createdAt }`; mask email: split on `@`, if no `@` use `*****`, else `localPart + '@*****'`; return `{ success: true, data: { orders: [...], pagination: { total, page, limit, totalPages } } }`; on error return 500 with ApiResponse.
- [x] **Task 1.2:** Use existing types/NextResponse patterns from `src/app/api/v1/campaigns/[slug]/route.ts` and `src/app/api/v1/admin/campaigns/[id]/orders/route.ts`.
  - Acceptance: Same ApiResponse shape; no admin auth; no extra fields in response.

### Exit Criteria

- [ ] GET `/api/v1/campaigns/:slug/statement` returns orders for that campaign with masked email and correct sort (createdAt desc).
- [ ] Invalid slug returns 404.

### Checkpoint 1

- API returns statement rows with exactly: Mã đơn (paymentReferenceId), Trạng thái (paymentStatus), Email (masked), Số vé (ticketsCount), Tổng tiền (totalAmount), createdAt.

---

## Phase 2: Campaign Statement Section (Client Component)

### Tasks

- [x] **Task 2.1:** Create client component `src/components/campaign/CampaignStatementSection.tsx`.
  - Agent: `frontend-engineer`
  - Acceptance: Props: `campaignSlug: string`. State: `orders: array | null` (null = not loaded), `loading: boolean`. Initial UI: section title "Sao kê" and single button "Xem danh sách". On button click: set loading true, fetch `GET /api/v1/campaigns/${campaignSlug}/statement`, on success set orders and loading false, on error show toast/error; do not fetch on mount.
- [x] **Task 2.2:** When `orders` is non-null, render table with columns: STT, Mã đơn, Trạng thái, Email, Số vé, Tổng tiền, createdAt. Use `@/components/ui/table` (Table, TableHeader, TableRow, TableHead, TableBody, TableCell). STT = row index + 1. Format: VND via `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`; date via `format(new Date(s), 'dd/MM/yyyy HH:mm')` (date-fns). Trạng thái: display "Pending" | "Success" | "Failed" (or Vietnamese equivalents if project uses them).
  - Acceptance: Row className: if `paymentStatus === 'failed'` then `bg-red-100`; if `paymentStatus === 'pending'` then `bg-gray-100`; else no background. Use `emailMasked` from API for Email column.
- [x] **Task 2.3:** Add `CampaignStatementSection` to campaign page at the bottom of the main content (inside the same container, after PrizeTable/PurchaseForm block).
  - Agent: `frontend-engineer`
  - Acceptance: In `src/app/campaigns/[slug]/page.tsx`, render `<CampaignStatementSection campaignSlug={campaign.slug} />` at the end of the `space-y-8` div.

### Exit Criteria

- [ ] Campaign slug page shows "Sao kê" section with "Xem danh sách" only until clicked; after click, table appears with correct columns and row styling (red-100 failed, grey-100 pending).
- [ ] Email column shows masked format (e.g. `sontd@*****`).

### Checkpoint 2

- Statement section does not load data until user clicks "Xem danh sách"; table matches PLAN columns and styling.

---

## Phase 3: Orders Page Refresh Button

### Tasks

- [x] **Task 3.1:** Add a refresh button to the admin campaign orders page that re-fetches the current list.
  - Agent: `frontend-engineer`
  - Acceptance: Button visible (e.g. in header row next to title or in filters row); on click call `fetchOrders()`; optionally show a brief "refreshing" state (e.g. disabled button + spinner or existing `loading` already covers full-table reload). Use existing `fetchOrders`; no change to filters/pagination—refresh in place.
- [x] **Task 3.2:** Use icon (e.g. RefreshCw from lucide-react) or label "Làm mới" / "Refresh" per project style.
  - Acceptance: Accessible (aria-label if icon-only).

### Exit Criteria

- [ ] Clicking refresh updates the orders table to the latest data for current page/filters.

### Checkpoint 3

- Refresh button triggers fetchOrders and list updates without full page reload.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Statement API abused (scraping) | Medium | Limit limit to 50–100; optional rate-limit later. |
| Email masking edge cases (no @) | Low | Use `*****` when no `@` in email. |

## Rollback

- Remove `src/app/api/v1/campaigns/[slug]/statement/route.ts`.
- Remove `<CampaignStatementSection />` from campaign page and delete `CampaignStatementSection.tsx`.
- Remove refresh button from orders page (revert button/layout changes in `src/app/admin/campaigns/[id]/orders/page.tsx`).
