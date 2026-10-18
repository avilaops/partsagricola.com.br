import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function digestToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

export function digestCpf(cpf: string, lookupKey: Buffer): Buffer {
  assertKey(lookupKey);
  const normalized = cpf.replace(/\D/g, "");
  if (!/^\d{11}$/.test(normalized)) throw new Error("CPF_INVALID");
  return createHmac("sha256", lookupKey).update(normalized, "utf8").digest();
}

export function digestLookup(value: string, lookupKey: Buffer): Buffer {
  assertKey(lookupKey);
  return createHmac("sha256", lookupKey)
    .update(value.trim().toLowerCase(), "utf8")
    .digest();
}

export function encryptSecret(value: string, key: Buffer): Buffer {
  assertKey(key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]);
}

export function decryptSecret(payload: Buffer, key: Buffer): string {
  assertKey(key);
  if (payload.length < 1 + IV_LENGTH + TAG_LENGTH || payload[0] !== VERSION) {
    throw new Error("ENCRYPTED_SECRET_INVALID");
  }
  const iv = payload.subarray(1, 1 + IV_LENGTH);
  const tag = payload.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(1 + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function randomOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function assertKey(key: Buffer): void {
  if (key.length !== 32) throw new Error("AUTH_KEY_LENGTH_INVALID");
}
