# Implementation Plan: Forgot Password

## Overview

Implement forgot-password flow: create a secure token stored in Redis (key = token, value = user_id, TTL 1 hour), send reset link by email, verify token on reset page, show reset form when valid, then update password and redirect to login. Rate limit: one forgot-password request per email per minute using Redis.

**Constraints from prior phases:**

- **Research**: Token one-time-use (delete after reset); same success message for forgot submit to avoid enumeration; rate limit key with normalized email; TTL 3600 for token, 60 for rate limit.
- **Scout**: Follow existing patterns—Redis prefix `forgot_password:` and `forgot_password_rate:`, AuthService or dedicated methods, EmailService new method, UserService.update for password, admin login UI pattern (Card, form, Zod, same layout).

## Design Approach (UI)

- **Forgot-password page**: Same layout as admin login (centered `min-h-screen`, `gray-50`, single Card `max-w-md`). Form: email only, submit button, link back to login. Use existing components: Card, Input, Label, Button, error state. No auth required (public).
- **Reset-password page**: Same layout. Read `token` from query. If token invalid/expired (verify via API or server-side): show “Invalid or expired link” and link to login or forgot-password. If valid: show form (new password + confirm), submit to reset API, on success redirect to `/admin/login` (optionally with `?reset=success`). Use PasswordInput, same Card/form pattern. Accessibility: labels, focus, error messages.

## Prerequisites

- [ ] Redis and env validated (existing).
- [ ] Email service working (SendGrid or MailHog) for sending reset email.
- [ ] Optional: `APP_URL` or `NEXT_PUBLIC_APP_URL` in env for reset link base; if missing, use request origin when sending email.

## Phase 1: Auth Service — Forgot-Password Token and Rate Limit

### Tasks

- [x] **Task 1.1** Add Redis key constants and TTL for forgot-password in `src/services/auth.service.ts`: e.g. `FORGOT_PASSWORD_PREFIX = 'forgot_password:'`, `FORGOT_PASSWORD_RATE_PREFIX = 'forgot_password_rate:'`, `FORGOT_PASSWORD_TTL = 3600`, `FORGOT_PASSWORD_RATE_TTL = 60`.
- [x] **Task 1.2** Implement `checkForgotPasswordRateLimit(email: string): Promise<boolean>`. Normalize email (lowercase, trim). Key = `forgot_password_rate:{email}`. If key exists (redis.get), return false (rate limited). Otherwise set key with value (e.g. timestamp or "1") and TTL 60, return true. Agent: backend-engineer. Acceptance: Returns false when same email requested within 60s; returns true and sets key when first request or after 60s.
- [x] **Task 1.3** Implement `createForgotPasswordToken(email: string): Promise<string | null>`. Find user by email (reuse `findUserByEmail`). If no user or user inactive, return null. Check rate limit via `checkForgotPasswordRateLimit(email)`; if limited, return null. Generate token (reuse `generateTokenBase()` or crypto random). Key = `forgot_password:{token}`, value = `userId` (string), TTL 3600. Return token. Agent: backend-engineer. Acceptance: Token stored in Redis with correct key/value/TTL; returns null when user not found, inactive, or rate limited.
- [x] **Task 1.4** Implement `getForgotPasswordUserId(token: string): Promise<number | null>`. Key = `forgot_password:{token}`. redis.get; parse value as number (userId). Return userId or null. Agent: backend-engineer. Acceptance: Returns userId when key exists and value is valid; null otherwise.
- [x] **Task 1.5** Implement `deleteForgotPasswordToken(token: string): Promise<void>`. redis.del(key). Agent: backend-engineer. Acceptance: Key removed from Redis.

### Exit Criteria

- [ ] All five methods implemented and consistent with existing AuthService style.
- [ ] Rate limit allows 1 request per email per 60 seconds; token TTL 1 hour.
- [ ] Unit tests (optional): rate limit and token get/set/delete with Redis mock.

---

## Phase 2: Email Service — Password Reset Email

### Tasks

- [x] **Task 2.1** Add `sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean>` in `src/services/email.service.ts`. Use same from name/email as other emails. Subject and body: clear “Reset your password” message and link (resetUrl). No attachments. Reuse `sendWithNodemailer` / SendGrid path and retry logic. Agent: backend-engineer. Acceptance: Email sent with correct link; returns true/false; logs errors.
- [x] **Task 2.2** (Optional) Add `APP_URL` or `NEXT_PUBLIC_APP_URL` to `src/config/env.ts` (optional string). When building reset URL in API, use `APP_URL ?? request.nextUrl.origin` so link works in production. Agent: backend-engineer. Acceptance: Reset link in email points to correct base URL.

### Exit Criteria

- [ ] Reset email is sent with correct reset URL.
- [ ] Reset URL base is configurable or derived from request.

---

## Phase 3: API Routes — Forgot-Password and Reset-Password

### Tasks

