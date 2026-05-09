import { and, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";

export async function getBookedSlots(input: {
  staffIds: string[];
  startAt: Date;
  endAt: Date;
}) {
  if (input.staffIds.length === 0) return [];

  return db
    .select()
    .from(schema.bookings)
    .where(
      and(
        inArray(schema.bookings.staffId, input.staffIds),
        gte(schema.bookings.startAt, input.startAt),
        lt(schema.bookings.startAt, input.endAt),
      ),
    );
}

export async function getActiveSlotLocks(input: {
  staffIds: string[];
  startAt: Date;
  endAt: Date;
}) {
  if (input.staffIds.length === 0) return [];

  return db
    .select()
    .from(schema.slotLocks)
    .where(
      and(
        inArray(schema.slotLocks.staffId, input.staffIds),
        gte(schema.slotLocks.startAt, input.startAt),
        lt(schema.slotLocks.startAt, input.endAt),
        gt(schema.slotLocks.expiresAt, new Date()),
      ),
    );
}

export async function acquireSlotLock(input: {
  staffId: string;
  serviceId: string;
  startAt: Date;
  endAt: Date;
  holderSessionId: string;
  ttlMinutes?: number;
}) {
  const expiresAt = new Date(
    Date.now() + (input.ttlMinutes ?? 10) * 60 * 1000,
  );

  const rows = await db
    .insert(schema.slotLocks)
    .values({
      staffId: input.staffId,
      serviceId: input.serviceId,
      startAt: input.startAt,
      endAt: input.endAt,
      holderSessionId: input.holderSessionId,
      expiresAt,
    })
    .onConflictDoNothing({
      target: [schema.slotLocks.staffId, schema.slotLocks.startAt],
    })
    .returning();

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

export async function confirmBooking(input: {
  businessId: string;
  serviceId: string;
  staffId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  startAt: Date;
  endAt: Date;
  holderSessionId?: string | null;
}) {
  return db.transaction(async (tx) => {
    const bookingRows = await tx
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

    if (input.holderSessionId) {
      await tx
        .delete(schema.slotLocks)
        .where(
          and(
            eq(schema.slotLocks.staffId, input.staffId),
            eq(schema.slotLocks.startAt, input.startAt),
            eq(schema.slotLocks.holderSessionId, input.holderSessionId),
          ),
        );
    }

    return bookingRows[0];
  });
}
