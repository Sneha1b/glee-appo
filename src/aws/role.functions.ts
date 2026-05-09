import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assignMyRole } from "../../aws/services/role";
import { requireUser } from "./session";

const roleSchema = z.object({ role: z.enum(["customer", "provider"]) });

export const assignMyRoleFn = createServerFn({ method: "POST" })
  .inputValidator((d) => roleSchema.parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    await assignMyRole({ userSub: u.sub, role: data.role });
    return { ok: true };
  });
