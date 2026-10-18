import pg from "pg";
import { databaseEnvSchema } from "@partsagricola/config";
export function createPool(
  env: Record<string, string | undefined> = process.env,
) {
  const { DATABASE_URL } = databaseEnvSchema.parse(env);
  return new pg.Pool({ connectionString: DATABASE_URL, max: 10 });
}
