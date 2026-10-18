import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createPool } from "./index.js";
const pool = createPool();
const sql = await readFile(
  fileURLToPath(new URL("../sql/001_foundation.sql", import.meta.url)),
  "utf8",
);
try {
  await pool.query(sql);
  console.log("migrations applied");
} finally {
  await pool.end();
}
