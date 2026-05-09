/**
 * Encrypted cookie session for Cognito tokens.
 * Stored: { accessToken, idToken, refreshToken, sub, email }
 *
 * Set SESSION_SECRET in your .env.aws (32+ random chars).
 */
import { useSession } from "@tanstack/react-start/server";

export type SessionData = {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  sub?: string;
  email?: string;
};

export function sessionConfig() {
  return {
    password:
      process.env.SESSION_SECRET ??
      "dev-only-insecure-password-please-set-SESSION_SECRET-in-prod",
    name: "schedora-session",
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function getAuthSession() {
  return useSession<SessionData>(sessionConfig());
}

export async function requireUser(): Promise<{
  sub: string;
  email: string;
  accessToken: string;
  idToken: string;
}> {
  const s = await getAuthSession();
  const d = s.data;
  if (!d?.sub || !d.accessToken || !d.idToken || !d.email) {
    throw new Error("unauthorized");
  }
  return {
    sub: d.sub,
    email: d.email,
    accessToken: d.accessToken,
    idToken: d.idToken,
  };
}
