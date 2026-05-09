import { eq, and, desc, isNull, lte, or, inArray } from "drizzle-orm";
import { db, schema } from "../db/client";

export async function listBusinesses() {
  return db.select().from(schema.businesses).orderBy(schema.businesses.name);
}

export async function listBusinessesRecent(limit = 8) {
  return db
    .select()
    .from(schema.businesses)
    .orderBy(desc(schema.businesses.createdAt))
    .limit(limit);
}

export async function getBusinessById(id: string) {
  const rows = await db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getBusinessesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(schema.businesses).where(inArray(schema.businesses.id, ids));
}

export async function listServiceCategories(businessId: string) {
  return db
    .select()
    .from(schema.serviceCategories)
    .where(eq(schema.serviceCategories.businessId, businessId))
    .orderBy(schema.serviceCategories.sortOrder);
}

export async function listAvailableServicesForBusiness(businessId: string) {
  const now = new Date();
  return db
    .select()
    .from(schema.services)
    .where(
      and(
        eq(schema.services.businessId, businessId),
        eq(schema.services.active, true),
        or(isNull(schema.services.availableFrom), lte(schema.services.availableFrom, now)),
      ),
    );
}

export async function createBusiness(input: {
  name: string;
  category?: string | null;
  timezone?: string;
  description?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}) {
  const rows = await db
    .insert(schema.businesses)
    .values({
      name: input.name,
      category: input.category ?? null,
      timezone: input.timezone ?? "UTC",
      description: input.description ?? null,
      phone: input.phone ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      region: input.region ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? null,
    })
    .returning();
  return rows[0];
}

export async function updateBusiness(
  id: string,
  patch: Partial<{
    name: string;
    category: string | null;
    description: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    timezone: string;
  }>,
) {
  const rows = await db
    .update(schema.businesses)
    .set(patch)
    .where(eq(schema.businesses.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function createBusinessWithOwner(input: {
  ownerUserId: string;
  name: string;
  category?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [biz] = await tx
      .insert(schema.businesses)
      .values({
        name: input.name,
        category: input.category ?? null,
        phone: input.phone ?? null,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        region: input.region ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null,
      })
      .returning();
    await tx.insert(schema.businessOwners).values({
      userId: input.ownerUserId,
      businessId: biz.id,
    });
    return biz;
  });
}

export async function listBusinessesByOwnerId(userId: string) {
  const rows = await db
    .select({ business: schema.businesses })
    .from(schema.businessOwners)
    .innerJoin(schema.businesses, eq(schema.businessOwners.businessId, schema.businesses.id))
    .where(eq(schema.businessOwners.userId, userId))
    .orderBy(schema.businesses.name);
  return rows.map((r) => r.business);
}

export async function isBusinessOwner(userId: string, businessId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.businessOwners.id })
    .from(schema.businessOwners)
    .where(
      and(
        eq(schema.businessOwners.userId, userId),
        eq(schema.businessOwners.businessId, businessId),
      ),
    )
    .limit(1);
  return !!rows[0];
}

export async function inviteBusinessManager(input: {
  businessId: string;
  email: string;
  invitedBy: string;
}) {
  await db
    .insert(schema.businessInvites)
    .values({
      businessId: input.businessId,
      email: input.email.toLowerCase(),
      invitedBy: input.invitedBy,
    })
    .onConflictDoNothing();
  return { ok: true };
}

export async function acceptPendingInvitesForUser(userId: string, email: string) {
  const pending = await db
    .select()
    .from(schema.businessInvites)
    .where(
      and(
        eq(schema.businessInvites.email, email.toLowerCase()),
        // not yet accepted
      ),
    );
  for (const inv of pending) {
    if (inv.acceptedAt) continue;
    await db
      .insert(schema.businessOwners)
      .values({ userId, businessId: inv.businessId })
      .onConflictDoNothing();
    await db
      .update(schema.businessInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(schema.businessInvites.id, inv.id));
  }
  return { accepted: pending.length };
}

