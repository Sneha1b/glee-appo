/**
 * Profile + business setup server fns. Thin: only createServerFn declarations.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/aws/auth/server";
import {
  upsertCustomerProfile,
  upsertProviderProfile,
  getCurrentUserContext,
} from "@/aws/services/profiles";
import {
  createBusinessWithOwner,
  listBusinessesByOwnerId,
  updateBusiness,
  getBusinessById,
} from "@/aws/services/businesses";
import { setUserRoleByCognitoSub } from "@/aws/services/role";

export const upsertCustomerProfileFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { firstName: string; lastName: string; phone: string | null }) =>
      z
        .object({
          firstName: z.string().min(1).max(80),
          lastName: z.string().min(1).max(80),
          phone: z.string().max(40).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    // Ensure role
    if (u.role !== "customer" && u.role !== "provider") {
      await setUserRoleByCognitoSub({ cognitoSub: u.cognitoSub, role: "customer" });
    }
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    const row = await upsertCustomerProfile({
      userId: u.id,
      fullName,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? null,
    });
    return {
      full_name: row.fullName,
      first_name: row.firstName,
      last_name: row.lastName,
      phone: row.phone,
    };
  });

export const upsertProviderProfileFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { firstName: string; lastName: string; phone: string }) =>
      z
        .object({
          firstName: z.string().min(1).max(80),
          lastName: z.string().min(1).max(80),
          phone: z.string().min(1).max(40),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    if (u.role !== "provider") {
      await setUserRoleByCognitoSub({ cognitoSub: u.cognitoSub, role: "provider" });
    }
    const row = await upsertProviderProfile({
      userId: u.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: u.email,
      phone: data.phone,
    });
    return {
      first_name: row.firstName,
      last_name: row.lastName,
      email: row.email,
      phone: row.phone,
    };
  });

export const listMyBusinesses = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  const rows = await listBusinessesByOwnerId(u.id);
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    city: b.city,
    region: b.region,
    logo_url: b.logoUrl,
  }));
});

export const createMyBusiness = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      name: string;
      category?: string;
      phone?: string;
      address_line1?: string;
      address_line2?: string;
      city?: string;
      region?: string;
      postal_code?: string;
      country?: string;
    }) =>
      z
        .object({
          name: z.string().min(1).max(255),
          category: z.string().max(120).optional(),
          phone: z.string().max(40).optional(),
          address_line1: z.string().max(255).optional(),
          address_line2: z.string().max(255).optional(),
          city: z.string().max(120).optional(),
          region: z.string().max(120).optional(),
          postal_code: z.string().max(40).optional(),
          country: z.string().max(120).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    if (u.role !== "provider") {
      await setUserRoleByCognitoSub({ cognitoSub: u.cognitoSub, role: "provider" });
    }
    const biz = await createBusinessWithOwner({
      ownerUserId: u.id,
      name: data.name,
      category: data.category ?? null,
      phone: data.phone ?? null,
      addressLine1: data.address_line1 ?? null,
      addressLine2: data.address_line2 ?? null,
      city: data.city ?? null,
      region: data.region ?? null,
      postalCode: data.postal_code ?? null,
      country: data.country ?? null,
    });
    return { id: biz.id };
  });

export const updateMyBusiness = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      businessId: string;
      patch: {
        name?: string;
        category?: string | null;
        phone?: string | null;
        address_line1?: string | null;
        address_line2?: string | null;
        city?: string | null;
        region?: string | null;
        postal_code?: string | null;
        country?: string | null;
      };
    }) =>
      z
        .object({
          businessId: z.string().uuid(),
          patch: z.object({
            name: z.string().min(1).max(255).optional(),
            category: z.string().max(120).nullable().optional(),
            phone: z.string().max(40).nullable().optional(),
            address_line1: z.string().max(255).nullable().optional(),
            address_line2: z.string().max(255).nullable().optional(),
            city: z.string().max(120).nullable().optional(),
            region: z.string().max(120).nullable().optional(),
            postal_code: z.string().max(40).nullable().optional(),
            country: z.string().max(120).nullable().optional(),
          }),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await requireUser(); // TODO: enforce owner check (Phase 4)
    const updated = await updateBusiness(data.businessId, {
      name: data.patch.name,
      category: data.patch.category,
      phone: data.patch.phone,
      addressLine1: data.patch.address_line1,
      addressLine2: data.patch.address_line2,
      city: data.patch.city,
      region: data.patch.region,
      postalCode: data.patch.postal_code,
      country: data.patch.country,
    });
    return { ok: !!updated };
  });

export const getBusinessForEdit = createServerFn({ method: "GET" })
  .inputValidator((d: { businessId: string }) =>
    z.object({ businessId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const b = await getBusinessById(data.businessId);
    if (!b) return null;
    return {
      id: b.id,
      name: b.name,
      category: b.category,
      phone: b.phone,
      address_line1: b.addressLine1,
      address_line2: b.addressLine2,
      city: b.city,
      region: b.region,
      postal_code: b.postalCode,
      country: b.country,
    };
  });

export const refreshMyContext = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  const ctx = await getCurrentUserContext(u.cognitoSub);
  return ctx
    ? {
        role: ctx.role,
        businessId: ctx.businessId,
      }
    : null;
});
