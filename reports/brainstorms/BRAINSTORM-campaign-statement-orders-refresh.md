## Requirements Discovery: Campaign Statement & Orders Refresh

### Initial Request

**Request 1:** On campaign-slug page add a "Sao kê" (Statement) section at the bottom for transparency. Similar to orders page but only show: STT, Mã đơn, Trạng thái, Email (mask: prefix@*****), Số vé, Tổng tiền, createdAt. Failed rows: background red-100; pending rows: grey-100. Sort by createdAt desc. Do not show statement by default—show only a "Xem danh sách" button; on click, fetch and display the statement.

**Request 2:** Add a refresh button on the orders screen that updates the order list to the latest.

### Clarifying Questions

1. Q: Is "Sao kê" data the same as campaign orders (same API), or a dedicated public endpoint?
   A: Inferred: same orders data, filtered by campaign (by slug); public read-only, no admin auth.

2. Q: Should the statement be visible to anyone viewing the campaign page (public)?
   A: Inferred: yes—transparency for all visitors.

3. Q: For orders refresh—refresh in place (same filters/pagination) or reset to page 1?
   A: Inferred: refresh in place (re-fetch with current filters/pagination).

### Problem Statement

- **R1:** Campaign public page lacks a transparent, on-demand "statement" view of orders (masked email, status, amounts) to build trust; data must be loaded only when user opts in.
- **R2:** Admin orders page has no explicit refresh control; users need a way to get the latest list without reloading the page.

### Stakeholders

| Role            | Needs                                      | Priority |
|----------------|---------------------------------------------|----------|
| Campaign visitor| See statement on demand, masked PII         | High     |
| Admin          | Refresh orders list on demand               | High     |

### Requirements

#### Functional

| ID  | Requirement | Priority |
|-----|-------------|----------|
| FR1 | Campaign slug page: add "Sao kê" section at bottom | Must |
| FR2 | Statement: columns STT, Mã đơn, Trạng thái, Email (prefix@*****), Số vé, Tổng tiền, createdAt | Must |
| FR3 | Statement: row background red-100 when status failed, grey-100 when pending | Must |
| FR4 | Statement: sort by createdAt desc | Must |
| FR5 | Statement: default state = single button "Xem danh sách"; on click fetch and show table | Must |
| FR6 | Orders (admin) page: add refresh button that re-fetches current list | Must |

### Success Criteria

1. On campaign/[slug], "Sao kê" section exists; clicking "Xem danh sách" loads and shows statement table with correct columns and row styling.
2. Email displayed as localPart@***** (e.g. sontd@*****).
3. Failed/pending rows have red-100/grey-100 background respectively.
4. On admin campaign orders page, a refresh control updates the order list to the latest (current filters/pagination).

### Open Questions

- None; requirements are implementable as stated.
