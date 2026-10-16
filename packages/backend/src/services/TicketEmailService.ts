import { db } from '@/config/database';
import { EmailService } from './EmailService';
import { logger } from '@/utils/logger';
import { supportAddress, ticketToken } from '@/utils/supportEmail';
import { BrandingService } from './BrandingService';
import { isStaffOfTenant } from '@/utils/tenant';
import { portalUrl } from '@/utils/portalName';
import {
  Brand,
  brandedLayout,
  button,
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

const layout = (brand: Brand, body: string, ticketRef: string, preheader?: string) =>
  brandedLayout(brand, body, {
    topNote: REPLY_MARKER,
    footerNote: `${brand.name} Support · Ticket ${ticketRef}`,
    preheader,
  });

/** What a ticket email shows about the ticket, and where it opens. */
export interface TicketSummary {
  title: string;
  ref: string;
  // Display label of its status ("In Progress")
  status: string;
  // The ticket on the customer portal (help.bomizzel.com/<company>/tickets/<id>)
  link: string | null;
}

// Status colours on the card, by status name
const STATUS_COLORS: Record<string, string> = {
  open: '#2563eb',
  in_progress: '#d97706',
  waiting: '#7c3aed',
  resolved: '#059669',
  closed: '#4b5563',
};

/** The ticket at a glance: number, subject and status. */
const ticketCard = (brand: Brand, t: TicketSummary, statusName?: string) => {
  const pill = STATUS_COLORS[statusName || ''] || brand.color;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid ${brand.color};border-radius:6px;">` +
    `<tr><td style="padding:14px 16px;">` +
    `<div style="font-size:12px;color:#6b7280;letter-spacing:.02em;">TICKET ${escapeHtml(t.ref)}</div>` +
    `<div style="margin-top:4px;font-size:16px;font-weight:bold;color:#111827;">${escapeHtml(t.title)}</div>` +
    `<div style="margin-top:10px;"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${pill};color:#ffffff;font-size:12px;font-weight:bold;">${escapeHtml(t.status)}</span></div>` +
    `</td></tr></table>`
  );
};

/** "View your ticket", and that a reply (with attachments) goes on the ticket. */
const actions = (brand: Brand, t: TicketSummary) =>
  (t.link ? button(brand, 'View your ticket', t.link) : '<div style="height:16px;"></div>') +
  `<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Or simply reply to this email to update your ticket. Attachments you include are added to it too.</p>`;

const actionsText = (t: TicketSummary) =>
  `${t.link ? `View your ticket: ${t.link}\n` : ''}Or reply to this email to update your ticket (attachments are added too).`;

const cardText = (t: TicketSummary) => `Ticket ${t.ref}: ${t.title}\nStatus: ${t.status}`;

/** What changed, for an update email. */
export type TicketChange =
  | { kind: 'status'; from: string; to: string }
  | { kind: 'assigned'; agentName: string };

/** The message for a change, in the customer's terms. */
const changeMessage = (brand: Brand, change: TicketChange, t: TicketSummary): string => {
  if (change.kind === 'assigned') {
    return `${change.agentName} from ${brand.name} is now handling your ticket and will be in touch.`;
  }
  switch (change.to) {
    case 'open':
      return ['resolved', 'closed'].includes(change.from)
        ? "Your ticket has been reopened. We'll pick it back up shortly."
        : 'Your ticket is open and in our queue.';
    case 'in_progress':
      return "We're working on your ticket now.";
    case 'waiting':
      return 'We need a little more information from you to keep going. Please reply to this email with the details.';
    case 'resolved':
      return "We've marked your ticket as resolved. If anything still isn't right, just reply to this email and we'll reopen it.";
    case 'closed':
      return 'Your ticket is now closed. Thank you for contacting us. If you need more help, reply to this email.';
    default:
      return `Your ticket's status is now ${t.status}.`;
  }
};

