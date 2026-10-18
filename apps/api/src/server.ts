import { parseServiceEnv } from "@partsagricola/config";
import { createPool } from "@partsagricola/db";
import { createS3UploadSigner } from "@partsagricola/providers";
import { createApp } from "./app.js";
import {
  loadMarkets,
  PostgresAuditRepository,
  PostgresImageJobQueue,
  PostgresMarketplaceRepository,
} from "./repositories.js";
const env = parseServiceEnv(process.env);
const pool = createPool();
const storage = storageConfig(process.env);
const app = await createApp({
  markets: await loadMarkets(pool),
  audit: new PostgresAuditRepository(pool),
  imageJobs: new PostgresImageJobQueue(pool),
  marketplace: new PostgresMarketplaceRepository(pool),
  ...(storage ? { uploads: createS3UploadSigner(storage) } : {}),
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
