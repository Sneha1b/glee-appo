## Test Plan — Validate `aws-finish_v3.patch` (Backends + Server-Fn Wrappers)

This plan exercises the data layer **before any UI is migrated**, so issues with Drizzle schema, MySQL semantics, Cognito wiring, and TanStack server-fn boundaries are caught while changes are cheap. UI on `aws-deploy` continues to run against Supabase until v4/v5.

### Scope under test (delivered by v3)

- New backend modules in `aws/services/`: `services.ts`, `staff.ts`, `hours.ts`, `bookings.ts` (extends), `invoices.ts`, `metrics.ts`
- New server-fn wrappers in `src/aws/`: `services.functions.ts`, `staff.functions.ts`, `hours.functions.ts`, `bookings.functions.ts`, `invoices.functions.ts`, `metrics.functions.ts`
- Existing wrappers remain untouched: `auth/role/customer/business`

### Pre-flight (one-time)

| # | Step | Command |
|---|---|---|
| P1 | Local MySQL 8 + Cognito user pool reachable | `mysql -h $RDS -u admin -p$PASS -e 'SELECT 1'` |
| P2 | `.env.aws` populated (DATABASE_URL, COGNITO_*, AWS_REGION, S3_BUCKET, SESSION_SECRET ≥ 32 chars) | `grep -c = .env.aws` ≥ 7 |
| P3 | Drizzle migrations generated and applied | `bunx drizzle-kit generate --config aws/drizzle.config.ts && bun aws/db/migrate.ts` |
| P4 | Two Cognito test users created (one provider, one customer), email-confirmed | AWS CLI `cognito-idp admin-create-user` + `admin-set-user-password` |

---

## Test suites

### Suite 1 — Static / build (5 min)

| ID | Test | Command | Pass criteria |
|---|---|---|---|
| 1.1 | Type-check passes | `bunx tsc --noEmit` | exit 0, zero errors |
| 1.2 | ESLint clean on new files | `bun run lint -- src/aws aws/services` | exit 0 |
| 1.3 | No client-bundle leak of `*.server.ts` or admin clients | `bunx vite build --config vite.config.aws.ts` | build succeeds; grep client chunks for `mysql2`, `aws-sdk`, `client.server` → **zero matches** |
| 1.4 | Server-fn split intact (no sibling-helper ReferenceErrors) | `rg -n "^(function|const) " src/aws/*.functions.ts \| grep -v createServerFn` | only `import` lines and `createServerFn` declarations — no plain helpers |
| 1.5 | Docker image builds | `docker build -t schedora-aws .` | exit 0, final image < 350 MB |

### Suite 2 — Schema & migrations (10 min)

| ID | Test | Pass criteria |
|---|---|---|
| 2.1 | All 16 tables exist after `migrate.ts` | `SHOW TABLES` returns ≥ 16 rows including `services`, `staff`, `staff_services`, `availabilities`, `time_blocks`, `business_hours`, `business_closures`, `invoices`, `slot_locks` |
| 2.2 | UUID defaults work | `INSERT INTO businesses (name) VALUES ('t');` then `SELECT id FROM businesses` returns 36-char UUID |
| 2.3 | `slot_locks_staff_start_uq` enforces upsert | Two inserts with same `(staff_id, start_at)` → second is ON DUPLICATE KEY UPDATE, row count stays 1 |
| 2.4 | Invoice `expires_at` defaults to +18 months | `SELECT TIMESTAMPDIFF(MONTH, NOW(3), expires_at)` = 18 |
| 2.5 | Re-running migrate is idempotent | second `bun aws/db/migrate.ts` → exit 0, no schema drift |

### Suite 3 — Server function smoke (15 min)

Run the AWS build and exercise each new wrapper via HTTP. The test driver below requires no UI.

```bash
# Start the AWS build locally
docker run --env-file .env.aws -p 3000:3000 schedora-aws &
until curl -sf http://localhost:3000/api/health; do sleep 2; done

# Get a Cognito session cookie (uses signInFn)
COOKIE=$(curl -sS -i -X POST http://localhost:3000/_serverFn/signInFn \
  -H 'Content-Type: application/json' \
  -d '{"data":{"email":"prov@test.local","password":"Provider1!"}}' \
  | awk '/^set-cookie:/ {print $2}' | head -1)
```

