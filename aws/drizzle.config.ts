import type { Config } from "drizzle-kit";

export default {
  schema: "./aws/db/schema.ts",
  out: "./aws/db/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
