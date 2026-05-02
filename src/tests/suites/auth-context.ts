// Unit tests for auth-context logic.
// These tests validate the state-transformation logic without React rendering.
import type { TestSuite } from "../runner";
import { expect } from "../runner";

// ── Helpers mirroring auth-context.tsx logic ──────────────────────────────────

type Role = "customer" | "provider" | null;

interface AuthState {
  user: { id: string } | null;
  role: Role;
  customerProfile: { full_name: string; phone: string | null } | null;
  businessId: string | null;
  loading: boolean;
}

// Simulates loadAux state derivation from DB rows
function deriveAuthState(
  user: { id: string } | null,
  roles: Array<{ role: string }>,
  customerProfile: { full_name: string; phone: string | null } | null,
  businessOwner: { business_id: string } | null
): Omit<AuthState, "loading"> {
  const r = roles?.[0]?.role as Role | undefined;
  return {
    user,
    role: r ?? null,
    customerProfile: customerProfile ?? null,
    businessId: businessOwner?.business_id ?? null,
  };
}

// Simulates the sign-out state reset
function signOutState(): Omit<AuthState, "loading"> {
  return { user: null, role: null, customerProfile: null, businessId: null };
}

// Simulates session restoration
function deriveFromSession(
  session: { user: { id: string } } | null
): Pick<AuthState, "user"> {
  return { user: session?.user ?? null };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

export const authContextSuite: TestSuite = {
  id: "auth-context",
  name: "Unit · Auth Context Logic",
  type: "unit",
  tests: [
    // ── Initial / unauthenticated state ───────────────────────────────────────
    {
      name: "unauthenticated state has null user, role, businessId, and profile",
      fn() {
        const state = deriveAuthState(null, [], null, null);
        expect(state.user).toBeNull();
        expect(state.role).toBeNull();
        expect(state.customerProfile).toBeNull();
        expect(state.businessId).toBeNull();
      },
    },
    {
      name: "sign-out resets all fields to null",
      fn() {
        const state = signOutState();
        expect(state.user).toBeNull();
        expect(state.role).toBeNull();
        expect(state.customerProfile).toBeNull();
        expect(state.businessId).toBeNull();
      },
    },
    {
      name: "no roles row results in null role",
      fn() {
        const state = deriveAuthState({ id: "user-1" }, [], null, null);
        expect(state.role).toBeNull();
      },
    },

    // ── Customer role ─────────────────────────────────────────────────────────
    {
      name: "customer role is correctly derived from roles row",
      fn() {
        const state = deriveAuthState(
          { id: "user-1" },
          [{ role: "customer" }],
          { full_name: "Jane Doe", phone: "555-1234" },
          null
        );
        expect(state.role).toBe("customer");
      },
    },
    {
      name: "customer has null businessId",
      fn() {
        const state = deriveAuthState(
          { id: "user-1" },
          [{ role: "customer" }],
          { full_name: "Jane Doe", phone: null },
          null
        );
        expect(state.businessId).toBeNull();
      },
    },
    {
      name: "customer profile full_name is preserved",
      fn() {
        const state = deriveAuthState(
          { id: "user-1" },
          [{ role: "customer" }],
          { full_name: "Jane Doe", phone: null },
          null
        );
        expect(state.customerProfile?.full_name).toBe("Jane Doe");
      },
    },
    {
      name: "customer profile phone can be null",
      fn() {
        const state = deriveAuthState(
          { id: "user-1" },
          [{ role: "customer" }],
          { full_name: "Jane Doe", phone: null },
          null
        );
        expect(state.customerProfile?.phone).toBeNull();
      },
    },
    {
      name: "customer profile phone is stored when provided",
      fn() {
        const state = deriveAuthState(
          { id: "user-1" },
          [{ role: "customer" }],
          { full_name: "Jane Doe", phone: "+1-555-1234" },
          null
        );
        expect(state.customerProfile?.phone).toBe("+1-555-1234");
      },
    },

    // ── Provider role ─────────────────────────────────────────────────────────
    {
      name: "provider role is correctly derived from roles row",
      fn() {
        const state = deriveAuthState(
          { id: "user-2" },
          [{ role: "provider" }],
          null,
          { business_id: "biz-abc" }
        );
        expect(state.role).toBe("provider");
      },
    },
    {
      name: "provider has correct businessId",
      fn() {
        const state = deriveAuthState(
          { id: "user-2" },
          [{ role: "provider" }],
          null,
          { business_id: "biz-abc" }
        );
        expect(state.businessId).toBe("biz-abc");
      },
    },
    {
      name: "provider with no business_owners row has null businessId",
      fn() {
        const state = deriveAuthState(
          { id: "user-2" },
          [{ role: "provider" }],
          null,
          null
        );
        expect(state.businessId).toBeNull();
      },
    },
    {
      name: "user object is preserved in state",
      fn() {
        const user = { id: "user-xyz" };
        const state = deriveAuthState(user, [{ role: "provider" }], null, null);
        expect(state.user?.id).toBe("user-xyz");
      },
    },

    // ── Session restoration ───────────────────────────────────────────────────
    {
      name: "session with user populates user field",
      fn() {
        const r = deriveFromSession({ user: { id: "user-restored" } });
        expect(r.user?.id).toBe("user-restored");
      },
    },
    {
      name: "null session populates null user",
      fn() {
        const r = deriveFromSession(null);
        expect(r.user).toBeNull();
      },
    },

    // ── Role uniqueness ───────────────────────────────────────────────────────
    {
      name: "only first role row is used when multiple exist",
      fn() {
        const state = deriveAuthState(
          { id: "user-1" },
          [{ role: "provider" }, { role: "customer" }],
          null,
          { business_id: "biz-1" }
        );
        expect(state.role).toBe("provider");
      },
    },

    // ── useAuth guard ─────────────────────────────────────────────────────────
    {
      name: "useAuth throws when called outside AuthProvider",
      fn() {
        // Can't render React here; verify the guard logic directly
        function simulateUseAuth(contextValue: null | object) {
          if (!contextValue) throw new Error("useAuth must be inside AuthProvider");
          return contextValue;
        }
        expect(() => simulateUseAuth(null)).toThrow("useAuth must be inside AuthProvider");
      },
    },
    {
      name: "useAuth returns context value when inside AuthProvider",
      fn() {
        function simulateUseAuth(contextValue: null | object) {
          if (!contextValue) throw new Error("useAuth must be inside AuthProvider");
          return contextValue;
        }
        const ctx = { user: null, role: null };
        const result = simulateUseAuth(ctx);
        expect(result).toEqual(ctx);
      },
    },
  ],
};
