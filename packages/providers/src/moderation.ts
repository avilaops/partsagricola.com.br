import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export type ModerationEvidence = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  sha256: string;
  keyVersion: number;
};

export function parseModerationEvidenceKey(value: string): Buffer {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("MODERATION_EVIDENCE_KEY_32_BYTES");
  return key;
}

export function createModerationEvidenceCipher(key: Buffer, keyVersion = 1) {
  if (key.length !== 32) throw new Error("MODERATION_EVIDENCE_KEY_32_BYTES");
  return {
    encrypt(value: string): ModerationEvidence {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ]);
      return {
        ciphertext,
        iv,
        authTag: cipher.getAuthTag(),
        sha256: createHash("sha256").update(value).digest("hex"),
        keyVersion,
      };
    },
    decrypt(value: ModerationEvidence): string {
      const decipher = createDecipheriv("aes-256-gcm", key, value.iv);
      decipher.setAuthTag(value.authTag);
      return Buffer.concat([
        decipher.update(value.ciphertext),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}
