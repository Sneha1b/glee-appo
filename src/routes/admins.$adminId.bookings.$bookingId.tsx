import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Mail, Phone, User, Trash2, CalendarClock } from "lucide-react";
import { computeSlots, type Slot } from "@/lib/slots";
import { fmtDateTime, fmtTime, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admins/$adminId/bookings/$bookingId")({
  component: BookingDetail,
  head: () => ({ meta: [{ title: "Booking — Schedora" }] }),
});

function BookingDetail() {
  const { adminId, bookingId } = Route.useParams();
  const { user, loading: authLoading, role } = useAuth();
  const navigate = useNavigate();
  const [ownership, setOwnership] = useState<"checking" | "owner" | "denied">("checking");
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState<Date | undefined>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [picked, setPicked] = useState<Slot | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/auth/provider", search: { mode: "login" } }); return; }
    if (role !== "provider") { navigate({ to: "/auth/provider", search: { mode: "login" } }); return; }
    let cancelled = false;
    setOwnership("checking");
    (async () => {
      const { data, error } = await supabase
        .from("business_owners")
        .select("business_id")
        .eq("user_id", user.id)
        .eq("business_id", adminId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) { setOwnership("denied"); navigate({ to: "/provider", replace: true }); return; }
      setOwnership("owner");
    })();
    return () => { cancelled = true; };
  }, [authLoading, user?.id, role, adminId]);

  async function load() {
    const { data } = await supabase
      .from("bookings")
      .select("*, service:service_id(id,name,duration_min,price), staff:staff_id(name), business:business_id(name)")
      .eq("id", bookingId)
      .maybeSingle();
    setBooking(data);
    setLoading(false);
    if (data) {
      const d = new Date(data.start_at);
      d.setHours(0, 0, 0, 0);
      setDate(d);
    }
  }
  useEffect(() => {
    if (ownership !== "owner") return;
    load();
  }, [bookingId, ownership]);

  useEffect(() => {
    if (!rescheduling || !booking?.service || !date) return;
    setLoadingSlots(true); setPicked(null);
    computeSlots({ serviceId: booking.service.id, durationMin: booking.service.duration_min, date })
      .then((s) => setSlots(s.filter((x) => x.staffId === booking.staff_id)))
      .catch((e) => toast.error(e.message ?? "Failed to load slots"))
      .finally(() => setLoadingSlots(false));
  }, [rescheduling, date, booking]);

  async function cancel() {
    if (!confirm("Cancel this booking? The customer will be emailed.")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
      if (error) throw error;
      supabase.functions.invoke("booking-confirmation", { body: { bookingId, action: "cancel" } })
        .catch((e) => console.warn(e));
      toast.success("Booking cancelled — email sent.");
      navigate({ to: "/admins/$adminId", params: { adminId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to cancel");
    } finally { setBusy(false); }
  }

  async function applyReschedule() {
    if (!picked || !booking) return;
    const previousStartAt = booking.start_at;
    const previousEndAt = booking.end_at;
    setBusy(true);
    try {
      const { error } = await supabase.from("bookings")
        .update({ start_at: picked.startAt, end_at: picked.endAt })
        .eq("id", bookingId);
      if (error) throw error;
      supabase.functions.invoke("booking-confirmation", {
        body: { bookingId, action: "reschedule", previousStartAt, previousEndAt },
      }).catch((e) => console.warn(e));
      toast.success("Rescheduled — updated invite emailed.");
      setRescheduling(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reschedule");
    } finally { setBusy(false); }
  }

  if (ownership !== "owner" || loading || !booking) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;

  const cancelled = booking.status === "cancelled";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admins/$adminId" params={{ adminId }}><ArrowLeft /> Back to dashboard</Link>
          </Button>
          <h1 className="font-semibold">Booking detail</h1>
          {cancelled && <Badge variant="destructive" className="ml-2">Cancelled</Badge>}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{booking.service?.name}</CardTitle>
            <CardDescription>{fmtDateTime(booking.start_at)} → {fmtTime(booking.end_at)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Staff</p>
              <p className="font-medium">{booking.staff?.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Price</p>
              <p className="font-medium">${Number(booking.service?.price ?? 0).toFixed(2)}</p>
            </div>
            <div className="sm:col-span-2 border-t pt-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Customer</p>
              <p className="flex items-center gap-2"><User className="size-4 text-muted-foreground" /> {booking.customer_name}</p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="size-4" /> {booking.customer_email}</p>
              {booking.customer_phone && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="size-4" /> {booking.customer_phone}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {!cancelled && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRescheduling((v) => !v)} disabled={busy}>
              <CalendarClock /> {rescheduling ? "Close reschedule" : "Reschedule"}
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={busy}>
              <Trash2 /> Cancel booking
            </Button>
          </div>
        )}

        {rescheduling && !cancelled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pick a new time</CardTitle>
              <CardDescription>Showing slots for {booking.staff?.name}. The customer will receive an updated calendar invite.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-[auto_1fr]">
              <Calendar
                mode="single" selected={date} onSelect={setDate}
                disabled={(d) => { const t = new Date(); t.setHours(0,0,0,0); return d < t; }}
                className="pointer-events-auto p-0"
              />
              <div>
                <p className="mb-2 text-sm font-medium">{date ? fmtDate(date) : "Pick a date"}</p>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No availability for this staff on this day.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => {
                      const isPicked = picked?.startAt === s.startAt;
                      return (
                        <Button key={s.startAt} size="sm" variant={isPicked ? "default" : "outline"}
                          onClick={() => setPicked(s)}>
                          {fmtTime(s.startAt)}
                        </Button>
                      );
                    })}
                  </div>
                )}
                {picked && (
                  <Button onClick={applyReschedule} disabled={busy} className="mt-4">
                    {busy && <Loader2 className="size-4 animate-spin" />} Confirm reschedule to {fmtTime(picked.startAt)}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
