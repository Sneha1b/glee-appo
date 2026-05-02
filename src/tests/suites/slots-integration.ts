// Integration tests for the slot computation algorithm.
// The core algorithm from src/lib/slots.ts is extracted as a pure function
// so it can be driven with controlled fixture data (no Supabase required).
import type { TestSuite } from "../runner";
import { expect } from "../runner";
import type { Slot } from "@/lib/slots";

// ── Pure slot computation (mirrors slots.ts computeSlots logic) ───────────────

const SLOT_STEP_MIN = 15;

function zonedWallTimeToUtc(
  localDate: Date,
  minutesSinceMidnight: number,
  timeZone: string
): Date {
  const y = localDate.getUTCFullYear();
  const m = localDate.getUTCMonth();
  const d = localDate.getUTCDate();
  const hh = Math.floor(minutesSinceMidnight / 60);
  const mm = minutesSinceMidnight % 60;
  const guessUtcMs = Date.UTC(y, m, d, hh, mm, 0);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(guessUtcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtcOfRendered = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return new Date(guessUtcMs - (asUtcOfRendered - guessUtcMs));
}

interface StaffDef {
  id: string;
  name: string;
}
interface AvailabilityDef {
  staff_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
}
interface BusyDef {
  staff_id: string;
  start_at: string;
  end_at: string;
}

function computeSlotsFromData(opts: {
  staffList: StaffDef[];
  availabilities: AvailabilityDef[];
  busy: BusyDef[];
  storeHours: { open_minute: number; close_minute: number } | null;
  isClosed: boolean;
  date: Date; // UTC-midnight of the local calendar date
  weekday: number;
  durationMin: number;
  tz: string;
  staffIdFilter?: string | null;
  nowMs?: number; // override "now" for past-slot testing
}): Slot[] {
  const {
    staffList,
    availabilities,
    busy,
    storeHours,
    isClosed,
    date,
    weekday,
    durationMin,
    tz,
    staffIdFilter,
    nowMs,
  } = opts;

  if (isClosed) return [];
  if (storeHours && storeHours.close_minute <= storeHours.open_minute) return [];

  const filtered = staffIdFilter ? staffList.filter((s) => s.id === staffIdFilter) : staffList;
  if (filtered.length === 0) return [];

  const busyByStaff: Record<string, Array<[number, number]>> = {};
  busy.forEach((r) => {
    (busyByStaff[r.staff_id] ??= []).push([
      new Date(r.start_at).getTime(),
      new Date(r.end_at).getTime(),
    ]);
  });

  const now = nowMs ?? Date.now();
  const out: Slot[] = [];

  for (const staff of filtered) {
    const windows = availabilities.filter(
      (a) => a.staff_id === staff.id && a.weekday === weekday
    );
    const staffBusy = busyByStaff[staff.id] ?? [];

    for (const w of windows) {
      const effStart = storeHours
        ? Math.max(w.start_minute, storeHours.open_minute)
        : w.start_minute;
      const effEnd = storeHours
        ? Math.min(w.end_minute, storeHours.close_minute)
        : w.end_minute;
      if (effEnd <= effStart) continue;

      const winStartMs = zonedWallTimeToUtc(date, effStart, tz).getTime();
      const winEndMs = zonedWallTimeToUtc(date, effEnd, tz).getTime();

      for (
        let t = winStartMs;
        t + durationMin * 60_000 <= winEndMs;
        t += SLOT_STEP_MIN * 60_000
      ) {
        const slotEnd = t + durationMin * 60_000;
        if (slotEnd <= now) continue;
        const overlaps = staffBusy.some(([bs, be]) => t < be && slotEnd > bs);
        if (overlaps) continue;
        out.push({
          staffId: staff.id,
          staffName: staff.name,
          startAt: new Date(t).toISOString(),
          endAt: new Date(slotEnd).toISOString(),
        });
      }
    }
  }

  out.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return out;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FUTURE_DATE = new Date(Date.UTC(2099, 5, 15)); // 2099-06-15 — always in the future
const FUTURE_WEEKDAY = 1; // Monday (2099-06-15 is a Monday)

const STAFF_ALICE: StaffDef = { id: "staff-alice", name: "Alice" };
const STAFF_BOB: StaffDef = { id: "staff-bob", name: "Bob" };

// Alice available Mon 09:00–17:00 (540–1020 minutes)
const ALICE_MON_AVAIL: AvailabilityDef = {
  staff_id: "staff-alice",
  weekday: 1,
  start_minute: 540,
  end_minute: 1020,
};

// Store hours 09:00–17:00
const STORE_9_17 = { open_minute: 540, close_minute: 1020 };

// ── Suite ─────────────────────────────────────────────────────────────────────

export const slotsIntegrationSuite: TestSuite = {
  id: "slots-integration",
  name: "Integration · Slot Computation Algorithm",
  type: "integration",
  tests: [
    // ── Guard conditions ──────────────────────────────────────────────────────
    {
      name: "returns empty array when business is closed",
      fn() {
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: true,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        expect(slots).toHaveLength(0);
      },
    },
    {
      name: "returns empty array when store hours are inverted (close <= open)",
      fn() {
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [],
          storeHours: { open_minute: 1020, close_minute: 540 },
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        expect(slots).toHaveLength(0);
      },
    },
    {
      name: "returns empty array when staff list is empty",
      fn() {
        const slots = computeSlotsFromData({
          staffList: [],
          availabilities: [],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        expect(slots).toHaveLength(0);
      },
    },
    {
      name: "returns empty array when staff has no availability on that weekday",
      fn() {
        // Alice only available on Tuesday (weekday=2), but we query Monday (1)
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [{ ...ALICE_MON_AVAIL, weekday: 2 }],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        expect(slots).toHaveLength(0);
      },
    },
    {
      name: "returns empty array when staffIdFilter matches no staff",
      fn() {
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
          staffIdFilter: "staff-nonexistent",
        });
        expect(slots).toHaveLength(0);
      },
    },

    // ── Slot generation ───────────────────────────────────────────────────────
    {
      name: "generates slots when all conditions are met",
      fn() {
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        expect(slots.length).toBeGreaterThan(0);
      },
    },
    {
      name: "all generated slots belong to the correct staff",
      fn() {
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        slots.forEach((s) => expect(s.staffId).toBe("staff-alice"));
        slots.forEach((s) => expect(s.staffName).toBe("Alice"));
      },
    },
    {
      name: "60-min service in 8h window produces 29 slots (15-min grid, last slot fits at 16:00)",
      fn() {
        // 09:00–17:00 = 480 min window, 60-min service on 15-min grid
        // Slots: 09:00,09:15,...,16:00 → (480-60)/15 + 1 = 29 slots
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        expect(slots.length).toBe(29);
      },
    },
    {
      name: "slots are exactly SLOT_STEP_MIN (15 min) apart on the grid",
      fn() {
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 30,
          tz: "UTC",
        });
        for (let i = 1; i < slots.length; i++) {
          const gap =
            new Date(slots[i].startAt).getTime() - new Date(slots[i - 1].startAt).getTime();
          expect(gap).toBe(15 * 60_000);
        }
      },
    },
    {
      name: "slot duration matches requested durationMin",
      fn() {
        const durationMin = 45;
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin,
          tz: "UTC",
        });
        slots.forEach((s) => {
          const dur =
            (new Date(s.endAt).getTime() - new Date(s.startAt).getTime()) / 60_000;
          expect(dur).toBe(durationMin);
        });
      },
    },
    {
      name: "output is sorted ascending by startAt",
      fn() {
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE, STAFF_BOB],
          availabilities: [
            ALICE_MON_AVAIL,
            { staff_id: "staff-bob", weekday: 1, start_minute: 540, end_minute: 1020 },
          ],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        for (let i = 1; i < slots.length; i++) {
          expect(slots[i].startAt >= slots[i - 1].startAt).toBeTruthy();
        }
      },
    },

    // ── Conflict filtering ────────────────────────────────────────────────────
    {
      name: "booking overlap removes exactly that slot",
      fn() {
        // Book Alice at 09:00–10:00
        const busy: BusyDef[] = [
          {
            staff_id: "staff-alice",
            start_at: new Date(Date.UTC(2099, 5, 15, 9, 0)).toISOString(),
            end_at: new Date(Date.UTC(2099, 5, 15, 10, 0)).toISOString(),
          },
        ];
        const all = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        const withBooking = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy,
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        // Booking at 09:00-10:00 blocks slots 08:01–10:00 that overlap — for 60-min service that's 09:00 slot
        expect(withBooking.length).toBeLessThan(all.length);
        const startTimes = withBooking.map((s) => s.startAt);
        // The 09:00 UTC slot is blocked
        expect(startTimes).not.toContain(new Date(Date.UTC(2099, 5, 15, 9, 0)).toISOString());
      },
    },
    {
      name: "time block overlap removes that slot",
      fn() {
        const timeBlock: BusyDef = {
          staff_id: "staff-alice",
          start_at: new Date(Date.UTC(2099, 5, 15, 13, 0)).toISOString(),
          end_at: new Date(Date.UTC(2099, 5, 15, 14, 0)).toISOString(),
        };
        const withBlock = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [timeBlock],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        const startTimes = withBlock.map((s) => s.startAt);
        expect(startTimes).not.toContain(new Date(Date.UTC(2099, 5, 15, 13, 0)).toISOString());
      },
    },
    {
      name: "busy slot does not affect other staff members",
      fn() {
        const aliceBusy: BusyDef = {
          staff_id: "staff-alice",
          start_at: new Date(Date.UTC(2099, 5, 15, 9, 0)).toISOString(),
          end_at: new Date(Date.UTC(2099, 5, 15, 17, 0)).toISOString(), // Alice booked all day
        };
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE, STAFF_BOB],
          availabilities: [
            ALICE_MON_AVAIL,
            { staff_id: "staff-bob", weekday: 1, start_minute: 540, end_minute: 1020 },
          ],
          busy: [aliceBusy],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        // All slots should be Bob's
        slots.forEach((s) => expect(s.staffId).toBe("staff-bob"));
        expect(slots.length).toBeGreaterThan(0);
      },
    },

    // ── Store hours clamping ──────────────────────────────────────────────────
    {
      name: "store hours clamp availability window",
      fn() {
        // Alice available 08:00–18:00 (480–1080), but store only 09:00–17:00
        const wideAvail: AvailabilityDef = {
          staff_id: "staff-alice",
          weekday: 1,
          start_minute: 480,
          end_minute: 1080,
        };
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [wideAvail],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        // No slot should start before 09:00 (540 min)
        slots.forEach((s) => {
          expect(new Date(s.startAt).getUTCHours()).toBeGreaterThanOrEqual(9);
        });
        // No slot should end after 17:00 (1020 min)
        slots.forEach((s) => {
          const endH = new Date(s.endAt).getUTCHours();
          expect(endH).toBeLessThanOrEqual(17);
        });
      },
    },
    {
      name: "staff availability narrower than store hours limits slots",
      fn() {
        // Store 09:00-17:00 but Alice only 10:00-12:00 (600-720)
        const narrowAvail: AvailabilityDef = {
          staff_id: "staff-alice",
          weekday: 1,
          start_minute: 600,
          end_minute: 720,
        };
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [narrowAvail],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        // 10:00-12:00 = 120 min. 60-min service on 15-min grid = (120-60)/15 + 1 = 5 slots
        expect(slots.length).toBe(5);
      },
    },
    {
      name: "null storeHours uses raw availability window",
      fn() {
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [],
          storeHours: null,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
        });
        expect(slots.length).toBeGreaterThan(0);
      },
    },

    // ── Past slot filtering ───────────────────────────────────────────────────
    {
      name: "all past slots are filtered out",
      fn() {
        // Set 'now' to end of day so all slots are in the past
        const endOfDay = new Date(Date.UTC(2099, 5, 15, 23, 59)).getTime();
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE],
          availabilities: [ALICE_MON_AVAIL],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
          nowMs: endOfDay,
        });
        expect(slots).toHaveLength(0);
      },
    },
    {
      name: "staffIdFilter returns only matching staff slots",
      fn() {
        const slots = computeSlotsFromData({
          staffList: [STAFF_ALICE, STAFF_BOB],
          availabilities: [
            ALICE_MON_AVAIL,
            { staff_id: "staff-bob", weekday: 1, start_minute: 540, end_minute: 1020 },
          ],
          busy: [],
          storeHours: STORE_9_17,
          isClosed: false,
          date: FUTURE_DATE,
          weekday: FUTURE_WEEKDAY,
          durationMin: 60,
          tz: "UTC",
          staffIdFilter: "staff-alice",
        });
        slots.forEach((s) => expect(s.staffId).toBe("staff-alice"));
        expect(slots.length).toBeGreaterThan(0);
      },
    },
  ],
};
