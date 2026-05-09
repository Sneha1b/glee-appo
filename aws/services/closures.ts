import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";

export async function listActiveBusinessClosures(businessId: string) {
  return db
    .select()
    .from(schema.businessClosures)
    .where(
      and(
        eq(schema.businessClosures.businessId, businessId),
        gte(schema.businessClosures.toDate, new Date().toISOString().slice(0, 10)),
      ),
    )
    .orderBy(schema.businessClosures.fromDate);
}

export async function createBusinessClosure(input: {
  businessId: string;
  fromDate: string;
  toDate: string;
  reason?: string | null;
}) {
  const rows = await db
    .insert(schema.businessClosures)
    .values({
      businessId: input.businessId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason ?? null,
    })
    .returning();

  return rows[0];
}

export async function deleteBusinessClosure(id: string) {
  await db
    .delete(schema.businessClosures)
    .where(eq(schema.businessClosures.id, id));

  return { ok: true };
}
