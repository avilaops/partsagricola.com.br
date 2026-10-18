import sharp from "sharp";

export type ImageJob = { id: string; sourceKey: string };
export interface ImageStorage {
  read(key: string): Promise<Uint8Array>;
  write(input: {
    key: string;
    contentType: "image/webp";
    body: Uint8Array;
  }): Promise<void>;
}
export interface ImageJobRepository {
  complete(
    id: string,
    derivatives: Array<{ key: string; width: number }>,
  ): Promise<void>;
  fail(id: string, message: string): Promise<void>;
}

const widths = [480, 960, 1600] as const;

export async function processImage(
  job: ImageJob,
  storage: ImageStorage,
  jobs: ImageJobRepository,
) {
  try {
    const source = await storage.read(job.sourceKey);
    const stem = job.sourceKey.replace(/\.[^.]+$/, "");
    const derivatives = await Promise.all(
      widths.map(async (width) => {
        const key = `${stem}-${width}.webp`;
        const body = await sharp(source)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        await storage.write({ key, contentType: "image/webp", body });
        return {
          key,
          width: Math.min(width, (await sharp(body).metadata()).width ?? width),
        };
      }),
    );
    await jobs.complete(job.id, derivatives);
    return derivatives;
  } catch (error) {
    await jobs.fail(
      job.id,
      error instanceof Error ? error.message : "UNKNOWN_IMAGE_ERROR",
    );
    throw error;
  }
}
