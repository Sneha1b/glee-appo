import { createFileRoute } from "@tanstack/react-router";
import { getBookingDetails } from "@/aws/services/bookings";
import {
  getInvoiceByBookingId,
  createInvoice,
} from "@/aws/services/invoices";

// POST /api/booking/:bookingId — finalize (mock) payment + create invoice.
// GET /api/booking/:bookingId — fetch booking details.
export const Route = createFileRoute("/api/booking/$bookingId")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const { bookingId } = params;
        const row = await getBookingDetails(bookingId);
        if (!row) return Response.json({ ok: false, error: "Booking not found" }, { status: 404 });
        const { booking, service, staff, business } = row;

        let invoice = await getInvoiceByBookingId(booking.id);
        if (!invoice) {
          const total = String(Number(service.price).toFixed(2));
          const number = `INV-${Date.now().toString(36).toUpperCase()}`;
          invoice = await createInvoice({
            invoiceNumber: number,
            businessId: business.id,
            bookingId: booking.id,
            staffId: staff.id,
            serviceId: service.id,
            serviceName: service.name,
            staffName: staff.name,
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            customerPhone: booking.customerPhone,
            amount: total,
            tax: "0",
            total,
            currency: "USD",
            status: "issued",
            appointmentAt: booking.startAt,
          });
        }
        return Response.json({
          ok: true,
          booking: { id: booking.id, status: booking.status },
          invoice: invoice
            ? { id: invoice.id, invoice_number: invoice.invoiceNumber, total: Number(invoice.total) }
            : null,
          emailStatus: "skipped" as const,
        });
      },
      GET: async ({ params }) => {
        const row = await getBookingDetails(params.bookingId);
        if (!row) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
        const { booking, service, staff, business } = row;
        return Response.json({
          ok: true,
          booking: {
            id: booking.id,
            status: booking.status,
            start_at: booking.startAt.toISOString(),
            end_at: booking.endAt.toISOString(),
            customer_name: booking.customerName,
            customer_email: booking.customerEmail,
            customer_phone: booking.customerPhone,
            service: { id: service.id, name: service.name, duration_min: service.durationMin, price: Number(service.price) },
            staff: { id: staff.id, name: staff.name },
            business: {
              id: business.id, name: business.name, phone: business.phone,
              address_line1: business.addressLine1, address_line2: business.addressLine2,
              city: business.city, region: business.region, postal_code: business.postalCode,
              logo_url: business.logoUrl,
            },
          },
        });
      },
    },
  },
});
