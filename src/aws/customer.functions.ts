import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "../../aws/db/client";
import { customerProfiles } from "../../aws/db/schema";
import { requireUser } from "./session";

export const getCustomerProfileFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const u = await requireUser();
    const rows = await db
      .select({
        first_name: customerProfiles.firstName,
        last_name: customerProfiles.lastName,
        full_name: customerProfiles.fullName,
        phone: customerProfiles.phone,
      })
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, u.sub))
      .limit(1);
    return rows[0] ?? null;
  },
);

const upsertSchema = z.object({
  first_name: z.string().min(1).max(120),
  last_name: z.string().min(1).max(120),
  phone: z.string().min(1).max(40),
});

export const upsertCustomerProfileFn = createServerFn({ method: "POST" })
  .inputValidator((d) => upsertSchema.parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    const fullName = `${data.first_name} ${data.last_name}`.trim();
    await db.execute(sql`
      INSERT INTO customer_profiles
        (id, user_id, full_name, first_name, last_name, phone, created_at, updated_at)
      VALUES
        (${crypto.randomUUID()}, ${u.sub}, ${fullName},
         ${data.first_name}, ${data.last_name}, ${data.phone}, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        full_name  = VALUES(full_name),
        first_name = VALUES(first_name),
        last_name  = VALUES(last_name),
        phone      = VALUES(phone),
        updated_at = NOW(3)
    `);
    return { ok: true };
  });
