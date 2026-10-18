import assert from "node:assert/strict";
import test from "node:test";
import { createS3UploadSigner } from "./index.ts";

test("gera URL S3 v4 curta e rejeita chave fora de uploads", async () => {
  const signer = createS3UploadSigner({
    endpoint: "http://127.0.0.1:59000",
    region: "us-east-1",
    bucket: "partsagricola",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    expiresIn: 300,
  });
  const signed = await signer.signUpload({
    key: "uploads/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg",
    contentType: "image/jpeg",
    size: 1024,
  });
  const url = new URL(signed.url);
  assert.equal(
    url.pathname,
    "/partsagricola/uploads/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg",
  );
  assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
  assert.ok(url.searchParams.get("X-Amz-Signature"));
  await assert.rejects(
    signer.signUpload({
      key: "../segredo",
      contentType: "image/jpeg",
      size: 1,
    }),
    /INVALID_STORAGE_KEY/,
  );
});
