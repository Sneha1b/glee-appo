/**
 * Provider/admin server functions — owner-scoped CRUD for the dashboard.
 * Thin file: only createServerFn declarations + their imports.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";
import { requireUser, assertBusinessOwner } from "@/aws/auth/server";
import {
  isBusinessOwner,
  listBusinessesByOwnerId,
  updateBusiness,
  acceptPendingInvitesForUser,
  inviteBusinessManager,
} from "@/aws/services/businesses";
import {
  listBookingsByBusinessFiltered,
  getBookingDetails,
  cancelBooking as cancelBookingSvc,
  updateBookingTimes,
} from "@/aws/services/bookings";
import {
  listAllServicesByBusiness,
  createService,
  updateService,
  listServiceCategoriesByBusiness,
  createServiceCategory,
  deleteServiceCategory,
} from "@/aws/services/services";
import {
  listStaffByBusiness,
  createStaff,
  deleteStaff,
  listStaffServiceLinks,
  assignServiceToStaff,
  removeServiceFromStaff,
  listAvailabilities,
  replaceAvailabilityForWeekday,
} from "@/aws/services/staffServices";
import {
  listBusinessHours,
  replaceBusinessHoursForWeekday,
} from "@/aws/services/businessHours";
import {
  listActiveBusinessClosures,
  createBusinessClosure,
  deleteBusinessClosure,
} from "@/aws/services/closures";
import {
  listUpcomingTimeBlocks,
  createTimeBlock,
  deleteTimeBlock,
} from "@/aws/services/timeBlocks";
import { listInvoicesByBusiness } from "@/aws/services/invoices";
import { getRichBusinessMetrics } from "@/aws/services/metrics";
import { setUserRoleByCognitoSub } from "@/aws/services/role";
import { presignBusinessImageUpload } from "@/aws/storage/s3";
import { createBusinessFull } from "@/aws/services/businesses";

const BizIdSchema = z.object({ businessId: z.string().uuid() });

export const listProviderBusinesses = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  // Self-heal: any owner is at least a provider.
  if (u.appUser.role !== "provider") {
    try {
      await setUserRoleByCognitoSub({ cognitoSub: u.cognitoSub, role: "provider" });
    } catch (e) { console.warn(e); }
  }
  // Best-effort accept any pending email invites.
  try {
    await acceptPendingInvitesForUser(u.appUser.id, u.email);
  } catch (e) { console.warn("accept invites", e); }
  const rows = await listBusinessesByOwnerId(u.appUser.id);
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    city: b.city,
    region: b.region,
    logo_url: b.logoUrl,
    banner_url: b.bannerUrl,
  }));
});

export const checkBusinessOwnership = createServerFn({ method: "POST" })
  .inputValidator((d: { businessId: string }) => BizIdSchema.parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    const ok = await isBusinessOwner(u.appUser.id, data.businessId);
    return { ok };
  });

// -------- Bookings --------
export const listAdminBookings = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; from?: string; to?: string; staffId?: string | null; serviceId?: string | null }) =>
      z
        .object({
          businessId: z.string().uuid(),
          from: z.string().optional(),
          to: z.string().optional(),
          staffId: z.string().uuid().nullable().optional(),
          serviceId: z.string().uuid().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const rows = await listBookingsByBusinessFiltered({
      businessId: data.businessId,
      from: data.from ? new Date(data.from) : undefined,
      to: data.to ? new Date(data.to) : undefined,
      staffId: data.staffId ?? null,
      serviceId: data.serviceId ?? null,
    });
    return rows.map((r) => ({
      id: r.booking.id,
      start_at: r.booking.startAt.toISOString(),
      end_at: r.booking.endAt.toISOString(),
      status: r.booking.status,
      customer_name: r.booking.customerName,
      customer_email: r.booking.customerEmail,
      customer_phone: r.booking.customerPhone,
      staff_id: r.staff.id,
      service_id: r.service.id,
      service: { name: r.service.name },
      staff: { name: r.staff.name },
    }));
  });

export const getAdminBooking = createServerFn({ method: "POST" })
  .inputValidator((d: { businessId: string; bookingId: string }) =>
    z.object({ businessId: z.string().uuid(), bookingId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const row = await getBookingDetails(data.bookingId);
    if (!row || row.business.id !== data.businessId) return null;
    return {
      id: row.booking.id,
      status: row.booking.status,
      start_at: row.booking.startAt.toISOString(),
      end_at: row.booking.endAt.toISOString(),
      customer_name: row.booking.customerName,
      customer_email: row.booking.customerEmail,
      customer_phone: row.booking.customerPhone,
      staff_id: row.staff.id,
      service_id: row.service.id,
      service: {
        id: row.service.id,
        name: row.service.name,
        duration_min: row.service.durationMin,
        price: Number(row.service.price),
      },
      staff: { id: row.staff.id, name: row.staff.name },
      business: { id: row.business.id, name: row.business.name },
    };
  });

export const cancelAdminBooking = createServerFn({ method: "POST" })
  .inputValidator((d: { businessId: string; bookingId: string }) =>
    z.object({ businessId: z.string().uuid(), bookingId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const updated = await cancelBookingSvc(data.bookingId);
    return { ok: !!updated };
  });

export const rescheduleAdminBooking = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; bookingId: string; startAt: string; endAt: string }) =>
      z
        .object({
          businessId: z.string().uuid(),
          bookingId: z.string().uuid(),
          startAt: z.string(),
          endAt: z.string(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const updated = await updateBookingTimes({
      id: data.bookingId,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
    });
    return { ok: !!updated };
  });

// -------- Services + Categories --------
export const listAdminServices = createServerFn({ method: "POST" })
  .inputValidator((d: { businessId: string }) => BizIdSchema.parse(d))
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const rows = await listAllServicesByBusiness(data.businessId);
    return rows.map((r) => ({
      id: r.service.id,
      name: r.service.name,
      duration_min: r.service.durationMin,
      price: Number(r.service.price),
      description: r.service.description,
      category_id: r.service.categoryId,
      active: r.service.active,
      available_from: r.service.availableFrom ? r.service.availableFrom.toISOString() : null,
      category: r.category ? { name: r.category.name } : null,
    }));
  });

export const upsertAdminService = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      businessId: string;
      id?: string | null;
      name: string;
      duration_min: number;
      price: number;
      description?: string | null;
      category_id?: string | null;
      available_from?: string | null;
    }) =>
      z
        .object({
          businessId: z.string().uuid(),
          id: z.string().uuid().nullable().optional(),
          name: z.string().min(1).max(200),
          duration_min: z.number().int().min(1).max(24 * 60),
          price: z.number().min(0).max(1_000_000),
          description: z.string().max(2000).nullable().optional(),
          category_id: z.string().uuid().nullable().optional(),
          available_from: z.string().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const availableFrom = data.available_from ? new Date(data.available_from) : null;
    if (data.id) {
      const updated = await updateService({
        id: data.id,
        name: data.name,
        durationMin: data.duration_min,
        price: String(data.price),
        description: data.description ?? null,
        categoryId: data.category_id ?? null,
        availableFrom,
      });
      return { id: updated?.id ?? data.id };
    }
    const created = await createService({
      businessId: data.businessId,
      name: data.name,
      durationMin: data.duration_min,
      price: String(data.price),
      description: data.description ?? null,
    });
    if (data.category_id || availableFrom) {
      await updateService({
        id: created.id,
        categoryId: data.category_id ?? null,
        availableFrom,
      });
    }
    return { id: created.id };
  });

export const setAdminServiceActive = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; id: string; active: boolean }) =>
      z
        .object({
          businessId: z.string().uuid(),
          id: z.string().uuid(),
          active: z.boolean(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    await updateService({ id: data.id, active: data.active });
    return { ok: true };
  });

export const listAdminCategories = createServerFn({ method: "POST" })
  .inputValidator((d: { businessId: string }) => BizIdSchema.parse(d))
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const rows = await listServiceCategoriesByBusiness(data.businessId);
    return rows.map((c) => ({ id: c.id, name: c.name, sort_order: c.sortOrder }));
  });

export const createAdminCategory = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; name: string; sortOrder?: number }) =>
      z
        .object({
          businessId: z.string().uuid(),
          name: z.string().min(1).max(120),
          sortOrder: z.number().int().min(0).max(1000).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const c = await createServiceCategory({
      businessId: data.businessId,
      name: data.name,
      sortOrder: data.sortOrder ?? 0,
    });
    return { id: c.id };
  });

export const deleteAdminCategory = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; id: string }) =>
      z.object({ businessId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    await deleteServiceCategory(data.id);
    return { ok: true };
  });

// -------- Staff --------
export const listAdminStaff = createServerFn({ method: "POST" })
  .inputValidator((d: { businessId: string }) => BizIdSchema.parse(d))
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const staffRows = await listStaffByBusiness(data.businessId);
    const out = await Promise.all(
      staffRows.map(async (s) => {
        const [links, avs] = await Promise.all([
          listStaffServiceLinks(s.id),
          listAvailabilities(s.id),
        ]);
        return {
          id: s.id,
          name: s.name,
          services: links.map((l) => ({ service_id: l.serviceId })),
          avail: avs.map((a) => ({
            id: a.id,
            weekday: a.weekday,
            start_minute: a.startMinute,
            end_minute: a.endMinute,
          })),
        };
      }),
    );
    return out;
  });

export const createAdminStaff = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; name: string }) =>
      z.object({ businessId: z.string().uuid(), name: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const s = await createStaff({ businessId: data.businessId, name: data.name });
    return { id: s.id };
  });

export const deleteAdminStaff = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; staffId: string }) =>
      z.object({ businessId: z.string().uuid(), staffId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    await deleteStaff(data.staffId);
    return { ok: true };
  });

export const toggleStaffServiceFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; staffId: string; serviceId: string; on: boolean }) =>
      z
        .object({
          businessId: z.string().uuid(),
          staffId: z.string().uuid(),
          serviceId: z.string().uuid(),
          on: z.boolean(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    if (data.on) {
      await assignServiceToStaff({ staffId: data.staffId, serviceId: data.serviceId });
    } else {
      await removeServiceFromStaff({ staffId: data.staffId, serviceId: data.serviceId });
    }
    return { ok: true };
  });

export const setStaffWeekdayHours = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; staffId: string; weekday: number; startMinute?: number | null; endMinute?: number | null }) =>
      z
        .object({
          businessId: z.string().uuid(),
          staffId: z.string().uuid(),
          weekday: z.number().int().min(0).max(6),
          startMinute: z.number().int().min(0).max(1440).nullable().optional(),
          endMinute: z.number().int().min(0).max(1440).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    await replaceAvailabilityForWeekday({
      staffId: data.staffId,
      weekday: data.weekday,
      startMinute: data.startMinute ?? null,
      endMinute: data.endMinute ?? null,
    });
    return { ok: true };
  });

// -------- Store hours / closures / business profile --------
export const listAdminStoreHours = createServerFn({ method: "POST" })
  .inputValidator((d: { businessId: string }) => BizIdSchema.parse(d))
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const rows = await listBusinessHours(data.businessId);
    return rows.map((h) => ({
      id: h.id,
      weekday: h.weekday,
      open_minute: h.openMinute,
      close_minute: h.closeMinute,
    }));
  });

export const setStoreHoursFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; weekday: number; openMinute?: number | null; closeMinute?: number | null }) =>
      z
        .object({
          businessId: z.string().uuid(),
          weekday: z.number().int().min(0).max(6),
          openMinute: z.number().int().min(0).max(1440).nullable().optional(),
          closeMinute: z.number().int().min(0).max(1440).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    await replaceBusinessHoursForWeekday({
      businessId: data.businessId,
      weekday: data.weekday,
      openMinute: data.openMinute ?? null,
      closeMinute: data.closeMinute ?? null,
    });
    return { ok: true };
  });

export const listAdminClosures = createServerFn({ method: "POST" })
  .inputValidator((d: { businessId: string }) => BizIdSchema.parse(d))
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const rows = await listActiveBusinessClosures(data.businessId);
    return rows.map((c) => ({
      id: c.id,
      from_date: c.fromDate,
      to_date: c.toDate,
      reason: c.reason,
    }));
  });

export const createAdminClosure = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; from_date: string; to_date: string; reason?: string | null }) =>
      z
        .object({
          businessId: z.string().uuid(),
          from_date: z.string(),
          to_date: z.string(),
          reason: z.string().max(255).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const c = await createBusinessClosure({
      businessId: data.businessId,
      fromDate: data.from_date,
      toDate: data.to_date,
      reason: data.reason ?? null,
    });
    return { id: c.id };
  });

export const deleteAdminClosure = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; id: string }) =>
      z.object({ businessId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    await deleteBusinessClosure(data.id);
    return { ok: true };
  });

export const getBusinessProfileFn = createServerFn({ method: "POST" })
  .inputValidator((d: { businessId: string }) => BizIdSchema.parse(d))
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const rows = await db
      .select()
      .from(schema.businesses)
      .where(eq(schema.businesses.id, data.businessId))
      .limit(1);
    const b = rows[0];
    if (!b) return null;
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      logo_url: b.logoUrl,
    };
  });

export const updateBusinessProfileFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; name: string; description?: string | null; logo_url?: string | null }) =>
      z
        .object({
          businessId: z.string().uuid(),
          name: z.string().min(1).max(255),
          description: z.string().max(2000).nullable().optional(),
          logo_url: z.string().max(2000).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const updated = await updateBusiness(data.businessId, {
      name: data.name,
      description: data.description ?? null,
      logoUrl: data.logo_url ?? null,
    });
    return { ok: !!updated };
  });

// -------- Time blocks --------
export const listAdminTimeBlocks = createServerFn({ method: "POST" })
  .inputValidator((d: { businessId: string }) => BizIdSchema.parse(d))
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    // listUpcomingTimeBlocks doesn't filter by business; filter via staff join here.
    const staffRows = await listStaffByBusiness(data.businessId);
    const staffIds = new Set(staffRows.map((s) => s.id));
    const all = await listUpcomingTimeBlocks();
    const filtered = all.filter((b) => staffIds.has(b.staffId));
    const staffById = new Map(staffRows.map((s) => [s.id, s] as const));
    return filtered.map((b) => ({
      id: b.id,
      staff_id: b.staffId,
      start_at: b.startAt.toISOString(),
      end_at: b.endAt.toISOString(),
      reason: b.reason,
      staff: { name: staffById.get(b.staffId)?.name ?? "" },
    }));
  });

export const createAdminTimeBlock = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; staffId: string; startAt: string; endAt: string; reason?: string | null }) =>
      z
        .object({
          businessId: z.string().uuid(),
          staffId: z.string().uuid(),
          startAt: z.string(),
          endAt: z.string(),
          reason: z.string().max(255).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const b = await createTimeBlock({
      staffId: data.staffId,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      reason: data.reason ?? null,
    });
    return { id: b.id };
  });

export const deleteAdminTimeBlock = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; id: string }) =>
      z.object({ businessId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    await deleteTimeBlock(data.id);
    return { ok: true };
  });

// -------- Invoices --------
export const listAdminInvoices = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; from?: string; to?: string; staffId?: string | null; serviceId?: string | null }) =>
      z
        .object({
          businessId: z.string().uuid(),
          from: z.string().optional(),
          to: z.string().optional(),
          staffId: z.string().uuid().nullable().optional(),
          serviceId: z.string().uuid().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    const filters = [eq(schema.invoices.businessId, data.businessId)];
    if (data.from) filters.push(gte(schema.invoices.issuedAt, new Date(data.from)));
    if (data.to) filters.push(lte(schema.invoices.issuedAt, new Date(data.to)));
    if (data.staffId) filters.push(eq(schema.invoices.staffId, data.staffId));
    if (data.serviceId) filters.push(eq(schema.invoices.serviceId, data.serviceId));
    const rows = await db
      .select()
      .from(schema.invoices)
      .where(and(...filters))
      .orderBy(desc(schema.invoices.issuedAt));
    return rows.map((r) => ({
      id: r.id,
      invoice_number: r.invoiceNumber,
      service_name: r.serviceName,
      staff_name: r.staffName,
      customer_name: r.customerName,
      customer_email: r.customerEmail,
      customer_phone: r.customerPhone,
      amount: Number(r.amount),
      total: Number(r.total),
      currency: r.currency,
      status: r.status,
      issued_at: r.issuedAt.toISOString(),
      appointment_at: r.appointmentAt.toISOString(),
    }));
  });

// -------- Metrics --------
export const getAdminMetrics = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; days: number }) =>
      z
        .object({
          businessId: z.string().uuid(),
          days: z.number().int().min(1).max(3650),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await assertBusinessOwner(data.businessId);
    return getRichBusinessMetrics({ businessId: data.businessId, windowDays: data.days });
  });

// -------- Image uploads (S3 presign) --------
export const presignBusinessImageFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { contentType: string; ext: string }) =>
      z
        .object({
          contentType: z.string().min(1).max(120),
          ext: z.string().min(1).max(10),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    return presignBusinessImageUpload({
      ownerUserId: u.appUser.id,
      contentType: data.contentType,
      ext: data.ext,
    });
  });

// -------- Wizard: full business creation --------
export const createBusinessFullFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        business: z.object({
          name: z.string().min(1).max(255),
          category: z.string().max(120).nullable().optional(),
          description: z.string().max(2000).nullable().optional(),
          phone: z.string().max(40).nullable().optional(),
          addressLine1: z.string().max(255).nullable().optional(),
          city: z.string().max(120).nullable().optional(),
          region: z.string().max(120).nullable().optional(),
          postalCode: z.string().max(40).nullable().optional(),
          country: z.string().max(120).nullable().optional(),
          logoUrl: z.string().max(2000).nullable().optional(),
        }),
        hours: z.array(
          z.object({
            weekday: z.number().int().min(0).max(6),
            openMinute: z.number().int().min(0).max(1440),
            closeMinute: z.number().int().min(0).max(1440),
          }),
        ),
        categories: z.array(z.object({ tempId: z.string(), name: z.string().min(1).max(120) })),
        services: z.array(
          z.object({
            tempId: z.string(),
            name: z.string().min(1).max(200),
            durationMin: z.number().int().min(1).max(24 * 60),
            price: z.number().min(0).max(1_000_000),
            description: z.string().max(2000).nullable().optional(),
            categoryTempId: z.string().nullable().optional(),
          }),
        ),
        staff: z.array(
          z.object({
            name: z.string().min(1).max(120),
            serviceTempIds: z.array(z.string()),
            availabilities: z.array(
              z.object({
                weekday: z.number().int().min(0).max(6),
                startMinute: z.number().int().min(0).max(1440),
                endMinute: z.number().int().min(0).max(1440),
              }),
            ),
          }),
        ),
        managerEmails: z.array(z.string().email().max(255)),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await requireUser();
    if (u.appUser.role !== "provider") {
      try {
        await setUserRoleByCognitoSub({ cognitoSub: u.cognitoSub, role: "provider" });
      } catch (e) { console.warn(e); }
    }
    const biz = await createBusinessFull({
      ownerUserId: u.appUser.id,
      business: data.business,
      hours: data.hours,
      categories: data.categories,
      services: data.services,
      staff: data.staff,
      managerEmails: data.managerEmails,
    });
    return { id: biz.id };
  });

export const inviteBusinessManagerFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { businessId: string; email: string }) =>
      z
        .object({
          businessId: z.string().uuid(),
          email: z.string().email().max(255),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const u = await assertBusinessOwner(data.businessId);
    return inviteBusinessManager({
      businessId: data.businessId,
      email: data.email,
      invitedBy: u.appUser.id,
    });
  });
