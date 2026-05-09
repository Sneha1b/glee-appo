import { and, count, eq, gte, lte, sql, sum } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";

export async function getBusinessMetrics(input: {
  businessId: string;
  from?: Date;
  to?: Date;
}) {
  const bookingFilters = [eq(schema.bookings.businessId, input.businessId)];
  const invoiceFilters = [eq(schema.invoices.businessId, input.businessId)];

  if (input.from) {
    bookingFilters.push(gte(schema.bookings.startAt, input.from));
    invoiceFilters.push(gte(schema.invoices.issuedAt, input.from));
  }

  if (input.to) {
    bookingFilters.push(lte(schema.bookings.startAt, input.to));
    invoiceFilters.push(lte(schema.invoices.issuedAt, input.to));
  }

  const [bookingMetrics] = await db
    .select({
      totalBookings: count(schema.bookings.id),
      confirmedBookings: sql<number>`
        count(*) filter (where ${schema.bookings.status} = 'confirmed')
      `,
      cancelledBookings: sql<number>`
        count(*) filter (where ${schema.bookings.status} = 'cancelled')
      `,
    })
    .from(schema.bookings)
    .where(and(...bookingFilters));

  const [invoiceMetrics] = await db
    .select({
      totalRevenue: sum(schema.invoices.total),
      invoiceCount: count(schema.invoices.id),
    })
    .from(schema.invoices)
    .where(and(...invoiceFilters));

  return {
    totalBookings: Number(bookingMetrics?.totalBookings ?? 0),
    confirmedBookings: Number(bookingMetrics?.confirmedBookings ?? 0),
    cancelledBookings: Number(bookingMetrics?.cancelledBookings ?? 0),
    invoiceCount: Number(invoiceMetrics?.invoiceCount ?? 0),
    totalRevenue: Number(invoiceMetrics?.totalRevenue ?? 0),
  };
}

export async function getRichBusinessMetrics(input: {
  businessId: string;
  windowDays: number;
}) {
  const since = new Date(Date.now() - input.windowDays * 86400_000);

  const bookingsRows = await db
    .select({
      id: schema.bookings.id,
      startAt: schema.bookings.startAt,
      status: schema.bookings.status,
      serviceName: schema.services.name,
    })
    .from(schema.bookings)
    .innerJoin(schema.services, eq(schema.bookings.serviceId, schema.services.id))
    .where(
      and(
        eq(schema.bookings.businessId, input.businessId),
        gte(schema.bookings.startAt, since),
      ),
    );

  const confirmed = bookingsRows.filter((b) => b.status === "confirmed");

  const topMap = new Map<string, number>();
  const dowMap = new Map<number, number>();
  const hourMap = new Map<number, number>();
  for (const b of confirmed) {
    topMap.set(b.serviceName, (topMap.get(b.serviceName) ?? 0) + 1);
    dowMap.set(b.startAt.getDay(), (dowMap.get(b.startAt.getDay()) ?? 0) + 1);
    hourMap.set(b.startAt.getHours(), (hourMap.get(b.startAt.getHours()) ?? 0) + 1);
  }

  const top_services = [...topMap.entries()]
    .map(([name, bookings]) => ({ name, bookings }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 8);
  const busy_dow = [...dowMap.entries()]
    .map(([dow, bookings]) => ({ dow, bookings }));
  const busy_hour = [...hourMap.entries()]
    .map(([hour, bookings]) => ({ hour, bookings }));

  // Rough funnel from slot_locks vs confirmed bookings
  const lockRows = await db
    .select({ count: count(schema.slotLocks.id) })
    .from(schema.slotLocks)
    .where(gte(schema.slotLocks.createdAt, since));
  const lockTotal = Number(lockRows[0]?.count ?? 0);

  return {
    window_days: input.windowDays,
    top_services,
    busy_dow,
    busy_hour,
    funnel: {
      total_lock_attempts: lockTotal,
      confirmed_bookings: confirmed.length,
      abandoned_attempts: Math.max(0, lockTotal - confirmed.length),
      avg_time_to_complete_seconds: 0,
    },
  };
}
