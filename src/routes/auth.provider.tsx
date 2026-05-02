import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const search = z.object({ mode: z.enum(["login", "signup"]).optional() });

export const Route = createFileRoute("/auth/provider")({
  component: ProviderAuth,
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "Provider sign in — Schedora" }] }),
});

function ProviderAuth() {
  const { mode = "login" } = useSearch({ from: "/auth/provider" });
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  // Note: we intentionally do NOT auto-redirect already-signed-in users away
  // from this page. Doing so created a redirect loop with /provider when a
  // provider's profile row is missing (/provider → /auth/provider/profile →
  // brief null user → /auth/provider → here → back to /provider).

  async function ensureRole(_uid: string) {
    try { await supabase.rpc("assign_my_role", { p_role: "provider" }); } catch (e) { console.warn("assign_my_role failed", e); }
  }

  async function postAuth(_uid: string) {
    // Navigate first; role assignment + invite acceptance happen in the background.
    // /provider re-runs accept_pending_business_invites on mount, so this is safe.
    void ensureRole(_uid).then(() => supabase.rpc("accept_pending_business_invites" as any).catch(() => {}));
    try { await refresh(); } catch (e) { console.warn("refresh failed", e); }
    navigate({ to: "/provider" });
  }

  async function saveProfile(uid: string, userEmail: string) {
    const payload = {
      user_id: uid,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim(),
      email: userEmail,
    };
    const { error } = await supabase
      .from("provider_profiles" as any)
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
          toast.error("Please fill in your name and phone number");
          setBusy(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/provider` },
        });
        if (error) throw error;
        if (data.user) await ensureRole(data.user.id);
        if (!data.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) {
            toast.success("Account created. Please sign in.");
            navigate({ to: "/auth/provider", search: { mode: "login" } });
            return;
          }
        }
        await saveProfile(data.user!.id, email);
        await postAuth(data.user!.id);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await postAuth(data.user.id);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally { setBusy(false); }
  }

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isSignup ? "Create your provider account" : "Provider sign in"}</CardTitle>
          <CardDescription>
            {isSignup ? "Tell us a bit about you, then register to manage your business." : "Sign in to your provider dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submit} className="space-y-3">
            {isSignup && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
                <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
              </div>
            )}
            {isSignup && (
              <div><Label>Phone number</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
            )}
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {isSignup ? "Register" : "Sign in"}
            </Button>
          </form>
          <div className="flex justify-between text-sm">
            {isSignup ? (
              <Link to="/auth/provider" search={{ mode: "login" }} className="underline">Have an account? Sign in</Link>
            ) : (
              <Link to="/auth/provider" search={{ mode: "signup" }} className="underline">New provider? Sign up</Link>
            )}
            <Link to="/" className="text-muted-foreground underline">Back to site</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
