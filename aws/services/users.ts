import { eq } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";

export type AppRole = "customer" | "provider";

export async function getUserByCognitoSub(cognitoSub: string) {
  const rows = await db
    .select()
    .from(schema.appUsers)
    .where(eq(schema.appUsers.cognitoSub, cognitoSub))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertUserFromCognito(input: {
  cognitoSub: string;
  email: string;
  role?: AppRole;
}) {
  const existing = await getUserByCognitoSub(input.cognitoSub);

  if (existing) return existing;

  const rows = await db
    .insert(schema.appUsers)
    .values({
      cognitoSub: input.cognitoSub,
      email: input.email,
      role: input.role ?? "customer",
    })
    .returning();

  return rows[0];
}
