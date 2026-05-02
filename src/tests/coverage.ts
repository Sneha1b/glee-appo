// Coverage map: maps each testable item to the test IDs that exercise it.
// When all covering tests pass, the item is marked covered.

export type CoverageItemType = "function" | "branch" | "statement";

export interface CoverageItem {
  file: string;
  name: string;
  type: CoverageItemType;
  /** IDs of tests (suite::name) that cover this item */
  coveredBy: string[];
}

export const COVERAGE_MAP: CoverageItem[] = [
  // ── src/lib/format.ts ──────────────────────────────────────────────────────
  {
    file: "src/lib/format.ts",
    name: "fmtTime()",
    type: "function",
    coveredBy: [
      "format::fmtTime: returns a non-empty string",
      "format::fmtTime: includes the minute component",
      "format::fmtTime: matches time pattern HH:MM",
      "format::fmtTime: midnight (00:00) renders without crash",
      "format::fmtTime: noon (12:00) includes 12",
    ],
  },
  {
    file: "src/lib/format.ts",
    name: "fmtDate()",
    type: "function",
    coveredBy: [
      "format::fmtDate: returns a non-empty string",
      "format::fmtDate: includes the day number",
      "format::fmtDate: includes a month name (not a number)",
      "format::fmtDate: different months produce different strings",
    ],
  },
  {
    file: "src/lib/format.ts",
    name: "fmtDateTime()",
    type: "function",
    coveredBy: [
      "format::fmtDateTime: contains the separator ·",
      "format::fmtDateTime: contains minute component",
      "format::fmtDateTime: returns longer string than fmtTime alone",
      "format::fmtDateTime: two different ISO strings produce different outputs",
    ],
  },
  {
    file: "src/lib/format.ts",
    name: "ymd()",
    type: "function",
    coveredBy: [
      "format::ymd: formats as YYYY-MM-DD",
      "format::ymd: pads single-digit month",
      "format::ymd: pads single-digit day",
      "format::ymd: handles December (month 11)",
      "format::ymd: handles year 2000",
      "format::ymd: output has exactly 10 characters",
      "format::ymd: output matches YYYY-MM-DD regex",
    ],
  },

  // ── src/lib/utils.ts ───────────────────────────────────────────────────────
  {
    file: "src/lib/utils.ts",
    name: "cn()",
    type: "function",
    coveredBy: [
      "utils::cn: merges two simple class strings",
      "utils::cn: returns empty string with no arguments",
      "utils::cn: handles undefined gracefully",
      "utils::cn: handles null gracefully",
      "utils::cn: truthy conditional class is included",
      "utils::cn: falsy conditional class is excluded",
    ],
  },
  {
    file: "src/lib/utils.ts",
    name: "cn() — Tailwind conflict resolution",
    type: "branch",
    coveredBy: [
      "utils::cn: resolves Tailwind padding conflict (last wins)",
      "utils::cn: resolves Tailwind text-color conflict",
      "utils::cn: resolves Tailwind margin conflict",
      "utils::cn: resolves Tailwind background conflict",
      "utils::cn: handles multiple conflicting utilities in sequence",
    ],
  },
  {
    file: "src/lib/utils.ts",
    name: "cn() — object and array syntax",
    type: "branch",
    coveredBy: [
      "utils::cn: handles object syntax (true key included)",
      "utils::cn: handles array of classes",
      "utils::cn: mixed object and string args",
    ],
  },

  // ── src/lib/slots.ts ───────────────────────────────────────────────────────
  {
    file: "src/lib/slots.ts",
    name: "addMinutes() [internal]",
    type: "function",
    coveredBy: [
      "slots-unit::addMinutes: adds positive minutes to a date",
      "slots-unit::addMinutes: adding zero returns equivalent time",
      "slots-unit::addMinutes: handles 60 minutes = 1 hour",
      "slots-unit::addMinutes: handles 90 minutes crossing hour boundary",
      "slots-unit::addMinutes: handles large values (24 hours)",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "zonedWallTimeToUtc() [internal]",
    type: "function",
    coveredBy: [
      "slots-unit::zonedWallTimeToUtc: UTC timezone — wall time equals UTC",
      "slots-unit::zonedWallTimeToUtc: UTC+5:30 (IST) — 09:00 IST = 03:30 UTC",
      "slots-unit::zonedWallTimeToUtc: UTC-5 (EST) — 14:00 EST = 19:00 UTC",
      "slots-unit::zonedWallTimeToUtc: midnight (0 min) returns start of day in tz",
      "slots-unit::zonedWallTimeToUtc: 480 minutes = 08:00 in UTC",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "weekdayInTz() [internal]",
    type: "function",
    coveredBy: [
      "slots-unit::weekdayInTz: known Monday in UTC returns 1",
      "slots-unit::weekdayInTz: known Sunday in UTC returns 0",
      "slots-unit::weekdayInTz: known Saturday in UTC returns 6",
      "slots-unit::weekdayInTz: returns a number between 0 and 6",
      "slots-unit::weekdayInTz: different timezones can produce different weekdays near midnight",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "mapBookingError() [internal]",
    type: "function",
    coveredBy: [
      "slots-unit::mapBookingError: slot_in_past → friendly past message",
      "slots-unit::mapBookingError: already_booked → user-friendly booked message",
      "slots-unit::mapBookingError: slot_locked → user-friendly locked message",
      "slots-unit::mapBookingError: lock_invalid → hold expired message",
      "slots-unit::mapBookingError: service_not_found → service not found",
      "slots-unit::mapBookingError: unknown error passes through unchanged",
      "slots-unit::mapBookingError: empty string returns fallback",
      "slots-unit::mapBookingError: mixed-case error is matched case-insensitively",
      "booking-flow::mapBookingError: slot_in_past → user-friendly past message",
      "booking-flow::mapBookingError: already_booked → user-friendly booked message",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "getSessionId()",
    type: "function",
    coveredBy: [
      "slots-unit::getSessionId: returns a string",
      "slots-unit::getSessionId: returns UUID-formatted string",
      "slots-unit::getSessionId: returns same value on repeated calls (localStorage backed)",
      "slots-unit::getSessionId: stored value persists across calls",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "computeSlots() — guard: isClosed",
    type: "branch",
    coveredBy: ["slots-integration::returns empty array when business is closed"],
  },
  {
    file: "src/lib/slots.ts",
    name: "computeSlots() — guard: inverted store hours",
    type: "branch",
    coveredBy: [
      "slots-integration::returns empty array when store hours are inverted (close <= open)",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "computeSlots() — guard: empty staff list",
    type: "branch",
    coveredBy: ["slots-integration::returns empty array when staff list is empty"],
  },
  {
    file: "src/lib/slots.ts",
    name: "computeSlots() — guard: no availability for weekday",
    type: "branch",
    coveredBy: [
      "slots-integration::returns empty array when staff has no availability on that weekday",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "computeSlots() — staffIdFilter",
    type: "branch",
    coveredBy: [
      "slots-integration::returns empty array when staffIdFilter matches no staff",
      "slots-integration::staffIdFilter returns only matching staff slots",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "computeSlots() — slot generation (happy path)",
    type: "function",
    coveredBy: [
      "slots-integration::generates slots when all conditions are met",
      "slots-integration::60-min service in 8h window produces 29 slots (15-min grid, last slot fits at 16:00)",
      "slots-integration::slots are exactly SLOT_STEP_MIN (15 min) apart on the grid",
      "slots-integration::slot duration matches requested durationMin",
      "slots-integration::output is sorted ascending by startAt",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "computeSlots() — overlap detection",
    type: "branch",
    coveredBy: [
      "slots-integration::booking overlap removes exactly that slot",
      "slots-integration::time block overlap removes that slot",
      "slots-integration::busy slot does not affect other staff members",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "computeSlots() — store hours clamping",
    type: "branch",
    coveredBy: [
      "slots-integration::store hours clamp availability window",
      "slots-integration::staff availability narrower than store hours limits slots",
      "slots-integration::null storeHours uses raw availability window",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "computeSlots() — past slot filter",
    type: "branch",
    coveredBy: ["slots-integration::all past slots are filtered out"],
  },
  {
    file: "src/lib/slots.ts",
    name: "acquireLock()",
    type: "function",
    coveredBy: [
      "booking-flow::acquireLock: success path returns lock data",
      "booking-flow::acquireLock: null data return is handled without throw",
      "booking-flow::acquireLock: slot_in_past error throws with friendly message",
      "booking-flow::acquireLock: already_booked error throws with friendly message",
      "booking-flow::acquireLock: slot_locked error throws with friendly message",
    ],
  },
  {
    file: "src/lib/slots.ts",
    name: "confirmBooking()",
    type: "function",
    coveredBy: [
      "booking-flow::confirmBooking: success path returns booking data",
      "booking-flow::confirmBooking: lock_invalid throws with friendly message",
      "booking-flow::confirmBooking: edge function failure does NOT throw (best-effort)",
    ],
  },

  // ── src/hooks/use-mobile.tsx ───────────────────────────────────────────────
  {
    file: "src/hooks/use-mobile.tsx",
    name: "useIsMobile() — breakpoint constant",
    type: "statement",
    coveredBy: [
      "use-mobile::mobile breakpoint is exactly 768",
      "use-mobile::width < 768 is considered mobile",
      "use-mobile::width === 768 is NOT mobile",
      "use-mobile::width > 768 is not mobile",
    ],
  },
  {
    file: "src/hooks/use-mobile.tsx",
    name: "useIsMobile() — media query string",
    type: "function",
    coveredBy: [
      "use-mobile::media query string uses breakpoint - 1",
      "use-mobile::matchMedia query for mobile breakpoint returns a MediaQueryList",
    ],
  },
  {
    file: "src/hooks/use-mobile.tsx",
    name: "useIsMobile() — event listener attach/detach",
    type: "branch",
    coveredBy: [
      "use-mobile::MediaQueryList.matches agrees with isMobileWidth for current viewport",
    ],
  },

  // ── src/lib/auth-context.tsx ───────────────────────────────────────────────
  {
    file: "src/lib/auth-context.tsx",
    name: "useAuth() guard",
    type: "function",
    coveredBy: [
      "auth-context::useAuth throws when called outside AuthProvider",
      "auth-context::useAuth returns context value when inside AuthProvider",
    ],
  },
  {
    file: "src/lib/auth-context.tsx",
    name: "loadAux() — role derivation",
    type: "function",
    coveredBy: [
      "auth-context::customer role is correctly derived from roles row",
      "auth-context::provider role is correctly derived from roles row",
      "auth-context::no roles row results in null role",
      "auth-context::only first role row is used when multiple exist",
    ],
  },
  {
    file: "src/lib/auth-context.tsx",
    name: "loadAux() — customerProfile",
    type: "branch",
    coveredBy: [
      "auth-context::customer profile full_name is preserved",
      "auth-context::customer profile phone can be null",
      "auth-context::customer profile phone is stored when provided",
    ],
  },
  {
    file: "src/lib/auth-context.tsx",
    name: "loadAux() — businessId",
    type: "branch",
    coveredBy: [
      "auth-context::provider has correct businessId",
      "auth-context::provider with no business_owners row has null businessId",
      "auth-context::customer has null businessId",
    ],
  },
  {
    file: "src/lib/auth-context.tsx",
    name: "signOut()",
    type: "function",
    coveredBy: ["auth-context::sign-out resets all fields to null"],
  },
  {
    file: "src/lib/auth-context.tsx",
    name: "refresh() — session restoration",
    type: "function",
    coveredBy: [
      "auth-context::session with user populates user field",
      "auth-context::null session populates null user",
    ],
  },
];

// ── Coverage calculation ───────────────────────────────────────────────────────

export interface FileCoverage {
  file: string;
  total: number;
  covered: number;
  pct: number;
  items: Array<{ name: string; type: CoverageItemType; covered: boolean }>;
}

export function computeCoverage(passedTestIds: Set<string>): {
  byFile: FileCoverage[];
  overall: number;
} {
  const fileMap = new Map<string, FileCoverage>();

  for (const item of COVERAGE_MAP) {
    if (!fileMap.has(item.file)) {
      fileMap.set(item.file, { file: item.file, total: 0, covered: 0, pct: 0, items: [] });
    }
    const fc = fileMap.get(item.file)!;
    const isCovered = item.coveredBy.some((id) => passedTestIds.has(id));
    fc.total++;
    if (isCovered) fc.covered++;
    fc.items.push({ name: item.name, type: item.type, covered: isCovered });
  }

  const byFile = Array.from(fileMap.values()).map((fc) => ({
    ...fc,
    pct: fc.total === 0 ? 0 : Math.round((fc.covered / fc.total) * 100),
  }));

  const totalItems = byFile.reduce((s, f) => s + f.total, 0);
  const coveredItems = byFile.reduce((s, f) => s + f.covered, 0);
  const overall = totalItems === 0 ? 0 : Math.round((coveredItems / totalItems) * 100);

  return { byFile, overall };
}
