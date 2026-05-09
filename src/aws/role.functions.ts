import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { verifyCognitoToken } from "../../aws/auth/verify";
import { assignMyRole } from "../../aws/services/role";

function requireUid(): Promise<string> {
  const t = getCookie("id_token");
  if (!t) throw new Error("unauthenticated");
  return verifyCognitoToken(t).then((c) => c.sub);
}

export const assignRoleFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ role: z.enum(["customer", "provider"]) }).parse)
  .handler(async ({ data }) => {
    const uid = await requireUid();
    await assignMyRole(uid, data.role);
    return { ok: true };
  });