- [x] **Task 3.1** Create `POST /api/v1/admin/auth/forgot-password`. Body: `{ email: string }`. Validate with Zod. Call `authService.createForgotPasswordToken(email)`. If null, still return 200 with generic success message (e.g. “If an account exists with this email, you will receive a reset link.”) to avoid user enumeration. If token returned: build reset URL = `{baseUrl}/admin/reset-password?token={token}`, call `emailService.sendPasswordResetEmail(email, resetUrl)`, then return same 200 success message. Do not reveal whether email existed or rate limit hit. Agent: backend-engineer. Acceptance: Same JSON success message in all cases; email sent only when user exists and not rate limited; 429 optional for rate limit (or still 200 with same message).
- [x] **Task 3.2** Create `GET /api/v1/admin/auth/reset-password/verify?token=...` (or equivalent). Query: `token`. Call `authService.getForgotPasswordUserId(token)`. Return 200 with `{ valid: true, userId }` or 400/404 with `{ valid: false }`. Used by reset page to show form or “invalid/expired” message. Agent: backend-engineer. Acceptance: Valid token returns valid: true; invalid/expired returns valid: false.
- [x] **Task 3.3** Create `POST /api/v1/admin/auth/reset-password`. Body: `{ token: string, password: string }`. Validate password (length, complexity if required). Call `getForgotPasswordUserId(token)`; if null, return 400 “Invalid or expired token”. Call `userService.update(userId, { password })`, then `authService.deleteForgotPasswordToken(token)`. Return 200 with message “Password reset successfully.” Agent: backend-engineer. Acceptance: Password updated; token deleted; invalid token returns 400.

### Exit Criteria

- [ ] Forgot-password and reset-password APIs behave as above; response shape matches existing auth routes.
- [ ] Token is one-time-use (deleted after successful reset).

---

## Phase 4: Admin Pages — Forgot-Password and Reset-Password UI

### Tasks

- [x] **Task 4.1** Create `src/app/admin/forgot-password/page.tsx`. Public page (no auth). Layout: same as login (centered, Card, gray-50). Form: email field, submit “Send reset link”. On submit: POST to `/api/v1/admin/auth/forgot-password`. On success: show generic success message (e.g. “If an account exists, we sent a link to your email.”). Link: “Back to login” to `/admin/login`. Agent: frontend-engineer. Acceptance: Same look-and-feel as login; success message does not reveal if email exists.
- [x] **Task 4.2** Create `src/app/admin/reset-password/page.tsx`. Read `token` from searchParams. On mount (or via small API call): verify token with GET `/api/v1/admin/auth/reset-password/verify?token=...`. If invalid: show “Invalid or expired link” and link to login or forgot-password. If valid: show form with new password + confirm password, submit to POST `/api/v1/admin/auth/reset-password`. On success: redirect to `/admin/login` (optionally with `?reset=success`). Use same Card/form/validation pattern as login. Agent: frontend-engineer. Acceptance: Form only shown when token valid; after submit, redirect to login.
- [x] **Task 4.3** Add “Forgot password?” link on admin login page (`src/app/admin/login/page.tsx`) pointing to `/admin/forgot-password`. Agent: frontend-engineer. Acceptance: Link visible and navigates to forgot-password page.

### Exit Criteria

- [ ] Forgot-password and reset-password pages render and submit correctly.
- [ ] After successful reset, user is redirected to login page.
- [ ] Invalid/expired token shows clear message and does not show reset form.

---

## Phase 5: Validation and Documentation

### Tasks

- [x] **Task 5.1** Add Zod schemas for forgot-password and reset-password request bodies (e.g. in `src/lib/validations/auth.ts` or adjacent). Export and use in route handlers. Agent: backend-engineer. Acceptance: Shared schemas; password rules consistent with existing (e.g. min length).
- [x] **Task 5.2** Update `docs/06-api-endpoints.md` (or equivalent) with `POST /api/v1/admin/auth/forgot-password` and `GET/POST .../reset-password` (and verify endpoint). Agent: docs-manager or backend-engineer. Acceptance: Documented request/response and behavior (rate limit, same message for enumeration safety).

### Exit Criteria

- [ ] Validation centralized and docs updated.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Email delivery failure | Medium | Log errors; user can request again after 1 minute. Optional: retry in EmailService (already has retry). |
| Redis down | High | Forgot/reset will fail; show generic error. Existing app already depends on Redis for sessions. |
| Token leaked in URL | Medium | Token in query string is standard; use HTTPS in production; short TTL and one-time-use limit exposure. |
| Rate limit bypass (different email casing) | Low | Normalize email (lowercase, trim) before Redis key (Scout warning). |

## Rollback

- Remove new routes and pages; remove new methods from AuthService and EmailService; remove link from login page. Redis keys will expire (1 hour for tokens, 1 minute for rate limit); no schema migration.

---

## Summary

| Phase | Focus | Deliverables |
|-------|--------|---------------|
| 1 | AuthService: token + rate limit in Redis | createForgotPasswordToken, getForgotPasswordUserId, deleteForgotPasswordToken, checkForgotPasswordRateLimit |
| 2 | EmailService: reset email | sendPasswordResetEmail; optional APP_URL |
| 3 | API: forgot + verify + reset | POST forgot-password, GET reset-password/verify, POST reset-password |
| 4 | UI: forgot + reset pages + login link | forgot-password page, reset-password page, “Forgot password?” on login |
| 5 | Validation + docs | Zod schemas, API docs update |

**Implement**: Run phases in order. After completion, test: request forgot-password (check email), open reset link, submit new password, confirm redirect to login and login with new password; then verify rate limit (same email within 1 minute) and invalid/expired token handling.
