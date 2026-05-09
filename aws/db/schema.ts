import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const appRole = pgEnum("app_role", ["customer", "provider"]);

const id = (name = "id") =>
  uuid(name).primaryKey().default(sql`gen_random_uuid()`);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const businesses = pgTable("businesses", {
  id: id(),
  name: text("name").notNull(),
  category: text("category"),
  timezone: text("timezone").notNull().default("UTC"),
  description: text("description"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  region: text("region"),
  postalCode: text("postal_code"),
  country: text("country"),
  phone: text("phone"),
  createdAt: createdAt(),
});

export const serviceCategories = pgTable("service_categories", {
  id: id(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const services = pgTable("services", {
  id: id(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => serviceCategories.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  durationMin: integer("duration_min").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  availableFrom: timestamp("available_from", { withTimezone: true }),
  createdAt: createdAt(),
});

export const staff = pgTable("staff", {
  id: id(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const staffServices = pgTable(
  "staff_services",
  {
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.staffId, t.serviceId] }),
  }),
);

export const availabilities = pgTable("availabilities", {
  id: id(),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "cascade" }),
  weekday: smallint("weekday").notNull(),
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
});

export const timeBlocks = pgTable("time_blocks", {
  id: id(),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "cascade" }),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
});

export const slotLocks = pgTable(
  "slot_locks",
  {
    id: id(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    holderSessionId: text("holder_session_id").notNull(),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    staffStartUq: uniqueIndex("slot_locks_staff_start_uq").on(
      t.staffId,
      t.startAt,
    ),
    holderIdx: index("slot_locks_holder_idx").on(t.holderSessionId),
    expiresIdx: index("slot_locks_expires_idx").on(t.expiresAt),
  }),
);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("confirmed"),
    createdAt: createdAt(),
  },
  (t) => ({
    staffStartUq: uniqueIndex("bookings_staff_start_uq").on(
      t.staffId,
      t.startAt,
    ),
    staffTimeIdx: index("bookings_staff_time_idx").on(t.staffId, t.startAt),
  }),
);

export const appUsers = pgTable("app_users", {
  id: id(),
  cognitoSub: text("cognito_sub").notNull().unique(),
  email: text("email").notNull().unique(),
  role: appRole("role").notNull(),
  createdAt: createdAt(),
});

export const customerProfiles = pgTable("customer_profiles", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const providerProfiles = pgTable("provider_profiles", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const businessOwners = pgTable(
  "business_owners",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => ({
    userBusinessUq: uniqueIndex("business_owners_user_business_uq").on(
      t.userId,
      t.businessId,
    ),
  }),
);

export const businessHours = pgTable(
  "business_hours",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    openMinute: integer("open_minute").notNull(),
    closeMinute: integer("close_minute").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    businessWeekdayUq: uniqueIndex("business_hours_business_weekday_uq").on(
      t.businessId,
      t.weekday,
    ),
  }),
);

export const businessClosures = pgTable("business_closures", {
  id: id(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  reason: text("reason"),
  createdAt: createdAt(),
});

export const businessInvites = pgTable(
  "business_invites",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => ({
    businessEmailUq: uniqueIndex("business_invites_business_email_uq").on(
      t.businessId,
      t.email,
    ),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    serviceId: uuid("service_id").references(() => services.id, {
      onDelete: "set null",
    }),
    serviceName: text("service_name").notNull(),
    staffName: text("staff_name"),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    amount: numeric("amount").notNull().default("0"),
    tax: numeric("tax").notNull().default("0"),
    total: numeric("total").notNull().default("0"),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull().default("issued"),
    appointmentAt: timestamp("appointment_at", { withTimezone: true }).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '18 months'`),
    createdAt: createdAt(),
  },
  (t) => ({
    businessIdx: index("invoices_business_idx").on(
      t.businessId,
      t.issuedAt,
    ),
    bookingIdx: index("invoices_booking_idx").on(t.bookingId),
    expiryIdx: index("invoices_expiry_idx").on(t.expiresAt),
  }),
);
