import { EmailService } from './EmailService';
import { logger } from '@/utils/logger';
import { supportAddress } from '@/utils/supportEmail';
import { portalUrl } from '@/utils/portalName';
import {
  Brand,
  BOMIZZEL_BRAND,
  brandedLayout,
  button,
  escapeHtml,
  signatureHtml,
  signatureText,
} from '@/utils/brandedEmail';

/**
 * The account emails: verify your address, reset your password, and the
 * welcome a subscriber's staff send a new contact (choose your password).
 * Links point at the frontend (FRONTEND_URL), which calls the matching
 * /api/auth endpoint.
 *
 * A subscriber's customers get them in the subscriber's brand, sent as the
 * subscriber from its support address, so a reply opens a ticket with them.
 * Bomizzel accounts (staff, owners) get Bomizzel's.
 *
 * When email isn't configured nothing can be sent. That's logged, not thrown,
 * so a missing mail setting can't turn a sign-up into a 500.
 */
const frontendUrl = (): string =>
  (process.env['FRONTEND_URL'] || 'https://www.bomizzel.com').replace(/\/+$/, '');

// A subscriber's customers finish on its portal; Bomizzel accounts on the app
const linkBase = (brand: Brand): string =>
  brand.companyId && brand.supportSlug ? portalUrl(brand.supportSlug) : frontendUrl();

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const linkFallback = (brand: Brand, link: string) =>
  `<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(link)}" style="color:${brand.color};word-break:break-all;">${escapeHtml(link)}</a></p>`;

const hi = (firstName?: string) => (firstName ? `Hi ${firstName},` : 'Hi,');
const isSubscriber = (brand: Brand) => !!brand.companyId;

/** What each email says, in a brand. Kept apart from sending for the previews. */
export const accountEmails = {
  /** A new staff login (an agent or admin): choose a password for the help desk. */
  staffWelcome(
    companyName: string,
    firstName: string | undefined,
    link: string,
    asOwner: boolean
  ): EmailContent {
    const brand = BOMIZZEL_BRAND;
    const role = asOwner
      ? `the owner of ${companyName}'s help desk on Bomizzel`
      : `${companyName}'s help desk on Bomizzel`;
    const lines = [
      `You've been added to ${role}.`,
      ...(asOwner
        ? [
            'As the owner you can do everything an admin can, and you are the only one who can hand ownership to someone else.',
          ]
        : []),
      'Choose a password to sign in. The link works for 7 days.',
    ];
    return {
      subject: asOwner
        ? `You're the owner of ${companyName} on Bomizzel`
        : `You've been added to ${companyName} on Bomizzel`,
      html: brandedLayout(
        brand,
        `<h1 style="margin:0 0 16px;font-size:20px;">Welcome to Bomizzel</h1>
<p style="margin:0 0 14px;line-height:1.55;">${escapeHtml(hi(firstName))}</p>
${lines.map((l) => `<p style="margin:0 0 14px;line-height:1.55;">${escapeHtml(l)}</p>`).join('\n')}
${button(brand, 'Choose my password', link)}${linkFallback(brand, link)}`,
        { preheader: `Your ${companyName} login is ready.` }
      ),
      text: `${hi(firstName)}\n\n${lines.join('\n\n')}\n\nChoose your password: ${link}\n`,
    };
  },

  verification(brand: Brand, firstName: string | undefined, link: string): EmailContent {
    const where = isSubscriber(brand) ? `${brand.name}'s support portal` : 'Bomizzel';
    return {
      subject: `Confirm your email for ${where}`,
      html: brandedLayout(
        brand,
        `<h1 style="margin:0 0 16px;font-size:20px;">Confirm your email address</h1>
<p style="margin:0 0 14px;line-height:1.55;">${escapeHtml(hi(firstName))}</p>
<p style="margin:0 0 14px;line-height:1.55;">Please confirm this is your email address so you can sign in to ${escapeHtml(where)}. The link works for 24 hours.</p>
${button(brand, 'Confirm email', link)}${linkFallback(brand, link)}`,
        { preheader: 'Confirm your email address to sign in.' }
      ),
      text: `${hi(firstName)}\n\nPlease confirm your email address so you can sign in to ${where}:\n${link}\n\nThe link works for 24 hours. If you didn't sign up, you can ignore this email.`,
    };
  },

  passwordReset(brand: Brand, firstName: string | undefined, link: string): EmailContent {
    const where = isSubscriber(brand)
      ? `your ${brand.name} support account`
      : 'your Bomizzel account';
    return {
      subject: isSubscriber(brand)
        ? `Reset your password for ${brand.name} support`
        : 'Reset your Bomizzel password',
      html: brandedLayout(
        brand,
        `<h1 style="margin:0 0 16px;font-size:20px;">Reset your password</h1>
<p style="margin:0 0 14px;line-height:1.55;">${escapeHtml(hi(firstName))}</p>
<p style="margin:0 0 14px;line-height:1.55;">Someone asked to reset the password for ${escapeHtml(where)}. The link works for 1 hour. If it wasn't you, ignore this email and your password stays the same.</p>
${button(brand, 'Choose a new password', link)}${linkFallback(brand, link)}`,
        { preheader: 'A link to choose a new password.' }
      ),
      text: `${hi(firstName)}\n\nTo reset the password for ${where}, open:\n${link}\n\nThe link works for 1 hour. If you didn't ask for this, ignore this email.`,
    };
  },

  /** The welcome a new contact gets: what the portal is, and choose a password. */
  welcome(
    brand: Brand,
    firstName: string | undefined,
    link: string,
    signature: string | null
  ): EmailContent {
    const name = brand.name;
    const canReply = !!brand.supportSlug;
    const lines = [
      `${name} has set up an account for you on our support portal. You can use it to see your support requests, follow their progress and reply, or open a new one.`,
      'To get started, choose a password. The link works for 7 days.',
    ];
    return {
      subject: `Welcome to ${name} support`,
      html: brandedLayout(
        brand,
        `<h1 style="margin:0 0 16px;font-size:22px;">Welcome to ${escapeHtml(name)} support</h1>
<p style="margin:0 0 14px;line-height:1.55;">${escapeHtml(hi(firstName))}</p>
${lines.map((l) => `<p style="margin:0 0 14px;line-height:1.55;">${escapeHtml(l)}</p>`).join('\n')}
${button(brand, 'Choose my password', link)}
${canReply ? `<p style="margin:0 0 14px;line-height:1.55;">Need help now? Just reply to this email and it reaches our support team.</p>` : ''}
${signatureHtml(signature)}
<div style="margin-top:24px;">${linkFallback(brand, link)}</div>`,
        { preheader: `Your ${name} support account is ready.` }
      ),
      text: `${hi(firstName)}\n\n${lines.join('\n\n')}\n\nChoose your password: ${link}\n${canReply ? '\nNeed help now? Just reply to this email and it reaches our support team.\n' : ''}${signatureText(signature)}\n`,
    };
  },
};

