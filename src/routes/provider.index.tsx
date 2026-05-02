import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Building2, MapPin, LogOut, User } from "lucide-react";

export const Route = createFileRoute("/provider/")({
  component: ProviderLanding,
  head: () => ({ meta: [{ title: "Your businesses — Schedora" }] }),
});

type Biz = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  region: string | null;
  logo_url: string | null;
  banner_url: string | null;
};

function ProviderLanding() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [busy, setBusy] = useState(true);
  const [profileComplete, setProfileComplete] = useState(true);
  const loadedForUidRef = useRef<string | null>(null);
  const redirectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (redirectedRef.current === "anon") return;
      redirectedRef.current = "anon";
      navigate({ to: "/auth/provider", search: { mode: "login" } });
      return;
    }
    if (loadedForUidRef.current === user.id) return;
    loadedForUidRef.current = user.id;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  async function load() {
    setBusy(true);
    // Profile completeness is informational only — surface a banner instead of forcing a redirect
    const { data: pp } = await supabase
      .from("provider_profiles" as any)
      .select("first_name, last_name, phone")
      .eq("user_id", user!.id)
      .maybeSingle() as any;
    const complete = !!(pp && pp.first_name && pp.last_name && pp.phone);
    setProfileComplete(complete);
    // Auto-claim any pending co-manager invites for this email
    await supabase.rpc("accept_pending_business_invites" as any);
    const { data: links } = await supabase
      .from("business_owners")
      .select("business_id")
      .eq("user_id", user!.id);
    const ids = (links ?? []).map((l: any) => l.business_id).filter(Boolean);
    if (ids.length === 0) { setBusinesses([]); setBusy(false); return; }
    const { data } = await supabase
      .from("businesses")
      .select("id, name, category, city, region, logo_url, banner_url")
      .in("id", ids);
    setBusinesses((data as Biz[]) ?? []);
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 bg-clip-text text-transparent">
            Schedora
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/profile"><User className="size-4" /> Profile</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your businesses</h1>
            <p className="text-muted-foreground mt-1">Pick a business to manage, or create a new one.</p>
          </div>
          <Button onClick={() => navigate({ to: "/provider/new" })} className="gap-2">
            <Plus className="size-4" /> Add business
          </Button>
        </div>

        {!busy && !profileComplete && (
          <Card className="mb-6 border-dashed bg-muted/40">
            <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <User className="size-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Complete your profile</p>
                  <p className="text-sm text-muted-foreground">Add your name and phone so customers and your team can reach you.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/profile">Complete profile</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {busy ? (
          <div className="text-center text-muted-foreground py-20">Loading…</div>
        ) : businesses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center space-y-4">
              <Building2 className="size-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No businesses yet</h3>
                <p className="text-muted-foreground">Create your first business to start accepting bookings.</p>
              </div>
              <Button onClick={() => navigate({ to: "/provider/new" })} className="gap-2">
                <Plus className="size-4" /> Create your first business
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => (
              <Link key={b.id} to="/admins/$adminId" params={{ adminId: b.id }} className="group">
                <Card className="overflow-hidden h-full transition hover:shadow-lg hover:-translate-y-0.5">
                  <div className="h-28 bg-gradient-to-br from-fuchsia-500/20 via-violet-500/20 to-indigo-500/20 relative">
                    {b.banner_url && <img src={b.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt="" className="size-10 rounded-md object-cover border" />
                      ) : (
                        <div className="size-10 rounded-md bg-gradient-to-br from-fuchsia-500 to-indigo-500 grid place-items-center text-white font-bold">
                          {b.name?.[0]?.toUpperCase() ?? "B"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{b.name}</CardTitle>
                        {b.category && <CardDescription className="truncate">{b.category}</CardDescription>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {(b.city || b.region) && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="size-3.5" /> {[b.city, b.region].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
