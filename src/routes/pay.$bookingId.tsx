import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, ShieldCheck, Lock, CheckCircle2 } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/pay/$bookingId")({
  component: PayPage,
  head: () => ({ meta: [{ title: "Payment — Schedora" }] }),
});

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
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvc: "", zip: "" });

  useEffect(() => {
    supabase
      .from("bookings")
      .select("*, service:service_id(name,price), staff:staff_id(name), business:business_id(name)")
      .eq("id", bookingId)
      .maybeSingle()
      .then(({ data }) => { setBooking(data); setLoading(false); });
  }, [bookingId]);

  function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!card.name || card.number.replace(/\s/g, "").length < 12 || card.expiry.length < 5 || card.cvc.length < 3) {
      toast.error("Please fill in all card details (mock).");
      return;
    }
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setPaid(true);
      toast.success("Payment recorded (mock — no charge made).");
    }, 900);
  }

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!booking) return <div className="p-12 text-center text-muted-foreground">Booking not found.</div>;

  const amount = Number(booking.service?.price ?? 0);

  if (paid) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-xl px-6 py-16 text-center">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle2 className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold">All set!</h1>
          <p className="mt-2 text-muted-foreground">
            {booking.service?.name} with {booking.staff?.name}
          </p>
          <p className="mt-1 font-medium">{fmtDateTime(booking.start_at)}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            A confirmation email and calendar invite are on the way.
          </p>
          <Button className="mt-8" onClick={() => navigate({ to: "/" })}>Back to home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft /> Skip for now</Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Step 2 of 2</p>
            <h1 className="font-semibold">Confirm payment</h1>
          </div>
          <Badge variant="secondary" className="ml-auto"><Lock className="size-3" /> Mock checkout</Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-3xl gap-6 px-6 py-8 md:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="size-4" /> Card details
            </CardTitle>
            <CardDescription>
              This is a demo checkout — no real charges are made and no card data is stored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={pay} className="space-y-3">
              <div>
                <Label htmlFor="cn">Name on card</Label>
                <Input id="cn" autoComplete="cc-name" value={card.name}
                  onChange={(e) => setCard({ ...card, name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="ccnum">Card number</Label>
                <Input id="ccnum" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242"
                  value={card.number}
                  onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })} required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="exp">Expiry</Label>
                  <Input id="exp" placeholder="MM/YY" value={card.expiry}
                    onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })} required />
                </div>
                <div>
                  <Label htmlFor="cvc">CVC</Label>
                  <Input id="cvc" inputMode="numeric" placeholder="123" maxLength={4} value={card.cvc}
                    onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "") })} required />
                </div>
                <div>
                  <Label htmlFor="zip">ZIP</Label>
                  <Input id="zip" value={card.zip}
                    onChange={(e) => setCard({ ...card, zip: e.target.value })} />
                </div>
              </div>
              <Button type="submit" disabled={paying} className="w-full" size="lg">
                {paying ? "Processing…" : `Pay $${amount.toFixed(2)} (mock)`}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3" /> Demo only — clicking pay does not charge anything.
              </p>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{booking.service?.name}</p>
              <p className="text-muted-foreground">{booking.business?.name}</p>
            </div>
            <div className="text-muted-foreground">
              {fmtDateTime(booking.start_at)}<br />with {booking.staff?.name}
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${amount.toFixed(2)}</span></div>
              <div className="mt-1 flex justify-between font-semibold text-base"><span>Total</span><span>${amount.toFixed(2)}</span></div>
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate({ to: "/" })}>
              Pay later — keep my booking
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
