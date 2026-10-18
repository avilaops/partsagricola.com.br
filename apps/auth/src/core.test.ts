import assert from "node:assert/strict";
import test from "node:test";

import { generate } from "otplib";

import { parseAuthConfig } from "./config.ts";
import {
  decryptSecret,
  digestCpf,
  digestToken,
  encryptSecret,
} from "./crypto.ts";
import { hashPassword, verifyPassword } from "./passwords.ts";
import { TotpService } from "./totp.ts";

const dataKey = Buffer.alloc(32, 11);
const lookupKey = Buffer.alloc(32, 12);

test("configuração de produção falha sem cada segredo obrigatório", () => {
  const base = {
    NODE_ENV: "production",
    AUTH_ISSUER: "https://auth.partsagricola.com.br",
    DATABASE_URL: "postgresql://user:pass@db.example.test/partsagricola",
    AUTH_SIGNING_JWK: JSON.stringify({
      kty: "OKP",
      crv: "Ed25519",
      x: "test-public",
      d: "test-private",
    }),
    AUTH_DATA_KEY: dataKey.toString("base64url"),
    AUTH_LOOKUP_KEY: lookupKey.toString("base64url"),
    SMTP_URL: "smtp://mail.example.test:587",
  };

  for (const required of [
    "AUTH_SIGNING_JWK",
    "AUTH_DATA_KEY",
    "AUTH_LOOKUP_KEY",
    "SMTP_URL",
  ]) {
    const env = { ...base, [required]: undefined };
    assert.throws(() => parseAuthConfig(env), new RegExp(required));
  }

  const config = parseAuthConfig(base);
  assert.equal(config.issuer.href, "https://auth.partsagricola.com.br/");
  assert.equal(config.cookieSecure, true);
  assert.equal(config.dataKey.length, 32);
  assert.equal(config.lookupKey.length, 32);
});

test("senha usa Argon2id e não autentica valor incorreto", async () => {
  const hash = await hashPassword("Trator-Seguro-2026!");
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(hash, "Trator-Seguro-2026!"), true);
  assert.equal(await verifyPassword(hash, "senha-errada"), false);
});

test("digests não expõem token ou CPF e CPF equivalente normaliza igual", () => {
  const token = "token-muito-secreto";
  const tokenDigest = digestToken(token);
  assert.equal(tokenDigest.length, 32);
  assert.equal(tokenDigest.includes(Buffer.from(token)), false);

  const formatted = digestCpf("123.456.789-09", lookupKey);
  const digits = digestCpf("12345678909", lookupKey);
  assert.deepEqual(formatted, digits);
  assert.equal(formatted.length, 32);
  assert.equal(formatted.includes(Buffer.from("12345678909")), false);
  assert.throws(() => digestCpf("123", lookupKey), /CPF_INVALID/);
});

test("AES-GCM restaura segredo e rejeita ciphertext adulterado", () => {
  const encrypted = encryptSecret("segredo-totp", dataKey);
  assert.notEqual(encrypted.toString("utf8"), "segredo-totp");
  assert.equal(decryptSecret(encrypted, dataKey), "segredo-totp");

  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 1;
  assert.throws(() => decryptSecret(tampered, dataKey));
});

test("TOTP valida código e recovery code apenas uma vez", async () => {
  const service = new TotpService(dataKey);
  const enrollment = await service.enroll("user@example.test");
  assert.match(enrollment.uri, /^otpauth:\/\/totp\/PARTSAGRICOLA:/);
  assert.equal(enrollment.recoveryCodes.length, 8);
  assert.equal(enrollment.recoveryCodeHashes.length, 8);

  const token = await generate({ secret: enrollment.secret });
  assert.equal(await service.verify(enrollment.encryptedSecret, token), true);
  assert.equal(
    await service.verify(enrollment.encryptedSecret, "000000"),
    false,
  );

  const first = service.useRecoveryCode(
    enrollment.recoveryCodeHashes,
    enrollment.recoveryCodes[0]!,
  );
  assert.equal(first.valid, true);
  assert.equal(first.remainingHashes.length, 7);
  const replay = service.useRecoveryCode(
    first.remainingHashes,
    enrollment.recoveryCodes[0]!,
  );
  assert.equal(replay.valid, false);
});
