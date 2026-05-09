/**
 * One-shot migration runner. Called from the container entrypoint or
 * manually via:  bun run aws/db/migrate.ts
 */
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
  const db = drizzle(conn);
  await migrate(db, { migrationsFolder: "aws/db/migrations" });
  await conn.end();
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
