import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { meFn, signOutFn } from "@/aws/auth.functions";

type Role = "customer" | "provider" | null;
type User = { id: string; email: string };
type AuthCtx = {
  user: User | null;
  session: { user: User } | null;
  loading: boolean;
  role: Role;
  customerProfile: { full_name: string; phone: string | null } | null;
  businessId: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [customerProfile, setCustomerProfile] = useState<AuthCtx["customerProfile"]>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const me = useServerFn(meFn);
  const signOutSrv = useServerFn(signOutFn);

  async function refresh() {
    try {
      const r = await me();
      if (r?.user) {
        setUser(r.user);
        setRole((r.role as Role) ?? null);
        setCustomerProfile(r.customerProfile ?? null);
        setBusinessId(r.businessId ?? null);
      } else {
        setUser(null); setRole(null); setCustomerProfile(null); setBusinessId(null);
      }
    } catch {
      setUser(null); setRole(null); setCustomerProfile(null); setBusinessId(null);
    }
  }

  useEffect(() => { (async () => { await refresh(); setLoading(false); })(); }, []);

  async function signOut() {
    try { await signOutSrv(); } catch {}
    setUser(null); setRole(null); setCustomerProfile(null); setBusinessId(null);
  }

  const session = user ? { user } : null;
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