| ID | Server fn | Driver | Pass criteria |
|---|---|---|---|
| 3.1 | `meFn` (already in v2) | `curl … -b $COOKIE _serverFn/meFn` | returns `{ user: { sub, email }, role: null }` for fresh user |
| 3.2 | `assignMyRoleFn` (v2) | POST `{role:'provider'}` | row appears in `user_roles`; second call with same role → idempotent (no error) |
| 3.3 | `createBusinessFn` (v2) | POST `{name:'Acme'}` | returns `{id}`; row in `businesses` + `business_owners` |
| 3.4 | **`createServiceFn` (new)** | POST `{businessId, name:'Cut', durationMin:30, price:'25.00'}` | row in `services` with `active=true`, returns id |
| 3.5 | **`listServicesFn` (new)** | GET `?businessId=…` | returns array including the row from 3.4 |
| 3.6 | **`createStaffFn` + `linkStaffServiceFn` (new)** | sequential | `staff` + `staff_services` rows present, composite PK enforced (second link → no dup) |
| 3.7 | **`upsertHoursFn` (new)** | POST `[{weekday:1, openMinute:540, closeMinute:1020}, …×7]` | `business_hours` has exactly 7 rows for the business |
| 3.8 | **`createTimeBlockFn` (new)** | POST `{staffId, startAt, endAt, reason}` | row appears; index `time_blocks_staff_start_idx` used (`EXPLAIN` shows non-ALL) |
| 3.9 | **`getAvailableSlotsFn` (new — wraps `slots.ts`)** | GET `?staffId&serviceId&date` | returns slot list; matches existing `src/lib/slots.ts` output for the same fixture (parity check) |
| 3.10 | **`acquireLockFn` → `confirmBookingFn` (new)** | sequential | booking row created, lock row deleted, returns `bookingId` |
| 3.11 | Concurrent lock contention | 5 parallel `acquireLockFn` for same slot | exactly 1 succeeds; others get `slot_locked` |
| 3.12 | **`createInvoiceFn` (new)** | POST `{bookingId}` | invoice row created with `invoice_number` unique, `status='issued'`, `expires_at` ≈ +18mo |
| 3.13 | **`listInvoicesFn` (new)** | GET `?businessId` | returns the invoice from 3.12 |
| 3.14 | **`getBusinessMetricsFn` (new)** | GET `?businessId&from&to` | returns `{bookingCount, revenueCents, topServices[]}`; numbers match raw SQL |
| 3.15 | Auth gate enforced | call any wrapper **without** cookie | HTTP 401, no DB write |
| 3.16 | Cross-tenant denied | provider A calls `createServiceFn` on provider B's businessId | HTTP 403, no row written |

### Suite 4 — Behavioural parity vs Supabase (15 min)

Run the **same fixture** against the existing Supabase preview and the new AWS build, diff the outputs.

| ID | Operation | Comparator | Pass criteria |
|---|---|---|---|
| 4.1 | Slot generation for one staff/day | JSON output of `getAvailableSlotsFn` vs the equivalent from `src/lib/slots.ts` against Supabase data | identical slot list (start times, available flags) |
| 4.2 | Booking confirmation atomicity | acquire → confirm under both stacks | both produce a single booking row, lock removed |
| 4.3 | Invoice number monotonicity | issue 10 invoices on AWS | numbers strictly increasing, no duplicates (covered by `unique` constraint) |
| 4.4 | Hours upsert overwrites prior week | call `upsertHoursFn` twice with different shapes | second call's rows replace first; row count still 7 |

### Suite 5 — Regression on Supabase preview (5 min)

v3 adds files but must NOT touch any Supabase importer.

| ID | Test | Pass criteria |
|---|---|---|
| 5.1 | Lovable preview still boots | open preview URL | landing page renders, no console errors |
| 5.2 | Provider login → admin dashboard still works on Supabase | manual click-through | bookings tab loads as before |
| 5.3 | `git diff main...aws-deploy -- src/components src/routes` | no changes from v3 in the diff (only v2 changes) |

---

## Definition of Done (success criteria for v3)

The patch is accepted when **all of the following are true**:

1. **Suite 1**: 5/5 pass — code compiles, lints, builds, Docker image healthy, no Node-only deps in client bundle.
2. **Suite 2**: 5/5 pass — schema applies cleanly and is idempotent.
3. **Suite 3**: 16/16 server functions pass — including auth gate (3.15) and tenant isolation (3.16). **These two are blockers; failure means a security regression vs Supabase RLS.**
4. **Suite 4**: 4/4 parity tests pass — slot generation and booking semantics behave identically to Supabase.
5. **Suite 5**: Supabase preview unaffected (no Supabase regressions because v3 adds files only).
6. **Performance**: median latency on `getAvailableSlotsFn` ≤ 150 ms locally; `confirmBookingFn` ≤ 250 ms.
7. **No leaked secrets**: `bunx vite build … && rg -n "(mysql://|cognito-idp|aws_access_key|SESSION_SECRET)" .output/public dist` → zero matches.

If any blocker (3.15, 3.16, 1.3, 5.x) fails, **do not proceed to v4**. Fix in v3 first.

---

## Test artifacts to deliver alongside v3

To make this plan executable in one shot, v3 should ship with:

- `aws/tests/smoke.sh` — bash driver that runs Suite 3 end-to-end against a running container
- `aws/tests/fixtures.sql` — seed for one business, one staff, one service, one customer
- `aws/tests/parity.ts` — Node script for Suite 4 (calls both stacks, diffs JSON)
- `aws/tests/README.md` — how to run each suite

### Estimated total runtime
~50 minutes for a full pass; ~10 minutes for the smoke subset (Suites 1 + 3.1–3.10).
