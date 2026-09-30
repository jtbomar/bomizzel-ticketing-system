import crypto from 'crypto';
import { db } from '@/config/database';
import { Ticket } from '@/models/Ticket';
import { User } from '@/models/User';
import { TicketService } from './TicketService';
import { TicketEmailService } from './TicketEmailService';
import { FileService } from './FileService';
import { logger } from '@/utils/logger';
import { inboundDomain, parseMailbox, parseSupportAddress } from '@/utils/supportEmail';

/**
 * Turns email sent to a subscriber's support address into tickets.
 *
 *   acme@support.bomizzel.com                 -> a new ticket for Acme's subscriber
 *   acme+<ticket token>@support.bomizzel.com  -> a reply on that ticket
 *
 * The sender becomes (or is matched to) a contact of that subscriber. A reply
 * only lands on the ticket if the sender is allowed on it - its customer, a
 * co-worker at the same account, or the subscriber's staff; otherwise it
 * becomes a new ticket, so a guessed or leaked reply address can't be used to
 * post into someone else's ticket.
 */

export interface ReceivedEmail {
  providerId: string; // the provider's id for this email; used to ignore repeats
  from: string;
  to: string[];
  cc: string[];
  receivedFor: string[]; // envelope recipients (set when mail was forwarded)
  subject: string;
  text: string | null;
  html: string | null;
  messageId?: string | null;
  headers: Record<string, string>;
  authentication?: { spf?: string; dkim?: string; dmarc?: string };
  attachments?: InboundAttachment[];
  // Fetches one attachment's bytes from the mail provider.
  downloadAttachment?: (attachment: InboundAttachment) => Promise<Buffer>;
}

export interface InboundAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  inline: boolean;
}

// At most this many files from one email.
const MAX_ATTACHMENTS = 10;
// Inline images smaller than this are signature logos and social icons, not
// screenshots.
const MIN_INLINE_IMAGE_BYTES = 5 * 1024;

export type InboundResult =
  | { outcome: 'ticket_created'; ticketId: string }
  | { outcome: 'note_added'; ticketId: string }
  | { outcome: 'ignored'; reason: string };

// Mail from these providers comes from people, not organisations, so their
// domain says nothing about which account they belong to.
const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.net',
  'zoho.com',
  'yandex.com',
  'mail.com',
  'comcast.net',
  'att.net',
  'verizon.net',
  'sbcglobal.net',
  'cox.net',
]);

const STAFF_ROLES = ['admin', 'employee', 'team_lead'];

// A sender who opens more than this many tickets in an hour is ignored.
const MAX_NEW_TICKETS_PER_SENDER_PER_HOUR = 20;

const MAX_BODY = 50_000;

/** Plain text of an email, from text or (failing that) HTML. */
export const bodyText = (email: Pick<ReceivedEmail, 'text' | 'html'>): string => {
  if (email.text && email.text.trim()) return email.text;
  let html = email.html || '';
  const dataUri = html.match(/^data:text\/html(?:;charset=[^;,]+)?;base64,(.*)$/s);
  if (dataUri) html = Buffer.from(dataUri[1], 'base64').toString('utf8');
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * The new part of a reply: everything above the quoted earlier message
 * ("On ... wrote:", "-----Original Message-----", Outlook's From:/Sent:
 * block, or lines starting with ">").
 */
export const stripQuotedReply = (text: string): string => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/reply above this line/i.test(line)) break;
    if (/^\s*>/.test(line)) break;
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    // "On <date>, <name> wrote:" - on one line, or wrapped onto the next
    if (/^\s*On\s.{3,200}wrote:\s*$/i.test(line)) break;
    if (/^\s*On\s/i.test(line) && /wrote:\s*$/i.test(lines[i + 1] || '')) break;
    if (
      /^\s*From:\s.+/i.test(line) &&
      /^\s*(Sent|Date):\s/im.test(lines.slice(i + 1, i + 4).join('\n'))
    )
      break;
    kept.push(line);
  }
  const result = kept.join('\n').trim();
  return result || text.trim();
};

const header = (headers: Record<string, string>, name: string): string =>
  (Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1] || '').toLowerCase();

