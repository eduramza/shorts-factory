import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { root, storageRoot } from "./storage";
import * as schema from "./schema";
mkdirSync(storageRoot, { recursive: true });
const sqlite = new Database(join(storageRoot, "clipforge.sqlite"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.exec(
  readFileSync(join(root, "packages/core/migrations/0001.sql"), "utf8"),
);
sqlite
  .prepare("INSERT OR IGNORE INTO schema_migrations VALUES (?,?)")
  .run("0001", new Date().toISOString());
export const db = drizzle(sqlite, { schema });
export { schema };
export const now = () => new Date().toISOString();
