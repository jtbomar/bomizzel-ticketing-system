import { db } from '@/config/database';
import { EmailService } from './EmailService';
import { logger } from '@/utils/logger';
import { supportAddress, ticketToken } from '@/utils/supportEmail';
import { BrandingService } from './BrandingService';
import {
  Brand,
  brandedLayout,
  escapeHtml,
  paragraphs,
  signatureHtml,
  signatureText,
} from '@/utils/brandedEmail';

/**
 * Email a ticket's customer: the receipt when their email opens a ticket, and
 * each public (non-internal) note an agent adds. Replies go to the ticket's
 * own support address, so they land back on the same ticket.
 *
 * Mail is sent as "<Subscriber> Support" from the ticket's support address,
 * in the subscriber's brand (logo, colour, signature - the Rebranding page).
 */

const REPLY_MARKER = '— Reply above this line to add to your ticket —';

const layout = (brand: Brand, body: string, ticketRef: string) =>
  brandedLayout(brand, body, {
    topNote: REPLY_MARKER,
    footerNote: `${brand.name} Support · Ticket ${ticketRef}`,
  });

/** What the emails say, kept apart from sending for the previews. */
export const ticketEmails = {
  receipt(
    brand: Brand,
    ticket: { title: string },
    ref: string,
    firstName: string | undefined,
    signature: string | null
  ) {
    const hi = firstName ? `Hi ${firstName},` : 'Hi,';
    const message = `${hi}\n\nThanks for getting in touch. We've received your request and someone from ${brand.name} will get back to you soon.\n\nYou can reply to this email to add anything else.`;
    const body =
      paragraphs(message) +
      `<p style="margin:16px 0 0;padding:12px;background:#f9fafb;border-left:3px solid ${brand.color};border-radius:4px;font-size:14px;"><strong>${escapeHtml(ticket.title)}</strong><br><span style="color:#6b7280;">Ticket ${escapeHtml(ref)}</span></p>` +
      signatureHtml(signature);
    return {
      html: layout(brand, body, ref),
      text: `${REPLY_MARKER}\n\n${message}\n\n${ticket.title}\nTicket ${ref}${signatureText(signature)}\n`,
    };
  },

  reply(
    brand: Brand,
    ticket: { title: string },
    ref: string,
    note: { content: string; content_html?: string | null },
    agentName: string,
    signature: string | null
  ) {
    // No signature set anywhere: the agent's name and the company, as before
    const sign =
      signature ||
      (agentName ? `<p>${escapeHtml(agentName)}<br>${escapeHtml(brand.name)}</p>` : null);
    // Formatted notes go out formatted. content_html was cleaned down to
    // formatting-only tags when it was saved.
    const body =
      (note.content_html
        ? `<div style="line-height:1.55;">${note.content_html}</div>`
        : paragraphs(note.content)) + signatureHtml(sign);
    return {
      html: layout(brand, body, ref),
      text: `${REPLY_MARKER}\n\n${note.content}${signatureText(sign)}\n\nTicket ${ref}: ${ticket.title}\n`,
    };
  },
};

interface TicketContext {
  ticket: any;
  subscriber: { id: string; name: string; support_email_slug: string };
  customer: { email: string; first_name?: string };
  brand: Brand;
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
  const brand = await BrandingService.forSubscriber(subscriber.id);
  return { ticket, subscriber, customer, brand };
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
    fromName: `${context.brand.name} Support`,
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

/** "#1001" - the ticket's permanent number (the token for any without one). */
const refFor = (ticket: any) =>
  ticket.ticket_number ? `#${ticket.ticket_number}` : `#${ticketToken(ticket.id)}`;

const subjectFor = (ticket: any) => `[${refFor(ticket)}] ${ticket.title}`;

export class TicketEmailService {
  /** "We've received your request" for a ticket opened by email. */
  static async sendReceipt(ticketId: string): Promise<boolean> {
    const context = await loadContext(ticketId);
    if (!context) return false;
    const { ticket, customer, brand } = context;
    const ref = refFor(ticket);
    // Automatic: the company's signature
    const { html, text } = ticketEmails.receipt(
      brand,
      ticket,
      ref,
      customer.first_name,
      brand.signatureHtml
    );
    return send(context, `Re: ${subjectFor(ticket)}`, html, text, null);
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

    const { ticket, brand } = context;
    const ref = refFor(ticket);
    const agentName = [author.first_name, author.last_name].filter(Boolean).join(' ');
    const { html, text } = ticketEmails.reply(
      brand,
      ticket,
      ref,
      note,
      agentName,
      await BrandingService.signatureFor(brand, note.author_id)
    );
    return send(context, `Re: ${subjectFor(ticket)}`, html, text, note.id);
  }
}
