/**
 * Port of has_role + assign_my_role RPCs.
 *
 * Note: assign_my_role's customer→provider upgrade-via-invite flow is
 * simplified here. Wire `acceptPendingBusinessInvites` from business.ts
 * into the login callback to recreate the original behavior.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { userRoles, type AppRole } from "../db/schema";
import { businessOwners } from "../db/schema";

export async function hasRole(userSub: string, role: AppRole): Promise<boolean> {
  const rows = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userSub), eq(userRoles.role, role)))
    .limit(1);
  return rows.length > 0;
}

export async function getMyRole(userSub: string): Promise<AppRole | null> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userSub))
    .limit(1);
  return rows[0]?.role ?? null;
}

export async function assignMyRole(opts: {
  userSub: string;
  role: AppRole;
}): Promise<void> {
  if (opts.role !== "customer" && opts.role !== "provider") {
    throw new Error("invalid_role");
  }
  const existing = await getMyRole(opts.userSub);
  if (existing === null) {
    await db.insert(userRoles).values({
      id: crypto.randomUUID(),
      userId: opts.userSub,
      role: opts.role,
    });
    return;
  }
  if (existing === opts.role) return;

  // Allow customer → provider upgrade if the user owns at least one business.
  if (existing === "customer" && opts.role === "provider") {
    const owns = await db
      .select({ id: businessOwners.id })
      .from(businessOwners)
      .where(eq(businessOwners.userId, opts.userSub))
      .limit(1);
    if (owns.length) {
      await db
        .update(userRoles)
        .set({ role: "provider" })
        .where(eq(userRoles.userId, opts.userSub));
      return;
    }
  }
  throw new Error("role_already_assigned");
}
