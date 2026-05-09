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
