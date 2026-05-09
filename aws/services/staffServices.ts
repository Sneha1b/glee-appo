import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/client";

export async function listStaffByBusiness(businessId: string) {
  return db
    .select()
    .from(schema.staff)
    .where(eq(schema.staff.businessId, businessId))
    .orderBy(schema.staff.name);
}

export async function createStaff(input: {
  businessId: string;
  name: string;
}) {
  const rows = await db
    .insert(schema.staff)
    .values({
      businessId: input.businessId,
      name: input.name,
    })
    .returning();

  return rows[0];
}

export async function deleteStaff(staffId: string) {
  await db.delete(schema.staff).where(eq(schema.staff.id, staffId));
  return { ok: true };
}

export async function listStaffServiceLinks(staffId: string) {
  return db
    .select()
    .from(schema.staffServices)
    .where(eq(schema.staffServices.staffId, staffId));
}

export async function assignServiceToStaff(input: {
  staffId: string;
  serviceId: string;
}) {
  await db
    .insert(schema.staffServices)
    .values({
      staffId: input.staffId,
      serviceId: input.serviceId,
    })
    .onConflictDoNothing();

  return { ok: true };
}

export async function removeServiceFromStaff(input: {
  staffId: string;
  serviceId: string;
}) {
  await db
    .delete(schema.staffServices)
    .where(
      and(
        eq(schema.staffServices.staffId, input.staffId),
        eq(schema.staffServices.serviceId, input.serviceId),
      ),
    );

  return { ok: true };
}

export async function listAvailabilities(staffId: string) {
  return db
    .select()
    .from(schema.availabilities)
    .where(eq(schema.availabilities.staffId, staffId))
    .orderBy(schema.availabilities.weekday, schema.availabilities.startMinute);
}

export async function replaceAvailabilityForWeekday(input: {
  staffId: string;
  weekday: number;
  startMinute?: number | null;
  endMinute?: number | null;
}) {
  await db
    .delete(schema.availabilities)
    .where(
      and(
        eq(schema.availabilities.staffId, input.staffId),
        eq(schema.availabilities.weekday, input.weekday),
      ),
    );

  if (input.startMinute == null || input.endMinute == null) {
    return { ok: true };
  }

  await db.insert(schema.availabilities).values({
    staffId: input.staffId,
    weekday: input.weekday,
    startMinute: input.startMinute,
    endMinute: input.endMinute,
  });

  return { ok: true };
}
