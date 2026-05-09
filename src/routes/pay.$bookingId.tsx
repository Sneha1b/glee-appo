import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBookingPublic, finalizeBookingPayment } from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, CreditCard, ShieldCheck, Lock, CheckCircle2,
  MapPin, User, Clock, Calendar as CalendarIcon, Building2, Mail, Phone,
} from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/pay/$bookingId")({
  component: PayPage,
  head: () => ({ meta: [{ title: "Confirm & pay — Schedora" }] }),
});

type Booking = NonNullable<Awaited<ReturnType<typeof getBookingPublic>>>;

function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length < 3) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function PayPage() {
  const { bookingId } = Route.useParams();
  const navigate = useNavigate();
  const callGet = useServerFn(getBookingPublic);
  const callFinalize = useServerFn(finalizeBookingPayment);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [card, setCard] = useState({
    name: "", number: "", expiry: "", cvc: "",
    addr1: "", city: "", region: "", zip: "",
  });

  useEffect(() => {
    callGet({ data: { bookingId } })
      .then((b) => setBooking(b))
      .finally(() => setLoading(false));
  }, [bookingId, callGet]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setPaying(true);
    try {
      const res = await callFinalize({ data: { bookingId } });
      if (!res.ok) {
        toast.error(res.error ?? "Could not finalize booking. Please try again.");
        return;
      }
      setPaid(true);
      setEmailSent((res.emailStatus as string) === "sent");
      toast.success((res.emailStatus as string) === "sent"
        ? "Payment successful (mock). Confirmation email sent."
        : "Payment successful (mock). Your booking is confirmed.");
      setTimeout(() => navigate({ to: "/reservations" }), 2500);
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading your booking…</div>;
  if (!booking) {
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <p className="text-muted-foreground">We couldn't find that booking.</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/" })}>Back to home</Button>
      </div>
    );
  }

  const amount = Number(booking.service?.price ?? 0);
  const address = [
    booking.business.address_line1, booking.business.address_line2,
    [booking.business.city, booking.business.region, booking.business.postal_code].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");

  if (paid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fuchsia-500/5 via-violet-500/5 to-indigo-500/5">
        <div className="mx-auto max-w-xl px-6 py-20 text-center">
          <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-violet-500/30">
            <CheckCircle2 className="size-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Booking confirmed!</h1>
          <p className="mt-2 text-muted-foreground">
            Your appointment at <b>{booking.business.name}</b> is locked in.
          </p>
          <Card className="mt-8 text-left">
            <CardContent className="space-y-3 p-6">
              <div className="flex items-start gap-3">
                <CalendarIcon className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">When</p>
                  <p className="font-medium">{fmtDateTime(booking.start_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Service</p>
                  <p className="font-medium">{booking.service.name} with {booking.staff.name}</p>
                </div>
              </div>
              {address && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Where</p>
                    <p className="font-medium">{address}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          {emailSent ? (
            <p className="mt-6 text-sm text-muted-foreground">
              We've emailed a confirmation with a calendar invite to <b>{booking.customer_email}</b>.
            </p>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Save this page or take a screenshot — we'll show your booking details here.
            </p>
          )}
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild><Link to="/reservations">My reservations</Link></Button>
            <Button variant="outline" asChild><Link to="/">Back to home</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft /> Back</Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Confirm & pay</p>
            <h1 className="font-semibold">Your booking</h1>
          </div>
          <Badge variant="secondary" className="ml-auto"><Lock className="size-3" /> Mock checkout</Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-fuchsia-500/10 via-violet-500/10 to-indigo-500/10 px-6 py-5">
              <div className="flex items-center gap-3">
                {booking.business.logo_url ? (
                  <img src={booking.business.logo_url} alt="" className="size-12 rounded-lg border bg-background object-cover" />
                ) : (
                  <div className="grid size-12 place-items-center rounded-lg border bg-background">
                    <Building2 className="size-5 text-violet-600" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Booking with</p>
                  <h2 className="truncate text-lg font-bold">{booking.business.name}</h2>
                </div>
              </div>
            </div>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <Detail icon={CalendarIcon} label="When" value={fmtDateTime(booking.start_at)} />
              <Detail icon={Clock} label="Duration" value={`${booking.service.duration_min} minutes`} />
              <Detail icon={User} label="Service" value={booking.service.name} />
              <Detail icon={User} label="With" value={booking.staff.name} />
              {address && (
                <div className="sm:col-span-2"><Detail icon={MapPin} label="Location" value={address} /></div>
              )}
              <div className="sm:col-span-2 border-t pt-4">
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Booking for</p>
                <p className="flex items-center gap-2 font-medium"><User className="size-4 text-muted-foreground" /> {booking.customer_name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground"><Mail className="size-3.5" /> {booking.customer_email}</p>
                {booking.customer_phone && (
                  <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground"><Phone className="size-3.5" /> {booking.customer_phone}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4" /> Payment details
              </CardTitle>
              <CardDescription>
                Demo checkout — clicking pay does not charge anything and no card data is stored.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={pay} className="space-y-3">
                <div>
                  <Label htmlFor="cn">Name on card</Label>
                  <Input id="cn" autoComplete="cc-name" value={card.name}
                    onChange={(e) => setCard({ ...card, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="ccnum">Card number</Label>
                  <Input id="ccnum" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242"
                    value={card.number}
                    onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="exp">Expiry</Label>
                    <Input id="exp" placeholder="MM/YY" value={card.expiry}
                      onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })} />
                  </div>
                  <div>
                    <Label htmlFor="cvc">CVC</Label>
                    <Input id="cvc" inputMode="numeric" placeholder="123" maxLength={4} value={card.cvc}
                      onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "") })} />
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing address</p>
                  <div className="space-y-3">
                    <div><Label htmlFor="b-addr">Street address</Label>
                      <Input id="b-addr" autoComplete="street-address" value={card.addr1}
                        onChange={(e) => setCard({ ...card, addr1: e.target.value })} /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label htmlFor="b-city">City</Label>
                        <Input id="b-city" value={card.city} onChange={(e) => setCard({ ...card, city: e.target.value })} /></div>
                      <div><Label htmlFor="b-reg">State / Region</Label>
                        <Input id="b-reg" value={card.region} onChange={(e) => setCard({ ...card, region: e.target.value })} /></div>
                      <div><Label htmlFor="b-zip">ZIP</Label>
                        <Input id="b-zip" value={card.zip} onChange={(e) => setCard({ ...card, zip: e.target.value })} /></div>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={paying} className="w-full bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white hover:opacity-90" size="lg">
                  {paying ? "Processing…" : `Pay $${amount.toFixed(2)} now`}
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3" /> Demo only — no real charge is made.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit md:sticky md:top-6">
          <CardHeader><CardTitle className="text-base">Order summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{booking.service.name}</p>
              <p className="text-muted-foreground">{booking.business.name} · {booking.staff.name}</p>
            </div>
            <div className="text-muted-foreground">{fmtDateTime(booking.start_at)}</div>
            <div className="space-y-1 border-t pt-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${amount.toFixed(2)}</span></div>
              <div className="flex justify-between text-base font-semibold"><span>Total</span><span>${amount.toFixed(2)}</span></div>
            </div>
            <p className="text-xs text-muted-foreground">
              You can pay later — your booking is already held. Closing this page won't cancel it.
            </p>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate({ to: "/" })}>
              Skip payment for now
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}
