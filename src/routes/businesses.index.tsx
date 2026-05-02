import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, MapPin, ArrowLeft, Building2 } from "lucide-react";

export const Route = createFileRoute("/businesses/")({
  component: Businesses,
  head: () => ({
    meta: [
      { title: "Browse businesses — Schedora" },
      { name: "description", content: "Find a business and book your next appointment on Schedora." },
    ],
  }),
});

type Biz = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  region: string | null;
};

function Businesses() {
  const [rows, setRows] = useState<Biz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("businesses")
      .select("id,name,category,description,logo_url,city,region")
      .order("name")
      .then(({ data }) => { setRows((data as Biz[]) ?? []); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft /> Home</Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white">
              <Sparkles className="size-4" />
            </div>
            <h1 className="font-semibold">Browse businesses</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <Building2 className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No businesses listed yet.</p>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {rows.map((b) => {
              const loc = [b.city, b.region].filter(Boolean).join(", ");
              return (
                <li key={b.id}>
                  <Link
                    to="/businesses/$businessId"
                    params={{ businessId: b.id }}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-accent"
                  >
                    {b.logo_url ? (
                      <img src={b.logo_url} alt="" className="size-12 shrink-0 rounded-lg border object-cover" />
                    ) : (
                      <div className="grid size-12 shrink-0 place-items-center rounded-lg border bg-gradient-to-br from-fuchsia-500/15 to-violet-600/15 text-violet-600">
                        <Building2 className="size-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{b.name}</p>
                        {b.category && <Badge variant="secondary" className="text-xs">{b.category}</Badge>}
                      </div>
                      {loc && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" /> {loc}
                        </p>
                      )}
                      {b.description && (
                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{b.description}</p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
