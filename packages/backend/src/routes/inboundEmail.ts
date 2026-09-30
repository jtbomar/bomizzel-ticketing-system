import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { InboundEmailService, ReceivedEmail } from '@/services/InboundEmailService';
import { logger } from '@/utils/logger';

/**
 * POST /api/inbound/email/resend
 *
 * Resend calls this for every email received at the inbound domain
 * (email.received). The webhook only carries metadata, so the message itself
 * is fetched from Resend's API, then handed to InboundEmailService.
 *
 * Requests are signed (Svix): the svix-signature header holds base64
 * HMAC-SHA256 values of "<svix-id>.<svix-timestamp>.<raw body>" made with the
 * webhook's signing secret (RESEND_WEBHOOK_SECRET, "whsec_<base64>").
 * Anything unsigned, badly signed, or more than five minutes old is refused.
 */

const TOLERANCE_SECONDS = 5 * 60;

export const verifySvixSignature = (
  secret: string,
  headers: { id?: string; timestamp?: string; signature?: string },
  rawBody: Buffer | string,
  now: number = Math.floor(Date.now() / 1000)
): boolean => {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody}`)
    .digest();

  // The header can list several signatures ("v1,<sig> v1,<sig>") during a
  // secret rotation; any one matching is enough.
  return signature.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
};

/** The full received message from Resend's API. */
const fetchReceivedEmail = async (emailId: string): Promise<any> => {
  const key = process.env['RESEND_RECEIVING_API_KEY'] || process.env['RESEND_API_KEY'];
  if (!key) throw new Error('RESEND_RECEIVING_API_KEY is not set');
  const response = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
    }
  );
  if (!response.ok) {
    throw new Error(`Resend ${response.status} fetching received email ${emailId}`);
  }
  return response.json();
};

/** One attachment's bytes, from its short-lived signed download URL. */
const downloadAttachment = async (emailId: string, attachmentId: string): Promise<Buffer> => {
  const key = process.env['RESEND_RECEIVING_API_KEY'] || process.env['RESEND_API_KEY'];
  const meta = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { headers: { Authorization: `Bearer ${key}` } }
  );
  if (!meta.ok) throw new Error(`Resend ${meta.status} fetching attachment ${attachmentId}`);
  const { download_url: url } = (await meta.json()) as { download_url?: string };
  if (!url) throw new Error(`No download URL for attachment ${attachmentId}`);
  const file = await fetch(url);
  if (!file.ok) throw new Error(`Download ${file.status} for attachment ${attachmentId}`);
  return Buffer.from(await file.arrayBuffer());
};

const router = Router();

router.post('/email/resend', async (req: Request, res: Response): Promise<void> => {
  const secret = process.env['RESEND_WEBHOOK_SECRET'] || '';
  const rawBody: Buffer | undefined = (req as any).rawBody;

  const valid =
    !!rawBody &&
    verifySvixSignature(
      secret,
      {
        id: req.header('svix-id'),
        timestamp: req.header('svix-timestamp'),
        signature: req.header('svix-signature'),
      },
      rawBody
    );
  if (!valid) {
    logger.warn('Inbound email webhook refused: bad or missing signature');
    res.status(401).json({ error: 'invalid signature' });
    return;
  }

  const event = req.body;
  if (event?.type !== 'email.received' || !event?.data?.email_id) {
    res.json({ ignored: true });
    return;
  }

  try {
    const full = await fetchReceivedEmail(event.data.email_id);
    const email: ReceivedEmail = {
      providerId: event.data.email_id,
      from: full.headers?.from || full.from || event.data.from,
      to: full.to || event.data.to || [],
      cc: full.cc || event.data.cc || [],
      receivedFor: full.received_for || event.data.received_for || [],
      subject: full.subject ?? event.data.subject ?? '',
      text: full.text ?? null,
      html: full.html ?? null,
      messageId: full.message_id || event.data.message_id || null,
      headers: full.headers || {},
      authentication: full.authentication || {},
      attachments: (full.attachments || []).map((a: any) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.content_type,
        size: Number(a.size) || 0,
        inline: a.content_disposition === 'inline',
      })),
      downloadAttachment: (attachment) => downloadAttachment(event.data.email_id, attachment.id),
    };
    const result = await InboundEmailService.handle(email);
    logger.info('Inbound email handled', { emailId: event.data.email_id, ...result });
    res.json(result);
  } catch (error) {
    // Anything unexpected: answer 500 so Resend retries. Repeats are ignored
    // by provider id, so a retry can't create a second ticket.
    logger.error('Inbound email failed', {
      emailId: event.data.email_id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'processing failed' });
  }
});

export default router;
