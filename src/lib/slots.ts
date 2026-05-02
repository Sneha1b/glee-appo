// Slot computation (FR-4): availability − bookings − blocks, in service-duration increments.
// Runs client-side against the publishable Supabase client.
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

export async function computeSlots(opts: {
  serviceId: string;
  durationMin: number;
  date: Date; // local date (we treat as business-local; v1 uses UTC-equivalent)
  staffIdFilter?: string | null;
}): Promise<Slot[]> {
  const { serviceId, durationMin, date, staffIdFilter } = opts;

  // Day window in UTC (PRD §5: store UTC; v1 demo treats local==UTC)
  const dayStart = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const weekday = dayStart.getUTCDay(); // 0=Sun..6=Sat

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

  // Check store-level closure first — if today is closed, no slots.
  const dateStr = `${dayStart.getUTCFullYear()}-${String(dayStart.getUTCMonth() + 1).padStart(2, "0")}-${String(dayStart.getUTCDate()).padStart(2, "0")}`;
  const { data: closures } = await supabase
    .from("business_closures")
    .select("from_date,to_date")
    .eq("business_id", businessId)
    .lte("from_date", dateStr)
    .gte("to_date", dateStr);
  if ((closures?.length ?? 0) > 0) return [];

  // Store hours for this weekday (if configured) constrain everything
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

  const now = Date.now();
  const out: Slot[] = [];

  for (const staff of staffList) {
    const windows = avRes.data?.filter((a) => a.staff_id === staff.id) ?? [];
    const busy = busyByStaff[staff.id] ?? [];

    for (const w of windows) {
      // Intersect staff window with store hours (if configured)
      const effStart = storeHours ? Math.max(w.start_minute, storeHours.open_minute) : w.start_minute;
      const effEnd = storeHours ? Math.min(w.end_minute, storeHours.close_minute) : w.end_minute;
      if (effEnd <= effStart) continue;
      const winStart = addMinutes(dayStart, effStart);
      const winEnd = addMinutes(dayStart, effEnd);
      for (
        let t = winStart.getTime();
        t + durationMin * 60_000 <= winEnd.getTime();
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
  if (error) throw error;
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
  if (error) throw error;
  // Fire-and-forget: send confirmation email + ICS + create invoice
  if (data && (data as any).id) {
    supabase.functions.invoke("booking-confirmation", { body: { bookingId: (data as any).id } })
      .catch((e) => console.warn("booking-confirmation failed", e));
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
