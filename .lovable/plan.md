## Fix

In `src/routes/provider.tsx` (line 137), change the business card link from the customer booking page to the admin dashboard:

```tsx
// before
<Link to="/businesses/$businessId" params={{ businessId: b.id }} ...>

// after
<Link to="/admins/$adminId" params={{ adminId: b.id }} ...>
```

That's the entire change.

## Why

`/admins/$adminId` is the existing provider admin landing page (Bookings, Services, Staff, Hours, Time blocks, Metrics, Invoices, Settings) and already enforces ownership via RLS. The previous link sent providers to the public customer booking view, which is slow and irrelevant for an owner.

## Memory update

Update `mem://index.md` Core: "Clicking a card opens /businesses/{id}" → "Clicking a card opens the admin dashboard at /admins/{id}".