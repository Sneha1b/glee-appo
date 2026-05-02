## Goals

1. Let providers create new service **categories** directly from the Services tab in the admin dashboard.
2. Replace the current single-page `/provider/new` form with a guided multi-step **Add business** wizard collecting: business info & location → store hours → categories & services → staff (optional, with weekly hours + service assignments) → review.

## 1. Categories on the Services tab

Edit `src/routes/admins.$adminId.tsx` → `ServicesTab`:

- Add a small "Categories" panel above (or next to) the Add/Edit service card.
- Lets the owner: list existing categories, add a new one (name input + Add button), and delete an unused category.
- Inserts into `service_categories` with `business_id`. Existing RLS already allows owners to manage categories.
- The new category appears immediately in the existing "Category" `<Select>` in the service form.
- Guard delete: if the category is referenced by any service, show a toast and skip (or null out via a confirm). Simplest: block delete when in use.

No schema or RLS changes needed.

## 2. Multi-step Add business wizard

Rewrite `src/routes/provider.new.tsx` as a step-based wizard. Single route, internal step state. Steps:

```text
1. Business info     → name*, category, description, phone, logo upload
2. Location          → address line 1, city, region, postal code, country
3. Store hours       → 7-day grid (open/close hour inputs; "Closed" toggle per day)
4. Categories        → add one or more category names (chips with remove)
5. Services          → add services (name*, duration*, price, description, optional category from step 4)
6. Staff (optional)  → for each staff: name*, weekly hours (per-day open/close), services they perform (checkboxes from step 5). Skippable.
7. Review & create   → summary of every section + Create button
```

Implementation notes:
- All collected client-side in a single state object until step 7 submit.
- On submit:
  1. `supabase.rpc("create_business_with_owner", ...)` → returns `businessId`.
  2. Insert `business_hours` rows for non-closed days.
  3. Insert `service_categories` rows; keep a local `tempCategoryId → realId` map.
  4. Insert `services` rows mapping `category_id` via the map.
  5. For each staff: insert `staff` row → insert `availabilities` rows → insert `staff_services` rows mapping `service_id` from temp ids to real ids.
  6. Send manager invites (keep existing capability — surfaced on Step 1 as a small "Invite co-managers" optional block, or moved to Review step).
  7. **Redirect to `/admins/$adminId` (the dashboard), NOT `/businesses/$businessId`.** This fixes the existing post-create redirect.
- Each step has Back/Next buttons; Next validates required fields for that step. Step 6 also has a "Skip" button.
- Top-of-page step indicator (e.g., "Step 3 of 7 · Store hours") with a thin progress bar.
- All inserts run sequentially with try/catch; on failure show a toast and stay on the review step (the business row will already exist if RPC succeeded — surface "partial save, you can finish setup from the dashboard" and still navigate to `/admins/{id}`).
- Reuse existing tokens / shadcn `Card`, `Input`, `Label`, `Button`, `Select`, `Textarea`, `Checkbox`. No new deps.

## Files to change

- `src/routes/admins.$adminId.tsx` — add a Categories management UI inside `ServicesTab`.
- `src/routes/provider.new.tsx` — replace single form with multi-step wizard (steps + state machine + sequenced inserts + correct post-save redirect to `/admins/$adminId`).

## Out of scope

- Schema/RLS changes (existing `service_categories`, `business_hours`, `staff`, `availabilities`, `staff_services` policies already cover owner inserts).
- Booking-time blocks on the wizard (kept on the dashboard's existing Time blocks tab).
- Editing categories from the wizard step 5 onward (only add/remove on step 4).
