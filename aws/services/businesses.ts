import { eq, and, desc, isNull, lte, or, inArray } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";

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
