import assert from "node:assert/strict";
import test from "node:test";
import {
  createModerationEvidenceCipher,
  parseModerationEvidenceKey,
} from "./moderation.ts";

test("AES-256-GCM cifra evidência, restaura e rejeita adulteração", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const cipher = createModerationEvidenceCipher(
    parseModerationEvidenceKey(key),
  );
  const encrypted = cipher.encrypt("contato 11 99999-8877");
  assert.doesNotMatch(encrypted.ciphertext.toString("utf8"), /99999/);
  assert.equal(cipher.decrypt(encrypted), "contato 11 99999-8877");
  encrypted.authTag[0] = encrypted.authTag[0]! ^ 1;
  assert.throws(() => cipher.decrypt(encrypted));
});

test("chave de evidência exige exatamente 32 bytes", () => {
  assert.throws(() => parseModerationEvidenceKey("curta"), /32_BYTES/);
});
