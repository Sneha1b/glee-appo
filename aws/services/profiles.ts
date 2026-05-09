import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";

export async function getCurrentUserContext(cognitoSub: string) {
  const user = await db.query.appUsers.findFirst({
    where: eq(schema.appUsers.cognitoSub, cognitoSub),
  });

  if (!user) return null;

  const [customerProfile, providerProfile, ownerLink] = await Promise.all([
    db.query.customerProfiles.findFirst({
      where: eq(schema.customerProfiles.userId, user.id),
    }),
    db.query.providerProfiles.findFirst({
      where: eq(schema.providerProfiles.userId, user.id),
    }),
    db.query.businessOwners.findFirst({
      where: eq(schema.businessOwners.userId, user.id),
    }),
  ]);

  return {
    user,
    role: user.role,
    customerProfile: customerProfile ?? null,
    providerProfile: providerProfile ?? null,
    businessId: ownerLink?.businessId ?? null,
  };
}

export async function upsertCustomerProfile(input: {
  userId: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}) {
  const rows = await db
    .insert(schema.customerProfiles)
    .values({
      userId: input.userId,
      fullName: input.fullName,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
    })
    .onConflictDoUpdate({
      target: schema.customerProfiles.userId,
      set: {
        fullName: input.fullName,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return rows[0];
}

export async function upsertProviderProfile(input: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}) {
  const rows = await db
    .insert(schema.providerProfiles)
    .values(input)
    .onConflictDoUpdate({
      target: schema.providerProfiles.userId,
      set: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        updatedAt: new Date(),
      },
    })
    .returning();

  return rows[0];
}
