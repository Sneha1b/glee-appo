import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { signInFn, signUpFn } from "@/aws/auth.functions";
import { assignMyRoleFn } from "@/aws/role.functions";
import { upsertCustomerProfileFn, getCustomerProfileFn } from "@/aws/customer.functions";
import { listBusinessesFn } from "@/aws/business.functions";
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
  const signIn = useServerFn(signInFn);
  const signUp = useServerFn(signUpFn);
  const assignRole = useServerFn(assignMyRoleFn);
  const upsertProfile = useServerFn(upsertCustomerProfileFn);
  const getProfile = useServerFn(getCustomerProfileFn);
  const listBusinesses = useServerFn(listBusinessesFn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (user && mode === "login") {
      (async () => {
        try { await assignRole({ data: { role: "customer" } }); } catch {}
        await routeAfterAuth();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, mode]);

  async function routeAfterAuth() {
    const cp = await getProfile().catch(() => null);
    const complete = cp && cp.first_name && cp.last_name && cp.phone;
    if (!complete) { navigate({ to: "/auth/customer/profile" }); return; }
    const bizes = await listBusinesses({ data: { limit: 2 } }).catch(() => []);
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
          setBusy(false); return;
        }
        await signUp({ data: { email, password } });
        await signIn({ data: { email, password } });
        await assignRole({ data: { role: "customer" } });
        await upsertProfile({ data: {
          first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim(),
        }});
        await refresh();
        await routeAfterAuth();
      } else {
        await signIn({ data: { email, password } });
        await assignRole({ data: { role: "customer" } });
        await refresh();
        await routeAfterAuth();
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
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
