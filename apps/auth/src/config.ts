export interface AuthConfig {
  nodeEnv: "development" | "test" | "production";
  issuer: URL;
  databaseUrl: string;
  signingJwk: Record<string, unknown>;
  dataKey: Buffer;
  lookupKey: Buffer;
  smtpUrl: string | null;
  cookieSecure: boolean;
  socialMockEnabled: boolean;
}

export function parseAuthConfig(
  env: Record<string, string | undefined> = process.env,
): AuthConfig {
  const nodeEnv = parseNodeEnv(env.NODE_ENV);
  const issuer = requiredUrl(env.AUTH_ISSUER, "AUTH_ISSUER");
  const databaseUrl = requiredUrl(env.DATABASE_URL, "DATABASE_URL").href;
  if (databaseUrl.slice(0, 13) !== "postgresql://") {
    throw new Error("DATABASE_URL must use postgresql://");
  }

  const production = nodeEnv === "production";
  const signingJwk = parseJwk(
    requireForProduction(env.AUTH_SIGNING_JWK, "AUTH_SIGNING_JWK", production),
  );
  const dataKey = parseKey(
    requireForProduction(env.AUTH_DATA_KEY, "AUTH_DATA_KEY", production),
    "AUTH_DATA_KEY",
  );
  const lookupKey = parseKey(
    requireForProduction(env.AUTH_LOOKUP_KEY, "AUTH_LOOKUP_KEY", production),
    "AUTH_LOOKUP_KEY",
  );
  const smtpUrl = requireForProduction(env.SMTP_URL, "SMTP_URL", production);

  return {
    nodeEnv,
    issuer,
    databaseUrl,
    signingJwk,
    dataKey,
    lookupKey,
    smtpUrl,
    cookieSecure: production,
    socialMockEnabled:
      nodeEnv !== "production" && env.AUTH_SOCIAL_MOCK === "true",
  };
}

function parseNodeEnv(value: string | undefined): AuthConfig["nodeEnv"] {
  const resolved = value ?? "development";
  if (
    !(["development", "test", "production"] as const).includes(
      resolved as AuthConfig["nodeEnv"],
    )
  ) {
    throw new Error("NODE_ENV_INVALID");
  }
  return resolved as AuthConfig["nodeEnv"];
}

function requiredUrl(value: string | undefined, name: string): URL {
  if (!value) throw new Error(`${name} is required`);
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function requireForProduction(
  value: string | undefined,
  name: string,
  production: boolean,
): string | null {
  if (!value && production)
    throw new Error(`${name} is required in production`);
  return value ?? null;
}

function parseKey(value: string | null, name: string): Buffer {
  if (!value) return Buffer.alloc(32);
  const key = Buffer.from(value, "base64url");
  if (key.length !== 32) throw new Error(`${name} must decode to 32 bytes`);
  return key;
}

function parseJwk(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("AUTH_SIGNING_JWK must be valid JSON");
  }
}
