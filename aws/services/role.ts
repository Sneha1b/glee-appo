import { eq } from "drizzle-orm";
import { db, schema } from "@/aws/db/client";

export type AppRole = "customer" | "provider";

export async function getUserRole(userId: string): Promise<AppRole | null> {
  const rows = await db
    .select({ role: schema.appUsers.role })
    .from(schema.appUsers)
    .where(eq(schema.appUsers.id, userId))
    .limit(1);

  return rows[0]?.role ?? null;
}

export async function getUserRoleByCognitoSub(
  cognitoSub: string,
): Promise<AppRole | null> {
  const rows = await db
    .select({ role: schema.appUsers.role })
    .from(schema.appUsers)
    .where(eq(schema.appUsers.cognitoSub, cognitoSub))
    .limit(1);

  return rows[0]?.role ?? null;
}

export async function setUserRole(input: {
  userId: string;
  role: AppRole;
}) {
  const rows = await db
    .update(schema.appUsers)
    .set({ role: input.role })
    .where(eq(schema.appUsers.id, input.userId))
    .returning();

  return rows[0] ?? null;
}

export async function setUserRoleByCognitoSub(input: {
  cognitoSub: string;
  role: AppRole;
}) {
  const rows = await db
    .update(schema.appUsers)
    .set({ role: input.role })
    .where(eq(schema.appUsers.cognitoSub, input.cognitoSub))
    .returning();

  return rows[0] ?? null;
}
