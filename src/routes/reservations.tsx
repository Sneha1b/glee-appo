import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarDays, MapPin, Clock, Building2 } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/reservations")({
  component: ReservationsPage,
  head: () => ({
    meta: [
      { title: "My reservations — Schedora" },
      { name: "description", content: "Your upcoming and past appointments." },
    ],
  }),
});

type InvoiceRow = {
  id: string;
  business_id: string;
  service_name: string;
  staff_name: string | null;
  appointment_at: string;
  total: number;
  currency: string;
  status: string;
};

type BusinessRow = {
  id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
  region: string | null;
};

function ReservationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [businesses, setBusinesses] = useState<Record<string, BusinessRow>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth/customer", search: { redirect: "/reservations" } as any });
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function load() {
    setLoading(true);
    const { data: invs } = await supabase
      .from("invoices")
      .select("id, business_id, service_name, staff_name, appointment_at, total, currency, status")
      .order("appointment_at", { ascending: false });
    const list = (invs ?? []) as InvoiceRow[];
    setInvoices(list);
    const ids = Array.from(new Set(list.map((i) => i.business_id)));
    if (ids.length) {
      const { data: biz } = await supabase
        .from("businesses")
        .select("id, name, logo_url, city, region")
        .in("id", ids);
      const map: Record<string, BusinessRow> = {};
      (biz ?? []).forEach((b: any) => (map[b.id] = b));
      setBusinesses(map);
    }
    setLoading(false);
  }

  const now = Date.now();
  const upcoming = invoices.filter((i) => new Date(i.appointment_at).getTime() >= now);
  const past = invoices.filter((i) => new Date(i.appointment_at).getTime() < now);

  if (authLoading || loading) {
    return <div className="p-12 text-center text-muted-foreground">Loading your reservations…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft /> Back
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Your account</p>
            <h1 className="font-semibold">My reservations</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-10">
        <Section title="Upcoming" empty="You have no upcoming reservations." rows={upcoming} businesses={businesses} highlight />
        <Section title="Past" empty="No past reservations yet." rows={past} businesses={businesses} />
      </main>
    </div>
  );
}

function Section({
  title,
  empty,
  rows,
  businesses,
  highlight = false,
}: {
  title: string;
  empty: string;
  rows: InvoiceRow[];
  businesses: Record<string, BusinessRow>;
  highlight?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {empty}
            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link to="/businesses">Browse businesses</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            const biz = businesses[r.business_id];
            return (
              <Card key={r.id} className={highlight ? "border-primary/30" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    {biz?.logo_url ? (
                      <img src={biz.logo_url} alt="" className="size-10 rounded-md border object-cover" />
                    ) : (
                      <div className="grid size-10 place-items-center rounded-md border bg-muted">
                        <Building2 className="size-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">
                        {biz?.name ?? "Business"}
                      </CardTitle>
                      <p className="truncate text-xs text-muted-foreground">{r.service_name}{r.staff_name ? ` · ${r.staff_name}` : ""}</p>
                    </div>
                    <div className="text-right text-sm font-semibold">
                      {r.currency} {Number(r.total).toFixed(2)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-4" /> {fmtDateTime(r.appointment_at)}
                    </span>
                    {(biz?.city || biz?.region) && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-4" /> {[biz.city, biz.region].filter(Boolean).join(", ")}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 capitalize">
                      <Clock className="size-4" /> {r.status}
                    </span>
                    {biz?.id && (
                      <Link
                        to="/businesses/$businessId"
                        params={{ businessId: biz.id }}
                        className="ml-auto text-xs font-medium text-primary hover:underline"
                      >
                        View business →
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
