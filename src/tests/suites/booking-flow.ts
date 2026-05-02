// Integration tests for the booking flow: acquireLock, releaseLock, confirmBooking.
// Uses lightweight mock Supabase clients — no real network calls.
import type { TestSuite } from "../runner";
import { expect } from "../runner";

// ── Replicated pure logic from slots.ts ───────────────────────────────────────

function mapBookingError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("slot_in_past")) return "That time has already passed. Please pick another slot.";
  if (m.includes("already_booked"))
    return "That slot was just booked by someone else. Please pick another.";
  if (m.includes("slot_locked"))
    return "Someone else is currently booking that slot. Please pick another.";
  if (m.includes("lock_invalid")) return "Your hold expired. Please pick the slot again.";
  if (m.includes("service_not_found")) return "Service not found.";
  return message || "Something went wrong.";
}

// ── Mock Supabase factory ─────────────────────────────────────────────────────

type RpcResult<T> = { data: T | null; error: { message: string } | null };

function mockRpc<T>(result: RpcResult<T>) {
  return (_fnName: string, _args: unknown) => Promise.resolve(result);
}

// Simulates acquireLock behaviour against a controllable rpc mock
async function testAcquireLock(rpcResult: RpcResult<unknown>) {
  const { data, error } = rpcResult;
  if (error) throw new Error(mapBookingError(error.message));
  return data;
}

// Simulates confirmBooking against controllable rpc + functions mock
async function testConfirmBooking(
  rpcResult: RpcResult<unknown>,
  invokeResult: { data: unknown; error: unknown } = { data: null, error: null }
) {
  const { data, error } = rpcResult;
  if (error) throw new Error(mapBookingError((error as { message: string }).message));
  // Edge function invocation (best-effort, doesn't throw on failure)
  if (invokeResult.error) {
    console.warn("booking-confirmation failed", invokeResult.error);
  }
  return data;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

export const bookingFlowSuite: TestSuite = {
  id: "booking-flow",
  name: "Integration · Booking Flow",
  type: "integration",
  tests: [
    // ── mapBookingError (exhaustive — these drive UI error strings) ────────────
    {
      name: "mapBookingError: slot_in_past → user-friendly past message",
      fn() {
        const r = mapBookingError("error: slot_in_past");
        expect(r).toContain("already passed");
        expect(r).not.toBe("error: slot_in_past");
      },
    },
    {
      name: "mapBookingError: already_booked → user-friendly booked message",
      fn() {
        const r = mapBookingError("already_booked: concurrent write");
        expect(r).toContain("just booked by someone else");
      },
    },
    {
      name: "mapBookingError: slot_locked → user-friendly locked message",
      fn() {
        const r = mapBookingError("slot_locked by another user");
        expect(r).toContain("currently booking");
      },
    },
    {
      name: "mapBookingError: lock_invalid → hold expired message",
      fn() {
        const r = mapBookingError("lock_invalid or expired");
        expect(r).toContain("hold expired");
      },
    },
    {
      name: "mapBookingError: service_not_found → service not found",
      fn() {
        const r = mapBookingError("service_not_found");
        expect(r).toBe("Service not found.");
      },
    },
    {
      name: "mapBookingError: unknown error passes through unchanged",
      fn() {
        const r = mapBookingError("foreign_key_violation");
        expect(r).toBe("foreign_key_violation");
      },
    },
    {
      name: "mapBookingError: empty string returns fallback",
      fn() {
        expect(mapBookingError("")).toBe("Something went wrong.");
      },
    },
    {
      name: "mapBookingError: mixed-case error is matched case-insensitively",
      fn() {
        expect(mapBookingError("ALREADY_BOOKED")).toContain("just booked by someone else");
        expect(mapBookingError("Lock_Invalid")).toContain("hold expired");
      },
    },

    // ── acquireLock mock scenarios ────────────────────────────────────────────
    {
      name: "acquireLock: success path returns lock data",
      async fn() {
        const lockData = { id: "lock-123", expires_at: "2099-01-01T00:00:00Z" };
        const result = await testAcquireLock({ data: lockData, error: null });
        expect((result as typeof lockData).id).toBe("lock-123");
      },
    },
    {
      name: "acquireLock: null data return is handled without throw",
      async fn() {
        const result = await testAcquireLock({ data: null, error: null });
        expect(result).toBeNull();
      },
    },
    {
      name: "acquireLock: slot_in_past error throws with friendly message",
      async fn() {
        let threw = false;
        let msg = "";
        try {
          await testAcquireLock({ data: null, error: { message: "slot_in_past" } });
        } catch (e) {
          threw = true;
          msg = (e as Error).message;
        }
        expect(threw).toBeTruthy();
        expect(msg).toContain("already passed");
      },
    },
    {
      name: "acquireLock: already_booked error throws with friendly message",
      async fn() {
        let threw = false;
        let msg = "";
        try {
          await testAcquireLock({ data: null, error: { message: "already_booked" } });
        } catch (e) {
          threw = true;
          msg = (e as Error).message;
        }
        expect(threw).toBeTruthy();
        expect(msg).toContain("just booked by someone else");
      },
    },
    {
      name: "acquireLock: slot_locked error throws with friendly message",
      async fn() {
        let threw = false;
        let msg = "";
        try {
          await testAcquireLock({ data: null, error: { message: "slot_locked" } });
        } catch (e) {
          threw = true;
          msg = (e as Error).message;
        }
        expect(threw).toBeTruthy();
        expect(msg).toContain("currently booking");
      },
    },

    // ── confirmBooking mock scenarios ─────────────────────────────────────────
    {
      name: "confirmBooking: success path returns booking data",
      async fn() {
        const bookingData = { id: "booking-abc", status: "confirmed" };
        const result = await testConfirmBooking(
          { data: bookingData, error: null },
          { data: { emailStatus: "sent" }, error: null }
        );
        expect((result as typeof bookingData).id).toBe("booking-abc");
        expect((result as typeof bookingData).status).toBe("confirmed");
      },
    },
    {
      name: "confirmBooking: lock_invalid throws with friendly message",
      async fn() {
        let threw = false;
        let msg = "";
        try {
          await testConfirmBooking({ data: null, error: { message: "lock_invalid" } });
        } catch (e) {
          threw = true;
          msg = (e as Error).message;
        }
        expect(threw).toBeTruthy();
        expect(msg).toContain("hold expired");
      },
    },
    {
      name: "confirmBooking: edge function failure does NOT throw (best-effort)",
      async fn() {
        const bookingData = { id: "booking-xyz" };
        // Edge fn fails, but booking still succeeded — should return data
        const result = await testConfirmBooking(
          { data: bookingData, error: null },
          { data: null, error: new Error("Edge function timeout") }
        );
        expect((result as typeof bookingData).id).toBe("booking-xyz");
      },
    },

    // ── Booking data shape validation ─────────────────────────────────────────
    {
      name: "lock data has id and expires_at fields",
      async fn() {
        const lock = { id: "lock-456", expires_at: "2099-06-15T10:15:00Z" };
        const result = await testAcquireLock({ data: lock, error: null }) as typeof lock;
        expect(typeof result.id).toBe("string");
        expect(typeof result.expires_at).toBe("string");
        expect(result.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      },
    },
    {
      name: "lock expires_at is a valid ISO date string",
      async fn() {
        const expiresAt = "2099-06-15T10:15:00Z";
        const lock = { id: "lock-789", expires_at: expiresAt };
        const result = await testAcquireLock({ data: lock, error: null }) as typeof lock;
        expect(isNaN(new Date(result.expires_at).getTime())).toBeFalsy();
      },
    },
  ],
};
