import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "../db/client";

export async function listInvoicesByBusiness(input: {
  businessId: string;
  from?: Date;
  to?: Date;
}) {
  const filters = [eq(schema.invoices.businessId, input.businessId)];

  if (input.from) filters.push(gte(schema.invoices.issuedAt, input.from));
  if (input.to) filters.push(lte(schema.invoices.issuedAt, input.to));

  return db
    .select()
    .from(schema.invoices)
    .where(and(...filters))
    .orderBy(desc(schema.invoices.issuedAt));
}

export async function listInvoicesByCustomerEmail(customerEmail: string) {
  return db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.customerEmail, customerEmail))
    .orderBy(desc(schema.invoices.issuedAt));
}

export async function getInvoiceByBookingId(bookingId: string) {
  const rows = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.bookingId, bookingId))
    .limit(1);

  return rows[0] ?? null;
}

export async function createInvoice(input: {
  invoiceNumber: string;
  businessId: string;
  bookingId: string;
  staffId?: string | null;
  serviceId?: string | null;
  serviceName: string;
  staffName?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  amount: string;
  tax?: string;
  total: string;
  currency?: string;
  status?: string;
  appointmentAt: Date;
}) {
  const rows = await db
    .insert(schema.invoices)
    .values({
      invoiceNumber: input.invoiceNumber,
      businessId: input.businessId,
      bookingId: input.bookingId,
      staffId: input.staffId ?? null,
      serviceId: input.serviceId ?? null,
      serviceName: input.serviceName,
      staffName: input.staffName ?? null,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone ?? null,
      amount: input.amount,
      tax: input.tax ?? "0",
      total: input.total,
      currency: input.currency ?? "USD",
      status: input.status ?? "issued",
      appointmentAt: input.appointmentAt,
    })
    .returning();

  return rows[0];
}
