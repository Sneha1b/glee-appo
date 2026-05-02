import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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
  head: () => ({ meta: [{ title: "Customer sign in — SlotKit" }] }),
});

function CustomerAuth() {
  const { mode = "login" } = useSearch({ from: "/auth/customer" });
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function ensureRole(_uid: string) {
    await supabase.rpc("assign_my_role", { p_role: "customer" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/customer/profile` },
        });
        if (error) throw error;
        if (data.user) await ensureRole(data.user.id);
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
        await refresh();
        navigate({ to: "/auth/customer/profile" });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await ensureRole(data.user.id);
        await refresh();
        const { data: cp } = await supabase.from("customer_profiles").select("first_name, last_name").eq("user_id", data.user.id).maybeSingle() as any;
        const complete = cp && cp.first_name && cp.last_name;
        navigate({ to: complete ? "/" : "/auth/customer/profile" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth/customer/profile` });
      if (result.error) { toast.error(result.error.message); return; }
      if (result.redirected) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await ensureRole(user.id);
        await refresh();
        const { data: cp } = await supabase.from("customer_profiles").select("first_name, last_name").eq("user_id", user.id).maybeSingle() as any;
        const complete = cp && cp.first_name && cp.last_name;
        navigate({ to: complete ? "/" : "/auth/customer/profile" });
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "signup" ? "Create your account" : "Welcome back"}</CardTitle>
          <CardDescription>
            {mode === "signup" ? "Sign up to manage your bookings." : "Sign in to your customer account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
            Continue with Google
          </Button>
          <div className="relative text-center text-xs text-muted-foreground">
            <span className="bg-card px-2 relative z-10">or</span>
            <div className="absolute inset-0 top-1/2 border-t" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "signup" ? "Sign up" : "Sign in"}
            </Button>
          </form>
          <div className="flex justify-between text-sm">
            {mode === "signup" ? (
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
