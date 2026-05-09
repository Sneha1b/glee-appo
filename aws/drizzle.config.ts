import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./aws/db/schema.ts",
  out: "./aws/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
