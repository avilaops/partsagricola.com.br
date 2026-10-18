export interface NotificationProvider {
  send(input: {
    recipient: string;
    template: string;
    data: Record<string, unknown>;
  }): Promise<{ id: string }>;
}
export interface ObjectStorageProvider {
  put(input: {
    key: string;
    contentType: string;
    body: Uint8Array;
  }): Promise<{ url: string }>;
}

export * from "./moderation.ts";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type S3StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  expiresIn?: number;
};

export function createS3UploadSigner(config: S3StorageConfig) {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle ?? true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return {
    async signUpload(input: {
      key: string;
      contentType: string;
      size: number;
    }) {
      if (!input.key.startsWith("uploads/") || input.key.includes(".."))
        throw new Error("INVALID_STORAGE_KEY");
      const expiresIn = config.expiresIn ?? 300;
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.size,
      });
      return {
        key: input.key,
        url: await getSignedUrl(client, command, {
          expiresIn,
          signableHeaders: new Set(["content-type"]),
        }),
        expiresIn,
      };
    },
    async signRead(key: string) {
      if (!key.startsWith("uploads/") || key.includes(".."))
        throw new Error("INVALID_STORAGE_KEY");
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn: config.expiresIn ?? 300 },
      );
    },
  };
}
