// Slot computation (FR-4): availability − bookings − blocks, in service-duration increments.
// NOTE: Final correctness (overlap, lock validity, past-time) is enforced server-side in
// public.acquire_slot_lock and public.confirm_booking. The client-side computation is only
// for UI display; the server is authoritative.
import { supabase } from "@/integrations/supabase/client";

export type Slot = {
  staffId: string;
  staffName: string;
  startAt: string; // ISO
  endAt: string; // ISO
};

const SLOT_STEP_MIN = 15; // grid granularity

function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000);
}

// Compute the UTC instant for `localDate` at `minutesSinceMidnight` in the given IANA timezone.
// Uses Intl to discover the offset that timezone has at that wall-clock moment.
function zonedWallTimeToUtc(localDate: Date, minutesSinceMidnight: number, timeZone: string): Date {
  const y = localDate.getFullYear();
  const m = localDate.getMonth();
  const d = localDate.getDate();
  const hh = Math.floor(minutesSinceMidnight / 60);
  const mm = minutesSinceMidnight % 60;
  // Naive UTC guess for that wall clock
  const guessUtcMs = Date.UTC(y, m, d, hh, mm, 0);
  // Find what wall clock that UTC instant prints at in target tz
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date(guessUtcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtcOfRendered = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offsetMs = asUtcOfRendered - guessUtcMs; // tz offset at that instant
  return new Date(guessUtcMs - offsetMs);
}

// Weekday (0=Sun..6=Sat) for `date` interpreted in `timeZone`.
function weekdayInTz(date: Date, timeZone: string): number {
  const wk = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wk);
}

