// Sends booking confirmation email + ICS calendar invite + invoice details.
// Triggered after a booking is confirmed. Idempotent via the bookings.id key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pad(n: number) { return n.toString().padStart(2, "0"); }
function icsDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function escapeIcs(s: string) {
  return (s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildIcs(opts: {
  uid: string;
  startAt: string;
  endAt: string;
  summary: string;
  description: string;
  location: string;
  organizerEmail: string;
  organizerName: string;
  attendeeEmail: string;
  attendeeName: string;
}) {
  const dtstamp = icsDate(new Date().toISOString());
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Schedora//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${icsDate(opts.startAt)}`,
    `DTEND:${icsDate(opts.endAt)}`,
    `SUMMARY:${escapeIcs(opts.summary)}`,
    `DESCRIPTION:${escapeIcs(opts.description)}`,
    `LOCATION:${escapeIcs(opts.location)}`,
    `ORGANIZER;CN=${escapeIcs(opts.organizerName)}:mailto:${opts.organizerEmail}`,
    `ATTENDEE;CN=${escapeIcs(opts.attendeeName)};RSVP=TRUE:mailto:${opts.attendeeEmail}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function buildEmailHtml(args: {
  businessName: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  whenStr: string;
  address: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
}) {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7fb;margin:0;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:24px;color:#fff">
        <h1 style="margin:0;font-size:22px">You're booked! ✓</h1>
        <p style="margin:6px 0 0;opacity:.9">${args.businessName}</p>
      </div>
      <div style="padding:24px;color:#111">
        <p style="margin:0 0 8px">Hi ${args.customerName},</p>
        <p style="margin:0 0 16px;color:#444">Thanks for booking with <b>${args.businessName}</b>. Your appointment is confirmed.</p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Appointment</p>
          <p style="margin:6px 0 0;font-size:16px;font-weight:600">${args.serviceName}</p>
          <p style="margin:4px 0 0;color:#444">${args.whenStr}</p>
          <p style="margin:4px 0 0;color:#444">with ${args.staffName}</p>
          ${args.address ? `<p style="margin:8px 0 0;color:#666;font-size:13px">📍 ${args.address}</p>` : ""}
        </div>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Invoice</p>
          <p style="margin:6px 0 0;font-size:14px"><b>${args.invoiceNumber}</b></p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:600">${args.currency} ${args.amount}</p>
          <p style="margin:8px 0 0;color:#666;font-size:12px">Due at appointment.</p>
        </div>
        <p style="margin:16px 0 0;color:#666;font-size:13px">A calendar invite (.ics) is attached. Tap to add it to your calendar.</p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;color:#999;font-size:12px;text-align:center">
        Powered by Schedora
      </div>
    </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { bookingId } = await req.json();
    if (!bookingId) throw new Error("bookingId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Create invoice (idempotent via RPC)
    const { data: invoice, error: invErr } = await supabase.rpc("create_invoice_for_booking", { p_booking_id: bookingId });
    if (invErr) throw invErr;

    // 2. Load context
    const { data: booking } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
    if (!booking) throw new Error("booking not found");
    const { data: business } = await supabase.from("businesses").select("*").eq("id", booking.business_id).single();
    const { data: service } = await supabase.from("services").select("name, duration_min").eq("id", booking.service_id).single();
    const { data: staff } = await supabase.from("staff").select("name").eq("id", booking.staff_id).single();

    const address = [business?.address_line1, business?.city, business?.region, business?.postal_code]
      .filter(Boolean).join(", ");
    const whenStr = new Date(booking.start_at).toLocaleString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });

    const ics = buildIcs({
      uid: `${bookingId}@schedora`,
      startAt: booking.start_at,
      endAt: booking.end_at,
      summary: `${service?.name ?? "Appointment"} — ${business?.name ?? ""}`,
      description: `Your booking with ${business?.name ?? ""}.\nInvoice: ${invoice?.invoice_number ?? ""}`,
      location: address,
      organizerEmail: business?.email ?? "noreply@schedora.app",
      organizerName: business?.name ?? "Schedora",
      attendeeEmail: booking.customer_email,
      attendeeName: booking.customer_name,
    });

    const html = buildEmailHtml({
      businessName: business?.name ?? "",
      customerName: booking.customer_name,
      serviceName: service?.name ?? "Appointment",
      staffName: staff?.name ?? "",
      whenStr,
      address,
      invoiceNumber: invoice?.invoice_number ?? "",
      amount: Number(invoice?.total ?? 0).toFixed(2),
      currency: invoice?.currency ?? "USD",
    });

    // 3. Send email via Resend if configured
    const resendKey = Deno.env.get("RESEND_API_KEY");
    let emailStatus: "sent" | "skipped" | "failed" = "skipped";
    let emailError: string | null = null;
    if (resendKey) {
      try {
        const icsB64 = btoa(ics);
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${business?.name ?? "Schedora"} <onboarding@resend.dev>`,
            to: [booking.customer_email],
            subject: `Booking confirmed — ${service?.name ?? "Appointment"} on ${whenStr}`,
            html,
            attachments: [
              {
                filename: "invite.ics",
                content: icsB64,
                content_type: "text/calendar; method=REQUEST",
              },
            ],
          }),
        });
        if (!resp.ok) {
          emailStatus = "failed";
          emailError = await resp.text();
        } else {
          emailStatus = "sent";
        }
      } catch (e) {
        emailStatus = "failed";
        emailError = String(e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, invoice, emailStatus, emailError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("booking-confirmation error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
