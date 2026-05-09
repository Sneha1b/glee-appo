/**
 * Port of get_booked_slots + get_active_slot_locks RPCs.
 * Returns confirmed bookings and live locks for a set of staff in a window.
 */
import { and, gt, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { bookings, slotLocks } from "../db/schema";

export interface BookedSlot {
  staffId: string;
  startAt: Date;
  endAt: Date;
}

export async function getBookedSlots(input: {
  staffIds: string[];
  from: Date;
  to: Date;
}): Promise<BookedSlot[]> {
  if (!input.staffIds.length) return [];
  const rows = await db
    .select({
      staffId: bookings.staffId,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
    })
    .from(bookings)
    .where(
      and(
        inArray(bookings.staffId, input.staffIds),
        gte(bookings.startAt, input.from),
        lt(bookings.startAt, input.to),
      ),
    );
  return rows;
}

export interface ActiveLock extends BookedSlot {
  expiresAt: Date;
}

export async function getActiveSlotLocks(input: {
  staffIds: string[];
  from: Date;
  to: Date;
}): Promise<ActiveLock[]> {
  if (!input.staffIds.length) return [];
  const rows = await db
    .select({
      staffId: slotLocks.staffId,
      startAt: slotLocks.startAt,
      endAt: slotLocks.endAt,
      expiresAt: slotLocks.expiresAt,
    })
    .from(slotLocks)
    .where(
      and(
        inArray(slotLocks.staffId, input.staffIds),
        gte(slotLocks.startAt, input.from),
        lt(slotLocks.startAt, input.to),
        gt(slotLocks.expiresAt, sql`NOW(3)`),
      ),
    );
  return rows;
}

export async function releaseSlotLock(input: {
  holderSessionId: string;
  staffId: string;
  startAt: Date;
}): Promise<void> {
  await db.execute(sql`
    DELETE FROM slot_locks
    WHERE staff_id = ${input.staffId}
      AND start_at = ${input.startAt}
      AND holder_session_id = ${input.holderSessionId}
  `);
}
