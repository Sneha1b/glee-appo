import { eq, and } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";

export async function listServicesByBusiness(businessId: string) {
  return db
    .select()
    .from(schema.services)
    .where(
      and(
        eq(schema.services.businessId, businessId),
        eq(schema.services.active, true),
      ),
    );
}

export async function getServiceById(id: string) {
  const rows = await db
    .select()
    .from(schema.services)
    .where(eq(schema.services.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function createService(input: {
  businessId: string;
  name: string;
  durationMin: number;
  price: string;
  description?: string | null;
  active?: boolean;
}) {
  const rows = await db
    .insert(schema.services)
    .values({
      businessId: input.businessId,
      name: input.name,
      durationMin: input.durationMin,
      price: input.price,
      description: input.description ?? null,
      active: input.active ?? true,
    })
    .returning();

  return rows[0];
}

export async function listServiceCategoriesByBusiness(businessId: string) {
  return db
    .select()
    .from(schema.serviceCategories)
    .where(eq(schema.serviceCategories.businessId, businessId))
    .orderBy(schema.serviceCategories.sortOrder, schema.serviceCategories.name);
}

export async function createServiceCategory(input: {
  businessId: string;
  name: string;
  sortOrder?: number;
}) {
  const rows = await db
    .insert(schema.serviceCategories)
    .values({
      businessId: input.businessId,
      name: input.name,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return rows[0];
}

export async function deleteServiceCategory(id: string) {
  await db.delete(schema.serviceCategories).where(eq(schema.serviceCategories.id, id));
  return { ok: true };
}

export async function listAllServicesByBusiness(businessId: string) {
  const rows = await db
    .select({
      service: schema.services,
      category: schema.serviceCategories,
    })
    .from(schema.services)
    .leftJoin(
      schema.serviceCategories,
      eq(schema.services.categoryId, schema.serviceCategories.id),
    )
    .where(eq(schema.services.businessId, businessId))
    .orderBy(schema.services.name);
  return rows;
}

export async function updateService(input: {
  id: string;
  name?: string;
  durationMin?: number;
  price?: string;
  description?: string | null;
  categoryId?: string | null;
  active?: boolean;
  availableFrom?: Date | null;
}) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.durationMin !== undefined) patch.durationMin = input.durationMin;
  if (input.price !== undefined) patch.price = input.price;
  if (input.description !== undefined) patch.description = input.description;
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
  if (input.active !== undefined) patch.active = input.active;
  if (input.availableFrom !== undefined) patch.availableFrom = input.availableFrom;
  const rows = await db
    .update(schema.services)
    .set(patch)
    .where(eq(schema.services.id, input.id))
    .returning();
  return rows[0] ?? null;
}
