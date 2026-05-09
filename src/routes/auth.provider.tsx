import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { signUp, confirmSignUp, signIn } from "@/lib/auth.functions";
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
  const callSignUp = useServerFn(signUp);
  const callConfirm = useServerFn(confirmSignUp);
  const callSignIn = useServerFn(signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function postAuth() {
    try { await refresh(); } catch (e) { console.warn("refresh failed", e); }
    navigate({ to: "/provider" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup" && !needsConfirm) {
        if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
          toast.error("Please fill in your name and phone number");
          return;
        }
        const out = await callSignUp({ data: { email, password, role: "provider" } });
        if (!out.confirmed) {
          setNeedsConfirm(true);
          toast.success("We've emailed you a confirmation code.");
          return;
        }
        await callSignIn({ data: { email, password, role: "provider" } });
        await postAuth();
      } else if (needsConfirm) {
        await callConfirm({ data: { email, code: confirmCode } });
        await callSignIn({ data: { email, password, role: "provider" } });
        await postAuth();
      } else {
        await callSignIn({ data: { email, password, role: "provider" } });
        await postAuth();
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {needsConfirm ? "Confirm your email" : isSignup ? "Create your provider account" : "Provider sign in"}
          </CardTitle>
          <CardDescription>
            {needsConfirm
              ? `We sent a 6-digit code to ${email}.`
              : isSignup
                ? "Tell us a bit about you, then register to manage your business."
                : "Sign in to your provider dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submit} className="space-y-3">
            {!needsConfirm && isSignup && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
                  <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
                </div>
                <div><Label>Phone number</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
              </>
            )}
            {!needsConfirm && (
              <>
                <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>
              </>
            )}
            {needsConfirm && (
              <div><Label>Confirmation code</Label><Input value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} required maxLength={12} /></div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {needsConfirm ? "Confirm" : isSignup ? "Register" : "Sign in"}
            </Button>
          </form>
          {!needsConfirm && (
            <div className="flex justify-between text-sm">
              {isSignup ? (
                <Link to="/auth/provider" search={{ mode: "login" }} className="underline">Have an account? Sign in</Link>
              ) : (
                <Link to="/auth/provider" search={{ mode: "signup" }} className="underline">New provider? Sign up</Link>
              )}
              <Link to="/" className="text-muted-foreground underline">Back to site</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
