import { eq, gte } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";

export async function listUpcomingTimeBlocks() {
  return db
    .select()
    .from(schema.timeBlocks)
    .where(gte(schema.timeBlocks.endAt, new Date()))
    .orderBy(schema.timeBlocks.startAt);
}

export async function createTimeBlock(input: {
  staffId: string;
  startAt: Date;
  endAt: Date;
  reason?: string | null;
}) {
  const rows = await db
    .insert(schema.timeBlocks)
    .values({
      staffId: input.staffId,
      startAt: input.startAt,
      endAt: input.endAt,
      reason: input.reason ?? null,
    })
    .returning();

  return rows[0];
}

export async function deleteTimeBlock(id: string) {
  await db.delete(schema.timeBlocks).where(eq(schema.timeBlocks.id, id));
  return { ok: true };
}
