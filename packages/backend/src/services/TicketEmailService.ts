import { db } from '@/config/database';
import { EmailService } from './EmailService';
import { logger } from '@/utils/logger';
import { supportAddress, ticketToken } from '@/utils/supportEmail';

/**
 * Email a ticket's customer: the receipt when their email opens a ticket, and
 * each public (non-internal) note an agent adds. Replies go to the ticket's
 * own support address, so they land back on the same ticket.
 *
 * Mail is sent as "<Subscriber> Support" from the platform's sending address
 * (the only one the mail provider will send as); Reply-To carries the
 * subscriber's support address.
 */

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

const paragraphs = (text: string): string =>
  escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.5;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');

const REPLY_MARKER = '— Reply above this line to add to your ticket —';

const layout = (subscriberName: string, body: string, ticketRef: string) => `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
<p style="max-width:600px;margin:0 auto 12px;font-size:12px;color:#9ca3af;">${escapeHtml(REPLY_MARKER)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;">
<tr><td style="padding:28px;">${body}
<p style="margin:24px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(subscriberName)} Support · Ticket ${escapeHtml(ticketRef)}</p>
</td></tr></table></body></html>`;

interface TicketContext {
  ticket: any;
  subscriber: { id: string; name: string; support_email_slug: string };
  customer: { email: string; first_name?: string };
}

const loadContext = async (ticketId: string): Promise<TicketContext | null> => {
  const ticket = await db('tickets').where('id', ticketId).first();
  if (!ticket?.org_id) return null;
  const [subscriber, customer] = await Promise.all([
    db('companies').where('id', ticket.org_id).first('id', 'name', 'support_email_slug'),
    db('users')
      .where('id', ticket.submitter_id)
      .where('is_active', true)
      .first('email', 'first_name', 'role'),
  ]);
  // No address to reply to, or no customer to write to (staff-raised tickets
  // whose submitter is staff): nothing to send.
  if (!subscriber?.support_email_slug || !customer || customer.role !== 'customer') return null;
  return { ticket, subscriber, customer };
};

const send = async (
  context: TicketContext,
  subject: string,
  html: string,
  text: string,
  noteId: string | null
): Promise<boolean> => {
  if (!EmailService.isInitialized()) {
    logger.warn('Ticket email not sent (email not configured)', { ticketId: context.ticket.id });
    return false;
  }
  const replyTo = supportAddress(context.subscriber.support_email_slug, context.ticket.id);
  const message = {
    to: [context.customer.email],
    subject,
    html,
    text,
    fromName: `${context.subscriber.name} Support`,
    replyTo,
    // Keep the ticket's messages together in the customer's mail app.
    headers: { 'X-Bomizzel-Ticket': ticketToken(context.ticket.id) },
  };

  // Send *from* the ticket's own support address, so a reply reaches the
  // ticket even in mail apps that ignore Reply-To (some reply to From - the
  // first live test's reply went to noreply@). If the provider won't send as
  // that domain yet, fall back to the platform address with Reply-To.
  let providerId: string;
  try {
    providerId = await EmailService.send({ ...message, fromAddress: replyTo });
  } catch (error) {
    logger.warn('Could not send from the support address; using the platform address', {
      ticketId: context.ticket.id,
      error: error instanceof Error ? error.message : String(error),
    });
    providerId = await EmailService.send(message);
  }
  await db('ticket_email_messages').insert({
    ticket_id: context.ticket.id,
    org_id: context.subscriber.id,
    direction: 'outbound',
    provider_id: providerId || null,
    from_address: replyTo,
    to_addresses: JSON.stringify([context.customer.email]),
    subject,
    note_id: noteId,
  });
  return true;
};

const subjectFor = (ticket: any) => `[#${ticketToken(ticket.id)}] ${ticket.title}`;

export class TicketEmailService {
  /** "We've received your request" for a ticket opened by email. */
  static async sendReceipt(ticketId: string): Promise<boolean> {
    const context = await loadContext(ticketId);
    if (!context) return false;
    const { ticket, subscriber, customer } = context;
    const hi = customer.first_name ? `Hi ${customer.first_name},` : 'Hi,';
    const ref = `#${ticketToken(ticket.id)}`;
    const body =
      paragraphs(
        `${hi}\n\nThanks for getting in touch. We've received your request and someone from ${subscriber.name} will get back to you soon.\n\nYou can reply to this email to add anything else.`
      ) +
      `<p style="margin:16px 0 0;padding:12px;background:#f9fafb;border-radius:6px;font-size:14px;"><strong>${escapeHtml(ticket.title)}</strong><br><span style="color:#6b7280;">Ticket ${escapeHtml(ref)}</span></p>`;
    const text = `${REPLY_MARKER}\n\n${hi}\n\nThanks for getting in touch. We've received your request and someone from ${subscriber.name} will get back to you soon.\n\nYou can reply to this email to add anything else.\n\n${ticket.title}\nTicket ${ref}\n`;
    return send(
      context,
      `Re: ${subjectFor(ticket)}`,
      layout(subscriber.name, body, ref),
      text,
      null
    );
  }

  /** Email a public note to the ticket's customer. Internal notes never go out. */
  static async sendNote(ticketId: string, noteId: string): Promise<boolean> {
    const note = await db('ticket_notes').where('id', noteId).first();
    if (!note || note.is_internal || note.is_email_generated) return false;
    const context = await loadContext(ticketId);
    if (!context) return false;
    // Only notes written by staff go to the customer; a customer's own portal
    // note doesn't need emailing back to them.
    const author = await db('users')
      .where('id', note.author_id)
      .first('role', 'first_name', 'last_name');
    if (!author || author.role === 'customer') return false;

    const { ticket, subscriber } = context;
    const ref = `#${ticketToken(ticket.id)}`;
    const signature = [author.first_name, author.last_name].filter(Boolean).join(' ');
    const body =
      paragraphs(note.content) +
      (signature
        ? `<p style="margin:16px 0 0;color:#374151;">${escapeHtml(signature)}<br>${escapeHtml(subscriber.name)}</p>`
        : '');
    const text = `${REPLY_MARKER}\n\n${note.content}\n\n${signature ? `${signature}\n${subscriber.name}\n` : ''}\nTicket ${ref}: ${ticket.title}\n`;
    return send(
      context,
      `Re: ${subjectFor(ticket)}`,
      layout(subscriber.name, body, ref),
      text,
      note.id
    );
  }
}
