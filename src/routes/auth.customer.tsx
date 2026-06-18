import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

export const Route = createFileRoute("/auth/customer")({
  component: CustomerAuth,
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "Customer sign in — Schedora" }] }),
});

function CustomerAuth() {
  const { mode = "login" } = useSearch({ from: "/auth/customer" });
  const navigate = useNavigate();
  const { refresh, user, loading: authLoading } = useAuth();
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

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      navigate({ to: "/businesses" });
    }
  }, [authLoading, user?.id, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup" && !needsConfirm) {
        if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
          toast.error("Please fill in your name and phone number");
          return;
        }
        const out = await callSignUp({ data: { email, password, role: "customer" } });
        if (!out.confirmed) {
          setNeedsConfirm(true);
          toast.success("We've emailed you a confirmation code.");
          return;
        }
        await callSignIn({ data: { email, password, role: "customer" } });
        await refresh();
        navigate({ to: "/auth/customer/profile" });
      } else if (needsConfirm) {
        await callConfirm({ data: { email, code: confirmCode } });
        await callSignIn({ data: { email, password, role: "customer" } });
        await refresh();
        navigate({ to: "/auth/customer/profile" });
      } else {
        await callSignIn({ data: { email, password, role: "customer" } });
        await refresh();
        navigate({ to: "/businesses" });
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
            {needsConfirm ? "Confirm your email" : isSignup ? "Create your account" : "Welcome back"}
          </CardTitle>
          <CardDescription>
            {needsConfirm
              ? `We sent a 6-digit code to ${email}. Enter it below.`
              : isSignup
                ? "Tell us a bit about you, then register to start booking."
                : "Sign in to your customer account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submit} className="space-y-3">
            {!needsConfirm && isSignup && (
              <>
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
                  <Label>Phone number</Label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={40} />
                </div>
              </>
            )}
            {!needsConfirm && (
              <>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                </div>
              </>
            )}
            {needsConfirm && (
              <div>
                <Label>Confirmation code</Label>
                <Input value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} required maxLength={12} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {needsConfirm ? "Confirm" : isSignup ? "Register" : "Sign in"}
            </Button>
          </form>
          {!needsConfirm && (
            <div className="flex justify-between text-sm">
              {isSignup ? (
                <Link to="/auth/customer" search={{ mode: "login" }} className="underline">
                  Have an account? Sign in
                </Link>
              ) : (
                <Link to="/auth/customer" search={{ mode: "signup" }} className="underline">
                  New here? Sign up
                </Link>
              )}
              <Link to="/" className="text-muted-foreground underline">Continue as guest</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
