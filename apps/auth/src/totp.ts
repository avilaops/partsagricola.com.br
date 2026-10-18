import { randomBytes, timingSafeEqual } from "node:crypto";

import { generateSecret, generateURI, verify } from "otplib";

import { decryptSecret, digestToken, encryptSecret } from "./crypto.js";

export interface TotpEnrollment {
  secret: string;
  uri: string;
  encryptedSecret: Buffer;
  recoveryCodes: string[];
  recoveryCodeHashes: Buffer[];
}

export class TotpService {
  private readonly encryptionKey: Buffer;

  constructor(encryptionKey: Buffer) {
    this.encryptionKey = encryptionKey;
  }

  async enroll(label: string): Promise<TotpEnrollment> {
    const secret = generateSecret();
    const recoveryCodes = Array.from({ length: 8 }, () => recoveryCode());
    return {
      secret,
      uri: generateURI({ issuer: "PARTSAGRICOLA", label, secret }),
      encryptedSecret: encryptSecret(secret, this.encryptionKey),
      recoveryCodes,
      recoveryCodeHashes: recoveryCodes.map(digestToken),
    };
  }

  async verify(encryptedSecret: Buffer, token: string): Promise<boolean> {
    if (!/^\d{6}$/.test(token)) return false;
    const secret = decryptSecret(encryptedSecret, this.encryptionKey);
    const result = await verify({ secret, token });
    return result.valid;
  }

  useRecoveryCode(
    hashes: Buffer[],
    code: string,
  ): { valid: boolean; remainingHashes: Buffer[] } {
    const candidate = digestToken(code.trim().toUpperCase());
    const index = hashes.findIndex(
      (hash) =>
        hash.length === candidate.length && timingSafeEqual(hash, candidate),
    );
    if (index === -1) return { valid: false, remainingHashes: hashes };
    return {
      valid: true,
      remainingHashes: hashes.filter((_, position) => position !== index),
    };
  }
}

function recoveryCode(): string {
  const value = randomBytes(8).toString("hex").toUpperCase();
  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12)}`;
}