export async function computeSlots(opts: {
  serviceId: string;
  durationMin: number;
  date: Date; // local-picked calendar date; interpreted in business timezone
  staffIdFilter?: string | null;
}): Promise<Slot[]> {
  const { serviceId, durationMin, date, staffIdFilter } = opts;

  // Eligible staff = those who perform this service
  const { data: ss, error: e1 } = await supabase
    .from("staff_services")
    .select("staff_id, staff:staff_id(id, name, business_id)")
    .eq("service_id", serviceId);
  if (e1) throw e1;
  let staffList = (ss ?? [])
    .map((r: any) => ({ id: r.staff.id, name: r.staff.name, business_id: r.staff.business_id }))
    .filter((s) => (staffIdFilter ? s.id === staffIdFilter : true));
  if (staffList.length === 0) return [];
  const staffIds = staffList.map((s) => s.id);
  const businessId = staffList[0].business_id;

  // Resolve business timezone (default UTC)
  const { data: bz } = await supabase
    .from("businesses")
    .select("timezone")
    .eq("id", businessId)
    .maybeSingle();
  const tz = bz?.timezone || "UTC";

  // Day window in business-local time → convert to UTC instants
  const dayStart = zonedWallTimeToUtc(date, 0, tz);
  const dayEnd = zonedWallTimeToUtc(date, 24 * 60, tz);
  const weekday = weekdayInTz(dayStart, tz);

  // Closure check: compare against the business-local date string
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const { data: closures } = await supabase
    .from("business_closures")
    .select("from_date,to_date")
    .eq("business_id", businessId)
    .lte("from_date", dateStr)
    .gte("to_date", dateStr);
  if ((closures?.length ?? 0) > 0) return [];

  const { data: storeHours } = await supabase
    .from("business_hours")
    .select("open_minute,close_minute")
    .eq("business_id", businessId)
    .eq("weekday", weekday)
    .maybeSingle();
  if (storeHours && storeHours.close_minute <= storeHours.open_minute) return [];

  const [avRes, bkRes, blRes, lkRes] = await Promise.all([
    supabase.from("availabilities").select("*").in("staff_id", staffIds).eq("weekday", weekday),
    supabase.rpc("get_booked_slots", {
      p_staff_ids: staffIds,
      p_from: dayStart.toISOString(),
      p_to: dayEnd.toISOString(),
    }),
    supabase
      .from("time_blocks")
      .select("staff_id,start_at,end_at")
      .in("staff_id", staffIds)
      .lt("start_at", dayEnd.toISOString())
      .gt("end_at", dayStart.toISOString()),
    supabase.rpc("get_active_slot_locks", {
      p_staff_ids: staffIds,
      p_from: dayStart.toISOString(),
      p_to: dayEnd.toISOString(),
    }),
  ]);
  if (avRes.error) throw avRes.error;
  if (bkRes.error) throw bkRes.error;
  if (blRes.error) throw blRes.error;
  if (lkRes.error) throw lkRes.error;

  const busyByStaff: Record<string, Array<[number, number]>> = {};
  const pushBusy = (sid: string, s: string, e: string) => {
    (busyByStaff[sid] ??= []).push([new Date(s).getTime(), new Date(e).getTime()]);
  };
  bkRes.data?.forEach((r) => pushBusy(r.staff_id, r.start_at, r.end_at));
  blRes.data?.forEach((r) => pushBusy(r.staff_id, r.start_at, r.end_at));
  lkRes.data?.forEach((r) => pushBusy(r.staff_id, r.start_at, r.end_at));

  // Past-slot filter is best-effort UI only; server re-validates.
  const now = Date.now();
  const out: Slot[] = [];

  for (const staff of staffList) {
    const windows = avRes.data?.filter((a) => a.staff_id === staff.id) ?? [];
    const busy = busyByStaff[staff.id] ?? [];

    for (const w of windows) {
      const effStart = storeHours ? Math.max(w.start_minute, storeHours.open_minute) : w.start_minute;
      const effEnd = storeHours ? Math.min(w.end_minute, storeHours.close_minute) : w.end_minute;
      if (effEnd <= effStart) continue;
      // Convert window edges from business-local minutes → UTC instants
      const winStartMs = zonedWallTimeToUtc(date, effStart, tz).getTime();
      const winEndMs = zonedWallTimeToUtc(date, effEnd, tz).getTime();
      for (
        let t = winStartMs;
        t + durationMin * 60_000 <= winEndMs;
        t += SLOT_STEP_MIN * 60_000
      ) {
        const slotEnd = t + durationMin * 60_000;
        if (slotEnd <= now) continue;
        const overlaps = busy.some(([bs, be]) => t < be && slotEnd > bs);
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

// Friendly mapper for server-side validation errors
function mapBookingError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("slot_in_past")) return "That time has already passed. Please pick another slot.";
  if (m.includes("already_booked")) return "That slot was just booked by someone else. Please pick another.";
  if (m.includes("slot_locked")) return "Someone else is currently booking that slot. Please pick another.";
  if (m.includes("lock_invalid")) return "Your hold expired. Please pick the slot again.";
  if (m.includes("service_not_found")) return "Service not found.";
  return message || "Something went wrong.";
}

// FR-5
export async function acquireLock(args: {
  holder: string;
  staffId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
}) {
  const { data, error } = await supabase.rpc("acquire_slot_lock", {
    p_holder: args.holder,
    p_staff: args.staffId,
    p_service: args.serviceId,
    p_start: args.startAt,
    p_end: args.endAt,
  });
  if (error) throw new Error(mapBookingError(error.message));
  return data as { id: string; expires_at: string } | null;
}

// FR-6
export async function releaseLock(holder: string, staffId: string, startAt: string) {
  await supabase.rpc("release_slot_lock", {
    p_holder: holder,
    p_staff: staffId,
    p_start: startAt,
  });
}

// FR-7
export async function confirmBooking(args: {
  holder: string;
  serviceId: string;
  staffId: string;
  startAt: string;
  name: string;
  email: string;
  phone?: string;
}) {
  const { data, error } = await supabase.rpc("confirm_booking", {
    p_holder: args.holder,
    p_service: args.serviceId,
    p_staff: args.staffId,
    p_start: args.startAt,
    p_name: args.name,
    p_email: args.email,
    p_phone: args.phone ?? "",
  });
  if (error) throw new Error(mapBookingError(error.message));

  // Await confirmation/invoice; surface failures (booking still succeeded).
  if (data && (data as any).id) {
    try {
      const { error: fnErr } = await supabase.functions.invoke("booking-confirmation", {
        body: { bookingId: (data as any).id },
      });
      if (fnErr) console.warn("booking-confirmation failed", fnErr);
    } catch (e) {
      console.warn("booking-confirmation invoke threw", e);
    }
  }
  return data;
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem("slotkit_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("slotkit_session", id);
  }
  return id;
}
