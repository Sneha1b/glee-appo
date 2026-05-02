# Fix the provider redirect loop

## Root cause

The signed-in provider (`provider@demo.test`) has no row in `provider_profiles`. Three pages all run their own `useEffect`-based auth/profile guards that disagree about where the user should be, and they bounce the URL between `/provider` and `/auth/provider/profile` (with brief stops at `/auth/provider`).

The cycle:

```text
/provider
  └─ useEffect: profile missing → navigate('/auth/provider/profile')

/auth/provider/profile
  └─ useEffect deps include the whole `user` object. Every onAuthStateChange
     event (INITIAL_SESSION, TOKEN_REFRESHED, …) creates a new user reference
     and re-runs the effect. If `user` is briefly null during a re-render
     (race with auth-context state updates), it calls
     navigate('/auth/provider', { mode: 'login' }).

/auth/provider  (mode=login)
  └─ useEffect: user is set + mode==='login' → postAuth() → navigate('/provider')

→ back to step 1, forever.
```

Two contributing bugs make this race trigger reliably:

1. `auth-context.tsx` calls `loadAux` from inside `onAuthStateChange` via `setTimeout(..., 0)`, and also from `refresh()` on mount. `user` is replaced with a new object reference on every auth event, so any effect depending on `user` (not `user?.id`) re-fires constantly.
2. `auth.provider.tsx` auto-redirects an already-signed-in user away from the page the moment `mode === 'login'`. That turns `/auth/provider` into a one-way trampoline back to `/provider`, closing the loop.

## Changes

### 1. `src/routes/auth.provider.profile.tsx`
- Change effect deps from `[loading, user]` to `[loading, user?.id]` so it only re-runs on identity change, not on every auth-state object swap.
- Guard the redirect with a small ready-check: only navigate to `/auth/provider` if `loading === false` AND `user` is null AND we have not already started loading the profile (use a ref). Prevents the transient-null redirect.

### 2. `src/routes/auth.provider.tsx`
- Remove the auto-redirect that fires when an already-signed-in user lands on `/auth/provider` with `mode=login`. The provider hub (`/provider`) is the canonical place to land logged-in users; this page should just show the form (or a small "You're already signed in — go to dashboard" link). This breaks the trampoline back into `/provider`.
- Keep `postAuth()` for the actual submit handler.

### 3. `src/routes/provider.tsx`
- Keep the "no profile row → go to profile" redirect, but only fire it once per mount (use a ref) so a re-render of the effect cannot re-trigger an in-flight navigation.
- Also switch to `[loading, user?.id]` deps for consistency.

### 4. `src/lib/auth-context.tsx` (small hardening)
- Skip the `loadAux` call inside `onAuthStateChange` when the new session's `user.id` matches the current one (prevents needless `setUser` / role refetch churn that creates new `user` object refs).
- Do not flip `loading` back to `true` on auth events — only the initial mount should toggle it.

## Out of scope

- No schema or RLS changes. The `provider_profiles` row will be created normally when the user fills the profile form.
- No new routes; this is purely fixing the guards on the existing three pages.

## Verification

After the fix:
- Logged-in provider with no `provider_profiles` row lands on `/auth/provider/profile` and stays there until they submit the form.
- Logged-in provider with a complete profile lands on `/provider` and stays.
- Visiting `/auth/provider` while signed in shows the form (no auto-redirect loop); submitting still routes correctly via `postAuth`.
