/**
 * MySQL connection pool + Drizzle instance.
 * Server-only — never import from client code.
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: mysql.Pool | undefined;
}

function getPool(): mysql.Pool {
  if (globalThis.__mysqlPool) return globalThis.__mysqlPool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    timezone: "Z", // store/read UTC
  });
  globalThis.__mysqlPool = pool;
  return pool;
}

export const db = drizzle(getPool(), { schema, mode: "default" });
export { schema };
