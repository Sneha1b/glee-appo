import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMe, signOut as signOutFn } from "@/lib/auth.functions";

export type Role = "customer" | "provider" | null;

export type AuthUser = { id: string; email: string };

export type CustomerProfile = {
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

export type ProviderProfile = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  role: Role;
  customerProfile: CustomerProfile | null;
  providerProfile: ProviderProfile | null;
  businessId: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const fetchMe = useServerFn(getMe);
  const callSignOut = useServerFn(signOutFn);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      if (!me) {
        setUser(null);
        setRole(null);
        setCustomerProfile(null);
        setProviderProfile(null);
        setBusinessId(null);
        return;
      }
      setUser(me.user);
      setRole(me.role);
      setCustomerProfile(me.customerProfile);
      setProviderProfile(me.providerProfile);
      setBusinessId(me.businessId);
    } catch (e) {
      console.warn("auth refresh failed", e);
      setUser(null);
      setRole(null);
      setCustomerProfile(null);
      setProviderProfile(null);
      setBusinessId(null);
    }
  }, [fetchMe]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refresh();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await callSignOut();
    } catch (e) {
      console.warn("signOut failed", e);
    }
    setUser(null);
    setRole(null);
    setCustomerProfile(null);
    setProviderProfile(null);
    setBusinessId(null);
  }, [callSignOut]);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        role,
        customerProfile,
        providerProfile,
        businessId,
        refresh,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
