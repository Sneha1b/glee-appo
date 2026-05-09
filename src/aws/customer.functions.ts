import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyCognitoToken } from "../../aws/auth/verify";
import { db } from "../../aws/db/client";
import { customerProfiles } from "../../aws/db/schema";

async function requireUid(): Promise<string> {
  const t = getCookie("id_token");
  if (!t) throw new Error("unauthenticated");
  const c = await verifyCognitoToken(t);
  return c.sub;
}

export const getCustomerProfileFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const uid = await requireUid();
    const rows = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, uid))
      .limit(1);
    return rows[0] ?? null;
  },
);

export const upsertCustomerProfileFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      firstName: z.string().min(1).max(80),
      lastName: z.string().min(1).max(80),
      fullName: z.string().min(1).max(160),
      phone: z.string().min(1).max(40),
    }).parse,
  )
  .handler(async ({ data }) => {
    const uid = await requireUid();
    await db
      .insert(customerProfiles)
      .values({ userId: uid, ...data })
      .onDuplicateKeyUpdate({ set: data });
    return { ok: true };
  });
