import { parseServiceEnv } from "@partsagricola/config";
import { createPool } from "@partsagricola/db";
import {
  createModerationEvidenceCipher,
  parseModerationEvidenceKey,
} from "@partsagricola/providers";
import { createHealthServer } from "./health.js";
import {
  createS3ImageStorage,
  PostgresImageJobs,
  processNextImage,
} from "./runtime.js";
import {
  createHttpOcrProvider,
  createHttpTextModerator,
  createLocalTextModerator,
  PostgresModerationJobs,
  processNextModeration,
} from "./moderation.js";
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
const moderationJobs = new PostgresModerationJobs(pool);
const evidenceCipher = createModerationEvidenceCipher(
  parseModerationEvidenceKey(required("MODERATION_EVIDENCE_KEY")),
);
const analyzeText =
  process.env.MODERATION_PROVIDER_URL && process.env.MODERATION_PROVIDER_API_KEY
    ? createHttpTextModerator({
        endpoint: process.env.MODERATION_PROVIDER_URL,
        apiKey: process.env.MODERATION_PROVIDER_API_KEY,
      })
    : createLocalTextModerator();
const extractImageText =
  process.env.OCR_PROVIDER_URL && process.env.OCR_PROVIDER_API_KEY
    ? createHttpOcrProvider({
        endpoint: process.env.OCR_PROVIDER_URL,
        apiKey: process.env.OCR_PROVIDER_API_KEY,
      })
    : async () => null;
const timer = setInterval(() => {
  void processNextImage(jobs, storage).catch((error) =>
    console.error("image job failed", error),
  );
  void processNextModeration(moderationJobs, {
    decryptEvidence: evidenceCipher.decrypt,
    analyzeText,
    extractImageText,
  }).catch((error) => console.error("moderation job failed", error));
}, 2_000);
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
