# Scout Report: Forgot Password

## Exploration Scope

- **Target**: Auth flow, Redis usage, email sending, admin login UI, and where to add forgot-password and reset-password.
- **Boundaries**: `src/services/auth.service.ts`, `src/lib/redis.ts`, `src/services/email.service.ts`, `src/app/api/v1/admin/auth/`, `src/app/admin/login/`, `src/services/user.service.ts`, `src/db/schema/users.ts`, `src/config/env.ts`.

## Patterns Discovered

### Pattern: Redis session key

- **Location**: `src/services/auth.service.ts`
- **Usage**: `SESSION_PREFIX = 'session:'`; key = `${SESSION_PREFIX}${tokenBase}`; value = JSON string of `SessionData` (userId, rememberMe, timestamp). TTL set via `redis.set(key, value, { ex: ttl })`.
- **Must Follow**: Yes. Forgot-password should use a different prefix (e.g. `forgot_password:`) and optionally a rate-limit prefix (e.g. `forgot_password_rate:`).

### Pattern: Auth API routes

- **Location**: `src/app/api/v1/admin/auth/login/route.ts`, `logout/route.ts`, `me/route.ts`
- **Usage**: POST login accepts body, calls `authService.login()`, sets HttpOnly cookie, returns JSON. Routes use validated env and shared `authService`.
- **Must Follow**: Yes. Add `POST .../auth/forgot-password` and `POST .../auth/reset-password` (or `GET .../auth/reset-password` for page + POST for submit). Use same error/response shape and validation (e.g. Zod).

### Pattern: Email sending

- **Location**: `src/services/email.service.ts`
- **Usage**: `EmailService` uses SendGrid (production) or Nodemailer/MailHog (dev). Method `sendTicketEmail(order, user, campaign, tickets)`. For other emails, add a method (e.g. `sendPasswordResetEmail(to, resetUrl)`) and reuse existing transporter/SendGrid setup.
- **Must Follow**: Yes. Add a dedicated method for password-reset email; do not reuse ticket template.

### Pattern: Admin login page UI

- **Location**: `src/app/admin/login/page.tsx`
- **Usage**: Client component with `useForm` (react-hook-form), Zod schema, Card/CardHeader/CardTitle/CardDescription/CardContent, Input, PasswordInput, Label, Button, error state. Layout: centered `min-h-screen`, `gray-50` background, single Card `max-w-md`. Redirect on success via `router.replace(redirect)`.
- **Must Follow**: Yes. Forgot-password and reset-password pages should use the same layout and components (Card, form, validation, error display) for consistency.

### Pattern: Password update

- **Location**: `src/services/user.service.ts` (method `update`)
- **Usage**: `UserService.update(id, { password?: string })` hashes password via `authService.hashPassword` when provided and updates `users.passwordDigest`. No dedicated `updatePassword`; use `update(id, { password })`.
- **Must Follow**: Yes. Reset-password flow can call `userService.update(userId, { password: newPassword })` after verifying token.

### Pattern: Auth service helpers

- **Location**: `src/services/auth.service.ts`
- **Usage**: `findUserByEmail`, `findUserById`, `hashPassword`, `generateTokenBase` (UUID v4). Session methods: `createSession`, `getSession`, `deleteSession`.
- **Must Follow**: Yes. Add forgot-password token create/get/delete and rate-limit check in AuthService or a small dedicated service; reuse `findUserByEmail`, `hashPassword`, and Redis client.

### Pattern: Environment config

- **Location**: `src/config/env.ts`
- **Usage**: Zod schema for DATABASE_URL, REDIS_URL, JWT_SECRET, email vars (SENDGRID_*, SMTP_*), etc. No app base URL yet.
- **Must Follow**: Yes. Add optional `APP_URL` or `NEXT_PUBLIC_APP_URL` for reset link base (e.g. `https://admin.example.com`). If missing, can derive from request (e.g. `request.nextUrl.origin` when sending email).

## Integration Points

| Point | File | Function / usage | New code location |
|-------|------|------------------|--------------------|
| Forgot token create + rate limit | `auth.service.ts` | New methods: e.g. `createForgotPasswordToken(email)`, `getForgotPasswordUserId(token)`, `deleteForgotPasswordToken(token)`, `checkForgotPasswordRateLimit(email)` | AuthService or new `ForgotPasswordService` using `redis` from `@/lib/redis` |
| Forgot API | New route | POST body: `{ email }` | `src/app/api/v1/admin/auth/forgot-password/route.ts` |
| Reset verify + submit | New route(s) | GET with token for page; POST body: `{ token, password }` for submit | `src/app/api/v1/admin/auth/reset-password/route.ts` or separate GET page + POST API |
| Send reset email | `email.service.ts` | New method: `sendPasswordResetEmail(to: string, resetUrl: string)` | `src/services/email.service.ts` |
| Update password | `user.service.ts` | Existing `UserService.update(id, { password })` | Called from reset-password handler after token verification |
| Forgot form page | New page | Form with email only, submit to forgot-password API | `src/app/admin/forgot-password/page.tsx` |
| Reset form page | New page | Read token from URL (e.g. query); show form if token valid (verify via API or server-side), submit new password | `src/app/admin/reset-password/page.tsx` (e.g. `?token=...`) |
| Redirect after reset | Reset handler | After success | `router.replace('/admin/login')` or redirect to login with success message |

## Conventions

- **Naming**: API routes under `api/v1/admin/auth/`; pages under `app/admin/` (e.g. `forgot-password`, `reset-password`). Redis keys: prefix `forgot_password:` for token, `forgot_password_rate:` for rate limit.
- **File organization**: One route per folder (e.g. `forgot-password/route.ts`). Services stay in `src/services/`; reuse `auth.service.ts` or add a small module for forgot-password logic.
- **Validation**: Use Zod schemas and parse in API routes; share schema from `src/lib/validations/` if needed.
- **Response shape**: `{ success: boolean, data?: ..., error?: { code, message } }` consistent with existing auth routes.

## Warnings

- **No APP_URL in env**: Reset link base URL must be configurable (e.g. `APP_URL` or from request origin when sending email). Document in plan.
- **Admin-only**: Current auth is admin login; forgot/reset are for the same admin users. If later there is a separate “user” auth, scope forgot/reset to the correct context.
- **Rate limit key**: Use normalized email (e.g. lowercased, trimmed) for Redis key to avoid bypass by case variation.
