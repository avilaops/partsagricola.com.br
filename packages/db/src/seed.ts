import { createPool } from "./index.js";
const pool = createPool();
try {
  await pool.query(
    "insert into app_setting (key,value) values ('brand_name','PARTSAGRICOLA') on conflict (key) do update set value=excluded.value",
  );
  console.log("seed applied");
} finally {
  await pool.end();
}
