import assert from "node:assert/strict";
import test from "node:test";
import {
  createOidcLogin,
  introspectSession,
  requireGlobalRole,
  requireSellerScope,
} from "./auth.ts";
const principal = {
  active: true as const,
  sub: "u",
  sid: "s",
  email: "u@test",
  email_verified: true,
  roles: ["ADMIN"],
  seller_ids: ["seller-1"],
  scope: "openid",
};
test("guards negam por padrão e separam papel global de empresa", () => {
  assert.equal(requireGlobalRole(principal, ["ADMIN"]), principal);
  assert.throws(
    () => requireGlobalRole(principal, ["FINANCE"]),
    /AUTH_FORBIDDEN/,
  );
  assert.equal(requireSellerScope(principal, "seller-1"), principal);
  assert.throws(
    () => requireSellerScope(principal, "seller-2"),
    /SELLER_SCOPE_FORBIDDEN/,
  );
});
test("introspecção falha fechada", async () => {
  const fetcher = async () =>
    new Response(JSON.stringify({ active: false }), { status: 200 });
  assert.equal(
    await introspectSession(
      "https://auth.test",
      "secret",
      fetcher as typeof fetch,
    ),
    null,
  );
});
test("login OIDC sempre usa code e PKCE S256", async () => {
  const login = await createOidcLogin({
    authOrigin: "https://auth.test",
    clientId: "web",
    redirectUri: "https://web.test/auth/callback",
  });
  const url = new URL(login.url);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.notEqual(url.searchParams.get("code_challenge"), login.verifier);
  assert.ok(login.state.length > 20);
});