export async function updateBusinessProfile(input: {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
}) {
  const rows = await db
    .update(schema.businesses)
    .set({
      name: input.name,
      description: input.description ?? null,
      logoUrl: input.logoUrl ?? null,
    })
    .where(eq(schema.businesses.id, input.id))
    .returning();
  return rows[0] ?? null;
}

export interface CreateBusinessFullInput {
  ownerUserId: string;
  business: {
    name: string;
    category?: string | null;
    description?: string | null;
    phone?: string | null;
    addressLine1?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
    logoUrl?: string | null;
  };
  hours: Array<{ weekday: number; openMinute: number; closeMinute: number }>;
  categories: Array<{ tempId: string; name: string }>;
  services: Array<{
    tempId: string;
    name: string;
    durationMin: number;
    price: number;
    description?: string | null;
    categoryTempId?: string | null;
  }>;
  staff: Array<{
    name: string;
    serviceTempIds: string[];
    availabilities: Array<{ weekday: number; startMinute: number; endMinute: number }>;
  }>;
  managerEmails: string[];
}

export async function createBusinessFull(input: CreateBusinessFullInput) {
  return db.transaction(async (tx) => {
    const [biz] = await tx
      .insert(schema.businesses)
      .values({
        name: input.business.name,
        category: input.business.category ?? null,
        description: input.business.description ?? null,
        phone: input.business.phone ?? null,
        addressLine1: input.business.addressLine1 ?? null,
        city: input.business.city ?? null,
        region: input.business.region ?? null,
        postalCode: input.business.postalCode ?? null,
        country: input.business.country ?? null,
        logoUrl: input.business.logoUrl ?? null,
      })
      .returning();

    await tx
      .insert(schema.businessOwners)
      .values({ userId: input.ownerUserId, businessId: biz.id });

    if (input.hours.length) {
      await tx.insert(schema.businessHours).values(
        input.hours.map((h) => ({
          businessId: biz.id,
          weekday: h.weekday,
          openMinute: h.openMinute,
          closeMinute: h.closeMinute,
        })),
      );
    }

    const catIdByTemp = new Map<string, string>();
    if (input.categories.length) {
      const catRows = await tx
        .insert(schema.serviceCategories)
        .values(
          input.categories.map((c, i) => ({
            businessId: biz.id,
            name: c.name,
            sortOrder: i,
          })),
        )
        .returning();
      input.categories.forEach((c, i) => catIdByTemp.set(c.tempId, catRows[i].id));
    }

    const svcIdByTemp = new Map<string, string>();
    if (input.services.length) {
      const svcRows = await tx
        .insert(schema.services)
        .values(
          input.services.map((s) => ({
            businessId: biz.id,
            name: s.name,
            durationMin: s.durationMin,
            price: String(s.price),
            description: s.description ?? null,
            categoryId: s.categoryTempId ? catIdByTemp.get(s.categoryTempId) ?? null : null,
          })),
        )
        .returning();
      input.services.forEach((s, i) => svcIdByTemp.set(s.tempId, svcRows[i].id));
    }

    for (const st of input.staff) {
      const [stRow] = await tx
        .insert(schema.staff)
        .values({ businessId: biz.id, name: st.name })
        .returning();
      if (st.availabilities.length) {
        await tx.insert(schema.availabilities).values(
          st.availabilities.map((a) => ({
            staffId: stRow.id,
            weekday: a.weekday,
            startMinute: a.startMinute,
            endMinute: a.endMinute,
          })),
        );
      }
      const ssRows = st.serviceTempIds
        .map((t) => svcIdByTemp.get(t))
        .filter((x): x is string => !!x)
        .map((sid) => ({ staffId: stRow.id, serviceId: sid }));
      if (ssRows.length) {
        await tx.insert(schema.staffServices).values(ssRows).onConflictDoNothing();
      }
    }

    for (const email of input.managerEmails) {
      await tx
        .insert(schema.businessInvites)
        .values({
          businessId: biz.id,
          email: email.toLowerCase(),
          invitedBy: input.ownerUserId,
        })
        .onConflictDoNothing();
    }

    return biz;
  });
}
