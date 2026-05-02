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
  head: () => ({ meta: [{ title: "Your profile — SlotKit" }] }),
});

function ProfilePage() {
  const { user, loading, refresh, customerProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth/customer", search: { mode: "login" } }); return; }
    if (customerProfile) {
      setName(customerProfile.full_name);
      setPhone(customerProfile.phone ?? "");
    } else {
      setName((user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? "");
    }
  }, [loading, user, customerProfile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("customer_profiles").upsert({
        user_id: user.id, full_name: name, phone: phone || null, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      await refresh();
      toast.success("Profile saved");
      navigate({ to: "/" });
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  }

  if (loading) return <div className="p-12 text-center">Loading…</div>;

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>Tell us your name and contact info to make booking faster.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div><Label>Phone (optional)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Save profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
