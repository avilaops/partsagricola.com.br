export function oidcDiscovery(issuer: URL) {
  const base = issuer.href.replace(/\/$/, "");
  return {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    userinfo_endpoint: `${base}/userinfo`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    end_session_endpoint: `${base}/logout`,
    introspection_endpoint: `${base}/session/introspect`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["EdDSA"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["openid", "profile", "email", "offline_access"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

export function validateAuthorize(input: URLSearchParams): {
  clientId: string;
  redirectUri: string;
  state?: string;
  nonce?: string;
  codeChallenge: string;
  scopes: string[];
} {
  if (input.get("response_type") !== "code")
    throw new Error("unsupported_response_type");
  if (input.get("code_challenge_method") !== "S256")
    throw new Error("invalid_request");
  const clientId = input.get("client_id");
  const redirectUri = input.get("redirect_uri");
  const codeChallenge = input.get("code_challenge");
  const scopes = (input.get("scope") ?? "").split(/\s+/).filter(Boolean);
  if (!clientId || !redirectUri || !codeChallenge || !scopes.includes("openid"))
    throw new Error("invalid_request");
  return {
    clientId,
    redirectUri,
    codeChallenge,
    scopes,
    ...(input.get("state") ? { state: input.get("state")! } : {}),
    ...(input.get("nonce") ? { nonce: input.get("nonce")! } : {}),
  };
}
