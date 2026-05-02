import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// POST /api/booking/:bookingId
// Finalizes a (mock) payment for a booking and triggers the booking-confirmation
// edge function. Returns the booking + email status. Email is best-effort: if
// no provider is configured the function returns emailStatus: "skipped".
export const Route = createFileRoute("/api/booking/$bookingId")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const { bookingId } = params;
        const { data: booking, error } = await supabaseAdmin
          .from("bookings")
          .select("id, status, customer_email, customer_name, start_at, end_at, business_id, service_id, staff_id")
          .eq("id", bookingId)
          .maybeSingle();

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        if (!booking) {
          return Response.json({ ok: false, error: "Booking not found" }, { status: 404 });
        }

        // Best-effort: trigger the booking-confirmation edge function. It
        // creates an invoice and (if configured) sends an email + ICS. We
        // surface emailStatus so the UI doesn't lie about delivery.
        let emailStatus: "sent" | "skipped" | "failed" = "skipped";
        let invoice: any = null;
        try {
          const { data, error: fnErr } = await supabaseAdmin.functions.invoke("booking-confirmation", {
            body: { bookingId, action: "confirm" },
          });
          if (!fnErr && data) {
            emailStatus = (data as any).emailStatus ?? "skipped";
            invoice = (data as any).invoice ?? null;
          } else if (fnErr) {
            emailStatus = "failed";
          }
        } catch {
          emailStatus = "failed";
        }

        return Response.json({ ok: true, booking, emailStatus, invoice });
      },
      GET: async ({ params }) => {
        const { bookingId } = params;
        const { data, error } = await supabaseAdmin
          .rpc("get_booking_public", { p_booking_id: bookingId });
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        if (!data) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
        return Response.json({ ok: true, booking: data });
      },
    },
  },
});
