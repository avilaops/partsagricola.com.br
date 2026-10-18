import { parseServiceEnv } from "@partsagricola/config";
import { createPool } from "@partsagricola/db";
import {
  createModerationEvidenceCipher,
  createS3UploadSigner,
  parseModerationEvidenceKey,
} from "@partsagricola/providers";
import { createApp } from "./app.js";
import { PostgresCatalogRepository } from "./catalog/postgres-repository.js";
import { PostgresChatRepository } from "./chat/postgres-repository.js";
import { PostgresModerationRepository } from "./moderation/postgres-repository.js";
import {
  loadMarkets,
  PostgresAuditRepository,
  PostgresImageJobQueue,
} from "./repositories.js";
const env = parseServiceEnv(process.env);
const pool = createPool();
const storage = storageConfig(process.env);
const evidenceCipher = createModerationEvidenceCipher(
  parseModerationEvidenceKey(required("MODERATION_EVIDENCE_KEY")),
);
const uploads = storage ? createS3UploadSigner(storage) : null;
const app = await createApp({
  markets: await loadMarkets(pool),
  audit: new PostgresAuditRepository(pool),
  catalog: new PostgresCatalogRepository(pool),
  chat: new PostgresChatRepository(pool, {
    encryptEvidence: evidenceCipher.encrypt,
    ...(uploads?.signRead ? { signRead: uploads.signRead } : {}),
  }),
  moderation: new PostgresModerationRepository(pool),
  imageJobs: new PostgresImageJobQueue(pool),
  ...(uploads ? { uploads } : {}),
});
app.addHook("onClose", async () => pool.end());
await app.listen({ host: env.HOST, port: env.PORT });

function storageConfig(source: NodeJS.ProcessEnv) {
  const required = [
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ] as const;
  if (!required.every((key) => source[key])) return null;
  return {
    endpoint: source.S3_ENDPOINT!,
    region: source.S3_REGION!,
    bucket: source.S3_BUCKET!,
    accessKeyId: source.S3_ACCESS_KEY_ID!,
    secretAccessKey: source.S3_SECRET_ACCESS_KEY!,
    forcePathStyle: source.S3_FORCE_PATH_STYLE !== "false",
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
