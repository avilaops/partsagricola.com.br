import { createPool } from "./index.js";
import { applyMigrations } from "./migrations.js";

const pool = createPool();
try {
  const result = await applyMigrations(
    pool,
    new URL("../sql/", import.meta.url),
  );
  console.log(
    `migrations applied=[${result.applied.join(",")}] skipped=[${result.skipped.join(",")}]`,
  );
} finally {
  await pool.end();
}