/** What the emails say, kept apart from sending for the previews. */
export const ticketEmails = {
  receipt(
    brand: Brand,
    t: TicketSummary,
    firstName: string | undefined,
    signature: string | null,
    statusName = 'open'
  ) {
    const hi = firstName ? `Hi ${firstName},` : 'Hi,';
    const message = `${hi}\n\nThanks for getting in touch. We've received your request and someone from ${brand.name} will get back to you soon.`;
    const body =
      paragraphs(message) +
      ticketCard(brand, t, statusName) +
      actions(brand, t) +
      signatureHtml(signature);
    return {
      html: layout(brand, body, t.ref, `We've received your request ${t.ref}`),
      text: `${REPLY_MARKER}\n\n${message}\n\n${cardText(t)}\n\n${actionsText(t)}${signatureText(signature)}\n`,
    };
  },

  reply(
    brand: Brand,
    t: TicketSummary,
    note: { content: string; content_html?: string | null },
    agentName: string,
    signature: string | null,
    statusName?: string
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
        : paragraphs(note.content)) +
      signatureHtml(sign) +
      ticketCard(brand, t, statusName) +
      actions(brand, t);
    return {
      html: layout(
        brand,
        body,
        t.ref,
        `${agentName || brand.name} replied to your ticket ${t.ref}`
      ),
      text: `${REPLY_MARKER}\n\n${note.content}${signatureText(sign)}\n\n${cardText(t)}\n\n${actionsText(t)}\n`,
    };
  },

  update(
    brand: Brand,
    t: TicketSummary,
    change: TicketChange,
    firstName: string | undefined,
    signature: string | null,
    statusName?: string
  ) {
    const hi = firstName ? `Hi ${firstName},` : 'Hi,';
    const message = `${hi}\n\n${changeMessage(brand, change, t)}`;
    const body =
      paragraphs(message) +
      ticketCard(brand, t, statusName) +
      actions(brand, t) +
      signatureHtml(signature);
    const preheader =
      change.kind === 'assigned'
        ? `${change.agentName} is handling your ticket ${t.ref}`
        : `Your ticket ${t.ref} is now ${t.status}`;
    return {
      html: layout(brand, body, t.ref, preheader),
      text: `${REPLY_MARKER}\n\n${message}\n\n${cardText(t)}\n\n${actionsText(t)}${signatureText(signature)}\n`,
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
  // Email not set up: nothing to send, so don't look anything up either
  if (!EmailService.isInitialized()) return null;
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
  // (Staff of this subscriber; a customer here can be staff of another company)
  if (
    !subscriber?.support_email_slug ||
    !customer ||
    (await isStaffOfTenant(ticket.submitter_id, subscriber.id))
  )
    return null;
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

/** The ticket as its emails show it: number, subject, status label, portal link. */
const summaryFor = async (context: TicketContext): Promise<TicketSummary> => {
  const { ticket, subscriber } = context;
  const status = await db('ticket_statuses')
    .where({ team_id: ticket.team_id, name: ticket.status })
    .first('label');
  const label =
    status?.label ||
    String(ticket.status || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  return {
    title: ticket.title,
    ref: refFor(ticket),
    status: label,
    link: subscriber.support_email_slug
      ? `${portalUrl(subscriber.support_email_slug)}/tickets/${ticket.id}`
      : null,
  };
};

export class TicketEmailService {
  /** "We've received your request": a new ticket, by email, on the portal or raised by staff. */
  static async sendReceipt(ticketId: string): Promise<boolean> {
    const context = await loadContext(ticketId);
    if (!context) return false;
    const { ticket, customer, brand } = context;
    // Automatic: the company's signature
    const { html, text } = ticketEmails.receipt(
      brand,
      await summaryFor(context),
      customer.first_name,
      brand.signatureHtml,
      ticket.status
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
    if (!author || !(await isStaffOfTenant(note.author_id, context.subscriber.id))) return false;

    const { ticket, brand } = context;
    const agentName = [author.first_name, author.last_name].filter(Boolean).join(' ');
    const { html, text } = ticketEmails.reply(
      brand,
      await summaryFor(context),
      note,
      agentName,
      await BrandingService.signatureFor(brand, note.author_id),
      ticket.status
    );
    return send(context, `Re: ${subjectFor(ticket)}`, html, text, note.id);
  }

  /**
   * The ticket's status changed, or an agent took it: tell its customer. Not
   * when the customer made the change themselves (closing it on the portal).
   */
  static async sendUpdate(
    ticketId: string,
    change: TicketChange,
    actorId?: string | null
  ): Promise<boolean> {
    if (change.kind === 'status' && change.from === change.to) return false;
    const context = await loadContext(ticketId);
    if (!context) return false;
    const { ticket, customer, brand } = context;
    if (actorId && actorId === ticket.submitter_id) return false;
    const { html, text } = ticketEmails.update(
      brand,
      await summaryFor(context),
      change,
      customer.first_name,
      brand.signatureHtml,
      ticket.status
    );
    return send(context, `Re: ${subjectFor(ticket)}`, html, text, null);
  }
}
