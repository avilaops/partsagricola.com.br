import { parseServiceEnv } from "@partsagricola/config";
import { createPool } from "@partsagricola/db";
import { createHealthServer } from "./health.js";
import {
  createS3ImageStorage,
  PostgresImageJobs,
  processNextImage,
} from "./runtime.js";
const env = parseServiceEnv(process.env);
const server = createHealthServer().listen(env.PORT, env.HOST, () =>
  console.log(`worker health on ${env.HOST}:${env.PORT}`),
);
const pool = createPool();
const storage = createS3ImageStorage({
  endpoint: required("S3_ENDPOINT"),
  region: required("S3_REGION"),
  bucket: required("S3_BUCKET"),
  accessKeyId: required("S3_ACCESS_KEY_ID"),
  secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
});
const jobs = new PostgresImageJobs(pool);
const timer = setInterval(
  () =>
    void processNextImage(jobs, storage).catch((error) =>
      console.error("image job failed", error),
    ),
  2_000,
);
timer.unref();
async function shutdown() {
  clearInterval(timer);
  server.close();
  await pool.end();
}
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
