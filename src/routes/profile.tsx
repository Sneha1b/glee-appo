import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Your profile — Schedora" }] }),
});

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(3, "Phone is required").max(40),
});

function ProfilePage() {
  const { user, role, loading: authLoading, refresh } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/" }); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, role]);

  async function load() {
    setLoading(true);
    setEmail(user?.email ?? "");
    if (role === "provider") {
      const { data } = await supabase
        .from("provider_profiles" as any)
        .select("first_name, last_name, phone, email")
        .eq("user_id", user!.id)
        .maybeSingle() as any;
      if (data) {
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setPhone(data.phone ?? "");
        if (data.email) setEmail(data.email);
      }
    } else {
      const { data } = await supabase
        .from("customer_profiles")
        .select("first_name, last_name, full_name, phone")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (data) {
        setFirstName(data.first_name ?? (data.full_name?.split(" ")[0] ?? ""));
        setLastName(data.last_name ?? (data.full_name?.split(" ").slice(1).join(" ") ?? ""));
        setPhone(data.phone ?? "");
      }
    }
    setLoading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ first_name: firstName, last_name: lastName, email, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      const v = parsed.data;
      // Update auth email if it changed
      if (v.email !== (user.email ?? "")) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: v.email });
        if (emailErr) throw emailErr;
        toast.message("Confirm the email change from your inbox to finish updating it.");
      }
      if (role === "provider") {
        const { error } = await supabase
          .from("provider_profiles" as any)
          .upsert(
            {
              user_id: user.id,
              first_name: v.first_name,
              last_name: v.last_name,
              email: v.email,
              phone: v.phone,
            },
            { onConflict: "user_id" }
          );
        if (error) throw error;
      } else {
        const full = `${v.first_name} ${v.last_name}`.trim();
        const { error } = await supabase
          .from("customer_profiles")
          .upsert(
            {
              user_id: user.id,
              first_name: v.first_name,
              last_name: v.last_name,
              full_name: full,
              phone: v.phone,
            },
            { onConflict: "user_id" }
          );
        if (error) throw error;
      }
      await refresh();
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message ?? "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) return <div className="p-12 text-center">Loading…</div>;

  const backTo = role === "provider" ? "/provider" : "/";

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
            <CardDescription>Update your personal details. All fields can be edited.</CardDescription>
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
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
                {email !== (user?.email ?? "") && (
                  <p className="text-xs text-muted-foreground mt-1">
                    You'll get a confirmation email at the new address to finish the change.
                  </p>
                )}
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
