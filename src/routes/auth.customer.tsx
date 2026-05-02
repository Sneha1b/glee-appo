import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

export const Route = createFileRoute("/auth/customer")({
  component: CustomerAuth,
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "Customer sign in — Schedora" }] }),
});

function CustomerAuth() {
  const { mode = "login" } = useSearch({ from: "/auth/customer" });
  const navigate = useNavigate();
  const { refresh, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    // Only auto-route on the login screen so the signup form stays interactive.
    if (user && mode === "login") {
      (async () => {
        try { await supabase.rpc("assign_my_role", { p_role: "customer" }); } catch {}
        await routeAfterAuth(user.id);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, mode]);

  async function ensureRole(_uid: string) {
    await supabase.rpc("assign_my_role", { p_role: "customer" });
  }

  async function saveProfile(uid: string) {
    const full = `${firstName.trim()} ${lastName.trim()}`.trim();
    const { error } = await supabase.from("customer_profiles").upsert(
      {
        user_id: uid,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: full,
        phone: phone.trim(),
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
  }

  async function routeAfterAuth(uid: string) {
    const { data: cp } = await supabase
      .from("customer_profiles")
      .select("first_name, last_name, phone")
      .eq("user_id", uid)
      .maybeSingle() as any;
    const complete = cp && cp.first_name && cp.last_name && cp.phone;
    if (!complete) {
      navigate({ to: "/auth/customer/profile" });
      return;
    }
    const { data: bizes } = await supabase
      .from("businesses")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(2);
    if (bizes && bizes.length === 1) {
      navigate({ to: "/businesses/$businessId", params: { businessId: bizes[0].id } });
    } else {
      navigate({ to: "/businesses" });
    }
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
          options: { emailRedirectTo: `${window.location.origin}/businesses` },
        });
        if (error) throw error;
        if (data.user) await ensureRole(data.user.id);
        if (!data.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) {
            toast.success("Account created. Please sign in.");
            navigate({ to: "/auth/customer", search: { mode: "login" } });
            return;
          }
        }
        await saveProfile(data.user!.id);
        await refresh();
        await routeAfterAuth(data.user!.id);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await ensureRole(data.user.id);
        await refresh();
        await routeAfterAuth(data.user.id);
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
          <CardTitle>{isSignup ? "Create your account" : "Welcome back"}</CardTitle>
          <CardDescription>
            {isSignup ? "Tell us a bit about you, then register to start booking." : "Sign in to your customer account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submit} className="space-y-3">
            {isSignup && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={80} /></div>
                  <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={80} /></div>
                </div>
                <div><Label>Phone number</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={40} /></div>
              </>
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
              <Link to="/auth/customer" search={{ mode: "login" }} className="underline">Have an account? Sign in</Link>
            ) : (
              <Link to="/auth/customer" search={{ mode: "signup" }} className="underline">New here? Sign up</Link>
            )}
            <Link to="/" className="text-muted-foreground underline">Continue as guest</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
