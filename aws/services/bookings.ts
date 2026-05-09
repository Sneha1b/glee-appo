import { and, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";

export async function listBookingsByBusiness(businessId: string) {
  return db.select().from(schema.bookings).where(eq(schema.bookings.businessId, businessId));
}

export async function listBookingsForStaffInRange(input: {
  staffId: string;
  startAt: Date;
  endAt: Date;
}) {
  return db
    .select()
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.staffId, input.staffId),
        gte(schema.bookings.startAt, input.startAt),
        lt(schema.bookings.startAt, input.endAt),
      ),
    );
}

export async function getBookingById(id: string) {
  const rows = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getBookingDetails(id: string) {
  const rows = await db
    .select({
      booking: schema.bookings,
      service: schema.services,
      staff: schema.staff,
      business: schema.businesses,
    })
    .from(schema.bookings)
    .innerJoin(schema.services, eq(schema.bookings.serviceId, schema.services.id))
    .innerJoin(schema.staff, eq(schema.bookings.staffId, schema.staff.id))
    .innerJoin(schema.businesses, eq(schema.bookings.businessId, schema.businesses.id))
    .where(eq(schema.bookings.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createBooking(input: {
  businessId: string;
  serviceId: string;
  staffId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  startAt: Date;
  endAt: Date;
}) {
  const rows = await db
    .insert(schema.bookings)
    .values({
      businessId: input.businessId,
      serviceId: input.serviceId,
      staffId: input.staffId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      status: "confirmed",
    })
    .returning();
  return rows[0];
}

export async function cancelBooking(id: string) {
  const rows = await db
    .update(schema.bookings)
    .set({ status: "cancelled" })
    .where(eq(schema.bookings.id, id))
    .returning();
  return rows[0] ?? null;
}
