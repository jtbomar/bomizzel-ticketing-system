import { EmailService } from './EmailService';
import { logger } from '@/utils/logger';

/**
 * The account emails: verify your address, reset your password, and the
 * invitation a subscriber's staff send a new contact. Links point at the
 * frontend (FRONTEND_URL), which calls the matching /api/auth endpoint.
 *
 * When SMTP isn't configured nothing can be sent. That's logged, not thrown,
 * so a missing mail setting can't turn a sign-up into a 500 - but the person
 * won't get their link, so production needs the SMTP_* variables set.
 */

const frontendUrl = (): string =>
  (process.env['FRONTEND_URL'] || 'https://www.bomizzel.com').replace(/\/+$/, '');

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

const layout = (
  heading: string,
  paragraphs: string[],
  buttonLabel: string,
  link: string
): string => `
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;">
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(heading)}</h1>
        ${paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.5;">${p}</p>`).join('\n        ')}
        <p style="margin:24px 0;">
          <a href="${link}" style="background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${escapeHtml(buttonLabel)}</a>
        </p>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
          If the button doesn't work, copy this link into your browser:<br>
          <a href="${link}" style="color:#2563eb;word-break:break-all;">${link}</a>
        </p>
      </td></tr>
    </table>
    <p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#9ca3af;text-align:center;">Bomizzel</p>
  </body>
</html>`;

const send = async (
  to: string,
  subject: string,
  html: string,
  text: string,
  type: string
): Promise<boolean> => {
  if (!EmailService.isInitialized()) {
    logger.warn(`Account email not sent (SMTP not configured): ${type}`, { to });
    return false;
  }
  try {
    await EmailService.sendNotificationEmail([to], subject, html, text, { type });
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
  static async sendVerification(user: { email: string; first_name?: string }, token: string) {
    const link = `${frontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    const name = user.first_name ? `Hi ${escapeHtml(user.first_name)},` : 'Hi,';
    const textName = user.first_name ? `Hi ${user.first_name},` : 'Hi,';
    return send(
      user.email,
      'Confirm your email for Bomizzel',
      layout(
        'Confirm your email address',
        [
          name,
          'Please confirm this is your email address so you can sign in to Bomizzel.',
          'The link works for 24 hours.',
        ],
        'Confirm email',
        link
      ),
      `${textName}\n\nPlease confirm your email address so you can sign in to Bomizzel:\n${link}\n\nThe link works for 24 hours. If you didn't sign up, you can ignore this email.`,
      'email_verification'
    );
  }

  static async sendPasswordReset(user: { email: string; first_name?: string }, token: string) {
    const link = `${frontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const name = user.first_name ? `Hi ${escapeHtml(user.first_name)},` : 'Hi,';
    const textName = user.first_name ? `Hi ${user.first_name},` : 'Hi,';
    return send(
      user.email,
      'Reset your Bomizzel password',
      layout(
        'Reset your password',
        [
          name,
          'Someone asked to reset the password for this Bomizzel account.',
          "The link works for 1 hour. If it wasn't you, ignore this email and your password stays the same.",
        ],
        'Choose a new password',
        link
      ),
      `${textName}\n\nTo reset your Bomizzel password, open:\n${link}\n\nThe link works for 1 hour. If you didn't ask for this, ignore this email.`,
      'password_reset'
    );
  }

  static async sendInvitation(
    user: { email: string; first_name?: string },
    token: string,
    companyName: string
  ) {
    const link = `${frontendUrl()}/reset-password?token=${encodeURIComponent(token)}&invite=1`;
    const name = user.first_name ? `Hi ${escapeHtml(user.first_name)},` : 'Hi,';
    const textName = user.first_name ? `Hi ${user.first_name},` : 'Hi,';
    return send(
      user.email,
      `${companyName} invited you to their support portal`,
      layout(
        `You're invited to ${companyName}'s support portal`,
        [
          name,
          `${escapeHtml(companyName)} has set up an account for you so you can follow and reply to your support tickets.`,
          'Choose a password to get started. The link works for 7 days.',
        ],
        'Set my password',
        link
      ),
      `${textName}\n\n${companyName} has set up a support portal account for you. Choose a password to get started:\n${link}\n\nThe link works for 7 days.`,
      'invitation'
    );
  }
}
