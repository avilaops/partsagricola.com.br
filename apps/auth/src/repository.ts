import type { Pool, PoolClient } from "pg";

type Hash = Buffer;

export type Credential = {
  userId: string;
  email: string;
  name: string;
  passwordHash: string | null;
  emailVerified: boolean;
  roles: string[];
  totpSecretEncrypted: Buffer | null;
  totpEnabled: boolean;
  recoveryCodeHashes: Buffer[];
};

export type SessionContext = {
  id: string;
  userId: string;
  email: string;
  emailVerified: boolean;
  roles: string[];
  sellerIds: string[];
  secondFactorAt: Date | null;
};

async function transaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export class AuthRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async registerLocal(input: {
    email: string;
    name: string;
    passwordHash: string;
    cpfDigest?: Hash;
  }): Promise<{ id: string }> {
    const email = input.email.trim().toLowerCase();
    return transaction(this.pool, async (client) => {
      const user = await client.query<{ id: string }>(
        `insert into marketplace.app_user (email, name)
         values ($1, $2) returning id`,
        [email, input.name.trim()],
      );
      const id = user.rows[0]!.id;
      await client.query(
        `insert into marketplace.auth_credential (user_id, password_hash, cpf_digest, password_changed_at)
         values ($1, $2, $3, now())`,
        [id, input.passwordHash, input.cpfDigest ?? null],
      );
      await client.query(
        `insert into marketplace.auth_user_role (user_id, role_key) values ($1, 'USER')`,
        [id],
      );
      return { id };
    });
  }

  private async findCredential(
    where: string,
    value: string | Hash,
  ): Promise<Credential | null> {
    const result = await this.pool.query<{
      user_id: string;
      email: string;
      name: string;
      password_hash: string | null;
      email_verified: boolean;
      roles: string[];
      totp_secret_encrypted: Buffer | null;
      totp_enabled: boolean;
      recovery_code_hashes: Buffer[];
    }>(
      `select u.id as user_id, u.email, u.name, c.password_hash,
              c.email_verified_at is not null as email_verified,
              c.totp_secret_encrypted, c.totp_enabled, c.recovery_code_hashes,
              coalesce(array_agg(r.role_key order by r.role_key)
                filter (where r.role_key is not null), '{}') as roles
       from marketplace.app_user u
       join marketplace.auth_credential c on c.user_id = u.id
       left join marketplace.auth_user_role r on r.user_id = u.id
       where ${where} and u.status = 'ACTIVE'
       group by u.id, c.password_hash, c.email_verified_at, c.totp_secret_encrypted, c.totp_enabled, c.recovery_code_hashes`,
      [value],
    );
    const row = result.rows[0];
    return row
      ? {
          userId: row.user_id,
          email: row.email,
          name: row.name,
          passwordHash: row.password_hash,
          emailVerified: row.email_verified,
          roles: row.roles,
          totpSecretEncrypted: row.totp_secret_encrypted,
          totpEnabled: row.totp_enabled,
          recoveryCodeHashes: row.recovery_code_hashes,
        }
      : null;
  }

  findCredentialByEmail(email: string): Promise<Credential | null> {
    return this.findCredential(
      "lower(btrim(u.email)) = $1",
      email.trim().toLowerCase(),
    );
  }

  findCredentialByCpf(cpfDigest: Hash): Promise<Credential | null> {
    return this.findCredential("c.cpf_digest = $1", cpfDigest);
  }

  async createOneTimeToken(input: {
    userId: string;
    kind: "EMAIL_VERIFY" | "PASSWORD_RESET" | "INVITE";
    tokenHash: Hash;
    expiresAt: Date;
  }): Promise<void> {
    await this.pool.query(
      `insert into marketplace.auth_one_time_token (user_id, kind, token_hash, expires_at)
       values ($1, $2, $3, $4)`,
      [input.userId, input.kind, input.tokenHash, input.expiresAt],
    );
  }

  async verifyEmail(tokenHash: Hash, now: Date): Promise<string | null> {
    return transaction(this.pool, async (client) => {
      const token = await client.query<{ user_id: string }>(
        `update marketplace.auth_one_time_token set consumed_at = $2
         where token_hash = $1 and kind = 'EMAIL_VERIFY'
           and consumed_at is null and expires_at > $2 returning user_id`,
        [tokenHash, now],
      );
      const userId = token.rows[0]?.user_id;
      if (!userId) return null;
      await client.query(
        "update marketplace.auth_credential set email_verified_at = $2 where user_id = $1",
        [userId, now],
      );
      return userId;
    });
  }

  async resetPassword(
    tokenHash: Hash,
    passwordHash: string,
    now: Date,
  ): Promise<string | null> {
    return transaction(this.pool, async (client) => {
      const token = await client.query<{ user_id: string }>(
        `update marketplace.auth_one_time_token set consumed_at = $2
         where token_hash = $1 and kind = 'PASSWORD_RESET'
           and consumed_at is null and expires_at > $2 returning user_id`,
        [tokenHash, now],
      );
      const userId = token.rows[0]?.user_id;
      if (!userId) return null;
      await client.query(
        `update marketplace.auth_credential
         set password_hash = $2, password_changed_at = $3,
             failed_attempts = 0, locked_until = null where user_id = $1`,
        [userId, passwordHash, now],
      );
      await this.revokeUserAccess(client, userId, now);
      return userId;
    });
  }

  async createSession(input: {
    userId: string;
    tokenHash: Hash;
    idleExpiresAt: Date;
    expiresAt: Date;
    secondFactorAt?: Date;
    userAgentHash?: Hash;
    ipHash?: Hash;
  }): Promise<{ id: string }> {
    const result = await this.pool.query<{ id: string }>(
      `insert into marketplace.auth_session
         (user_id, token_hash, idle_expires_at, expires_at, second_factor_at, user_agent_hash, ip_hash)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        input.userId,
        input.tokenHash,
        input.idleExpiresAt,
        input.expiresAt,
        input.secondFactorAt ?? null,
        input.userAgentHash ?? null,
        input.ipHash ?? null,
      ],
    );
    return { id: result.rows[0]!.id };
  }

  async getSession(tokenHash: Hash, now: Date): Promise<SessionContext | null> {
    const result = await this.pool.query<{
      id: string;
      user_id: string;
      email: string;
      email_verified: boolean;
      roles: string[];
      seller_ids: string[];
      second_factor_at: Date | null;
    }>(
      `select s.id, u.id as user_id, u.email,
              c.email_verified_at is not null as email_verified, s.second_factor_at,
              coalesce((select array_agg(ur.role_key order by ur.role_key)
                from marketplace.auth_user_role ur where ur.user_id = u.id), '{}') as roles,
              coalesce((select array_agg(cm.company_id::text order by cm.company_id::text)
                from marketplace.company_member cm
                where cm.user_id = u.id and cm.active), '{}') as seller_ids
       from marketplace.auth_session s
       join marketplace.app_user u on u.id = s.user_id and u.status = 'ACTIVE'
       join marketplace.auth_credential c on c.user_id = u.id
       where s.token_hash = $1 and s.revoked_at is null
         and s.idle_expires_at > $2 and s.expires_at > $2`,
      [tokenHash, now],
    );
    const row = result.rows[0];
    if (!row) return null;
    await this.pool.query(
      "update marketplace.auth_session set last_seen_at = $2 where id = $1",
      [row.id, now],
    );
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      emailVerified: row.email_verified,
      roles: row.roles,
      sellerIds: row.seller_ids,
      secondFactorAt: row.second_factor_at,
    };
  }

  async revokeAllSessions(userId: string, now: Date): Promise<void> {
    await transaction(this.pool, (client) =>
      this.revokeUserAccess(client, userId, now),
    );
  }

  private async revokeUserAccess(
    client: PoolClient,
    userId: string,
    now: Date,
  ): Promise<void> {
    await client.query(
      "update marketplace.auth_session set revoked_at = coalesce(revoked_at, $2) where user_id = $1",
      [userId, now],
    );
    await client.query(
      "update marketplace.auth_refresh_token set revoked_at = coalesce(revoked_at, $2) where user_id = $1",
      [userId, now],
    );
  }

  async createRefreshToken(input: {
    userId: string;
    sessionId: string;
    clientId: string;
    tokenHash: Hash;
    familyId: string;
    scopes: string[];
    expiresAt: Date;
    parentId?: string;
  }): Promise<{ id: string }> {
    const result = await this.pool.query<{ id: string }>(
      `insert into marketplace.auth_refresh_token
         (user_id, session_id, client_id, token_hash, family_id, scopes, expires_at, parent_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        input.userId,
        input.sessionId,
        input.clientId,
        input.tokenHash,
        input.familyId,
        input.scopes,
        input.expiresAt,
        input.parentId ?? null,
      ],
    );
    return { id: result.rows[0]!.id };
  }

  async rotateRefreshToken(input: {
    currentHash: Hash;
    replacementHash: Hash;
    now: Date;
    expiresAt: Date;
  }): Promise<{
    status: "rotated" | "replay" | "invalid";
    tokenId?: string;
    sessionId?: string;
    clientId?: string;
    scopes?: string[];
  }> {
    return transaction(this.pool, async (client) => {
      const current = await client.query<{
        id: string;
        family_id: string;
        user_id: string;
        session_id: string;
        client_id: string;
        scopes: string[];
        consumed_at: Date | null;
        revoked_at: Date | null;
        expires_at: Date;
      }>(
        "select * from marketplace.auth_refresh_token where token_hash = $1 for update",
        [input.currentHash],
      );
      const row = current.rows[0];
      if (!row || row.revoked_at || row.expires_at <= input.now)
        return { status: "invalid" };
      if (row.consumed_at) {
        await client.query(
          "update marketplace.auth_refresh_token set revoked_at = coalesce(revoked_at, $2) where family_id = $1",
          [row.family_id, input.now],
        );
        return { status: "replay" };
      }
      await client.query(
        "update marketplace.auth_refresh_token set consumed_at = $2 where id = $1",
        [row.id, input.now],
      );
      const replacement = await client.query<{ id: string }>(
        `insert into marketplace.auth_refresh_token
           (token_hash,family_id,parent_id,user_id,session_id,client_id,scopes,expires_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [
          input.replacementHash,
          row.family_id,
          row.id,
          row.user_id,
          row.session_id,
          row.client_id,
          row.scopes,
          input.expiresAt,
        ],
      );
      return {
        status: "rotated",
        tokenId: replacement.rows[0]!.id,
        sessionId: row.session_id,
        clientId: row.client_id,
        scopes: row.scopes,
      };
    });
  }

  async isRefreshFamilyActive(familyId: string, now: Date): Promise<boolean> {
    const result = await this.pool.query<{ active: boolean }>(
      `select exists(select 1 from marketplace.auth_refresh_token
         where family_id = $1 and consumed_at is null and revoked_at is null and expires_at > $2) as active`,
      [familyId, now],
    );
    return result.rows[0]?.active ?? false;
  }

  async validateClient(
    clientId: string,
    redirectUri: string,
    scopes: string[],
  ): Promise<boolean> {
    const result = await this.pool.query<{ valid: boolean }>(
      `select exists(
         select 1 from marketplace.auth_client c
         join marketplace.auth_client_redirect r on r.client_id = c.client_id
         where c.client_id = $1 and r.redirect_uri = $2 and r.kind = 'LOGIN'
           and c.active and $3::text[] <@ c.scopes
       ) as valid`,
      [clientId, redirectUri, scopes],
    );
    return result.rows[0]?.valid ?? false;
  }

  async createAuthorizationTransaction(input: {
    handleHash: Hash;
    clientId: string;
    redirectUri: string;
    state?: string;
    nonce?: string;
    codeChallenge: string;
    scopes: string[];
    expiresAt: Date;
  }): Promise<void> {
    await this.pool.query(
      `insert into marketplace.auth_transaction
       (handle_hash,client_id,redirect_uri,state,nonce,code_challenge,scopes,expires_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        input.handleHash,
        input.clientId,
        input.redirectUri,
        input.state ?? null,
        input.nonce ?? null,
        input.codeChallenge,
        input.scopes,
        input.expiresAt,
      ],
    );
  }

  async completeAuthorization(input: {
    handleHash: Hash;
    codeHash: Hash;
    userId: string;
    sessionId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<{
    clientId: string;
    redirectUri: string;
    state: string | null;
  } | null> {
    return transaction(this.pool, async (client) => {
      const tx = await client.query<{
        id: string;
        client_id: string;
        redirect_uri: string;
        state: string | null;
        nonce: string | null;
        code_challenge: string;
        scopes: string[];
      }>(
        `update marketplace.auth_transaction set status='AUTHENTICATED', session_id=$3
         where handle_hash=$1 and status='PENDING' and expires_at>$2
         returning id,client_id,redirect_uri,state,nonce,code_challenge,scopes`,
        [input.handleHash, input.now, input.sessionId],
      );
      const row = tx.rows[0];
      if (!row) return null;
      await client.query(
        `insert into marketplace.auth_authorization_code
         (code_hash,transaction_id,user_id,session_id,client_id,redirect_uri,code_challenge,nonce,scopes,expires_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          input.codeHash,
          row.id,
          input.userId,
          input.sessionId,
          row.client_id,
          row.redirect_uri,
          row.code_challenge,
          row.nonce,
          row.scopes,
          input.expiresAt,
        ],
      );
      return {
        clientId: row.client_id,
        redirectUri: row.redirect_uri,
        state: row.state,
      };
    });
  }

  async consumeAuthorizationCode(input: {
    codeHash: Hash;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    now: Date;
  }): Promise<{
    userId: string;
    sessionId: string;
    scopes: string[];
    nonce: string | null;
  } | null> {
    return transaction(this.pool, async (client) => {
      const result = await client.query<{
        user_id: string;
        session_id: string;
        scopes: string[];
        nonce: string | null;
      }>(
        `update marketplace.auth_authorization_code set consumed_at=$5
         where code_hash=$1 and client_id=$2 and redirect_uri=$3 and code_challenge=$4
           and consumed_at is null and expires_at>$5
         returning user_id,session_id,scopes,nonce`,
        [
          input.codeHash,
          input.clientId,
          input.redirectUri,
          input.codeChallenge,
          input.now,
        ],
      );
      const row = result.rows[0];
      return row
        ? {
            userId: row.user_id,
            sessionId: row.session_id,
            scopes: row.scopes,
            nonce: row.nonce,
          }
        : null;
    });
  }

  async getSessionById(
    sessionId: string,
    now: Date,
  ): Promise<SessionContext | null> {
    const result = await this.pool.query<{ token_hash: Hash }>(
      "select token_hash from marketplace.auth_session where id=$1",
      [sessionId],
    );
    const hash = result.rows[0]?.token_hash;
    return hash ? this.getSession(hash, now) : null;
  }

  async revokeSession(sessionId: string, now: Date): Promise<void> {
    await transaction(this.pool, async (client) => {
      const result = await client.query<{ user_id: string }>(
        "update marketplace.auth_session set revoked_at=coalesce(revoked_at,$2) where id=$1 returning user_id",
        [sessionId, now],
      );
      if (result.rows[0])
        await this.revokeUserAccess(client, result.rows[0].user_id, now);
    });
  }

  async setTotp(
    userId: string,
    encryptedSecret: Buffer,
    recoveryHashes: Buffer[],
  ): Promise<void> {
    await this.pool.query(
      `update marketplace.auth_credential set totp_secret_encrypted=$2, recovery_code_hashes=$3, totp_enabled=true where user_id=$1`,
      [userId, encryptedSecret, recoveryHashes],
    );
  }

  async replaceRecoveryHashes(
    userId: string,
    recoveryHashes: Buffer[],
  ): Promise<void> {
    await this.pool.query(
      "update marketplace.auth_credential set recovery_code_hashes=$2 where user_id=$1",
      [userId, recoveryHashes],
    );
  }

  async listEnabledConnectors(): Promise<
    Array<{
      provider: string;
      clientIdEnv: string;
      clientSecretEnv: string;
      authorizationEndpoint: string;
      tokenEndpoint: string;
      userinfoEndpoint: string;
      scopes: string[];
    }>
  > {
    const result = await this.pool.query<{
      provider: string;
      client_id_env: string;
      client_secret_env: string;
      authorization_endpoint: string;
      token_endpoint: string;
      userinfo_endpoint: string;
      scopes: string[];
    }>(
      "select provider,client_id_env,client_secret_env,authorization_endpoint,token_endpoint,userinfo_endpoint,scopes from marketplace.auth_connector where enabled order by provider",
    );
    return result.rows.map((row) => ({
      provider: row.provider,
      clientIdEnv: row.client_id_env,
      clientSecretEnv: row.client_secret_env,
      authorizationEndpoint: row.authorization_endpoint,
      tokenEndpoint: row.token_endpoint,
      userinfoEndpoint: row.userinfo_endpoint,
      scopes: row.scopes,
    }));
  }

  async findIdentity(
    provider: string,
    subject: string,
  ): Promise<Credential | null> {
    const result = await this.pool.query<{ email: string }>(
      "select u.email from marketplace.auth_identity i join marketplace.app_user u on u.id=i.user_id where i.provider=$1 and i.subject=$2",
      [provider, subject],
    );
    return result.rows[0]
      ? this.findCredentialByEmail(result.rows[0].email)
      : null;
  }

  async registerSocial(input: {
    provider: string;
    subject: string;
    email: string;
    name: string;
    emailVerified: boolean;
  }): Promise<{ id: string }> {
    return transaction(this.pool, async (client) => {
      const email = input.email.trim().toLowerCase();
      const existing = await client.query(
        "select id from marketplace.app_user where lower(btrim(email))=$1",
        [email],
      );
      if (existing.rowCount) throw new Error("SOCIAL_LINK_REQUIRED");
      const user = await client.query<{ id: string }>(
        "insert into marketplace.app_user(email,name) values ($1,$2) returning id",
        [email, input.name.trim()],
      );
      const id = user.rows[0]!.id;
      await client.query(
        "insert into marketplace.auth_credential(user_id,email_verified_at) values ($1,$2)",
        [id, input.emailVerified ? new Date() : null],
      );
      await client.query(
        "insert into marketplace.auth_user_role(user_id,role_key) values ($1,'USER')",
        [id],
      );
      await client.query(
        "insert into marketplace.auth_identity(user_id,provider,subject,email,email_verified) values ($1,$2,$3,$4,$5)",
        [id, input.provider, input.subject, email, input.emailVerified],
      );
      return { id };
    });
  }

  async isLoginRateLimited(
    identifierHash: Hash,
    ipHash: Hash,
    now: Date,
  ): Promise<boolean> {
    const result = await this.pool.query<{ failures: string }>(
      `select count(*)::text as failures from marketplace.auth_login_attempt
       where identifier_hash=$1 and ip_hash=$2 and not succeeded
         and attempted_at > $3::timestamptz - interval '15 minutes'`,
      [identifierHash, ipHash, now],
    );
    return Number(result.rows[0]?.failures ?? 0) >= 5;
  }

  async recordLoginAttempt(
    identifierHash: Hash,
    ipHash: Hash,
    succeeded: boolean,
    now: Date,
  ): Promise<void> {
    await this.pool.query(
      "insert into marketplace.auth_login_attempt(identifier_hash,ip_hash,succeeded,attempted_at) values ($1,$2,$3,$4)",
      [identifierHash, ipHash, succeeded, now],
    );
  }
}
