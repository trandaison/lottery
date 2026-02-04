## Research Report: Campaign Statement & Orders Refresh

### Executive Summary

The codebase exposes campaign orders only via the admin API (by campaign ID). For the public "Sao kê" we need a new **public** API that returns orders by **campaign slug** with masked email and fixed sort (createdAt desc). The existing `orderService.listByCampaign` can be reused; a new public route that resolves slug → campaign id and returns a restricted, masked payload is the recommended approach. For the orders page, reusing the existing `fetchOrders` callback behind a refresh button is sufficient.

### Findings

#### Finding 1: No public orders-by-campaign endpoint

- Current: `GET /api/v1/admin/campaigns/:id/orders` requires admin context and uses numeric campaign ID.
- Public campaign access uses slug: `GET /api/v1/campaigns/[slug]` returns campaign + stats (no orders).
- **Recommendation:** Add a public route, e.g. `GET /api/v1/campaigns/[slug]/statement`, that: (1) resolves campaign by slug via `campaignService.getBySlug(slug)`; (2) calls `orderService.listByCampaign(campaign.id, { sortBy: 'createdAt', sortOrder: 'desc', limit, page })`; (3) returns only the statement fields and applies email masking server-side.
- Source: Codebase `src/app/api/v1/admin/campaigns/[id]/orders/route.ts`, `src/app/api/v1/campaigns/[slug]/route.ts`, `src/services/order.service.ts`.
- Confidence: High.

#### Finding 2: Email masking format

- Requirement: show only part before `@` and `@`, suffix replaced by 5 asterisks (e.g. `sontd@*****`).
- Implementation: split email on `@`; if one part: show as `*****`; else `localPart + '@*****'`. No need to expose domain.
- Source: User requirement; common PII masking practice.
- Confidence: High.

#### Finding 3: Orders page refresh

- `CampaignOrdersPage` already has `fetchOrders` that depends on `campaignId`, `page`, `statusFilter`, `debouncedSearch`, `sortBy`, `sortOrder`. Calling `fetchOrders()` again refreshes the list with current filters/pagination.
- Adding a refresh button that triggers `fetchOrders()` (and optionally a short "refreshing" state) satisfies R2.
- Source: `src/app/admin/campaigns/[id]/orders/page.tsx`.
- Confidence: High.

### Recommendations

1. **Recommended:** Add public `GET /api/v1/campaigns/[slug]/statement` that returns orders for the campaign (by slug) with fields: STT (index), Mã đơn, Trạng thái, Email (masked), Số vé, Tổng tiền, createdAt; sort createdAt desc; optional pagination (e.g. limit 50, page 1). Reuse `orderService.listByCampaign` after resolving slug to campaign id.
2. **Recommended:** Implement statement table as a client component on the campaign slug page: initial state shows only "Xem danh sách"; on click, fetch the new statement API and display the table with row styling (failed → red-100, pending → grey-100).
3. **Recommended:** On admin orders page, add a refresh button (e.g. icon or "Refresh") that calls the existing `fetchOrders`; optionally set a brief loading state so the user sees that data is refreshing.

### Sources

1. Codebase: `src/app/api/v1/admin/campaigns/[id]/orders/route.ts` — admin orders API.
2. Codebase: `src/app/api/v1/campaigns/[slug]/route.ts` — public campaign by slug.
3. Codebase: `src/services/order.service.ts` — `listByCampaign` signature and behavior.
4. Codebase: `src/app/admin/campaigns/[id]/orders/page.tsx` — `fetchOrders` and state.
