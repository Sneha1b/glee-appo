// Sends booking confirmation / cancellation / reschedule emails with ICS invite.
// action: 'confirm' (default) | 'cancel' | 'reschedule'
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
  uid: string; sequence: number; method: "REQUEST" | "CANCEL";
  startAt: string; endAt: string; summary: string; description: string; location: string;
  organizerEmail: string; organizerName: string; attendeeEmail: string; attendeeName: string;
  status: "CONFIRMED" | "CANCELLED";
}) {
  const dtstamp = icsDate(new Date().toISOString());
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Schedora//Booking//EN", "CALSCALE:GREGORIAN",
    `METHOD:${opts.method}`,
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `SEQUENCE:${opts.sequence}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${icsDate(opts.startAt)}`,
    `DTEND:${icsDate(opts.endAt)}`,
    `SUMMARY:${escapeIcs(opts.summary)}`,
    `DESCRIPTION:${escapeIcs(opts.description)}`,
    `LOCATION:${escapeIcs(opts.location)}`,
    `ORGANIZER;CN=${escapeIcs(opts.organizerName)}:mailto:${opts.organizerEmail}`,
    `ATTENDEE;CN=${escapeIcs(opts.attendeeName)};RSVP=TRUE:mailto:${opts.attendeeEmail}`,
    `STATUS:${opts.status}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

function emailShell(headerTitle: string, headerSub: string, bodyInner: string) {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7fb;margin:0;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:24px;color:#fff">
        <h1 style="margin:0;font-size:22px">${headerTitle}</h1>
        <p style="margin:6px 0 0;opacity:.9">${headerSub}</p>
      </div>
      <div style="padding:24px;color:#111">${bodyInner}</div>
      <div style="padding:16px 24px;background:#fafafa;color:#999;font-size:12px;text-align:center">Powered by Schedora</div>
    </div></body></html>`;
}

