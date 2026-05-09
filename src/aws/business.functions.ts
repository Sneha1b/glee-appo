import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { asc } from "drizzle-orm";
import { db } from "../../aws/db/client";
import { businesses } from "../../aws/db/schema";

export const listBusinessesFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ limit: z.number().int().min(1).max(100).default(20) }).parse,
  )
  .handler(async ({ data }) => {
    return db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .orderBy(asc(businesses.createdAt))
      .limit(data.limit);
  });
