import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  // prepare: false is safer with Supabase poolers; fine on direct too
  const client = postgres(url, { prepare: false, max: 10 });
  return drizzle(client, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop, receiver) {
    if (!_db) _db = createDb();
    return Reflect.get(_db, prop, receiver);
  },
});

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export type Database = ReturnType<typeof createDb>;
