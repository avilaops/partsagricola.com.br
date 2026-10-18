import { readFile } from "node:fs/promises";

import {
  importCatalog,
  parseCatalogCsv,
  resolveCatalogPath,
} from "./catalog-import.js";
import { createPool } from "./index.js";

const path = resolveCatalogPath(process.argv.slice(2));

const rows = parseCatalogCsv(await readFile(path, "utf8"));
const pool = createPool();
try {
  const summary = await importCatalog(pool, rows);
  console.log(`catalog imported ${JSON.stringify(summary)}`);
} finally {
  await pool.end();
}
