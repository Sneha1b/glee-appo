import {
  getCookie,
  setCookie,
  deleteCookie,
} from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";

import { verifyCognitoJwt, type CognitoClaims } from "./verify";
import { signOutEverywhere } from "./cognito";
import { getUserByCognitoSub, upsertUserFromCognito } from "../services/users";
import type { AppRole } from "../services/users";
import { db, schema } from "../db/client";

export const ID_TOKEN_COOKIE = "schedora_id";
export const ACCESS_TOKEN_COOKIE = "schedora_at";
export const REFRESH_TOKEN_COOKIE = "schedora_rt";

interface CookieTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function setAuthCookies(tokens: CookieTokens): void {
  const accessMaxAge = Math.max(60, tokens.expiresIn);

  setCookie(ID_TOKEN_COOKIE, tokens.idToken, {
    ...baseCookieOptions,
    maxAge: accessMaxAge,
  });

  setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: accessMaxAge,
  });

  setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(): void {
  deleteCookie(ID_TOKEN_COOKIE, { path: "/" });
  deleteCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
  deleteCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
}

export function getAuthTokensFromCookies(): {
  idToken: string | null;
  accessToken: string | null;
  refreshToken: string | null;
} {
  return {
    idToken: getCookie(ID_TOKEN_COOKIE) ?? null,
    accessToken: getCookie(ACCESS_TOKEN_COOKIE) ?? null,
    refreshToken: getCookie(REFRESH_TOKEN_COOKIE) ?? null,
  };
}

export async function globalSignOut(accessToken: string): Promise<void> {
  try {
    await signOutEverywhere(accessToken);
  } catch (e) {
    console.warn("globalSignOut failed", e);
  }
}

export type AppUser = NonNullable<
  Awaited<ReturnType<typeof getUserByCognitoSub>>
>;

export interface AuthedUser {
  cognitoSub: string;
  email: string;
  claims: CognitoClaims;
  appUser: AppUser;
}

export async function requireUser(opts?: {
  defaultRole?: AppRole;
}): Promise<AuthedUser> {
  const { idToken } = getAuthTokensFromCookies();

  if (!idToken) {
    throw new Response("Unauthorized", { status: 401 });
  }

  let claims: CognitoClaims;

  try {
    claims = await verifyCognitoJwt(idToken);
  } catch {
    throw new Response("Unauthorized", { status: 401 });
  }

  const email = claims.email ?? "";
  let appUser = await getUserByCognitoSub(claims.sub);

  if (!appUser) {
    if (!email) {
      throw new Response("Email missing on token", { status: 400 });
    }

    appUser = await upsertUserFromCognito({
      cognitoSub: claims.sub,
      email,
      role: opts?.defaultRole ?? "customer",
    });
  }

  return {
    cognitoSub: claims.sub,
    email: appUser.email,
    claims,
    appUser,
  };
}

export async function getOptionalUser(): Promise<AuthedUser | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

export async function assertBusinessOwner(
  businessId: string,
): Promise<AuthedUser> {
  const user = await requireUser();

  const rows = await db
    .select({ id: schema.businessOwners.id })
    .from(schema.businessOwners)
    .where(
      and(
        eq(schema.businessOwners.userId, user.appUser.id),
        eq(schema.businessOwners.businessId, businessId),
      ),
    )
    .limit(1);

  if (!rows[0]) {
    throw new Response("Forbidden", { status: 403 });
  }

  return user;
}}
