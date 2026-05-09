import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { upsertCustomerProfileFn } from "@/lib/profile.functions";
import { listBusinessesPublic } from "@/lib/businesses.functions";
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
  const callUpsert = useServerFn(upsertCustomerProfileFn);
  const callListBiz = useServerFn(listBusinessesPublic);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth/customer", search: { mode: "login" } });
      return;
    }
    if (customerProfile) {
      setFirstName(customerProfile.first_name ?? customerProfile.full_name?.split(" ")[0] ?? "");
      setLastName(customerProfile.last_name ?? customerProfile.full_name?.split(" ").slice(1).join(" ") ?? "");
      setPhone(customerProfile.phone ?? "");
    }
  }, [loading, user, customerProfile, navigate]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await callUpsert({
        data: { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || null },
      });
      await refresh();
      toast.success("Profile saved");
      const bizes = await callListBiz();
      if (bizes.length === 1) {
        navigate({ to: "/businesses/$businessId", params: { businessId: bizes[0].id } });
      } else {
        navigate({ to: "/businesses" });
      }
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
              <Label>Email</Label>
              <Input type="email" value={user?.email ?? ""} readOnly disabled />
            </div>
            <div>
              <Label>Phone number</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+1 555 123 4567" />
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
