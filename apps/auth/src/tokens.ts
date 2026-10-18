import { createHash } from "node:crypto";
import { SignJWT, exportJWK, importJWK, jwtVerify, type JWK } from "jose";

export type AccessClaims = {
  sub: string;
  sid: string;
  roles: string[];
  seller_ids: string[];
  email: string;
  email_verified: boolean;
  scope: string;
};

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export class TokenService {
  private readonly privateKey: CryptoKey;
  private readonly publicKey: CryptoKey;
  private readonly kid: string;
  private readonly issuer: string;

  private constructor(
    privateKey: CryptoKey,
    publicKey: CryptoKey,
    kid: string,
    issuer: string,
  ) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.kid = kid;
    this.issuer = issuer.replace(/\/$/, "");
  }

  static async create(jwk: JWK, issuer: string): Promise<TokenService> {
    const privateKey = (await importJWK(jwk, "EdDSA")) as CryptoKey;
    const publicJwk = { ...jwk };
    delete publicJwk.d;
    const publicKey = (await importJWK(publicJwk, "EdDSA")) as CryptoKey;
    const thumbprint = createHash("sha256")
      .update(JSON.stringify(publicJwk))
      .digest("base64url")
      .slice(0, 16);
    return new TokenService(
      privateKey,
      publicKey,
      String(jwk.kid ?? thumbprint),
      issuer,
    );
  }

  async jwks(): Promise<{ keys: JWK[] }> {
    return {
      keys: [
        {
          ...(await exportJWK(this.publicKey)),
          kid: this.kid,
          alg: "EdDSA",
          use: "sig",
        },
      ],
    };
  }

  async signAccess(
    claims: AccessClaims,
    audience: string,
    ttlSeconds = 300,
  ): Promise<string> {
    return new SignJWT({ ...claims, jti: crypto.randomUUID() })
      .setProtectedHeader({ alg: "EdDSA", kid: this.kid, typ: "at+jwt" })
      .setIssuer(this.issuer)
      .setAudience(audience)
      .setSubject(claims.sub)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.privateKey);
  }

  async signId(
    claims: AccessClaims,
    audience: string,
    nonce?: string | null,
    ttlSeconds = 300,
  ): Promise<string> {
    return new SignJWT({
      sid: claims.sid,
      email: claims.email,
      email_verified: claims.email_verified,
      roles: claims.roles,
      seller_ids: claims.seller_ids,
      ...(nonce ? { nonce } : {}),
    })
      .setProtectedHeader({ alg: "EdDSA", kid: this.kid, typ: "JWT" })
      .setIssuer(this.issuer)
      .setAudience(audience)
      .setSubject(claims.sub)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.privateKey);
  }

  async verify(
    token: string,
    audience?: string,
  ): Promise<Record<string, unknown>> {
    const result = await jwtVerify(token, this.publicKey, {
      issuer: this.issuer,
      ...(audience ? { audience } : {}),
      algorithms: ["EdDSA"],
    });
    return result.payload;
  }
}
