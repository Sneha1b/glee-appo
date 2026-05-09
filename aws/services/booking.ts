/**
 * Port of acquire_slot_lock + confirm_booking RPCs.
 * The Postgres SECURITY DEFINER + advisory locking is replaced with
 * a MySQL transaction + SELECT ... FOR UPDATE on the slot_locks row.
 *
 * Lock TTL: 60 seconds (matches the Postgres default).
 */
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { bookings, services, slotLocks } from "../db/schema";

const LOCK_TTL_SECONDS = 60;

export class BookingError extends Error {
  code:
    | "slot_in_past"
    | "invalid_range"
    | "already_booked"
    | "slot_locked"
    | "lock_invalid"
    | "service_not_found";
  constructor(code: BookingError["code"]) {
    super(code);
    this.code = code;
  }
}

/**
 * Reserve a slot for `holderSessionId`. Returns the lock id.
 */
export async function acquireSlotLock(input: {
  holderSessionId: string;
  staffId: string;
  serviceId: string;
  startAt: Date;
  endAt: Date;
}): Promise<{ lockId: string; expiresAt: Date }> {
  const now = new Date();
  if (input.startAt <= now) throw new BookingError("slot_in_past");
  if (input.endAt <= input.startAt) throw new BookingError("invalid_range");

  return db.transaction(async (tx) => {
    // 1. Reject if a confirmed booking overlaps for this staff.
    const overlap = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.staffId, input.staffId),
          eq(bookings.status, "confirmed"),
          lt(bookings.startAt, input.endAt),
          gt(bookings.endAt, input.startAt),
        ),
      )
      .limit(1);
    if (overlap.length) throw new BookingError("already_booked");

    // 2. Garbage-collect expired locks at this exact slot so we can re-insert.
    await tx
      .delete(slotLocks)
      .where(
        and(
          eq(slotLocks.staffId, input.staffId),
          eq(slotLocks.startAt, input.startAt),
          // expires_at <= now
          sql`${slotLocks.expiresAt} <= NOW(3)`,
        ),
      );

    // 3. Reject if a live lock held by someone else overlaps this window.
    const heldByOther = await tx
      .select({ id: slotLocks.id })
      .from(slotLocks)
      .where(
        and(
          eq(slotLocks.staffId, input.staffId),
          gt(slotLocks.expiresAt, now),
          sql`${slotLocks.holderSessionId} <> ${input.holderSessionId}`,
          lt(slotLocks.startAt, input.endAt),
          gt(slotLocks.endAt, input.startAt),
        ),
      )
      .limit(1);
    if (heldByOther.length) throw new BookingError("slot_locked");

    // 4. Upsert the lock for (staff_id, start_at).
    const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);
    const lockId = cryptoRandomUuid();

    await tx.execute(sql`
      INSERT INTO slot_locks
        (id, holder_session_id, staff_id, service_id, start_at, end_at, expires_at, created_at)
      VALUES
        (${lockId}, ${input.holderSessionId}, ${input.staffId}, ${input.serviceId},
         ${input.startAt}, ${input.endAt}, ${expiresAt}, NOW(3))
      ON DUPLICATE KEY UPDATE
        holder_session_id = VALUES(holder_session_id),
        service_id        = VALUES(service_id),
        end_at            = VALUES(end_at),
        expires_at        = VALUES(expires_at),
        created_at        = NOW(3)
    `);

    return { lockId, expiresAt };
  });
}

/**
 * Confirm a previously locked slot. Inserts the booking and releases the lock.
 */
export async function confirmBooking(input: {
  holderSessionId: string;
  serviceId: string;
  staffId: string;
  startAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}): Promise<{ bookingId: string }> {
  return db.transaction(async (tx) => {
    // Lock the row to serialize concurrent confirms.
    const lockRows = (await tx.execute(sql`
      SELECT id, end_at, expires_at
      FROM slot_locks
      WHERE staff_id = ${input.staffId}
        AND start_at = ${input.startAt}
        AND holder_session_id = ${input.holderSessionId}
        AND expires_at > NOW(3)
      FOR UPDATE
    `)) as unknown as [Array<{ id: string; end_at: Date; expires_at: Date }>, unknown];

    const lock = lockRows[0]?.[0];
    if (!lock) throw new BookingError("lock_invalid");
    if (input.startAt <= new Date()) throw new BookingError("slot_in_past");

    const svc = await tx
      .select()
      .from(services)
      .where(eq(services.id, input.serviceId))
      .limit(1);
    if (!svc.length) throw new BookingError("service_not_found");

    // Final overlap re-check inside the transaction.
    const overlap = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.staffId, input.staffId),
          eq(bookings.status, "confirmed"),
          lt(bookings.startAt, lock.end_at),
          gt(bookings.endAt, input.startAt),
        ),
      )
      .limit(1);
    if (overlap.length) throw new BookingError("already_booked");

    const bookingId = cryptoRandomUuid();
    await tx.insert(bookings).values({
      id: bookingId,
      businessId: svc[0].businessId,
      serviceId: input.serviceId,
      staffId: input.staffId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      startAt: input.startAt,
      endAt: lock.end_at,
      status: "confirmed",
    });

    await tx.delete(slotLocks).where(eq(slotLocks.id, lock.id));
    return { bookingId };
  });
}

function cryptoRandomUuid(): string {
  return crypto.randomUUID();
}
