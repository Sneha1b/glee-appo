import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";

export async function listStaffByBusiness(businessId: string) {
  return db
    .select()
    .from(schema.staff)
    .where(eq(schema.staff.businessId, businessId));
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
