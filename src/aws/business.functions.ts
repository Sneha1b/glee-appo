import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "../../aws/db/client";
import { businesses, businessOwners } from "../../aws/db/schema";
import { createBusinessWithOwner } from "../../aws/services/business";
import { requireUser } from "./session";

export const listBusinessesFn = createServerFn({ method: "GET" })
  .inputValidator((d: { limit?: number } | undefined) => ({
    limit: Math.min(Math.max(d?.limit ?? 100, 1), 200),
  }))
  .handler(async ({ data }) => {
    const rows = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        category: businesses.category,
        description: businesses.description,
        logo_url: businesses.logoUrl,
        city: businesses.city,
        region: businesses.region,
      })
      .from(businesses)
      .orderBy(asc(businesses.name))
      .limit(data.limit);
    return rows;
  });

export const getBusinessFn = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const rows = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, data.id))
      .limit(1);
    return rows[0] ?? null;
  });

export const listMyBusinessesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const u = await requireUser();
    const rows = await db
      .select({ id: businesses.id, name: businesses.name, category: businesses.category })
      .from(businesses)
      .innerJoin(businessOwners, eq(businessOwners.businessId, businesses.id))
      .where(eq(businessOwners.userId, u.sub));
    return rows;
  },
);

const createSchema = z.object({
  name: z.string().min(1).max(240),
  category: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  description: z.string().max(2000).optional(),
  address_line1: z.string().max(240).optional(),
  address_line2: z.string().max(240).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  postal_code: z.string().max(40).optional(),
  country: z.string().max(120).optional(),
  logo_url: z.string().max(2000).optional(),
  banner_url: z.string().max(2000).optional(),
});

export const createBusinessFn = createServerFn({ method: "POST" })
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    const id = await createBusinessWithOwner({
      userSub: u.sub,
      name: data.name,
      category: data.category,
      phone: data.phone,
      description: data.description,
      addressLine1: data.address_line1,
      addressLine2: data.address_line2,
      city: data.city,
      region: data.region,
      postalCode: data.postal_code,
      country: data.country,
      logoUrl: data.logo_url,
      bannerUrl: data.banner_url,
    });
    return { id };
  });

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export const updateBusinessFn = createServerFn({ method: "POST" })
  .inputValidator((d) => updateSchema.parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    const owns = await db
      .select({ id: businessOwners.id })
      .from(businessOwners)
      .where(eq(businessOwners.businessId, data.id))
      .limit(1);
    if (!owns.length) throw new Error("not_owner");
    // Confirm THIS user owns it
    const mine = await db
      .select({ id: businessOwners.id })
      .from(businessOwners)
      .where(eq(businessOwners.userId, u.sub))
      .limit(1);
    if (!mine.length) throw new Error("not_owner");

    const { id, ...patch } = data;
    const mapped: Record<string, unknown> = {};
    if (patch.name !== undefined) mapped.name = patch.name;
    if (patch.category !== undefined) mapped.category = patch.category;
    if (patch.phone !== undefined) mapped.phone = patch.phone;
    if (patch.description !== undefined) mapped.description = patch.description;
    if (patch.address_line1 !== undefined) mapped.addressLine1 = patch.address_line1;
    if (patch.address_line2 !== undefined) mapped.addressLine2 = patch.address_line2;
    if (patch.city !== undefined) mapped.city = patch.city;
    if (patch.region !== undefined) mapped.region = patch.region;
    if (patch.postal_code !== undefined) mapped.postalCode = patch.postal_code;
    if (patch.country !== undefined) mapped.country = patch.country;
    if (patch.logo_url !== undefined) mapped.logoUrl = patch.logo_url;
    if (patch.banner_url !== undefined) mapped.bannerUrl = patch.banner_url;
    if (Object.keys(mapped).length) {
      await db.update(businesses).set(mapped).where(eq(businesses.id, id));
    }
    return { ok: true };
  });
