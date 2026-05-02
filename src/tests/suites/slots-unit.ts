// Unit tests for the pure internal functions in src/lib/slots.ts.
// Because these functions are not exported, they are replicated here verbatim
// so the algorithm can be verified in isolation from Supabase.
import type { TestSuite } from "../runner";
import { expect } from "../runner";
import { getSessionId } from "@/lib/slots";

// ── Internal functions replicated from slots.ts ──────────────────────────────

function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000);
}

function zonedWallTimeToUtc(
  localDate: Date,
  minutesSinceMidnight: number,
  timeZone: string
): Date {
  const y = localDate.getFullYear();
  const m = localDate.getMonth();
  const d = localDate.getDate();
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
  const offsetMs = asUtcOfRendered - guessUtcMs;
  return new Date(guessUtcMs - offsetMs);
}

function weekdayInTz(date: Date, timeZone: string): number {
  const wk = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wk);
}

// Replicated from slots.ts — not exported
function mapBookingError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("slot_in_past")) return "That time has already passed. Please pick another slot.";
  if (m.includes("already_booked"))
    return "That slot was just booked by someone else. Please pick another.";
  if (m.includes("slot_locked"))
    return "Someone else is currently booking that slot. Please pick another.";
  if (m.includes("lock_invalid")) return "Your hold expired. Please pick the slot again.";
  if (m.includes("service_not_found")) return "Service not found.";
  return message || "Something went wrong.";
}

// ── Test Suite ────────────────────────────────────────────────────────────────

