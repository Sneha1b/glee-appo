/**
 * Booking server fns: slot computation, locks, confirm, payment finalize, lookups.
 * Thin: createServerFn + helpers only. Server-only logic lives in aws/services.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, gt, gte, inArray, lt, desc } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";
import { acquireSlotLock, releaseSlotLock, confirmBooking } from "@/aws/services/slots";
import { getBookingDetails } from "@/aws/services/bookings";
import {
  getInvoiceByBookingId,
  createInvoice,
  listInvoicesByCustomerEmail,
} from "@/aws/services/invoices";
import { getBusinessesByIds } from "@/aws/services/businesses";
import { requireUser } from "@/aws/auth/server";

const SLOT_STEP_MIN = 15;

function zonedWallTimeToUtc(localDate: Date, minutesSinceMidnight: number, tz: string): Date {
  const y = localDate.getFullYear();
  const m = localDate.getMonth();
  const d = localDate.getDate();
  const hh = Math.floor(minutesSinceMidnight / 60);
  const mm = minutesSinceMidnight % 60;
  const guess = Date.UTC(y, m, d, hh, mm, 0);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offset = asUtc - guess;
  return new Date(guess - offset);
}

function weekdayInTz(date: Date, tz: string): number {
  const wk = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wk);
}

export const getDayAvailability = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { serviceId: string; date: string; staffIdFilter?: string | null }) =>
      z
        .object({
          serviceId: z.string().uuid(),
          date: z.string(), // ISO
          staffIdFilter: z.string().uuid().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const date = new Date(data.date);

    const svc = (
      await db.select().from(schema.services).where(eq(schema.services.id, data.serviceId)).limit(1)
    )[0];
    if (!svc) return [];
    const durationMin = svc.durationMin;

    const staffLinks = await db
      .select({
        staffId: schema.staff.id,
        name: schema.staff.name,
        businessId: schema.staff.businessId,
      })
      .from(schema.staffServices)
      .innerJoin(schema.staff, eq(schema.staffServices.staffId, schema.staff.id))
      .where(eq(schema.staffServices.serviceId, data.serviceId));
    let staffList = staffLinks;
    if (data.staffIdFilter) staffList = staffList.filter((s) => s.staffId === data.staffIdFilter);
    if (staffList.length === 0) return [];
    const staffIds = staffList.map((s) => s.staffId);
    const businessId = staffList[0].businessId;

    const biz = (
      await db.select().from(schema.businesses).where(eq(schema.businesses.id, businessId)).limit(1)
    )[0];
    const tz = biz?.timezone || "UTC";

    const dayStart = zonedWallTimeToUtc(date, 0, tz);
    const dayEnd = zonedWallTimeToUtc(date, 24 * 60, tz);
    const weekday = weekdayInTz(dayStart, tz);

    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);

    const closures = await db
      .select()
      .from(schema.businessClosures)
      .where(
        and(
          eq(schema.businessClosures.businessId, businessId),
          lt(schema.businessClosures.fromDate, dateStr as any),
          gt(schema.businessClosures.toDate, dateStr as any),
        ),
      );
    if (closures.length > 0) return [];

    const storeHoursRows = await db
      .select()
      .from(schema.businessHours)
      .where(
        and(
          eq(schema.businessHours.businessId, businessId),
          eq(schema.businessHours.weekday, weekday),
        ),
      )
      .limit(1);
    const storeHours = storeHoursRows[0] ?? null;
    if (storeHours && storeHours.closeMinute <= storeHours.openMinute) return [];

    const [avs, bks, blks, lks] = await Promise.all([
      db
        .select()
        .from(schema.availabilities)
        .where(
          and(
            inArray(schema.availabilities.staffId, staffIds),
            eq(schema.availabilities.weekday, weekday),
          ),
        ),
      db
        .select()
        .from(schema.bookings)
        .where(
          and(
            inArray(schema.bookings.staffId, staffIds),
            gte(schema.bookings.startAt, dayStart),
            lt(schema.bookings.startAt, dayEnd),
            eq(schema.bookings.status, "confirmed"),
          ),
        ),
      db
        .select()
        .from(schema.timeBlocks)
        .where(
          and(
            inArray(schema.timeBlocks.staffId, staffIds),
            lt(schema.timeBlocks.startAt, dayEnd),
            gt(schema.timeBlocks.endAt, dayStart),
          ),
        ),
      db
        .select()
        .from(schema.slotLocks)
        .where(
          and(
            inArray(schema.slotLocks.staffId, staffIds),
            gte(schema.slotLocks.startAt, dayStart),
            lt(schema.slotLocks.startAt, dayEnd),
            gt(schema.slotLocks.expiresAt, new Date()),
          ),
        ),
    ]);

    const busyByStaff: Record<string, Array<[number, number]>> = {};
    const pushBusy = (sid: string, s: Date, e: Date) => {
      (busyByStaff[sid] ??= []).push([s.getTime(), e.getTime()]);
    };
    bks.forEach((r) => pushBusy(r.staffId, r.startAt, r.endAt));
    blks.forEach((r) => pushBusy(r.staffId, r.startAt, r.endAt));
    lks.forEach((r) => pushBusy(r.staffId, r.startAt, r.endAt));

    const now = Date.now();
    const out: Array<{ staffId: string; staffName: string; startAt: string; endAt: string }> = [];

    for (const staff of staffList) {
      const windows = avs.filter((a) => a.staffId === staff.staffId);
      const busy = busyByStaff[staff.staffId] ?? [];
      for (const w of windows) {
        const effStart = storeHours
          ? Math.max(w.startMinute, storeHours.openMinute)
          : w.startMinute;
        const effEnd = storeHours ? Math.min(w.endMinute, storeHours.closeMinute) : w.endMinute;
        if (effEnd <= effStart) continue;
        const winStartMs = zonedWallTimeToUtc(date, effStart, tz).getTime();
        const winEndMs = zonedWallTimeToUtc(date, effEnd, tz).getTime();
        for (let t = winStartMs; t + durationMin * 60_000 <= winEndMs; t += SLOT_STEP_MIN * 60_000) {
          const slotEnd = t + durationMin * 60_000;
          if (slotEnd <= now) continue;
          const overlaps = busy.some(([bs, be]) => t < be && slotEnd > bs);
          if (overlaps) continue;
          out.push({
            staffId: staff.staffId,
            staffName: staff.name,
            startAt: new Date(t).toISOString(),
            endAt: new Date(slotEnd).toISOString(),
          });
        }
      }
    }
    out.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return out;
  });

export const acquireLockFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      holderSessionId: string;
      staffId: string;
      serviceId: string;
      startAt: string;
      endAt: string;
    }) =>
      z
        .object({
          holderSessionId: z.string().min(8).max(128),
          staffId: z.string().uuid(),
          serviceId: z.string().uuid(),
          startAt: z.string(),
          endAt: z.string(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    if (startAt.getTime() <= Date.now()) {
      throw new Error("slot_in_past");
    }
    // Check existing booking
    const existing = await db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.staffId, data.staffId),
          eq(schema.bookings.startAt, startAt),
          eq(schema.bookings.status, "confirmed"),
        ),
      )
      .limit(1);
    if (existing[0]) throw new Error("already_booked");

    const lock = await acquireSlotLock({
      staffId: data.staffId,
      serviceId: data.serviceId,
      startAt,
      endAt,
      holderSessionId: data.holderSessionId,
      ttlMinutes: 10,
    });
    if (!lock) throw new Error("slot_locked");
    return { id: lock.id, expires_at: lock.expiresAt.toISOString() };
  });

export const releaseLockFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { holderSessionId: string; staffId: string; startAt: string }) =>
      z
        .object({
          holderSessionId: z.string().min(8).max(128),
          staffId: z.string().uuid(),
          startAt: z.string(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await releaseSlotLock({
      holderSessionId: data.holderSessionId,
      staffId: data.staffId,
      startAt: new Date(data.startAt),
    });
    return { ok: true };
  });

export const confirmBookingFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      holderSessionId: string;
      serviceId: string;
      staffId: string;
      startAt: string;
      name: string;
      email: string;
      phone?: string;
    }) =>
      z
        .object({
          holderSessionId: z.string().min(8).max(128),
          serviceId: z.string().uuid(),
          staffId: z.string().uuid(),
          startAt: z.string(),
          name: z.string().min(1).max(200),
          email: z.string().email().max(255),
          phone: z.string().max(40).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const startAt = new Date(data.startAt);
    if (startAt.getTime() <= Date.now()) throw new Error("slot_in_past");

    // Validate active lock
    const lockRows = await db
      .select()
      .from(schema.slotLocks)
      .where(
        and(
          eq(schema.slotLocks.staffId, data.staffId),
          eq(schema.slotLocks.startAt, startAt),
          eq(schema.slotLocks.holderSessionId, data.holderSessionId),
          gt(schema.slotLocks.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const lock = lockRows[0];
    if (!lock) throw new Error("lock_invalid");

    const svc = (
      await db.select().from(schema.services).where(eq(schema.services.id, data.serviceId)).limit(1)
    )[0];
    if (!svc) throw new Error("service_not_found");
    const endAt = new Date(startAt.getTime() + svc.durationMin * 60_000);

    const booking = await confirmBooking({
      businessId: svc.businessId,
      serviceId: data.serviceId,
      staffId: data.staffId,
      customerName: data.name,
      customerEmail: data.email,
      customerPhone: data.phone ?? null,
      startAt,
      endAt,
      holderSessionId: data.holderSessionId,
    });
    return { id: booking.id };
  });

export const getBookingPublic = createServerFn({ method: "GET" })
  .inputValidator((d: { bookingId: string }) =>
    z.object({ bookingId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const row = await getBookingDetails(data.bookingId);
    if (!row) return null;
    const { booking, service, staff, business } = row;
    return {
      id: booking.id,
      status: booking.status,
      start_at: booking.startAt.toISOString(),
      end_at: booking.endAt.toISOString(),
      customer_name: booking.customerName,
      customer_email: booking.customerEmail,
      customer_phone: booking.customerPhone,
      service: {
        id: service.id,
        name: service.name,
        duration_min: service.durationMin,
        price: Number(service.price),
      },
      staff: { id: staff.id, name: staff.name },
      business: {
        id: business.id,
        name: business.name,
        phone: business.phone,
        address_line1: business.addressLine1,
        address_line2: business.addressLine2,
        city: business.city,
        region: business.region,
        postal_code: business.postalCode,
        logo_url: business.logoUrl,
      },
    };
  });

export const finalizeBookingPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { bookingId: string }) =>
    z.object({ bookingId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const row = await getBookingDetails(data.bookingId);
    if (!row) return { ok: false, error: "Booking not found" };
    const { booking, service, staff, business } = row;

    let invoice = await getInvoiceByBookingId(booking.id);
    if (!invoice) {
      const total = String(Number(service.price).toFixed(2));
      const number = `INV-${Date.now().toString(36).toUpperCase()}`;
      invoice = await createInvoice({
        invoiceNumber: number,
        businessId: business.id,
        bookingId: booking.id,
        staffId: staff.id,
        serviceId: service.id,
        serviceName: service.name,
        staffName: staff.name,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        amount: total,
        tax: "0",
        total,
        currency: "USD",
        status: "issued",
        appointmentAt: booking.startAt,
      });
    }

    return {
      ok: true,
      booking: { id: booking.id, status: booking.status },
      invoice: invoice
        ? { id: invoice.id, invoice_number: invoice.invoiceNumber, total: Number(invoice.total) }
        : null,
      // Email sending is intentionally out of scope (no Resend wired up yet).
      emailStatus: "skipped" as const,
    };
  });

export const listMyReservations = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  const invoices = await listInvoicesByCustomerEmail(u.email);
  if (invoices.length === 0) return { invoices: [], businesses: [] };
  const businesses = await getBusinessesByIds(
    Array.from(new Set(invoices.map((i) => i.businessId))),
  );
  return {
    invoices: invoices.map((i) => ({
      id: i.id,
      business_id: i.businessId,
      service_name: i.serviceName,
      staff_name: i.staffName,
      appointment_at: i.appointmentAt.toISOString(),
      total: Number(i.total),
      currency: i.currency,
      status: i.status,
    })),
    businesses: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      logo_url: b.logoUrl,
      city: b.city,
      region: b.region,
    })),
  };
});

// Used by route loaders that previously called listInvoicesByCustomerEmail desc
export const __orderHint = desc; // tree-shake guard against unused import
