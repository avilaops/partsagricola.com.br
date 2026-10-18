import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type pg from "pg";
import { processImage, type ImageJob } from "./images.js";

export class PostgresImageJobs {
  constructor(privatePool: pg.Pool) {
    this.pool = privatePool;
  }
  private readonly pool: pg.Pool;
  async claim(): Promise<ImageJob | null> {
    const result = await this.pool.query<{ id: string; source_key: string }>(`
      update marketplace.image_job set status='PROCESSING',attempts=attempts+1,started_at=now(),updated_at=now()
       where id=(select id from marketplace.image_job where status in ('PENDING','FAILED') and attempts < 10 and available_at <= now() order by created_at for update skip locked limit 1)
      returning id,source_key
    `);
    const row = result.rows[0];
    return row ? { id: row.id, sourceKey: row.source_key } : null;
  }
  async complete(
    id: string,
    derivatives: Array<{ key: string; width: number }>,
  ) {
    await this.pool.query(
      "update marketplace.image_job set status='COMPLETED',derivatives=$2,error_message=null,completed_at=now(),updated_at=now() where id=$1",
      [id, JSON.stringify(derivatives)],
    );
  }
  async fail(id: string, message: string) {
    await this.pool.query(
      "update marketplace.image_job set status='FAILED',error_message=$2,available_at=now()+interval '5 minutes',updated_at=now() where id=$1",
      [id, message.slice(0, 1000)],
    );
  }
}

export function createS3ImageStorage(config: {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}) {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return {
    async read(key: string) {
      const output = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      );
      if (!output.Body) throw new Error("IMAGE_SOURCE_EMPTY");
      return output.Body.transformToByteArray();
    },
    async write(input: {
      key: string;
      contentType: "image/webp";
      body: Uint8Array;
    }) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          ContentType: input.contentType,
          Body: input.body,
        }),
      );
    },
  };
}

export async function processNextImage(
  jobs: PostgresImageJobs,
  storage: ReturnType<typeof createS3ImageStorage>,
) {
  const job = await jobs.claim();
  if (!job) return false;
  await processImage(job, storage, jobs);
  return true;
}
