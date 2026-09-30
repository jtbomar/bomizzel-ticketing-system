/**
 * Sends mail through Resend's HTTPS API, with the same sendMail/verify shape
 * as a nodemailer transporter so EmailService doesn't care which it has.
 *
 * Why not SMTP: Railway blocks outbound SMTP (ports 25/465/587) on its Free,
 * Trial and Hobby plans - connections to smtp.gmail.com just hang. An HTTPS
 * API goes out on port 443 like any other web request.
 */

type Address = string | string[] | undefined;

export interface MailOptions {
  from?: string;
  to?: Address;
  cc?: Address;
  bcc?: Address;
  subject?: string;
  html?: string;
  text?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string | string[];
  headers?: Record<string, string | undefined>;
}

const list = (value: Address): string[] | undefined =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

export class ResendTransport {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 15000
  ) {}

  async sendMail(mail: MailOptions): Promise<{ messageId: string }> {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(mail.headers || {})) {
      if (value !== undefined && value !== null) headers[key] = String(value);
    }
    if (mail.inReplyTo) headers['In-Reply-To'] = mail.inReplyTo;
    if (mail.references) {
      headers['References'] = Array.isArray(mail.references)
        ? mail.references.join(' ')
        : mail.references;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: mail.from,
          to: list(mail.to),
          cc: list(mail.cc),
          bcc: list(mail.bcc),
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          reply_to: mail.replyTo,
          headers: Object.keys(headers).length ? headers : undefined,
        }),
        signal: controller.signal,
      });

      const body: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          `Resend ${response.status}: ${body?.message || body?.name || 'send failed'}`
        );
      }
      return { messageId: body.id };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Checks the key works (lists domains; no mail is sent). */
  async verify(): Promise<boolean> {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) throw new Error(`Resend ${response.status}`);
    return true;
  }
}
