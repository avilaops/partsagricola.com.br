export type ConnectorRecord = {
  provider: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  scopes: string[];
};
export type SocialProfile = {
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
};
export function resolveConnectors(
  records: ConnectorRecord[],
  env: Record<string, string | undefined>,
) {
  return records.flatMap((record) => {
    const clientId = env[record.clientIdEnv];
    const clientSecret = env[record.clientSecretEnv];
    return clientId && clientSecret
      ? [
          {
            provider: record.provider,
            clientId,
            clientSecret,
            authorizationEndpoint: record.authorizationEndpoint,
            tokenEndpoint: record.tokenEndpoint,
            userinfoEndpoint: record.userinfoEndpoint,
            scopes: record.scopes,
          },
        ]
      : [];
  });
}
export function socialSignupDecision(
  profile: SocialProfile,
  existingEmailUserId?: string,
): "CREATE" | "COMPLETE_PROFILE" | "LINK_REQUIRED" {
  if (existingEmailUserId) return "LINK_REQUIRED";
  if (!profile.email || !profile.name || !profile.emailVerified)
    return "COMPLETE_PROFILE";
  return "CREATE";
}

export async function exchangeSocialCode(
  connector: ReturnType<typeof resolveConnectors>[number],
  code: string,
  redirectUri: string,
  fetcher: typeof fetch = fetch,
): Promise<SocialProfile> {
  const tokenResponse = await fetcher(connector.tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: connector.clientId,
      client_secret: connector.clientSecret,
    }),
  });
  if (!tokenResponse.ok) throw new Error("SOCIAL_TOKEN_EXCHANGE_FAILED");
  const tokens = (await tokenResponse.json()) as {
    access_token?: string;
    id_token?: string;
  };
  if (connector.provider === "APPLE") {
    if (!tokens.id_token) throw new Error("SOCIAL_ID_TOKEN_MISSING");
    const verified = await jwtVerify(
      tokens.id_token,
      createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
      { issuer: "https://appleid.apple.com", audience: connector.clientId },
    );
    const subject = verified.payload.sub;
    if (!subject) throw new Error("SOCIAL_SUBJECT_MISSING");
    return {
      subject,
      ...(typeof verified.payload.email === "string"
        ? { email: verified.payload.email }
        : {}),
      emailVerified:
        verified.payload.email_verified === true ||
        verified.payload.email_verified === "true",
    };
  }
  if (!tokens.access_token) throw new Error("SOCIAL_ACCESS_TOKEN_MISSING");
  const profileResponse = await fetcher(connector.userinfoEndpoint, {
    headers: {
      authorization: `Bearer ${tokens.access_token}`,
      accept: "application/json",
    },
  });
  if (!profileResponse.ok) throw new Error("SOCIAL_USERINFO_FAILED");
  const profile = (await profileResponse.json()) as Record<string, unknown>;
  const subject =
    typeof profile.sub === "string"
      ? profile.sub
      : typeof profile.id === "string"
        ? profile.id
        : null;
  if (!subject) throw new Error("SOCIAL_SUBJECT_MISSING");
  return {
    subject,
    ...(typeof profile.email === "string" ? { email: profile.email } : {}),
    ...(typeof profile.name === "string" ? { name: profile.name } : {}),
    emailVerified:
      profile.email_verified === true || profile.verified_email === true,
  };
}
import { createRemoteJWKSet, jwtVerify } from "jose";
