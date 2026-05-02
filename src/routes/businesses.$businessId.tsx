import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Phone, Calendar as CalIcon, Settings, LogOut, User, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/businesses/$businessId")({
  component: BusinessPage,
  head: () => ({ meta: [{ title: "Book your appointment" }] }),
});

type Business = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
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

function buildMapsUrl(b: Business) {
  const parts = [b.address_line1, b.address_line2, b.city, b.region, b.postal_code, b.country].filter(Boolean);
  const q = encodeURIComponent(parts.join(", "));
  const isApple = typeof navigator !== "undefined" && /iP(hone|ad|od)|Mac/.test(navigator.platform || "");
  return isApple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function BusinessPage() {
  const { businessId } = Route.useParams();
  const { user, role, customerProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [biz, setBiz] = useState<Business | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [b, c, s] = await Promise.all([
        supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
        supabase.from("service_categories").select("*").eq("business_id", businessId).order("sort_order"),
        supabase.from("services").select("*").eq("business_id", businessId).eq("active", true),
      ]);
      setBiz(b.data as Business | null);
      setCats((c.data as Category[]) ?? []);
      setServices((s.data as Service[]) ?? []);
      setLoading(false);
    })();
  }, [businessId]);

  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!biz) return (
    <div className="p-12 text-center">
      <p className="text-muted-foreground">Business not found.</p>
      <Button variant="link" onClick={() => navigate({ to: "/" })}>Back home</Button>
    </div>
  );

  const addressLine = [biz.address_line1, biz.city, biz.region, biz.postal_code].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/"><ArrowLeft /> Home</Link>
            </Button>
            {biz.logo_url && (
              <img src={biz.logo_url} alt={`${biz.name} logo`} className="size-8 rounded-md object-cover border" />
            )}
            <h1 className="truncate text-base font-semibold">{biz.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/auth/customer/profile">
                    <User /> {customerProfile?.full_name || "Profile"}
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => signOut()}>
                  <LogOut /> Sign out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/auth/customer" search={{ mode: "login" }}>Sign in</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/auth/customer" search={{ mode: "signup" }}>Sign up</Link>
                </Button>
              </>
            )}
            {role === "provider" && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin"><Settings /> Admin</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <section className="mb-10 overflow-hidden rounded-xl border bg-card">
          {biz.banner_url ? (
            <div className="relative h-48 w-full sm:h-64">
              <img src={biz.banner_url} alt={`${biz.name} banner`} className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="p-6 pt-6 sm:pt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {biz.logo_url && (
                <img
                  src={biz.logo_url}
                  alt={`${biz.name} logo`}
                  className={`size-16 shrink-0 rounded-lg border bg-background object-cover shadow-sm ${biz.banner_url ? "sm:-mt-16" : ""}`}
                />
              )}
              <div className="min-w-0 flex-1">
                {biz.category && <Badge variant="secondary" className="mb-2">{biz.category}</Badge>}
                <h2 className="text-2xl font-semibold tracking-tight">{biz.name}</h2>
                {biz.description && (
                  <p className="mt-2 max-w-2xl text-muted-foreground">{biz.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  {addressLine && (
                    <a
                      href={buildMapsUrl(biz)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 underline-offset-2 hover:text-foreground hover:underline"
                    >
                      <MapPin className="size-4" /> {addressLine}
                    </a>
                  )}
                  {biz.phone && (
                    <a href={`tel:${biz.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                      <Phone className="size-4" /> {biz.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>
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
    </div>
  );
}
