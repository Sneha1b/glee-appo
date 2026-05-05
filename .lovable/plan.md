## Goal

On the booking page (`/book/$serviceId`), if **today** has no available slots, automatically land the user on the **next day within 15 days** that has at least one open slot. Show a small banner explaining the jump. If the user manually picks a date, do not auto-jump.

## Approach: client-side scan

Reuse the existing `computeSlots()` helper — it already correctly handles timezone, business hours, closures, bookings, blocks, and locks. No DB or RPC changes needed.

## Changes

### 1. `src/lib/slots.ts` — add `findNextAvailableDay`

New helper that scans up to N days starting from a given date and returns the first date with ≥1 slot, plus the slots for that day (so the caller doesn't need to re-fetch).

```ts
export async function findNextAvailableDay(opts: {
  serviceId: string;
  durationMin: number;
  fromDate: Date;
  horizonDays: number;          // 15
  staffIdFilter?: string | null;
}): Promise<{ date: Date; slots: Slot[] } | null>
```

Implementation: loop day-by-day from `fromDate`, call `computeSlots` for each. Return on the first non-empty result. Stop after `horizonDays` iterations.

Optional micro-optimization (only if simple): a single upfront fetch of `business_hours` and `business_closures` for the business so days that are closed/no-hours can be skipped without the full 4-query `computeSlots` round-trip. Skip this if it complicates the code — the loop is still acceptable performance for 15 days.

### 2. `src/routes/book.$serviceId.tsx` — wire it up

- Add state: `autoJumped: { from: Date } | null` and `searching: boolean`.
- Replace the existing "load slots when service/date changes" effect with a small state machine:
  - **Initial mount** (after `service` loads): set `searching=true`, call `findNextAvailableDay({ fromDate: today, horizonDays: 15 })`.
    - If found and the returned date ≠ today → `setDate(found.date)`, `setSlots(found.slots)`, `setAutoJumped({ from: today })`.
    - If found and date = today → `setDate(today)`, `setSlots(found.slots)`, no banner.
    - If null → keep `date=today`, `slots=[]`, set a "no availability in next 15 days" flag for the empty state copy.
  - **User changes date manually**: existing behavior — call `computeSlots` for that date only, never auto-jump, clear `autoJumped`.
- Distinguish "user-initiated date change" from "programmatic date change after auto-jump" by gating on a ref or by setting slots directly in the auto-jump branch (skipping the effect's fetch).

### 3. UI — banner + loading copy

- While `searching` is true, the slots card shows: **"Finding the next available day…"** with the spinner (replacing current "Loading availability…").
- When `autoJumped` is set, render a small `Alert` (shadcn) above the slots card:
  > **No openings on {fmtDate(autoJumped.from)}** — showing the next available day instead.
  
  Dismissible (X button) — clicking dismiss just clears `autoJumped`.
- When the 15-day scan finds nothing, the empty-state line becomes: **"No availability in the next 15 days. Try contacting the business directly."**

## Flow validation

| Scenario | Result |
|---|---|
| Today has slots | Lands on today, no banner (current behavior preserved) |
| Today empty, tomorrow has slots | Lands on tomorrow, banner shown |
| Today + next 14 days all empty | Lands on today, "No availability in 15 days" empty state |
| User manually clicks an empty future date | Shows "0 slots" for that date, no auto-jump |
| User manually clicks back to today | Shows whatever today has (likely empty), no re-jump |
| Lock acquired, then user picks new date | Existing release-lock behavior unchanged |

## Out of scope

- No DB migration, no new RPC.
- No change to slot computation, locking, or confirmation flow.
- Calendar component itself unchanged (still allows picking any future date).

## Files touched

- `src/lib/slots.ts` — add `findNextAvailableDay`
- `src/routes/book.$serviceId.tsx` — initial-load logic + banner + loading copy