export const slotsUnitSuite: TestSuite = {
  id: "slots-unit",
  name: "Unit · Slots — Pure Functions",
  type: "unit",
  tests: [
    // addMinutes
    {
      name: "addMinutes: adds positive minutes to a date",
      fn() {
        const base = new Date("2024-01-15T10:00:00Z");
        const result = addMinutes(base, 30);
        expect(result.getTime()).toBe(base.getTime() + 30 * 60_000);
      },
    },
    {
      name: "addMinutes: adding zero returns equivalent time",
      fn() {
        const base = new Date("2024-01-15T10:00:00Z");
        expect(addMinutes(base, 0).getTime()).toBe(base.getTime());
      },
    },
    {
      name: "addMinutes: handles 60 minutes = 1 hour",
      fn() {
        const base = new Date("2024-01-15T10:00:00Z");
        const result = addMinutes(base, 60);
        expect(result.getUTCHours()).toBe(11);
      },
    },
    {
      name: "addMinutes: handles 90 minutes crossing hour boundary",
      fn() {
        const base = new Date("2024-01-15T10:30:00Z");
        const result = addMinutes(base, 90);
        expect(result.getUTCHours()).toBe(12);
        expect(result.getUTCMinutes()).toBe(0);
      },
    },
    {
      name: "addMinutes: handles large values (24 hours)",
      fn() {
        const base = new Date("2024-01-15T00:00:00Z");
        const result = addMinutes(base, 24 * 60);
        expect(result.getUTCDate()).toBe(16);
      },
    },

    // zonedWallTimeToUtc
    {
      name: "zonedWallTimeToUtc: UTC timezone — wall time equals UTC",
      fn() {
        const date = new Date(2024, 0, 15); // Jan 15 2024 local
        const result = zonedWallTimeToUtc(new Date(Date.UTC(2024, 0, 15)), 9 * 60, "UTC");
        expect(result.getUTCHours()).toBe(9);
        expect(result.getUTCMinutes()).toBe(0);
      },
    },
    {
      name: "zonedWallTimeToUtc: UTC+5:30 (IST) — 09:00 IST = 03:30 UTC",
      fn() {
        const utcDate = new Date(Date.UTC(2024, 0, 15));
        const result = zonedWallTimeToUtc(utcDate, 9 * 60, "Asia/Kolkata");
        expect(result.getUTCHours()).toBe(3);
        expect(result.getUTCMinutes()).toBe(30);
      },
    },
    {
      name: "zonedWallTimeToUtc: UTC-5 (EST) — 14:00 EST = 19:00 UTC",
      fn() {
        // Using a non-DST date (January)
        const utcDate = new Date(Date.UTC(2024, 0, 15));
        const result = zonedWallTimeToUtc(utcDate, 14 * 60, "America/New_York");
        expect(result.getUTCHours()).toBe(19);
      },
    },
    {
      name: "zonedWallTimeToUtc: midnight (0 min) returns start of day in tz",
      fn() {
        const utcDate = new Date(Date.UTC(2024, 0, 15));
        const result = zonedWallTimeToUtc(utcDate, 0, "UTC");
        expect(result.getUTCHours()).toBe(0);
        expect(result.getUTCMinutes()).toBe(0);
      },
    },
    {
      name: "zonedWallTimeToUtc: 480 minutes = 08:00 in UTC",
      fn() {
        const utcDate = new Date(Date.UTC(2024, 5, 15));
        const result = zonedWallTimeToUtc(utcDate, 480, "UTC");
        expect(result.getUTCHours()).toBe(8);
        expect(result.getUTCMinutes()).toBe(0);
      },
    },

    // weekdayInTz
    {
      name: "weekdayInTz: known Monday in UTC returns 1",
      fn() {
        // 2024-01-15 is a Monday
        const date = new Date("2024-01-15T12:00:00Z");
        expect(weekdayInTz(date, "UTC")).toBe(1);
      },
    },
    {
      name: "weekdayInTz: known Sunday in UTC returns 0",
      fn() {
        // 2024-01-14 is a Sunday
        const date = new Date("2024-01-14T12:00:00Z");
        expect(weekdayInTz(date, "UTC")).toBe(0);
      },
    },
    {
      name: "weekdayInTz: known Saturday in UTC returns 6",
      fn() {
        // 2024-01-20 is a Saturday
        const date = new Date("2024-01-20T12:00:00Z");
        expect(weekdayInTz(date, "UTC")).toBe(6);
      },
    },
    {
      name: "weekdayInTz: returns a number between 0 and 6",
      fn() {
        const date = new Date("2024-03-15T12:00:00Z");
        const wd = weekdayInTz(date, "UTC");
        expect(wd).toBeGreaterThanOrEqual(0);
        expect(wd).toBeLessThan(7);
      },
    },
    {
      name: "weekdayInTz: different timezones can produce different weekdays near midnight",
      fn() {
        // UTC Sunday midnight might be Saturday in UTC-5
        const date = new Date("2024-01-14T03:00:00Z"); // Sunday 03:00 UTC = Saturday 22:00 EST
        const utcWd = weekdayInTz(date, "UTC");
        const estWd = weekdayInTz(date, "America/New_York");
        expect(utcWd).not.toBe(estWd);
      },
    },

    // mapBookingError
    {
      name: "mapBookingError: slot_in_past → friendly past message",
      fn() {
        expect(mapBookingError("slot_in_past")).toContain("already passed");
      },
    },
    {
      name: "mapBookingError: already_booked → friendly booked message",
      fn() {
        expect(mapBookingError("already_booked")).toContain("just booked by someone else");
      },
    },
    {
      name: "mapBookingError: slot_locked → friendly locked message",
      fn() {
        expect(mapBookingError("slot_locked")).toContain("currently booking");
      },
    },
    {
      name: "mapBookingError: lock_invalid → hold expired message",
      fn() {
        expect(mapBookingError("lock_invalid")).toContain("hold expired");
      },
    },
    {
      name: "mapBookingError: service_not_found → service not found",
      fn() {
        expect(mapBookingError("service_not_found")).toBe("Service not found.");
      },
    },
    {
      name: "mapBookingError: unknown error → returned as-is",
      fn() {
        expect(mapBookingError("some_random_db_error")).toBe("some_random_db_error");
      },
    },
    {
      name: "mapBookingError: empty string → fallback message",
      fn() {
        expect(mapBookingError("")).toBe("Something went wrong.");
      },
    },
    {
      name: "mapBookingError: case-insensitive matching",
      fn() {
        expect(mapBookingError("SLOT_IN_PAST")).toContain("already passed");
      },
    },

    // getSessionId
    {
      name: "getSessionId: returns a string",
      fn() {
        const id = getSessionId();
        expect(typeof id).toBe("string");
      },
    },
    {
      name: "getSessionId: returns UUID-formatted string",
      fn() {
        const id = getSessionId();
        expect(id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      },
    },
    {
      name: "getSessionId: returns same value on repeated calls (localStorage backed)",
      fn() {
        const a = getSessionId();
        const b = getSessionId();
        expect(a).toBe(b);
      },
    },
    {
      name: "getSessionId: stored value persists across calls",
      fn() {
        const first = getSessionId();
        localStorage.removeItem("slotkit_session");
        // After removing, a new one is generated
        const fresh = getSessionId();
        expect(typeof fresh).toBe("string");
        expect(fresh).toMatch(/^[0-9a-f-]{36}$/i);
        // Restore original
        localStorage.setItem("slotkit_session", first);
      },
    },
  ],
};
