/**
 * Auth server functions — replaces supabase.auth.* on the client.
 *
 * Browser code calls these via useServerFn(). Tokens never touch JS:
 * id_token + refresh_token are stored in httpOnly cookies set here.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  setCookie,
  deleteCookie,
  getCookie,
} from "@tanstack/react-start/server";
import { z } from "zod";
import { signUp, signIn, refresh } from "../../aws/auth/cognito";
import { verifyCognitoToken } from "../../aws/auth/verify";
import { db } from "../../aws/db/client";
import { userRoles, customerProfiles, businessOwners } from "../../aws/db/schema";
import { eq } from "drizzle-orm";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

function setSessionCookies(idToken: string, refreshToken: string, expiresIn: number) {
  setCookie("id_token", idToken, { ...COOKIE_OPTS, maxAge: expiresIn });
  setCookie("refresh_token", refreshToken, {
    ...COOKIE_OPTS,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { userSub, confirmed } = await signUp(data.email, data.password);
    if (confirmed) {
      const tokens = await signIn(data.email, data.password);
      setSessionCookies(tokens.idToken, tokens.refreshToken, tokens.expiresIn);
    }
    return { userId: userSub, confirmed };
  });

export const signInFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(1).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const tokens = await signIn(data.email, data.password);
    setSessionCookies(tokens.idToken, tokens.refreshToken, tokens.expiresIn);
    const claims = await verifyCognitoToken(tokens.idToken);
    return { userId: claims.sub, email: claims.email };
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie("id_token", { path: "/" });
  deleteCookie("refresh_token", { path: "/" });
  return { ok: true };
});

/**
 * Returns the current user + role + customerProfile + first businessId.
 * Mirrors what auth-context.tsx used to load via 3 supabase queries.
 * Returns null if no valid session cookie.
 */
export const meFn = createServerFn({ method: "GET" }).handler(async () => {
  let idToken = getCookie("id_token");
  if (!idToken) {
    const rt = getCookie("refresh_token");
    if (!rt) return null;
    try {
      const t = await refresh(rt);
      setCookie("id_token", t.idToken, { ...COOKIE_OPTS, maxAge: t.expiresIn });
      idToken = t.idToken;
    } catch {
      return null;
    }
  }
  let claims;
  try {
    claims = await verifyCognitoToken(idToken);
  } catch {
    return null;
  }
  const uid = claims.sub;
  const [roles, cp, bo] = await Promise.all([
    db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, uid)),
    db
      .select({ fullName: customerProfiles.fullName, phone: customerProfiles.phone })
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, uid))
      .limit(1),
    db
      .select({ businessId: businessOwners.businessId })
      .from(businessOwners)
      .where(eq(businessOwners.userId, uid))
      .limit(1),
  ]);
  return {
    user: { id: uid, email: claims.email as string | undefined },
    role: (roles[0]?.role ?? null) as "customer" | "provider" | null,
    customerProfile: cp[0] ?? null,
    businessId: bo[0]?.businessId ?? null,
  };
});
