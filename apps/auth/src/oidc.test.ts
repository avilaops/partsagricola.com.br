import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPair, exportJWK } from "jose";
import { oidcDiscovery, validateAuthorize } from "./oidc.ts";
import { pkceChallenge, TokenService } from "./tokens.ts";

test("discovery anuncia somente Authorization Code, PKCE S256 e EdDSA", () => {
  const doc = oidcDiscovery(new URL("https://auth.partsagricola.test/"));
  assert.deepEqual(doc.response_types_supported, ["code"]);
  assert.deepEqual(doc.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(doc.id_token_signing_alg_values_supported, ["EdDSA"]);
  assert.equal("password" in doc.grant_types_supported, false);
});

test("authorize rejeita implicit e PKCE plain", () => {
  const base = new URLSearchParams({
    client_id: "web",
    redirect_uri: "https://app/cb",
    scope: "openid",
    code_challenge: "x",
  });
  base.set("response_type", "token");
  base.set("code_challenge_method", "S256");
  assert.throws(() => validateAuthorize(base), /unsupported_response_type/);
  base.set("response_type", "code");
  base.set("code_challenge_method", "plain");
  assert.throws(() => validateAuthorize(base), /invalid_request/);
});

test("JWT Ed25519 preserva claims e JWKS nunca inclui chave privada", async () => {
  const { privateKey } = await generateKeyPair("EdDSA", { extractable: true });
  const jwk = await exportJWK(privateKey);
  jwk.kid = "test-key";
  const service = await TokenService.create(
    jwk,
    "https://auth.partsagricola.test",
  );
  const token = await service.signAccess(
    {
      sub: "u1",
      sid: "s1",
      roles: ["USER"],
      seller_ids: ["c1"],
      email: "u@example.test",
      email_verified: true,
      scope: "openid",
    },
    "client",
    60,
  );
  const claims = await service.verify(token, "client");
  assert.equal(claims.sid, "s1");
  assert.deepEqual(claims.seller_ids, ["c1"]);
  assert.equal((await service.jwks()).keys[0]!.d, undefined);
  assert.equal(pkceChallenge("a".repeat(43)), createPkce("a".repeat(43)));
});

function createPkce(value: string): string {
  return Buffer.from(awaitableSha256(value)).toString("base64url");
}
function awaitableSha256(value: string): Buffer {
  return requireHash(value);
}
import { createHash as nodeHash } from "node:crypto";
function requireHash(value: string): Buffer {
  return nodeHash("sha256").update(value).digest();
}
