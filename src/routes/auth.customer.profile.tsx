import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/customer/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Your profile" }] }),
});

function ProfilePage() {
  const { user, loading, refresh, customerProfile } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth/customer", search: { mode: "login" } });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("customer_profiles")
        .select("first_name, last_name, full_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        const d = data as any;
        setFirstName(d.first_name ?? (d.full_name?.split(" ")[0] ?? ""));
        setLastName(d.last_name ?? (d.full_name?.split(" ").slice(1).join(" ") ?? ""));
        setPhone(d.phone ?? "");
      } else {
        const meta = (user.user_metadata ?? {}) as any;
        const guess = (meta.full_name ?? meta.name ?? "").trim();
        const [f, ...rest] = guess.split(" ");
        setFirstName(f ?? "");
        setLastName(rest.join(" "));
      }
      setLoaded(true);
    })();
  }, [loading, user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const full = `${firstName} ${lastName}`.trim();
      const { error } = await supabase.from("customer_profiles").upsert(
        {
          user_id: user.id,
          first_name: firstName,
          last_name: lastName,
          full_name: full,
          phone: phone || null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id" },
      );
      if (error) throw error;
      await refresh();
      toast.success("Profile saved");
      navigate({ to: "/businesses" });
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
          <CardTitle>{customerProfile?.full_name ? "Edit your profile" : "Complete your profile"}</CardTitle>
          <CardDescription>Tell us your name and phone number to make booking faster.</CardDescription>
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
              {busy && <Loader2 className="size-4 animate-spin" />} Save profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
