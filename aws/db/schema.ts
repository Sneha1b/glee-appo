/**
 * Drizzle MySQL 8 schema — port of Supabase public.* tables.
 *
 * Conversions:
 *   uuid                 -> CHAR(36) with (UUID()) default
 *   timestamptz          -> TIMESTAMP (store UTC, app converts to business tz)
 *   numeric              -> DECIMAL(12,2)
 *   smallint             -> tinyint
 *   text                 -> varchar(N) where bounded, text otherwise
 *   jsonb                -> JSON
 *   enum app_role        -> mysqlEnum
 *
 * RLS is GONE — every query path must enforce ownership in TypeScript.
 */
import {
  mysqlTable,
  varchar,
  char,
  text,
  int,
  tinyint,
  decimal,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  mysqlEnum,
  primaryKey,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

const uuid = (name: string) =>
  char(name, { length: 36 }).default(sql`(UUID())`).notNull();

const ts = (name: string) =>
  timestamp(name, { fsp: 3 }).default(sql`CURRENT_TIMESTAMP(3)`).notNull();

// ---------- Users / roles ----------
// Cognito owns the user identity; we mirror the user_id (Cognito `sub`) here.
export const userRoles = mysqlTable(
  "user_roles",
  {
    id: uuid("id").primaryKey(),
    userId: char("user_id", { length: 36 }).notNull(),
    role: mysqlEnum("role", ["customer", "provider"]).notNull(),
    createdAt: ts("created_at"),
  },
  (t) => ({
    userRoleUq: uniqueIndex("user_roles_user_role_uq").on(t.userId, t.role),
  }),
);

export const providerProfiles = mysqlTable("provider_profiles", {
  id: uuid("id").primaryKey(),
  userId: char("user_id", { length: 36 }).notNull().unique(),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const customerProfiles = mysqlTable("customer_profiles", {
  id: uuid("id").primaryKey(),
  userId: char("user_id", { length: 36 }).notNull().unique(),
  fullName: varchar("full_name", { length: 240 }).notNull(),
  firstName: varchar("first_name", { length: 120 }),
  lastName: varchar("last_name", { length: 120 }),
  phone: varchar("phone", { length: 40 }),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

// ---------- Businesses ----------
export const businesses = mysqlTable("businesses", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 240 }).notNull(),
  category: varchar("category", { length: 120 }),
  description: text("description"),
  phone: varchar("phone", { length: 40 }),
  addressLine1: varchar("address_line1", { length: 240 }),
  addressLine2: varchar("address_line2", { length: 240 }),
  city: varchar("city", { length: 120 }),
  region: varchar("region", { length: 120 }),
  postalCode: varchar("postal_code", { length: 40 }),
  country: varchar("country", { length: 80 }),
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  createdAt: ts("created_at"),
});

export const businessOwners = mysqlTable(
  "business_owners",
  {
    id: uuid("id").primaryKey(),
    userId: char("user_id", { length: 36 }).notNull(),
    businessId: char("business_id", { length: 36 }).notNull(),
    createdAt: ts("created_at"),
  },
  (t) => ({
    ownerUq: uniqueIndex("business_owners_uq").on(t.userId, t.businessId),
    byBusiness: index("business_owners_business_idx").on(t.businessId),
  }),
);

export const businessInvites = mysqlTable(
  "business_invites",
  {
    id: uuid("id").primaryKey(),
    businessId: char("business_id", { length: 36 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    invitedBy: char("invited_by", { length: 36 }).notNull(),
    acceptedAt: timestamp("accepted_at", { fsp: 3 }),
    createdAt: ts("created_at"),
  },
  (t) => ({
    inviteUq: uniqueIndex("business_invites_uq").on(t.businessId, t.email),
    byEmail: index("business_invites_email_idx").on(t.email),
  }),
);

export const businessHours = mysqlTable(
  "business_hours",
  {
    id: uuid("id").primaryKey(),
    businessId: char("business_id", { length: 36 }).notNull(),
    weekday: tinyint("weekday").notNull(), // 0=Sun..6=Sat
    openMinute: int("open_minute").notNull(),
    closeMinute: int("close_minute").notNull(),
    createdAt: ts("created_at"),
  },
  (t) => ({
    byBusiness: index("business_hours_business_idx").on(t.businessId),
  }),
);

export const businessClosures = mysqlTable("business_closures", {
  id: uuid("id").primaryKey(),
  businessId: char("business_id", { length: 36 }).notNull(),
  fromDate: varchar("from_date", { length: 10 }).notNull(), // YYYY-MM-DD
  toDate: varchar("to_date", { length: 10 }).notNull(),
  reason: text("reason"),
  createdAt: ts("created_at"),
});

// ---------- Services ----------
export const serviceCategories = mysqlTable("service_categories", {
  id: uuid("id").primaryKey(),
  businessId: char("business_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 240 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: ts("created_at"),
});

export const services = mysqlTable(
  "services",
  {
    id: uuid("id").primaryKey(),
    businessId: char("business_id", { length: 36 }).notNull(),
    categoryId: char("category_id", { length: 36 }),
    name: varchar("name", { length: 240 }).notNull(),
    description: text("description"),
    durationMin: int("duration_min").notNull(),
    price: decimal("price", { precision: 12, scale: 2 }).notNull().default("0"),
    active: boolean("active").notNull().default(true),
    availableFrom: timestamp("available_from", { fsp: 3 }),
    createdAt: ts("created_at"),
  },
  (t) => ({
    byBusiness: index("services_business_idx").on(t.businessId),
  }),
);

// ---------- Staff ----------
export const staff = mysqlTable(
  "staff",
  {
    id: uuid("id").primaryKey(),
    businessId: char("business_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 240 }).notNull(),
    createdAt: ts("created_at"),
  },
  (t) => ({
    byBusiness: index("staff_business_idx").on(t.businessId),
  }),
);

export const staffServices = mysqlTable(
  "staff_services",
  {
    staffId: char("staff_id", { length: 36 }).notNull(),
    serviceId: char("service_id", { length: 36 }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.staffId, t.serviceId] }),
  }),
);

export const availabilities = mysqlTable(
  "availabilities",
  {
    id: uuid("id").primaryKey(),
    staffId: char("staff_id", { length: 36 }).notNull(),
    weekday: tinyint("weekday").notNull(),
    startMinute: int("start_minute").notNull(),
    endMinute: int("end_minute").notNull(),
  },
  (t) => ({
    byStaff: index("availabilities_staff_idx").on(t.staffId),
  }),
);

export const timeBlocks = mysqlTable(
  "time_blocks",
  {
    id: uuid("id").primaryKey(),
    staffId: char("staff_id", { length: 36 }).notNull(),
    startAt: timestamp("start_at", { fsp: 3 }).notNull(),
    endAt: timestamp("end_at", { fsp: 3 }).notNull(),
    reason: text("reason"),
  },
  (t) => ({
    byStaffStart: index("time_blocks_staff_start_idx").on(t.staffId, t.startAt),
  }),
);

// ---------- Bookings + slot locks ----------
export const bookings = mysqlTable(
  "bookings",
  {
    id: uuid("id").primaryKey(),
    businessId: char("business_id", { length: 36 }).notNull(),
    serviceId: char("service_id", { length: 36 }).notNull(),
    staffId: char("staff_id", { length: 36 }).notNull(),
    customerName: varchar("customer_name", { length: 240 }).notNull(),
    customerEmail: varchar("customer_email", { length: 320 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 40 }),
    startAt: timestamp("start_at", { fsp: 3 }).notNull(),
    endAt: timestamp("end_at", { fsp: 3 }).notNull(),
    status: mysqlEnum("status", ["confirmed", "cancelled"])
      .notNull()
      .default("confirmed"),
    createdAt: ts("created_at"),
  },
  (t) => ({
    staffStart: index("bookings_staff_start_idx").on(t.staffId, t.startAt),
    business: index("bookings_business_idx").on(t.businessId),
  }),
);

export const slotLocks = mysqlTable(
  "slot_locks",
  {
    id: uuid("id").primaryKey(),
    holderSessionId: varchar("holder_session_id", { length: 64 }).notNull(),
    staffId: char("staff_id", { length: 36 }).notNull(),
    serviceId: char("service_id", { length: 36 }).notNull(),
    startAt: timestamp("start_at", { fsp: 3 }).notNull(),
    endAt: timestamp("end_at", { fsp: 3 }).notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    createdAt: ts("created_at"),
  },
  (t) => ({
    // Replaces the Postgres ON CONFLICT (staff_id, start_at) target
    staffStartUq: uniqueIndex("slot_locks_staff_start_uq").on(
      t.staffId,
      t.startAt,
    ),
    expires: index("slot_locks_expires_idx").on(t.expiresAt),
  }),
);

// ---------- Invoices ----------
// Note: 18-month retention via cleanup cron is dropped per plan.
// The expiresAt column is kept so a future Lambda/EventBridge can sweep it.
export const invoices = mysqlTable(
  "invoices",
  {
    id: uuid("id").primaryKey(),
    invoiceNumber: varchar("invoice_number", { length: 64 }).notNull().unique(),
    businessId: char("business_id", { length: 36 }).notNull(),
    bookingId: char("booking_id", { length: 36 }).notNull().unique(),
    staffId: char("staff_id", { length: 36 }),
    serviceId: char("service_id", { length: 36 }),
    serviceName: varchar("service_name", { length: 240 }).notNull(),
    staffName: varchar("staff_name", { length: 240 }),
    customerName: varchar("customer_name", { length: 240 }).notNull(),
    customerEmail: varchar("customer_email", { length: 320 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 40 }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    tax: decimal("tax", { precision: 12, scale: 2 }).notNull().default("0"),
    total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    status: varchar("status", { length: 32 }).notNull().default("issued"),
    appointmentAt: timestamp("appointment_at", { fsp: 3 }).notNull(),
    issuedAt: ts("issued_at"),
    expiresAt: timestamp("expires_at", { fsp: 3 })
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP(3) + INTERVAL 18 MONTH)`),
    createdAt: ts("created_at"),
  },
  (t) => ({
    business: index("invoices_business_idx").on(t.businessId),
    customer: index("invoices_customer_email_idx").on(t.customerEmail),
  }),
);

export type AppRole = "customer" | "provider";
