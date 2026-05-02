## Problem

Clicking a booking on `/admins/{adminId}` flashes the booking detail page, then bounces back to the dashboard instead of staying on `/admins/{adminId}/bookings/{bookingId}`.

## Root cause

`src/routes/admins.$adminId.bookings.$bookingId.tsx` still uses the legacy single-business assumption from `useAuth()`:

```tsx
const { user, loading: authLoading, businessId, role } = useAuth();
...
if (businessId !== adminId) {
  navigate({ to: "/admins/$adminId", params: { adminId: businessId }, replace: true });
}
```

`useAuth().businessId` only returns the provider's *primary* business. Providers can own multiple businesses (per the `business_owners` table + `create_business_with_owner` RPC), so any booking under a non-primary business fails this check and gets redirected away — exactly the same pattern we just fixed on the parent dashboard route.

## Fix

Mirror the ownership-check pattern already used in `src/routes/admins.$adminId.tsx`:

1. Drop the `businessId` dependency from `useAuth()` in `admins.$adminId.bookings.$bookingId.tsx`.
2. Add an `ownership: "checking" | "owner" | "denied"` state.
3. On mount (and when `adminId` / `user` changes), query `business_owners` for `(user_id = current user, business_id = adminId)`. If found → `owner`; otherwise → redirect to `/provider`.
4. Gate the booking fetch and rendering on `ownership === "owner"` so we don't fetch a booking the user can't view.
5. Keep the existing auth gate (must be logged in + role `provider`); on failure send to `/auth/provider`.
6. Keep the cancel-flow `navigate` going back to `/admins/$adminId` with the URL's `adminId` (already correct).

No schema/RLS changes; RLS already restricts `bookings` to owners of `business_id`, so the ownership check is purely to avoid the bad client-side redirect.

## Files to edit

- `src/routes/admins.$adminId.bookings.$bookingId.tsx` — replace the `businessId !== adminId` redirect with the per-business `business_owners` ownership check, gate render on it.
