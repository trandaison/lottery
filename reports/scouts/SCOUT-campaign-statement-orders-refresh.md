# Scout Report: Campaign Statement & Orders Refresh

## Exploration Scope

- **Target:** Campaign slug page structure, public API layout, admin orders page layout, table/UI components.
- **Boundaries:** `src/app/campaigns/[slug]/`, `src/app/api/v1/campaigns/[slug]/`, `src/app/admin/campaigns/[id]/orders/`, `src/services/order.service.ts`, `src/components/ui/table.tsx`.

## Patterns Discovered

### Pattern: Public campaign API by slug

- **Location:** `src/app/api/v1/campaigns/[slug]/route.ts`, `src/app/api/v1/campaigns/[slug]/lookup/route.ts`
- **Usage:** Route handlers receive `context.params` (Promise); await `params` to get `{ slug }`. Use `campaignService.getBySlug(slug)` to resolve campaign. Return `NextResponse.json({ success, data | error })`.
- **Must Follow:** Yes for any new public campaign route under `[slug]`.

### Pattern: Admin campaign orders API

- **Location:** `src/app/api/v1/admin/campaigns/[id]/orders/route.ts`
- **Usage:** GET with query params: page, limit, status, search, sortBy, sortOrder. Uses `orderService.listByCampaign(campaignId, filters)`. Returns `{ orders, pagination }`. Order rows include `user: { id, name, email }`.
- **Must Follow:** New statement API should reuse `orderService.listByCampaign` (by campaign id from slug); response shape can be a subset with masked email.

### Pattern: Campaign page (server component)

- **Location:** `src/app/campaigns/[slug]/page.tsx`
- **Usage:** Async page, `params` is Promise; fetches campaign and stats server-side. Renders sections: CampaignHeader, CampaignStats, CountdownTimer, CampaignDescription, PrizeTable, PurchaseForm/Placeholder. No client state. All in `container mx-auto px-4 py-8` and `space-y-8`.
- **Must Follow:** New "Sao kê" section must be a **client component** (fetch on button click); place at bottom of the same `space-y-8` block.

### Pattern: Orders table UI (admin)

- **Location:** `src/app/admin/campaigns/[id]/orders/page.tsx`, `src/components/ui/table.tsx`
- **Usage:** Table from `@/components/ui/table` (Table, TableHeader, TableRow, TableHead, TableBody, TableCell). Headers: STT, Mã đơn, Trạng thái, etc. Row styling can be done via `className` on `TableRow` (e.g. `bg-red-100`). formatVnd via `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`. Dates via `format(new Date(s), 'dd/MM/yyyy HH:mm')` (date-fns).
- **Must Follow:** Use same Table components and formatting conventions for statement table; row background by status (failed → red-100, pending → grey-100).

### Pattern: Fetch and loading state (client)

- **Location:** `src/app/admin/campaigns/[id]/orders/page.tsx`
- **Usage:** `useState` for list + `loading`; `useCallback` for `fetchOrders` that sets loading true, fetches, then sets data and loading false. `useEffect` to run fetch when deps change.
- **Must Follow:** Statement section: initial state = no data + not loaded; button click triggers single fetch then show table (same loading/data pattern).

## Integration Points

| Point | File | Function | New Code Location |
|-------|------|----------|-------------------|
| Public statement API | `src/app/api/v1/campaigns/[slug]/` | GET list orders by slug | New: `src/app/api/v1/campaigns/[slug]/statement/route.ts` |
| Statement section on campaign page | `src/app/campaigns/[slug]/page.tsx` | Default export (page) | Add `<CampaignStatementSection campaignSlug={campaign.slug} />` at bottom of content; new client component e.g. `src/components/campaign/CampaignStatementSection.tsx` |
| Orders refresh | `src/app/admin/campaigns/[id]/orders/page.tsx` | Header/filters row, fetchOrders | Add Refresh button (e.g. next to title) that calls `fetchOrders()`; optional brief loading state for refresh-only |

## Conventions

- **Naming:** API routes: `route.ts` in segment folder. Components: PascalCase. Campaign slug prop: `campaignSlug`.
- **File organization:** API under `src/app/api/v1/`; shared UI under `src/components/ui/`; feature components under `src/components/campaign/` or `src/components/admin/`.
- **Response shape:** `ApiResponse<T>` with `success`, `data` or `error: { code, message }`. Pagination: `{ total, page, limit, totalPages }`.

## Warnings

- ⚠️ Statement API is **public** (no admin auth). Do not return sensitive fields (e.g. full email, errorMessage, sepayTransactionId) beyond the agreed columns; mask email server-side.
- ⚠️ Campaign page is server component; the statement block must be a client component that receives `campaignSlug` and fetches on demand to avoid exposing order data in initial HTML.
