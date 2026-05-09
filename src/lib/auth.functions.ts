/**
 * Auth server functions — Cognito sign-up, sign-in, sign-out, profile fetch.
 * IMPORTANT: thin file. Only createServerFn declarations + their imports.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  signUp as cognitoSignUp,
  confirmSignUp as cognitoConfirmSignUp,
  signIn as cognitoSignIn,
  forgotPassword as cognitoForgotPassword,
  confirmForgotPassword as cognitoConfirmForgotPassword,
} from "@/aws/auth/cognito";
import { verifyCognitoJwt } from "@/aws/auth/verify";
import {
  setAuthCookies,
  clearAuthCookies,
  getAuthTokensFromCookies,
  globalSignOut,
  requireUser,
} from "@/aws/auth/server";
import {
  upsertUserFromCognito,
  getUserByCognitoSub,
} from "@/aws/services/users";
import { setUserRoleByCognitoSub } from "@/aws/services/role";
import { getCurrentUserContext } from "@/aws/services/profiles";

const AppRoleSchema = z.enum(["customer", "provider"]);

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string; role: "customer" | "provider" }) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(8).max(128),
        role: AppRoleSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const out = await cognitoSignUp(data.email, data.password);
    return { userSub: out.userSub ?? null, confirmed: out.confirmed };
  });

export const confirmSignUp = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; code: string }) =>
    z.object({ email: z.string().email().max(255), code: z.string().min(4).max(12) }).parse(d),
  )
  .handler(async ({ data }) => {
    await cognitoConfirmSignUp(data.email, data.code);
    return { ok: true };
  });

export const signIn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { email: string; password: string; role?: "customer" | "provider" }) =>
      z
        .object({
          email: z.string().email().max(255),
          password: z.string().min(1).max(128),
          role: AppRoleSchema.optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const tokens = await cognitoSignIn(data.email, data.password);
    setAuthCookies(tokens);

    // Verify and ensure an app_users row exists for this Cognito sub.
    const claims = await verifyCognitoJwt(tokens.idToken);
    const email = claims.email ?? data.email;
    let appUser = await getUserByCognitoSub(claims.sub);
    if (!appUser) {
      appUser = await upsertUserFromCognito({
        cognitoSub: claims.sub,
        email,
        role: data.role ?? "customer",
      });
    } else if (data.role && appUser.role !== data.role) {
      // Allow customer → provider upgrade only if explicitly requested.
      if (appUser.role === "customer" && data.role === "provider") {
        const upgraded = await setUserRoleByCognitoSub({
          cognitoSub: claims.sub,
          role: "provider",
        });
        if (upgraded) appUser = upgraded;
      }
    }

    return { ok: true, userId: appUser.id, role: appUser.role };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { accessToken } = getAuthTokensFromCookies();
  if (accessToken) await globalSignOut(accessToken);
  clearAuthCookies();
  return { ok: true };
});

export const forgotPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) =>
    z.object({ email: z.string().email().max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    await cognitoForgotPassword(data.email);
    return { ok: true };
  });

export const confirmForgotPassword = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { email: string; code: string; newPassword: string }) =>
      z
        .object({
          email: z.string().email().max(255),
          code: z.string().min(4).max(12),
          newPassword: z.string().min(8).max(128),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await cognitoConfirmForgotPassword(data.email, data.code, data.newPassword);
    return { ok: true };
  });

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { idToken } = getAuthTokensFromCookies();
  if (!idToken) return null;
  let user;
  try {
    user = await requireUser();
  } catch {
    return null;
  }
  const ctx = await getCurrentUserContext(user.cognitoSub);
  if (!ctx) return null;
  return {
    user: { id: ctx.user.id, email: ctx.user.email },
    role: ctx.role,
    customerProfile: ctx.customerProfile
      ? {
          full_name: ctx.customerProfile.fullName,
          first_name: ctx.customerProfile.firstName,
          last_name: ctx.customerProfile.lastName,
          phone: ctx.customerProfile.phone,
        }
      : null,
    providerProfile: ctx.providerProfile
      ? {
          first_name: ctx.providerProfile.firstName,
          last_name: ctx.providerProfile.lastName,
          phone: ctx.providerProfile.phone,
          email: ctx.providerProfile.email,
        }
      : null,
    businessId: ctx.businessId,
  };
});