/** Auto-replies, bounces and bulk mail: never make tickets from these. */
const isAutomated = (email: ReceivedEmail, sender: string): boolean => {
  const auto = header(email.headers, 'auto-submitted');
  if (auto && auto !== 'no') return true;
  if (header(email.headers, 'x-autoreply') || header(email.headers, 'x-autorespond')) return true;
  if (['bulk', 'junk', 'list', 'auto_reply'].includes(header(email.headers, 'precedence')))
    return true;
  if (header(email.headers, 'x-auto-response-suppress').includes('all')) return true;
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/.test(sender)) return true;
  return false;
};

const displayName = (name: string, email: string) => {
  const cleaned = name.replace(/["']/g, '').trim();
  if (cleaned) {
    const parts = cleaned.split(/\s+/);
    return {
      firstName: parts[0].slice(0, 50),
      lastName: (parts.slice(1).join(' ') || '-').slice(0, 50),
    };
  }
  return { firstName: email.split('@')[0].slice(0, 50), lastName: '-' };
};

export class InboundEmailService {
  static async handle(email: ReceivedEmail): Promise<InboundResult> {
    // Delivered twice (webhook retries): the first one already did the work.
    if (email.providerId) {
      const seen = await db('ticket_email_messages')
        .where('provider_id', email.providerId)
        .first('id');
      if (seen) return { outcome: 'ignored', reason: 'duplicate' };
    }

    const sender = parseMailbox(email.from);
    if (!sender) return { outcome: 'ignored', reason: 'no sender' };

    // Never loop on mail we sent ourselves, or on auto-replies and bounces.
    if (sender.email.endsWith(`@${inboundDomain()}`))
      return { outcome: 'ignored', reason: 'own address' };
    if (isAutomated(email, sender.email)) return { outcome: 'ignored', reason: 'automated' };

    // A sender that fails DMARC is pretending to be someone else.
    if ((email.authentication?.dmarc || '').toLowerCase() === 'fail') {
      return { outcome: 'ignored', reason: 'dmarc fail' };
    }

    // Which subscriber: the first support address among the recipients.
    const target = [...email.receivedFor, ...email.to, ...email.cc]
      .map(parseSupportAddress)
      .find(Boolean);
    if (!target) return { outcome: 'ignored', reason: 'not a support address' };

    const subscriber = await db('companies')
      .where('support_email_slug', target.slug)
      .whereNull('subscriber_id')
      .where((q) => q.where('is_active', true).orWhereNull('is_active'))
      .first('id', 'name', 'support_email_slug');
    if (!subscriber) return { outcome: 'ignored', reason: 'unknown support address' };
    const tenantId: string = subscriber.id;

    const text = bodyText(email).slice(0, MAX_BODY);
    const subject = (email.subject || '').trim().slice(0, 255) || '(no subject)';

    // A reply on an existing ticket?
    const ticket = await this.findReplyTicket(tenantId, target.token, subject);
    if (ticket) {
      const author = await this.allowedOnTicket(sender.email, ticket, tenantId);
      if (author) {
        const content = stripQuotedReply(text) || '(empty reply)';
        const [note] = await db('ticket_notes')
          .insert({
            ticket_id: ticket.id,
            author_id: author.id,
            content,
            is_internal: false,
            is_email_generated: true,
            email_metadata: JSON.stringify({
              from: sender.email,
              subject,
              messageId: email.messageId,
            }),
            org_id: tenantId,
          })
          .returning('*');
        await Ticket.addHistory(
          ticket.id,
          author.id,
          'note_added',
          undefined,
          undefined,
          undefined,
          {
            source: 'email',
          }
        );
        // A customer writing back reopens a ticket that was waiting on them.
        if (!STAFF_ROLES.includes(author.role) && ['resolved', 'closed'].includes(ticket.status)) {
          await db('tickets')
            .where('id', ticket.id)
            .update({ status: 'open', updated_at: db.fn.now() });
          await Ticket.addHistory(
            ticket.id,
            author.id,
            'reopened',
            'status',
            ticket.status,
            'open'
          );
        }
        await this.log(email, ticket.id, tenantId, sender.email, subject, note.id);
        await this.saveAttachments(email, ticket.id, author.id, note.id);
        logger.info('Email added to ticket', { ticketId: ticket.id, from: sender.email });
        return { outcome: 'note_added', ticketId: ticket.id };
      }
      // Not allowed on that ticket: falls through to a new ticket of their own.
    }

    // Too many new tickets from one sender: someone is flooding the address.
    const recent = await db('ticket_email_messages')
      .where({ org_id: tenantId, direction: 'inbound', from_address: sender.email })
      .where('created_at', '>', db.raw("now() - interval '1 hour'"))
      .count('* as n')
      .first();
    if (Number(recent?.n || 0) >= MAX_NEW_TICKETS_PER_SENDER_PER_HOUR) {
      return { outcome: 'ignored', reason: 'rate limited' };
    }

    const contact = await this.findOrCreateContact(tenantId, sender);
    const created = await this.createTicket(tenantId, contact, subject, text);
    if (!created) return { outcome: 'ignored', reason: 'subscriber has no team' };

    await this.log(email, created.id, tenantId, sender.email, subject, null);
    await this.saveAttachments(email, created.id, contact.userId);
    logger.info('Email created ticket', { ticketId: created.id, from: sender.email });

    // Tell them we have it, and give them the address that replies on it.
    await TicketEmailService.sendReceipt(created.id).catch((error) =>
      logger.error('Could not send ticket receipt', { ticketId: created.id, error: String(error) })
    );

    return { outcome: 'ticket_created', ticketId: created.id };
  }

  /**
   * The ticket a reply is for: from the +token in the address, else "[#1001]"
   * (the ticket number) or an older "[#<token>]" in the subject.
   */
  private static async findReplyTicket(
    tenantId: string,
    token: string | undefined,
    subject: string
  ) {
    if (!token) {
      const number = subject.match(/\[#(\d{1,9})\]/)?.[1];
      if (number) {
        const byNumber = await db('tickets')
          .where({ org_id: tenantId, ticket_number: Number(number) })
          .first();
        if (byNumber) return byNumber;
      }
    }
    const fromSubject = subject.match(/\[#([0-9a-f]{12})\]/i)?.[1]?.toLowerCase();
    const wanted = token || fromSubject;
    if (!wanted) return null;
    const matches = await db('tickets')
      .where('org_id', tenantId)
      .whereRaw("replace(id::text, '-', '') like ?", [`${wanted}%`])
      .limit(2);
    return matches.length === 1 ? matches[0] : null;
  }

  /**
   * The user a reply can be posted as: the subscriber's staff, or a contact of
   * the ticket's own account. Anyone else isn't allowed on the ticket.
   */
  private static async allowedOnTicket(email: string, ticket: any, tenantId: string) {
    const user = await db('users')
      .whereRaw('lower(email) = ?', [email])
      .where('is_active', true)
      .first();
    if (!user) return null;
    const memberships = await db('user_company_associations')
      .where('user_id', user.id)
      .pluck('company_id');
    if (STAFF_ROLES.includes(user.role)) return memberships.includes(tenantId) ? user : null;
    return memberships.includes(ticket.company_id) ? user : null;
  }

  /**
   * The contact for a sender, within this subscriber. Existing contacts are
   * reused. New ones go in the account with their email domain, or a new
   * account for that domain; people on personal email (gmail.com and the
   * like) get an account of their own, so strangers who share a mail
   * provider never see each other's tickets.
   */
  private static async findOrCreateContact(
    tenantId: string,
    sender: { name: string; email: string }
  ): Promise<{ userId: string; companyId: string }> {
    const tenantAccounts = db('companies').select('id').where('subscriber_id', tenantId);

    let user = await db('users').whereRaw('lower(email) = ?', [sender.email]).first();
    if (user) {
      const account = await db('user_company_associations')
        .where('user_id', user.id)
        .whereIn('company_id', tenantAccounts)
        .first('company_id');
      if (account) return { userId: user.id, companyId: account.company_id };
    } else {
      const { firstName, lastName } = displayName(sender.name, sender.email);
      user = await User.createUser({
        email: sender.email,
        // They've never set a password: an agent's invitation, or "Forgot
        // your password?", lets them into the portal later.
        password: crypto.randomBytes(24).toString('base64url'),
        firstName,
        lastName,
        role: 'customer',
        emailVerified: false,
      });
      await db('users').where('id', user.id).update({ current_org_id: tenantId });
    }

    const domain = sender.email.split('@')[1];
    let companyId: string | undefined;
    if (!PERSONAL_DOMAINS.has(domain)) {
      const existing = await db('companies')
        .where('subscriber_id', tenantId)
        .whereRaw('lower(domain) = ?', [domain])
        .first('id');
      companyId = existing?.id;
      if (!companyId) {
        const [created] = await db('companies')
          .insert({
            name: domain,
            domain,
            subscriber_id: tenantId,
            description: 'Created from email',
          })
          .returning('id');
        companyId = created.id ?? created;
      }
    } else {
      const label = [user.first_name, user.last_name]
        .filter((p: string) => p && p !== '-')
        .join(' ');
      const [created] = await db('companies')
        .insert({
          name: `${label || sender.email} (${sender.email})`.slice(0, 255),
          subscriber_id: tenantId,
          description: 'Created from email',
        })
        .returning('id');
      companyId = created.id ?? created;
    }

    await db('user_company_associations').insert({
      user_id: user.id,
      company_id: companyId,
      role: 'member',
    });
    return { userId: user.id, companyId: companyId as string };
  }

  private static async createTicket(
    tenantId: string,
    contact: { userId: string; companyId: string },
    subject: string,
    text: string
  ) {
    const team = await db('teams')
      .where('org_id', tenantId)
      .where((q) => q.where('is_active', true).orWhereNull('is_active'))
      .orderBy('created_at', 'asc')
      .first('id');
    if (!team) return null;
    const queues = await db('queues').where({ team_id: team.id }).orderBy('created_at', 'asc');
    const queue = queues.find((q: any) => q.type === 'unassigned') || queues[0];
    if (!queue) return null;

    const departmentId = await TicketService.resolveDepartment(tenantId);
    const ticket = await Ticket.createTicket({
      title: subject,
      description: text || '(no message)',
      submitterId: contact.userId,
      companyId: contact.companyId,
      queueId: queue.id,
      teamId: team.id,
      departmentId,
    });
    await db('tickets').where('id', ticket.id).update({ source: 'email' });
    await Ticket.addHistory(ticket.id, contact.userId, 'created', undefined, undefined, undefined, {
      source: 'email',
    });
    return ticket;
  }

  /**
   * Save the email's attachments to the ticket (screenshots, PDFs, ...),
   * through the same checks as a portal upload: allowed types, size limit,
   * and the sender's access to the ticket. A file that fails is skipped, not
   * fatal - the ticket or reply still goes in.
   */
  private static async saveAttachments(
    email: ReceivedEmail,
    ticketId: string,
    uploadedById: string,
    noteId?: string
  ): Promise<number> {
    if (!email.attachments?.length || !email.downloadAttachment) return 0;
    const wanted = email.attachments
      .filter(
        (a) => !(a.inline && a.contentType.startsWith('image/') && a.size < MIN_INLINE_IMAGE_BYTES)
      )
      .slice(0, MAX_ATTACHMENTS);

    let saved = 0;
    for (const attachment of wanted) {
      try {
        const buffer = await email.downloadAttachment(attachment);
        const file = {
          fieldname: 'file',
          originalname: attachment.filename || 'attachment',
          encoding: '7bit',
          mimetype: attachment.contentType || 'application/octet-stream',
          size: buffer.length,
          buffer,
        } as Express.Multer.File;
        await FileService.uploadFile(file, ticketId, uploadedById, noteId);
        saved++;
      } catch (error) {
        logger.warn('Email attachment not saved', {
          ticketId,
          filename: attachment.filename,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return saved;
  }

  private static async log(
    email: ReceivedEmail,
    ticketId: string,
    tenantId: string,
    from: string,
    subject: string,
    noteId: string | null
  ) {
    await db('ticket_email_messages').insert({
      ticket_id: ticketId,
      org_id: tenantId,
      direction: 'inbound',
      provider_id: email.providerId || null,
      message_id: email.messageId || null,
      from_address: from,
      to_addresses: JSON.stringify([...email.to, ...email.cc]),
      subject,
      note_id: noteId,
    });
  }
}
