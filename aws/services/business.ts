/**
 * Port of create_business_with_owner + invite_business_manager +
 * accept_pending_business_invites RPCs. RLS replaced with explicit
 * ownership checks in TS.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import { businessOwners, businessInvites, businesses } from "../db/schema";

export async function createBusinessWithOwner(input: {
  userSub: string;
  name: string;
  category?: string;
  phone?: string;
  description?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  logoUrl?: string;
  bannerUrl?: string;
}): Promise<string> {
  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(businesses).values({ id, ...input });
    await tx.insert(businessOwners).values({
      id: crypto.randomUUID(),
      businessId: id,
      userId: input.userSub,
    });
    return id;
  });
}

export async function isBusinessOwner(opts: {
  userSub: string;
  businessId: string;
}): Promise<boolean> {
  const rows = await db
    .select({ id: businessOwners.id })
    .from(businessOwners)
    .where(
      and(
        eq(businessOwners.businessId, opts.businessId),
        eq(businessOwners.userId, opts.userSub),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function assertBusinessOwner(opts: {
  userSub: string;
  businessId: string;
}) {
  if (!(await isBusinessOwner(opts))) {
    throw new Error("not_owner");
  }
}

export async function inviteBusinessManager(input: {
  inviterSub: string;
  businessId: string;
  email: string;
}): Promise<string> {
  await assertBusinessOwner({
    userSub: input.inviterSub,
    businessId: input.businessId,
  });
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("invalid_email");

  // Upsert on (business_id, email) — replicate ON CONFLICT DO UPDATE.
  const id = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO business_invites (id, business_id, email, invited_by, created_at)
    VALUES (${id}, ${input.businessId}, ${email}, ${input.inviterSub}, NOW(3))
    ON DUPLICATE KEY UPDATE invited_by = VALUES(invited_by)
  `);
  return id;
}

/**
 * Auto-claim any pending invites for the user's email.
 * Returns the number of business_owners rows inserted.
 */
export async function acceptPendingBusinessInvites(opts: {
  userSub: string;
  email: string;
}): Promise<number> {
  const email = opts.email.trim().toLowerCase();
  if (!email) return 0;

  return db.transaction(async (tx) => {
    const pending = await tx
      .select({ businessId: businessInvites.businessId, id: businessInvites.id })
      .from(businessInvites)
      .where(
        and(
          eq(sql`LOWER(${businessInvites.email})`, email),
          isNull(businessInvites.acceptedAt),
        ),
      );
    if (!pending.length) return 0;

    let inserted = 0;
    for (const row of pending) {
      await tx
        .update(businessInvites)
        .set({ acceptedAt: new Date() })
        .where(eq(businessInvites.id, row.id));
      // INSERT IGNORE-style: skip if owner row already exists.
      const exists = await tx
        .select({ id: businessOwners.id })
        .from(businessOwners)
        .where(
          and(
            eq(businessOwners.userId, opts.userSub),
            eq(businessOwners.businessId, row.businessId),
          ),
        )
        .limit(1);
      if (!exists.length) {
        await tx.insert(businessOwners).values({
          id: crypto.randomUUID(),
          userId: opts.userSub,
          businessId: row.businessId,
        });
        inserted += 1;
      }
    }
    return inserted;
  });
}
