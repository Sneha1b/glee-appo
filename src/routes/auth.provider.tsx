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

export const Route = createFileRoute("/auth/provider")({
  component: ProviderAuth,
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "Provider sign in — SlotKit" }] }),
});

function ProviderAuth() {
  const { mode = "login" } = useSearch({ from: "/auth/provider" });
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function ensureRole(_uid: string) {
    await supabase.rpc("assign_my_role", { p_role: "provider" });
  }

  async function postAuth(uid: string) {
    await ensureRole(uid);
    await refresh();
    const { data: bo } = await supabase.from("business_owners").select("business_id").eq("user_id", uid).maybeSingle();
    navigate({ to: bo ? "/admin" : "/auth/provider/business" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/provider/business` },
        });
        if (error) throw error;
        if (data.user) await ensureRole(data.user.id);
        if (!data.session) { toast.success("Check your email to confirm your account."); return; }
        await postAuth(data.user!.id);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await postAuth(data.user.id);
      }
    } catch (err: any) { toast.error(err.message ?? "Something went wrong"); } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth/provider/business` });
      if (result.error) { toast.error(result.error.message); return; }
      if (result.redirected) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await postAuth(user.id);
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "signup" ? "Provider sign up" : "Provider sign in"}</CardTitle>
          <CardDescription>
            {mode === "signup" ? "Create an account to manage your business." : "Sign in to your provider dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={google} disabled={busy}>Continue with Google</Button>
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