const send = async (
  to: string,
  brand: Brand,
  content: EmailContent,
  type: string
): Promise<boolean> => {
  if (!EmailService.isInitialized()) {
    logger.warn(`Account email not sent (email not configured): ${type}`, { to });
    return false;
  }
  const message = {
    to: [to],
    subject: content.subject,
    html: content.html,
    text: content.text,
    headers: { 'X-Notification-Type': type },
  };
  try {
    if (brand.companyId && brand.supportSlug) {
      // As the subscriber, from its support address (replies open a ticket).
      // If the provider won't send as that domain, the platform address with
      // Reply-To instead.
      const address = supportAddress(brand.supportSlug);
      const branded = { ...message, fromName: brand.name, replyTo: address };
      try {
        await EmailService.send({ ...branded, fromAddress: address });
      } catch (error) {
        logger.warn('Could not send from the support address; using the platform address', {
          type,
          error: error instanceof Error ? error.message : String(error),
        });
        await EmailService.send(branded);
      }
    } else {
      await EmailService.send({ ...message, fromName: brand.companyId ? brand.name : undefined });
    }
    logger.info(`Account email sent: ${type}`, { to });
    return true;
  } catch (error) {
    logger.error(`Account email failed: ${type}`, {
      to,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

export class AccountEmailService {
  static async sendVerification(
    user: { email: string; first_name?: string },
    token: string,
    brand: Brand = BOMIZZEL_BRAND
  ) {
    const link = `${linkBase(brand)}/verify-email?token=${encodeURIComponent(token)}`;
    return send(
      user.email,
      brand,
      accountEmails.verification(brand, user.first_name, link),
      'email_verification'
    );
  }

  static async sendPasswordReset(
    user: { email: string; first_name?: string },
    token: string,
    brand: Brand = BOMIZZEL_BRAND
  ) {
    const link = `${linkBase(brand)}/reset-password?token=${encodeURIComponent(token)}`;
    return send(
      user.email,
      brand,
      accountEmails.passwordReset(brand, user.first_name, link),
      'password_reset'
    );
  }

  /** A new staff member's link to choose their password (on the app, not a portal). */
  static async sendStaffInvitation(
    user: { email: string; first_name?: string },
    token: string,
    companyName: string,
    asOwner: boolean
  ) {
    const link = `${frontendUrl()}/reset-password?token=${encodeURIComponent(token)}&invite=1`;
    return send(
      user.email,
      BOMIZZEL_BRAND,
      accountEmails.staffWelcome(companyName, user.first_name, link, asOwner),
      'staff_invitation'
    );
  }

  /** The welcome email: a contact's link to choose their password. */
  static async sendInvitation(
    user: { email: string; first_name?: string },
    token: string,
    brand: Brand,
    signature: string | null
  ) {
    const link = `${linkBase(brand)}/reset-password?token=${encodeURIComponent(token)}&invite=1`;
    return send(
      user.email,
      brand,
      accountEmails.welcome(brand, user.first_name, link, signature),
      'invitation'
    );
  }
}
