import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/client";

export async function listBusinessHours(businessId: string) {
  return db
    .select()
    .from(schema.businessHours)
    .where(eq(schema.businessHours.businessId, businessId))
    .orderBy(schema.businessHours.weekday);
}

export async function replaceBusinessHoursForWeekday(input: {
  businessId: string;
  weekday: number;
  openMinute?: number | null;
  closeMinute?: number | null;
}) {
  await db
    .delete(schema.businessHours)
    .where(
      and(
        eq(schema.businessHours.businessId, input.businessId),
        eq(schema.businessHours.weekday, input.weekday),
      ),
    );

  if (input.openMinute == null || input.closeMinute == null) {
    return { ok: true };
  }

  await db.insert(schema.businessHours).values({
    businessId: input.businessId,
    weekday: input.weekday,
    openMinute: input.openMinute,
    closeMinute: input.closeMinute,
  });

  return { ok: true };
}
