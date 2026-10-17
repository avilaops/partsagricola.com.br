import { digestCpf, digestToken, randomOpaqueToken } from "./crypto.js";
import { hashPassword } from "./passwords.js";
import type { AuthRepository } from "./repository.js";
import type { MailTransport } from "./mailer.js";
export class AccountService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly mailer: MailTransport,
    private readonly lookupKey: Buffer,
    private readonly issuer: URL,
  ) {}
  async register(input: {
    email: string;
    name: string;
    password: string;
    cpf?: string;
  }) {
    const user = await this.repository.registerLocal({
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      ...(input.cpf ? { cpfDigest: digestCpf(input.cpf, this.lookupKey) } : {}),
    });
    const token = randomOpaqueToken();
    await this.repository.createOneTimeToken({
      userId: user.id,
      kind: "EMAIL_VERIFY",
      tokenHash: digestToken(token),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await this.mailer.send({
      to: input.email.trim().toLowerCase(),
      subject: "Verifique seu acesso PARTSAGRICOLA",
      text: `Confirme seu e-mail: ${new URL(`/verify-email?token=${encodeURIComponent(token)}`, this.issuer)}`,
    });
    return { id: user.id };
  }
  async requestPasswordReset(email: string) {
    const credential = await this.repository.findCredentialByEmail(email);
    if (credential) {
      const token = randomOpaqueToken();
      await this.repository.createOneTimeToken({
        userId: credential.userId,
        kind: "PASSWORD_RESET",
        tokenHash: digestToken(token),
        expiresAt: new Date(Date.now() + 1_800_000),
      });
      await this.mailer.send({
        to: credential.email,
        subject: "Redefina sua senha PARTSAGRICOLA",
        text: `Redefina: ${new URL(`/reset-password?token=${encodeURIComponent(token)}`, this.issuer)}`,
      });
    }
    return { accepted: true as const };
  }
  verifyEmail(token: string) {
    return this.repository.verifyEmail(digestToken(token), new Date());
  }
  async resetPassword(token: string, password: string) {
    return this.repository.resetPassword(
      digestToken(token),
      await hashPassword(password),
      new Date(),
    );
  }
}
