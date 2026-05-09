import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { upsertProviderProfileFn } from "@/lib/profile.functions";
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
  const { user, loading, refresh, providerProfile } = useAuth();
  const navigate = useNavigate();
  const callUpsert = useServerFn(upsertProviderProfileFn);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth/provider", search: { mode: "login" } });
      return;
    }
    if (providerProfile) {
      setFirstName(providerProfile.first_name ?? "");
      setLastName(providerProfile.last_name ?? "");
      setPhone(providerProfile.phone ?? "");
    }
  }, [loading, user, providerProfile, navigate]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await callUpsert({
        data: { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() },
      });
      await refresh();
      toast.success("Profile saved");
      navigate({ to: "/provider" });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-12 text-center">Loading…</div>;

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
              <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
              <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={user?.email ?? ""} readOnly disabled />
            </div>
            <div>
              <Label>Phone number</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+1 555 123 4567" />
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