function detailBlock(label: string, serviceName: string, whenStr: string, staffName: string, address: string) {
  return `<div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;margin:16px 0">
    <p style="margin:0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em">${label}</p>
    <p style="margin:6px 0 0;font-size:16px;font-weight:600">${serviceName}</p>
    <p style="margin:4px 0 0;color:#444">${whenStr}</p>
    <p style="margin:4px 0 0;color:#444">with ${staffName}</p>
    ${address ? `<p style="margin:8px 0 0;color:#666;font-size:13px">📍 ${address}</p>` : ""}
  </div>`;
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { bookingId, action = "confirm", previousStartAt, previousEndAt } = body;
    if (!bookingId) throw new Error("bookingId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
    if (!booking) throw new Error("booking not found");
    const { data: business } = await supabase.from("businesses").select("*").eq("id", booking.business_id).single();
    const { data: service } = await supabase.from("services").select("name").eq("id", booking.service_id).single();
    const { data: staff } = await supabase.from("staff").select("name").eq("id", booking.staff_id).single();

    const address = [business?.address_line1, business?.city, business?.region, business?.postal_code]
      .filter(Boolean).join(", ");
    const whenStr = fmtWhen(booking.start_at);
    const serviceName = service?.name ?? "Appointment";
    const staffName = staff?.name ?? "";

    let invoice: any = null;
    let subject = "";
    let html = "";
    let icsMethod: "REQUEST" | "CANCEL" = "REQUEST";
    let icsStatus: "CONFIRMED" | "CANCELLED" = "CONFIRMED";
    let sequence = 0;
    let icsStart = booking.start_at;
    let icsEnd = booking.end_at;

    if (action === "confirm") {
      const { data: inv, error: invErr } = await supabase.rpc("create_invoice_for_booking", { p_booking_id: bookingId });
      if (invErr) throw invErr;
      invoice = inv;
      subject = `Booking confirmed — ${serviceName} on ${whenStr}`;
      const inner = `
        <p style="margin:0 0 8px">Hi ${booking.customer_name},</p>
        <p style="margin:0 0 16px;color:#444">Thanks for booking with <b>${business?.name ?? ""}</b>. Your appointment is confirmed.</p>
        ${detailBlock("Appointment", serviceName, whenStr, staffName, address)}
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Invoice</p>
          <p style="margin:6px 0 0;font-size:14px"><b>${invoice?.invoice_number ?? ""}</b></p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:600">${invoice?.currency ?? "USD"} ${Number(invoice?.total ?? 0).toFixed(2)}</p>
          <p style="margin:8px 0 0;color:#666;font-size:12px">Due at appointment.</p>
        </div>
        <p style="margin:16px 0 0;color:#666;font-size:13px">A calendar invite (.ics) is attached.</p>`;
      html = emailShell("You're booked! ✓", business?.name ?? "", inner);
    } else if (action === "cancel") {
      subject = `Booking cancelled — ${serviceName} on ${whenStr}`;
      icsMethod = "CANCEL";
      icsStatus = "CANCELLED";
      sequence = 1;
      const inner = `
        <p style="margin:0 0 8px">Hi ${booking.customer_name},</p>
        <p style="margin:0 0 16px;color:#444">Your appointment with <b>${business?.name ?? ""}</b> has been <b style="color:#dc2626">cancelled</b>.</p>
        ${detailBlock("Cancelled appointment", serviceName, whenStr, staffName, address)}
        <p style="margin:16px 0 0;color:#444">If this was a mistake or you'd like to rebook, please contact us${business?.phone ? ` at ${business.phone}` : ""}.</p>`;
      html = emailShell("Booking cancelled", business?.name ?? "", inner);
    } else if (action === "reschedule") {
      subject = `Booking rescheduled — ${serviceName} now on ${whenStr}`;
      sequence = 2;
      const oldWhen = previousStartAt ? fmtWhen(previousStartAt) : "previous time";
      const inner = `
        <p style="margin:0 0 8px">Hi ${booking.customer_name},</p>
        <p style="margin:0 0 16px;color:#444">Your appointment with <b>${business?.name ?? ""}</b> has been <b>rescheduled</b>.</p>
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px;margin:8px 0;color:#92400e;font-size:13px">
          Previously: ${oldWhen}
        </div>
        ${detailBlock("New appointment time", serviceName, whenStr, staffName, address)}
        <p style="margin:16px 0 0;color:#666;font-size:13px">An updated calendar invite is attached — accepting it will replace the old event.</p>`;
      html = emailShell("Appointment rescheduled", business?.name ?? "", inner);
    } else {
      throw new Error(`unknown action ${action}`);
    }

    const ics = buildIcs({
      uid: `${bookingId}@schedora`,
      sequence,
      method: icsMethod,
      startAt: icsStart,
      endAt: icsEnd,
      summary: `${serviceName} — ${business?.name ?? ""}`,
      description: `Booking with ${business?.name ?? ""}.`,
      location: address,
      organizerEmail: "noreply@schedora.app",
      organizerName: business?.name ?? "Schedora",
      attendeeEmail: booking.customer_email,
      attendeeName: booking.customer_name,
      status: icsStatus,
    });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    let emailStatus: "sent" | "skipped" | "failed" = "skipped";
    let emailError: string | null = null;
    if (resendKey) {
      try {
        const icsB64 = btoa(ics);
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${business?.name ?? "Schedora"} <onboarding@resend.dev>`,
            to: [booking.customer_email],
            subject, html,
            attachments: [{
              filename: action === "cancel" ? "cancel.ics" : "invite.ics",
              content: icsB64,
              content_type: `text/calendar; method=${icsMethod}`,
            }],
          }),
        });
        if (!resp.ok) { emailStatus = "failed"; emailError = await resp.text(); }
        else emailStatus = "sent";
      } catch (e) { emailStatus = "failed"; emailError = String(e); }
    }

    return new Response(
      JSON.stringify({ ok: true, action, invoice, emailStatus, emailError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("booking-confirmation error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
