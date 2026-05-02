import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "customer" | "provider" | null;

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: Role;
  customerProfile: { full_name: string; phone: string | null } | null;
  businessId: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [customerProfile, setCustomerProfile] = useState<AuthCtx["customerProfile"]>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAux(uid: string) {
    const [{ data: roles }, { data: cp }, { data: bo }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("customer_profiles").select("full_name, phone").eq("user_id", uid).maybeSingle(),
      supabase.from("business_owners").select("business_id").eq("user_id", uid).maybeSingle(),
    ]);
    const r = roles?.[0]?.role as Role | undefined;
    setRole(r ?? null);
    setCustomerProfile(cp as any);
    setBusinessId(bo?.business_id ?? null);
  }

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    if (data.session?.user) await loadAux(data.session.user.id);
    else { setRole(null); setCustomerProfile(null); setBusinessId(null); }
  }

  useEffect(() => {
    let currentUid: string | null = null;
    let mounted = true;

    // Prime from the restored session FIRST and seed currentUid so the
    // listener's INITIAL_SESSION event doesn't re-trigger loadAux.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      currentUid = data.session?.user?.id ?? null;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadAux(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      const newUid = s?.user?.id ?? null;
      setSession(s);
      if (newUid !== currentUid) {
        setUser(s?.user ?? null);
        currentUid = newUid;
        if (s?.user) setTimeout(() => loadAux(s.user.id), 0);
        else { setRole(null); setCustomerProfile(null); setBusinessId(null); }
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  async function signOut() { await supabase.auth.signOut(); }

  return (
    <Ctx.Provider value={{ user, session, loading, role, customerProfile, businessId, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
