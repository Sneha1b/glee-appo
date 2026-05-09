# Route swap template: Supabase → AWS

This shows the pattern for migrating one feature off Supabase. Apply the same
shape to every route/component that imports `@/integrations/supabase/*`.

## The principle

Browser code never talks to MySQL or Cognito directly — it calls a
**TanStack server function** that runs on EC2 and uses `aws/*` internally.

```
Component (browser)  →  createServerFn (EC2 Node)  →  aws/db | aws/auth | aws/storage
```

This replaces the previous shape, which was:

```
Component (browser)  →  supabase-js  →  Supabase Postgres (RLS-enforced)
```

Because RLS is gone, **every server fn must do its own auth check** with
`aws/auth/verify.ts` against the Cognito session cookie.

---

## Example: list of bookings for current user

### Before (Supabase, in `reservations.tsx`)

```ts
import { supabase } from "@/integrations/supabase/client";

const { data } = await supabase
  .from("bookings")
  .select("*, services(name), staff(name)")
  .eq("customer_id", userId)
  .order("start_at", { ascending: false });
```

RLS policy on `bookings` automatically restricts to `customer_id = auth.uid()`.

### After (AWS)

**1) Server fn — `src/lib/bookings.functions.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/aws/db/client";
import { bookings, services, staff } from "@/aws/db/schema";
import { verifyCognitoToken } from "@/aws/auth/verify";

export const listMyBookings = createServerFn({ method: "GET" }).handler(async () => {
  const cookie = getRequestHeader("cookie") ?? "";
  const idToken = parseCookie(cookie, "id_token");
  if (!idToken) throw new Error("unauthenticated");
  const claims = await verifyCognitoToken(idToken);

  return db
    .select({
      id: bookings.id,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      serviceName: services.name,
      staffName: staff.name,
    })
    .from(bookings)
    .leftJoin(services, eq(services.id, bookings.serviceId))
    .leftJoin(staff, eq(staff.id, bookings.staffId))
    .where(eq(bookings.customerId, claims.sub))
    .orderBy(desc(bookings.startAt));
});

function parseCookie(header: string, name: string): string | null {
  const m = header.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
```

**2) Component call — `src/routes/reservations.tsx`**

```tsx
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyBookings } from "@/lib/bookings.functions";

function Reservations() {
  const fetchBookings = useServerFn(listMyBookings);
  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => fetchBookings(),
  });
  // …render
}
```

---

## Mapping table — what to swap

| Supabase pattern | AWS replacement |
|---|---|
| `supabase.from(t).select()` | server fn → `db.select().from(t)` (Drizzle) |
| `supabase.rpc("acquire_slot_lock", …)` | server fn → `aws/services/booking.ts → acquireSlotLock()` |
| `supabase.rpc("confirm_booking", …)` | server fn → `aws/services/booking.ts → confirmBooking()` |
| `supabase.rpc("assign_my_role", …)` | server fn → `aws/services/role.ts → assignMyRole()` |
| `supabase.rpc("get_booked_slots", …)` | server fn → `aws/services/slots.ts → getBookedSlots()` |
| `supabase.auth.signUp / signIn` | server fn → `aws/auth/cognito.ts` (set httpOnly cookie) |
| `supabase.auth.getUser()` (browser) | server fn → verify cookie with `verifyCognitoToken` |
| `supabase.storage.from("business-images").upload()` | server fn → `aws/storage/s3.ts → presignedPutUrl()`, then `fetch(url, {method:"PUT", body:file})` from browser |
| `supabase.functions.invoke("booking-confirmation")` | **drop** (no email per plan) |
| Realtime `supabase.channel(...)` | not used in current code; if needed later, poll or SSE from a server route |

## Order to migrate (least-risky first)

1. **Auth** — once Cognito login works, every other swap can rely on the cookie.
2. **Read-only lists** (services, staff, hours, businesses public pages).
3. **Provider mutations** (create/update business, services, staff, hours).
4. **Booking flow** (`acquire_slot_lock` → `confirm_booking`) — most complex.
5. **Image upload** (presigned PUT).
6. Delete `supabase/`, `src/integrations/supabase/`, and `@supabase/supabase-js` from package.json.
