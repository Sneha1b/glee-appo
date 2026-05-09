/**
 * Public read-only server fns for businesses & services.
 * Thin file: only createServerFn declarations + their imports.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  listBusinesses,
  listBusinessesRecent,
  getBusinessById,
  listServiceCategories,
  listAvailableServicesForBusiness,
} from "@/aws/services/businesses";
import { getServiceById } from "@/aws/services/services";

function toBusiness(b: NonNullable<Awaited<ReturnType<typeof getBusinessById>>>) {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    description: b.description,
    logo_url: b.logoUrl,
    banner_url: b.bannerUrl,
    address_line1: b.addressLine1,
    address_line2: b.addressLine2,
    city: b.city,
    region: b.region,
    postal_code: b.postalCode,
    country: b.country,
    phone: b.phone,
    timezone: b.timezone,
  };
}

export const listBusinessesPublic = createServerFn({ method: "GET" }).handler(
  async () => {
    const rows = await listBusinesses();
    return rows.map(toBusiness);
  },
);

export const listRecentBusinessesPublic = createServerFn({ method: "GET" })
  .inputValidator((d?: { limit?: number }) =>
    z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const rows = await listBusinessesRecent(data.limit ?? 8);
    return rows.map(toBusiness);
  });

export const getBusinessPage = createServerFn({ method: "GET" })
  .inputValidator((d: { businessId: string }) =>
    z.object({ businessId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const business = await getBusinessById(data.businessId);
    if (!business) return null;
    const [categories, services] = await Promise.all([
      listServiceCategories(data.businessId),
      listAvailableServicesForBusiness(data.businessId),
    ]);
    return {
      business: toBusiness(business),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        sort_order: c.sortOrder,
      })),
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        duration_min: s.durationMin,
        price: Number(s.price),
        category_id: s.categoryId,
      })),
    };
  });

export const getServiceForBooking = createServerFn({ method: "GET" })
  .inputValidator((d: { serviceId: string }) =>
    z.object({ serviceId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = await getServiceById(data.serviceId);
    if (!s) return null;
    const business = await getBusinessById(s.businessId);
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      duration_min: s.durationMin,
      price: Number(s.price),
      business_id: s.businessId,
      business_timezone: business?.timezone ?? "UTC",
      business_name: business?.name ?? "",
    };
  });
