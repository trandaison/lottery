# Fix: Redirect Loop Issue

## Problem
After login, the application had an infinite redirect loop between `/admin/login` and `/admin/campaigns`.

## Root Cause
The redirect loop was caused by conflicting navigation logic:

1. **Login Page** (`src/app/admin/login/page.tsx`):
   - Had a `useEffect` that auto-redirected to `/admin/campaigns` when `isAuthenticated` was true
   
2. **Admin Layout** (`src/app/admin/layout.tsx`):
   - Had a `useEffect` that redirected to `/admin/login` when `user` was null

**The Race Condition:**
- User logs in successfully
- Login page detects `isAuthenticated = true` → redirects to `/admin/campaigns`
- Admin layout renders, but `useAuth` hook state hasn't synced yet
- Admin layout sees `user = null` (briefly) → redirects back to `/admin/login`
- Login page sees `isAuthenticated = true` → redirects to `/admin/campaigns` again
- Loop continues...

## Solution

### 1. Remove Auto-Redirect from Login Page
**File**: `src/app/admin/login/page.tsx`

**Before:**
```typescript
useEffect(() => {
  if (isAuthenticated) {
    const redirect = searchParams.get('redirect') || '/admin/campaigns';
    router.push(redirect);
  }
}, [isAuthenticated, router, searchParams]);
```

**After:**
```typescript
// Don't auto-redirect here to prevent redirect loop
// Let the form submission handle the redirect instead
```

**Reason**: Only the form submission should handle redirect, not a separate useEffect. This prevents race conditions.

### 2. Simplify Admin Layout Redirect Logic
**File**: `src/app/admin/layout.tsx`

**Before:**
```typescript
useEffect(() => {
  if (!isLoading && !user && pathname !== '/admin/login') {
    router.push('/admin/login');
  }
}, [user, isLoading, pathname, router]);

if (pathname === '/admin/login') {
  return <>{children}</>;
}

if (isLoading) {
  return <div>Loading...</div>;
}

if (!user) {
  return null;
}
```

**After:**
```typescript
// Show login page without layout
if (pathname === '/admin/login') {
  return <>{children}</>;
}

// Show loading state while checking auth
if (isLoading) {
  return <div>Loading...</div>;
}

// Redirect to login if not authenticated
if (!user) {
  router.replace('/admin/login');
  return null;
}
```

**Changes:**
- Removed `useEffect` for redirect (no longer needed)
- Check pathname first (early return for login page)
- Use `router.replace()` instead of `router.push()` to prevent back button issues
- Simpler, more synchronous flow

### 3. Use `router.replace()` in Login Form Submission
**File**: `src/app/admin/login/page.tsx`

**Before:**
```typescript
if (success) {
  const redirect = searchParams.get('redirect') || '/admin/campaigns';
  router.push(redirect);
}
```

**After:**
```typescript
if (success) {
  // Use replace to prevent back button returning to login page
  const redirect = searchParams.get('redirect') || '/admin/campaigns';
  router.replace(redirect);
}
```

**Reason**: Using `replace` instead of `push` prevents the back button from returning to the login page after successful login.

## Benefits

1. **No Redirect Loop**: Single source of truth for redirects
2. **Better UX**: Back button doesn't go back to login page
3. **Simpler Code**: Less useEffect dependencies, easier to reason about
4. **Synchronous Flow**: Direct conditional checks instead of async useEffect
5. **Race Condition Free**: No competing redirects

## Testing

Run the test script to verify:
```bash
./scripts/test-auth-flow.sh
```

All tests should pass:
- ✅ Login successful
- ✅ Authentication verified
- ✅ Can access protected endpoint
- ✅ Logout successful
- ✅ Correctly denied access after logout

## Manual Testing Steps

1. Open browser to `http://localhost:3000/admin/login`
2. Login with `admin@company.com` / `password123`
3. Verify redirect to `/admin/campaigns` happens ONCE (no loop)
4. Check browser console - should have no errors
5. Verify page renders correctly with campaigns list
6. Test logout - should return to login page
7. Try accessing `/admin/campaigns` without login - should redirect to login

## Related Files Modified

- `src/app/admin/login/page.tsx`
- `src/app/admin/layout.tsx`
- `scripts/test-auth-flow.sh` (new)

## Notes

- This fix follows React best practices: avoid using useEffect for navigation when possible
- Direct conditional rendering is more predictable than useEffect-based navigation
- Using `router.replace()` improves UX by managing browser history correctly
