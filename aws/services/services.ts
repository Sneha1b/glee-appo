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
