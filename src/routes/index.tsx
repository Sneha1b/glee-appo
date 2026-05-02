import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Phone, Calendar as CalIcon, Settings } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "SlotKit — Book your appointment" },
      { name: "description", content: "Browse services and book an appointment in under a minute." },
    ],
  }),
});

type Business = {
  id: string;
  name: string;
  category: string | null;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  phone: string | null;
};
type Category = { id: string; name: string; sort_order: number };
type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;
  category_id: string | null;
};

function Home() {
  const [biz, setBiz] = useState<Business | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [b, c, s] = await Promise.all([
        supabase.from("businesses").select("*").limit(1).maybeSingle(),
        supabase.from("service_categories").select("*").order("sort_order"),
        supabase.from("services").select("*").eq("active", true),
      ]);
      setBiz(b.data as Business | null);
      setCats((c.data as Category[]) ?? []);
      setServices((s.data as Service[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!biz) return <div className="p-12 text-center">No business configured.</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">SlotKit</p>
            <h1 className="text-xl font-semibold">{biz.name}</h1>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin">
              <Settings /> Provider
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <section className="mb-10 rounded-xl border bg-card p-6">
          <Badge variant="secondary" className="mb-3">{biz.category}</Badge>
          <h2 className="text-3xl font-semibold tracking-tight">Book in under a minute.</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Pick a service, choose a time that works, and you're done. We'll hold your slot for 60 seconds while you confirm.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {biz.address_line1 && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> {biz.address_line1}, {biz.city}, {biz.region} {biz.postal_code}
              </span>
            )}
            {biz.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4" /> {biz.phone}
              </span>
            )}
          </div>
        </section>

        {cats.map((cat) => {
          const items = services.filter((s) => s.category_id === cat.id);
          if (items.length === 0) return null;
          return (
            <section key={cat.id} className="mb-8">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {cat.name}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((s) => (
                  <Card key={s.id} className="transition-shadow hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base">{s.name}</CardTitle>
                        <span className="text-base font-semibold">${Number(s.price).toFixed(0)}</span>
                      </div>
                      {s.description && <CardDescription>{s.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="size-4" /> {s.duration_min} min
                      </span>
                      <Button asChild size="sm">
                        <Link to="/book/$serviceId" params={{ serviceId: s.id }}>
                          <CalIcon /> Book
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        SlotKit · Demo appointment booking
      </footer>
    </div>
  );
}
