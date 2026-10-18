import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { processImage } from "./images.ts";

test("gera três WebP sem EXIF e só conclui após publicar todos", async () => {
  const source = await sharp({
    create: { width: 1800, height: 1200, channels: 3, background: "#4c7a2a" },
  })
    .withMetadata({ exif: { IFD0: { Copyright: "segredo" } } })
    .jpeg()
    .toBuffer();
  const written = new Map<string, Uint8Array>();
  let completed = false;
  const result = await processImage(
    { id: "job-1", sourceKey: "uploads/company/photo.jpg" },
    {
      read: async () => source,
      write: async ({ key, body }) => void written.set(key, body),
    },
    {
      complete: async () => void (completed = true),
      fail: async () => undefined,
    },
  );
  assert.equal(completed, true);
  assert.deepEqual(
    result.map((item) => item.width),
    [480, 960, 1600],
  );
  for (const item of result) {
    const metadata = await sharp(written.get(item.key)).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, item.width);
    assert.equal(metadata.exif, undefined);
  }
});

test("marca job como falho e não conclui quando uma publicação falha", async () => {
  const source = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  let completed = false;
  let failed = false;
  await assert.rejects(
    processImage(
      { id: "job-2", sourceKey: "uploads/company/photo.png" },
      {
        read: async () => source,
        write: async () => {
          throw new Error("storage unavailable");
        },
      },
      {
        complete: async () => void (completed = true),
        fail: async () => void (failed = true),
      },
    ),
    /storage unavailable/,
  );
  assert.equal(completed, false);
  assert.equal(failed, true);
});
