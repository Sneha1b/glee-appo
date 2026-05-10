import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listRecentBusinessesPublic } from "@/lib/businesses.functions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Clock, Sparkles, Shield, Mail, BarChart3, ArrowRight,
  MapPin, Settings, LogOut, User, Zap, Users,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Schedora — Booking made effortless for service businesses" },
      { name: "description", content: "Schedora is the modern booking platform for hair salons, clinics, studios, and more. Customers book in under a minute. Providers run their day." },
      { property: "og:title", content: "Schedora — Effortless online booking" },
      { property: "og:description", content: "Beautiful booking pages, automatic invoices, calendar invites — built for modern service businesses." },
    ],
  }),
});

type Biz = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  city: string | null;
  region: string | null;
};

function Landing() {
  const { user, role, customerProfile, signOut } = useAuth();
  const fetchRecent = useServerFn(listRecentBusinessesPublic);
  const [businesses, setBusinesses] = useState<Biz[]>([]);

  useEffect(() => {
    fetchRecent({ data: { limit: 8 } })
      .then((rows) => setBusinesses(rows as Biz[]))
      .catch((e) => console.warn("listRecentBusinesses failed", e));
  }, [fetchRecent]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-violet-500/30">
              <Sparkles className="size-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Schedora</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            <a href="#features" className="rounded-md px-3 py-2 text-muted-foreground transition hover:text-foreground">Features</a>
            <a href="#businesses" className="rounded-md px-3 py-2 text-muted-foreground transition hover:text-foreground">Businesses</a>
            <a href="#providers" className="rounded-md px-3 py-2 text-muted-foreground transition hover:text-foreground">For providers</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {role === "provider" ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/auth/provider"><Settings /> Dashboard</Link>
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/profile"><User /> {customerProfile?.full_name?.split(" ")[0] || "Profile"}</Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => signOut()}>
                  <LogOut /> Sign out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/auth/customer" search={{ mode: "login" }}>Sign in</Link>
                </Button>
                <Button size="sm" asChild className="bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white hover:opacity-90">
                  <Link to="/auth/provider" search={{ mode: "signup" }}>Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 top-0 size-[480px] rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="absolute right-0 top-32 size-[520px] rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 size-[420px] rounded-full bg-cyan-400/15 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
          <Badge variant="secondary" className="mb-6 gap-1.5 rounded-full border bg-background/60 px-4 py-1.5 backdrop-blur">
            <Zap className="size-3.5 text-fuchsia-500" /> Built for modern service businesses
          </Badge>
          <h1 className="mx-auto max-w-4xl text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            Booking that{" "}
            <span className="bg-gradient-to-r from-fuchsia-500 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
              feels effortless
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            Schedora helps salons, clinics, studios and trades fill their calendars without the back-and-forth.
            Customers book in under a minute. Providers run their day.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild className="h-12 bg-gradient-to-r from-fuchsia-500 to-violet-600 px-7 text-base text-white shadow-lg shadow-violet-500/30 hover:opacity-90">
              <Link to="/auth/provider" search={{ mode: "signup" }}>
                I'm a provider — start free <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 px-7 text-base">
              <Link to="/auth/customer" search={{ mode: "signup" }}>
                I'm a customer — sign up
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Free to try · No credit card required</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to <span className="bg-gradient-to-r from-fuchsia-500 to-violet-600 bg-clip-text text-transparent">fill your calendar</span>
          </h2>
          <p className="mt-3 text-muted-foreground">No plugins. No spreadsheets. Just bookings.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Calendar, title: "Real-time availability", body: "Slots update live as bookings come in. No double-bookings, ever." },
            { icon: Clock, title: "60-second hold", body: "Your slot is reserved while you confirm — no race conditions." },
            { icon: Mail, title: "Auto confirmation emails", body: "Customers get a polished email with calendar invite the moment they book." },
            { icon: BarChart3, title: "Invoices, automated", body: "Every booking generates an invoice. Filter by date, service, or staff." },
            { icon: Users, title: "Staff & services", body: "Manage who does what, when. Per-staff hours and time blocks." },
            { icon: Shield, title: "Secure by default", body: "Bank-grade auth, row-level security, and PII protection out of the box." },
          ].map((f) => (
            <Card key={f.title} className="group relative overflow-hidden border-2 transition hover:border-violet-500/30 hover:shadow-lg">
              <CardContent className="p-6">
                <div className="mb-4 grid size-11 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-violet-600/10 text-violet-600 ring-1 ring-violet-500/20">
                  <f.icon className="size-5" />
                </div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured businesses */}
      <section id="businesses" className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Browse businesses</h2>
              <p className="mt-2 text-muted-foreground">Real businesses taking bookings on Schedora right now.</p>
            </div>
          </div>
          {businesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No businesses yet — be the first to list yours.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.map((b) => {
                const loc = [b.city, b.region].filter(Boolean).join(", ");
                return (
                  <Link
                    key={b.id}
                    to="/businesses/$businessId"
                    params={{ businessId: b.id }}
                    className="group overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-fuchsia-500/20 to-violet-600/20">
                      {b.banner_url && (
                        <img src={b.banner_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-start gap-3">
                        {b.logo_url && (
                          <img src={b.logo_url} alt="" className="-mt-10 size-12 shrink-0 rounded-lg border bg-background object-cover shadow-md" />
                        )}
                        <div className="min-w-0 flex-1">
                          {b.category && <Badge variant="secondary" className="mb-1.5 text-xs">{b.category}</Badge>}
                          <h3 className="truncate text-base font-semibold">{b.name}</h3>
                          {loc && (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="size-3" /> {loc}
                            </p>
                          )}
                        </div>
                      </div>
                      {b.description && (
                        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Provider CTA */}
      <section id="providers" className="mx-auto max-w-6xl px-6 py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-500 via-violet-600 to-indigo-700 p-10 text-white shadow-2xl shadow-violet-500/30 sm:p-16">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <Badge className="mb-5 border-white/30 bg-white/15 text-white hover:bg-white/20">For providers</Badge>
            <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              List your business in 5 minutes.
            </h2>
            <p className="mt-4 text-lg text-white/90">
              Add your services, set your hours, share your link. Start taking bookings today —
              with confirmation emails, calendar invites and invoices handled automatically.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild className="h-12 bg-white px-7 text-base text-violet-700 hover:bg-white/90">
                <Link to="/auth/provider" search={{ mode: "signup" }}>
                  Create your provider account <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-12 border-white/40 bg-transparent px-7 text-base text-white hover:bg-white/10 hover:text-white">
                <Link to="/auth/provider" search={{ mode: "login" }}>
                  Sign in
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Customer CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border bg-card p-8 sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Booking somewhere on Schedora?</h3>
              <p className="mt-2 text-muted-foreground">Create an account to skip the form next time and keep all your bookings in one place.</p>
            </div>
            <Button size="lg" asChild className="bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white hover:opacity-90">
              <Link to="/auth/customer" search={{ mode: "signup" }}>
                Sign up as a customer <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Schedora. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/auth/customer" search={{ mode: "login" }}>Customer login</Link>
            <Link to="/auth/provider" search={{ mode: "login" }}>Provider login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
