/**
 * Auth server functions — wraps aws/auth/cognito.ts and stores tokens
 * in an encrypted cookie session.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  signIn as cognitoSignIn,
  signUp as cognitoSignUp,
  signOutEverywhere,
} from "../../aws/auth/cognito";
import { verifyCognitoJwt } from "../../aws/auth/verify";
import { getMyRole } from "../../aws/services/role";
import { acceptPendingBusinessInvites } from "../../aws/services/business";
import { db } from "../../aws/db/client";
import { customerProfiles, businessOwners } from "../../aws/db/schema";
import { eq } from "drizzle-orm";
import { getAuthSession } from "./session";

const credSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(256),
});

export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator((d) => credSchema.parse(d))
  .handler(async ({ data }) => {
    const { userSub, confirmed } = await cognitoSignUp(data.email, data.password);
    return { userSub, confirmed };
  });

export const signInFn = createServerFn({ method: "POST" })
  .inputValidator((d) => credSchema.parse(d))
  .handler(async ({ data }) => {
    const tokens = await cognitoSignIn(data.email, data.password);
    const claims = await verifyCognitoJwt(tokens.idToken);
    const session = await getAuthSession();
    await session.update({
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      refreshToken: tokens.refreshToken,
      sub: claims.sub,
      email: claims.email ?? data.email,
    });
    // Auto-claim any pending invites for this email.
    try {
      await acceptPendingBusinessInvites({
        userSub: claims.sub,
        email: claims.email ?? data.email,
      });
    } catch {
      /* non-fatal */
    }
    return { sub: claims.sub, email: claims.email ?? data.email };
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getAuthSession();
  const token = session.data?.accessToken;
  if (token) {
    try {
      await signOutEverywhere(token);
    } catch {
      /* ignore — clear cookie anyway */
    }
  }
  await session.clear();
  return { ok: true };
});

/**
 * Hydrates AuthProvider on the client. Returns user, role, customer profile,
 * and the user's first owned business id (if any).
 */
export const meFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAuthSession();
  const d = session.data;
  if (!d?.sub || !d.email) return { user: null };

  const [role, profileRows, ownerRows] = await Promise.all([
    getMyRole(d.sub),
    db
      .select({
        full_name: customerProfiles.fullName,
        phone: customerProfiles.phone,
      })
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, d.sub))
      .limit(1),
    db
      .select({ business_id: businessOwners.businessId })
      .from(businessOwners)
      .where(eq(businessOwners.userId, d.sub))
      .limit(1),
  ]);

  return {
    user: { id: d.sub, email: d.email },
    role,
    customerProfile: profileRows[0]
      ? {
          full_name: profileRows[0].full_name ?? "",
          phone: profileRows[0].phone ?? null,
        }
      : null,
    businessId: ownerRows[0]?.business_id ?? null,
  };
});
