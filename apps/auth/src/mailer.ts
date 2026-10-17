import nodemailer from "nodemailer";
export type MailMessage = { to: string; subject: string; text: string };
export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}
export class SmtpMailTransport implements MailTransport {
  private readonly transport;
  constructor(url: string) {
    this.transport = nodemailer.createTransport(url);
  }
  async send(message: MailMessage) {
    await this.transport.sendMail({
      ...message,
      from: "PARTSAGRICOLA <acesso@partsagricola.com.br>",
    });
  }
}
export class MemoryMailTransport implements MailTransport {
  readonly messages: MailMessage[] = [];
  async send(message: MailMessage) {
    this.messages.push(message);
  }
}
