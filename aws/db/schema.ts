import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  smallint,
  numeric,
  boolean,
  timestamp,
  date,
  pgEnum,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const appRole = pgEnum("app_role", ["customer", "provider"]);

const id = (name = "id") =>
  uuid(name).primaryKey().default(sql`gen_random_uuid()`);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const appUsers = pgTable("app_users", {
  id: id(),
  cognitoSub: text("cognito_sub").notNull().unique(),
  email: text("email").notNull().unique(),
  role: appRole("role").notNull(),
  createdAt: createdAt(),
});

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

export const services = pgTable("services", {
  id: id(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  durationMin: integer("duration_min").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const staff = pgTable("staff", {
  id: id(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const staffServices = pgTable("staff_services", {
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.staffId, t.serviceId] }),
}));

export const bookings = pgTable("bookings", {
  id: id(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("confirmed"),
  createdAt: createdAt(),
}, (t) => ({
  staffStartUq: uniqueIndex("bookings_staff_start_uq").on(t.staffId, t.startAt),
  staffTimeIdx: index("bookings_staff_time_idx").on(t.staffId, t.startAt),
}));

export const slotLocks = pgTable("slot_locks", {
  id: id(),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  holderSessionId: text("holder_session_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => ({
  staffStartUq: uniqueIndex("slot_locks_staff_start_uq").on(t.staffId, t.startAt),
}));
