export type SessionPrincipal = {
  active: true;
  sub: string;
  sid: string;
  email: string;
  email_verified: boolean;
  roles: string[];
  seller_ids: string[];
  scope: string;
};

export async function introspectSession(
  authOrigin: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<SessionPrincipal | null> {
  const response = await fetcher(new URL("/session/introspect", authOrigin), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: accessToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const result = (await response.json()) as Partial<SessionPrincipal> & {
    active?: boolean;
  };
  return result.active &&
    typeof result.sub === "string" &&
    Array.isArray(result.roles) &&
    Array.isArray(result.seller_ids)
    ? (result as SessionPrincipal)
    : null;
}
export function requireGlobalRole(
  principal: SessionPrincipal | null,
  allowed: string[],
): SessionPrincipal {
  if (!principal || !allowed.some((role) => principal.roles.includes(role)))
    throw new Error("AUTH_FORBIDDEN");
  return principal;
}
export function requireSellerScope(
  principal: SessionPrincipal | null,
  sellerId: string,
): SessionPrincipal {
  if (!principal || !principal.seller_ids.includes(sellerId))
    throw new Error("SELLER_SCOPE_FORBIDDEN");
  return principal;
}
export async function createOidcLogin(input: {
  authOrigin: string;
  clientId: string;
  redirectUri: string;
  scopes?: string[];
}) {
  const verifier = randomBase64Url(32);
  const state = randomBase64Url(24);
  const nonce = randomBase64Url(24);
  const challenge = base64Url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
  const url = new URL("/authorize", input.authOrigin);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: (
      input.scopes ?? ["openid", "profile", "email", "offline_access"]
    ).join(" "),
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return { url: url.href, verifier, state, nonce };
}
export async function exchangeAuthorizationCode(input: {
  authOrigin: string;
  code: string;
  verifier: string;
  clientId: string;
  redirectUri: string;
  fetcher?: typeof fetch;
}) {
  const response = await (input.fetcher ?? fetch)(
    new URL("/token", input.authOrigin),
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        code_verifier: input.verifier,
        client_id: input.clientId,
        redirect_uri: input.redirectUri,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("OIDC_CODE_EXCHANGE_FAILED");
  return response.json() as Promise<{
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}
function randomBase64Url(bytes: number) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}
function base64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
