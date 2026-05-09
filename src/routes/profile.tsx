import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { upsertCustomerProfileFn, upsertProviderProfileFn } from "@/lib/profile.functions";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Your profile — Schedora" }] }),
});

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  phone: z.string().trim().min(3, "Phone is required").max(40),
});

function ProfilePage() {
  const { user, role, customerProfile, providerProfile, loading: authLoading, refresh } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const callCustomer = useServerFn(upsertCustomerProfileFn);
  const callProvider = useServerFn(upsertProviderProfileFn);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/" }); return; }
    if (role === "provider" && providerProfile) {
      setFirstName(providerProfile.first_name ?? "");
      setLastName(providerProfile.last_name ?? "");
      setPhone(providerProfile.phone ?? "");
    } else if (customerProfile) {
      setFirstName(customerProfile.first_name ?? customerProfile.full_name?.split(" ")[0] ?? "");
      setLastName(
        customerProfile.last_name ?? customerProfile.full_name?.split(" ").slice(1).join(" ") ?? "",
      );
      setPhone(customerProfile.phone ?? "");
    }
  }, [authLoading, user?.id, role, customerProfile, providerProfile, navigate]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ first_name: firstName, last_name: lastName, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      const v = parsed.data;
      if (role === "provider") {
        await callProvider({ data: { firstName: v.first_name, lastName: v.last_name, phone: v.phone } });
      } else {
        await callCustomer({ data: { firstName: v.first_name, lastName: v.last_name, phone: v.phone } });
      }
      await refresh();
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message ?? "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return <div className="p-12 text-center">Loading…</div>;

  const backTo = role === "provider" ? "/provider" : "/";
  const email = user?.email ?? "";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link to={backTo} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-4" /> Back
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>Update your personal details. Email changes happen from your account settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>First name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={80} />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={80} />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} disabled readOnly />
              </div>
              <div>
                <Label>Phone number</Label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={40} />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 className="size-4 animate-spin" />} Save changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
