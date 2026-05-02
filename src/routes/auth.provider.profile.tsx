import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/provider/profile")({
  component: ProviderProfilePage,
  head: () => ({ meta: [{ title: "Your provider profile — Schedora" }] }),
});

function ProviderProfilePage() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fetchedForUidRef = useRef<string | null>(null);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      navigate({ to: "/auth/provider", search: { mode: "login" } });
      return;
    }
    if (fetchedForUidRef.current === user.id) return;
    fetchedForUidRef.current = user.id;
    (async () => {
      const { data } = await supabase
        .from("provider_profiles" as any)
        .select("first_name, last_name, phone")
        .eq("user_id", user.id)
        .maybeSingle() as any;
      if (data) {
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setPhone(data.phone ?? "");
      } else {
        const meta = (user.user_metadata ?? {}) as any;
        const guess = (meta.full_name ?? meta.name ?? "").trim();
        const [f, ...rest] = guess.split(" ");
        setFirstName(f ?? "");
        setLastName(rest.join(" "));
      }
      setLoaded(true);
    })();
  }, [loading, user?.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("provider_profiles" as any)
        .upsert(
          {
            user_id: user.id,
            first_name: firstName,
            last_name: lastName,
            email: user.email ?? "",
            phone,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      await refresh();
      toast.success("Profile saved");
      navigate({ to: "/provider" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !loaded) return <div className="p-12 text-center">Loading…</div>;

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tell us about you</CardTitle>
          <CardDescription>
            We use your name and phone so customers and your team can reach you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={user?.email ?? ""} readOnly disabled />
            </div>
            <div>
              <Label>Phone number</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+1 555 123 4567"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Save and continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
