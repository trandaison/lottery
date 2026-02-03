# Research Report: Forgot Password (Token + Redis + Email + Rate Limit)

## Executive Summary

Forgot-password flows should use a cryptographically secure token stored in Redis with a short TTL (e.g. 1 hour). Rate limiting per email (e.g. 1 request per minute) in Redis prevents abuse and email cost. Tokens should be one-time-use (delete after successful reset) and the same success message should be shown whether the email exists or not to avoid user enumeration.

## Findings

### Finding 1: Token generation and storage

- Use a cryptographically secure random source (e.g. `crypto.randomBytes` or UUID v4) for the token.
- Store in Redis with key = token (or a prefixed key) and value = user identifier (e.g. user_id). TTL 1 hour (3600 seconds) is within the typical 15 minutes–1 hour range recommended for password reset.
- Use atomic SET with EX (e.g. `SET key value EX 3600`) so storage and TTL are set together.
- **Recommended**: Treat the token as one-time-use: delete the Redis key after a successful password reset.

- Source: [How to properly create a password reset token?](https://security.stackexchange.com/questions/213975/how-to-properly-create-a-password-reset-token)  
- Confidence: High

### Finding 2: Redis TTL and key design

- Use a key prefix (e.g. `forgot_password:`) to separate reset tokens from session keys. Value can be user_id (string or number) for lookup.
- Set TTL when writing (e.g. 3600 seconds). Redis automatically removes keys when TTL expires, avoiding manual cleanup.
- Upstash Redis supports `set(key, value, { ex: seconds })` for atomic set-with-expiry.

- Source: [Best Practices for Using Redis EXPIRE and TTL](https://devops.aibit.im/article/best-practices-redis-expire-ttl)  
- Confidence: High

### Finding 3: Rate limiting per email with Redis

- Use a Redis key per email (e.g. `forgot_password_rate:{email}` or a normalized/hashed email). Value: last request timestamp or a counter.
- For “1 request per minute”: before sending email, check if the key exists and has not expired (TTL 60 seconds). If it exists and is still valid, return a generic “try again later” response without sending email. If it does not exist or has expired, set the key with TTL 60 seconds and proceed.
- Alternative: INCR + EXPIRE (increment counter, set TTL on first request). Allow only when counter is 1 within the window. For “1 per minute”, a simple “set key with ex 60” and “get key” to decide allow/deny is sufficient.

- Source: [How to build a Rate Limiter using Redis](https://redis.io/learn/howtos/ratelimiting), [How can I limit the login attempts using redis?](https://stackoverflow.com/questions/21020804/how-can-i-limit-the-login-attempts-using-redis)  
- Confidence: High

### Finding 4: Security and UX

- To prevent user enumeration: always return the same success message after “forgot password” submit (e.g. “If an account exists, we sent a link…”), and do not reveal whether the email exists.
- Invalidate the token after successful reset (delete from Redis). Optionally allow only one valid token per user (overwrite previous token when a new one is requested).
- Reset URL should use HTTPS in production and contain only the token (no sensitive data).

- Source: [How to Implement a Forgot Password Flow? Complete Guide](https://supertokens.com/blog/implementing-a-forgot-password-flow)  
- Confidence: High

## Recommendations

1. **Token**: Generate with `uuid v4` or `crypto.randomBytes` (e.g. 32 bytes hex). Store in Redis as `forgot_password:{token}` → value `userId`, TTL 3600. Delete key after successful reset.
2. **Rate limit**: Key `forgot_password_rate:{email}` (or hashed email), value timestamp or “1”, TTL 60. If key exists, return 429 or a generic “wait 1 minute” message; otherwise set key and send email.
3. **Email**: Same success message whether email exists or not; send email only when email exists and rate limit allows.
4. **Reset page**: Look up token in Redis; if missing or expired, show “invalid or expired link”; if valid, show reset form. On submit: update password, delete token, redirect to login.

## Sources

1. [How to properly create a password reset token?](https://security.stackexchange.com/questions/213975/how-to-properly-create-a-password-reset-token) – Security Stack Exchange  
2. [Best Practices for Using Redis EXPIRE and TTL](https://devops.aibit.im/article/best-practices-redis-expire-ttl)  
3. [How to build a Rate Limiter using Redis](https://redis.io/learn/howtos/ratelimiting) – Redis  
4. [How to Implement a Forgot Password Flow? Complete Guide](https://supertokens.com/blog/implementing-a-forgot-password-flow) – SuperTokens  
5. [How can I limit the login attempts using redis?](https://stackoverflow.com/questions/21020804/how-can-i-limit-the-login-attempts-using-redis) – Stack Overflow  
