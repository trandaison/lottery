# Fix: Authentication State Loss on Navigation

## Problem (Round 2)
After fixing the redirect loop, a new issue appeared: Users could login successfully, but when redirected to `/admin/campaigns`, they were immediately kicked back to `/admin/login`.

## Root Cause
The `useAuth` hook was using **local component state** (`useState`). Each time a new page/component mounted:
1. Hook re-initializes with `isLoading: true` and `user: null`
2. Admin layout checks `if (!user)` → immediately redirects to login
3. Even though the cookie exists, the async fetch hasn't completed yet

**Timeline:**
```
T0: Login success → state set → navigate to /admin/campaigns
T1: Admin layout mounts → useAuth initializes (user=null, isLoading=true)
T2: Admin layout renders → sees user=null → redirects to /admin/login
T3: fetchUser completes → but too late, already redirected
```

## Solution: Auth Context with Global State

Created `AuthContext` to share authentication state across the entire application.

### Key Changes

#### 1. Created Auth Context (`src/lib/context/AuthContext.tsx`)
```typescript
// Global context that persists across navigation
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  
  // Same login/logout/fetch logic
  // ...
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**Benefits:**
- State persists across page navigations
- Single source of truth for auth state
- No re-initialization on component mount

#### 2. Wrapped App with AuthProvider (`src/app/layout.tsx`)
```typescript
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
```

#### 3. Updated Imports
- `src/app/admin/layout.tsx`: Changed from `@/lib/hooks/useAuth` to `@/lib/context/AuthContext`
- `src/app/admin/login/page.tsx`: Changed from `@/lib/hooks/useAuth` to `@/lib/context/AuthContext`

## How It Works Now

### Login Flow
```
1. User submits login form
2. AuthContext.login() called
3. API request → success
4. Context updates state globally
5. Navigate to /admin/campaigns
6. Admin layout mounts
7. useAuth() returns context (state already loaded)
8. No redirect because user is already set
```

### Navigation Flow
```
1. User navigates /admin/campaigns → /admin/campaigns/new
2. New component mounts
3. useAuth() returns the same context instance
4. State is preserved (user still set, isLoading=false)
5. No unnecessary API calls
6. Smooth navigation
```

## Comparison: Before vs After

### Before (Local State)
```typescript
// Each component instance has its own state
function useAuth() {
  const [state, setState] = useState({ user: null, isLoading: true });
  
  useEffect(() => {
    fetchUser(); // Called on EVERY mount
  }, []);
  
  return state;
}
```

**Problem:** State resets on every navigation

### After (Context)
```typescript
// Single shared state for entire app
function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, isLoading: true });
  
  useEffect(() => {
    fetchUser(); // Called only ONCE on app mount
  }, []);
  
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
```

**Solution:** State persists across navigation

## Testing

Run the test script:
```bash
./scripts/test-auth-context.sh
```

All tests should pass:
- ✅ Login successful
- ✅ /me endpoint works immediately
- ✅ Can access protected endpoints
- ✅ Rapid requests work (no race conditions)

## Browser Testing Steps

1. Open http://localhost:3000/admin/login
2. Open DevTools → Console + Network tabs
3. Login with `admin@company.com` / `password123`
4. **Expected behavior:**
   - Navigate to `/admin/campaigns`
   - Stay on campaigns page (no redirect back to login)
   - Network tab shows one `/me` call during initial app load
   - Console has no errors

## Files Modified

- ✅ Created: `src/lib/context/AuthContext.tsx`
- ✅ Updated: `src/app/layout.tsx` (added AuthProvider)
- ✅ Updated: `src/app/admin/layout.tsx` (import from context)
- ✅ Updated: `src/app/admin/login/page.tsx` (import from context)
- ✅ Created: `scripts/test-auth-context.sh`

## Why This Is Better

1. **Performance**: Only one `/me` API call per app load (not per page)
2. **Reliability**: No race conditions between navigation and auth check
3. **UX**: Instant navigation without loading flashes
4. **Maintainability**: Single source of truth for auth state
5. **React Best Practice**: Using Context for shared state

## Old Hook Status

The old `src/lib/hooks/useAuth.ts` can now be:
- Deleted (replaced by AuthContext)
- Or kept for reference (not used anymore)

## Notes

- Auth state now persists across client-side navigation
- Server-side rendering still works (initial load checks auth on server)
- Cookie-based authentication ensures security
- Context is only used on client side (`'use client'`)
