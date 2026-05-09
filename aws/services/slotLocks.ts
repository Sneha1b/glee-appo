import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";

export async function createSlotLock(input: {
  staffId: string;
  serviceId: string;
  startAt: Date;
  endAt: Date;
  holderSessionId: string;
  expiresAt: Date;
}) {
  const rows = await db
    .insert(schema.slotLocks)
    .values({
      staffId: input.staffId,
      serviceId: input.serviceId,
      startAt: input.startAt,
      endAt: input.endAt,
      holderSessionId: input.holderSessionId,
      expiresAt: input.expiresAt,
    })
    .returning();

  return rows[0];
}

export async function getActiveSlotLock(input: {
  staffId: string;
  startAt: Date;
}) {
  const rows = await db
    .select()
    .from(schema.slotLocks)
    .where(
      and(
        eq(schema.slotLocks.staffId, input.staffId),
        eq(schema.slotLocks.startAt, input.startAt),
        gt(schema.slotLocks.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function releaseSlotLock(input: {
  staffId: string;
  startAt: Date;
  holderSessionId: string;
}) {
  await db
    .delete(schema.slotLocks)
    .where(
      and(
        eq(schema.slotLocks.staffId, input.staffId),
        eq(schema.slotLocks.startAt, input.startAt),
        eq(schema.slotLocks.holderSessionId, input.holderSessionId),
      ),
    );

  return { ok: true };
}
