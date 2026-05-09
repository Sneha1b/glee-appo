// Client-side wrapper around server slot/booking functions.
// All authoritative logic lives server-side in src/lib/booking.functions.ts.
import {
  getDayAvailability,
  acquireLockFn,
  releaseLockFn,
  confirmBookingFn,
} from "@/lib/booking.functions";

export type Slot = {
  staffId: string;
  staffName: string;
  startAt: string; // ISO
  endAt: string; // ISO
};

export async function computeSlots(opts: {
  serviceId: string;
  durationMin: number;
  date: Date;
  staffIdFilter?: string | null;
}): Promise<Slot[]> {
  return getDayAvailability({
    data: {
      serviceId: opts.serviceId,
      date: opts.date.toISOString(),
      staffIdFilter: opts.staffIdFilter ?? null,
    },
  });
}

export async function findNextAvailableDay(opts: {
  serviceId: string;
  durationMin: number;
  fromDate: Date;
  horizonDays: number;
  staffIdFilter?: string | null;
}): Promise<{ date: Date; slots: Slot[] } | null> {
  for (let i = 0; i < opts.horizonDays; i++) {
    const d = new Date(opts.fromDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const slots = await computeSlots({
      serviceId: opts.serviceId,
      durationMin: opts.durationMin,
      date: d,
      staffIdFilter: opts.staffIdFilter,
    });
    if (slots.length > 0) return { date: d, slots };
  }
  return null;
}

function mapBookingError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("slot_in_past")) return "That time has already passed. Please pick another slot.";
  if (m.includes("already_booked")) return "That slot was just booked by someone else. Please pick another.";
  if (m.includes("slot_locked")) return "Someone else is currently booking that slot. Please pick another.";
  if (m.includes("lock_invalid")) return "Your hold expired. Please pick the slot again.";
  if (m.includes("service_not_found")) return "Service not found.";
  return message || "Something went wrong.";
}

export async function acquireLock(args: {
  holder: string;
  staffId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
}) {
  try {
    return await acquireLockFn({
      data: {
        holderSessionId: args.holder,
        staffId: args.staffId,
        serviceId: args.serviceId,
        startAt: args.startAt,
        endAt: args.endAt,
      },
    });
  } catch (e: any) {
    throw new Error(mapBookingError(e?.message ?? ""));
  }
}

export async function releaseLock(holder: string, staffId: string, startAt: string) {
  try {
    await releaseLockFn({ data: { holderSessionId: holder, staffId, startAt } });
  } catch (e) {
    console.warn("releaseLock", e);
  }
}

export async function confirmBooking(args: {
  holder: string;
  serviceId: string;
  staffId: string;
  startAt: string;
  name: string;
  email: string;
  phone?: string;
}) {
  try {
    return await confirmBookingFn({
      data: {
        holderSessionId: args.holder,
        serviceId: args.serviceId,
        staffId: args.staffId,
        startAt: args.startAt,
        name: args.name,
        email: args.email,
        phone: args.phone,
      },
    });
  } catch (e: any) {
    throw new Error(mapBookingError(e?.message ?? ""));
  }
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
