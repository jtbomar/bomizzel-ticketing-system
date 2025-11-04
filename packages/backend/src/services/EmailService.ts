import nodemailer from 'nodemailer';
import { TicketNoteService } from './TicketNoteService';
import { Ticket } from '@/models/Ticket';
import { User } from '@/models/User';
import { Company } from '@/models/Company';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  isActive: boolean;
}

export interface SendEmailRequest {
  ticketId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  textBody: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
}

export interface EmailMetadata {
  messageId: string;
  subject: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  sentAt: Date;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;
  private static config: EmailConfig | null = null;

  static initialize(config: EmailConfig): void {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }

  static async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      throw new Error('Email service not initialized');
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service verification failed:', error);
      return false;
    }
  }

  static async sendTicketEmail(
    senderId: string,
    emailRequest: SendEmailRequest
  ): Promise<EmailMetadata> {
    if (!this.transporter || !this.config) {
      throw new Error('Email service not initialized');
    }

    // Verify ticket exists and sender has access
    const ticket = await Ticket.findById(emailRequest.ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Get sender information
    const sender = await User.findById(senderId);
    if (!sender) {
      throw new Error('Sender not found');
    }

    // Prepare email options
    const mailOptions = {
      from: this.config.from,
      to: emailRequest.to,
      cc: emailRequest.cc,
      bcc: emailRequest.bcc,
      subject: emailRequest.subject,
      html: emailRequest.htmlBody,
      text: emailRequest.textBody,
      replyTo: emailRequest.replyTo || this.config.from,
      inReplyTo: emailRequest.inReplyTo,
      references: emailRequest.references,
      headers: {
        'X-Ticket-ID': emailRequest.ticketId,
        'X-Sender-ID': senderId,
      },
    };

    // Send email
    const info = await this.transporter.sendMail(mailOptions);

    // Create email metadata
    const emailMetadata: EmailMetadata = {
      messageId: info.messageId,
      subject: emailRequest.subject,
      to: emailRequest.to,
      sentAt: new Date(),
    };

    // Add optional fields only if they exist
    if (emailRequest.cc) emailMetadata.cc = emailRequest.cc;
    if (emailRequest.bcc) emailMetadata.bcc = emailRequest.bcc;
    if (emailRequest.replyTo) emailMetadata.replyTo = emailRequest.replyTo;
    if (emailRequest.inReplyTo) emailMetadata.inReplyTo = emailRequest.inReplyTo;
    if (emailRequest.references) emailMetadata.references = emailRequest.references;

    // Create note from sent email
    await TicketNoteService.createEmailNote(
      emailRequest.ticketId,
      senderId,
      this.formatEmailContent(emailRequest),
      emailMetadata
    );

    return emailMetadata;
  }

  static async sendNotificationEmail(
    to: string[],
    subject: string,
    htmlBody: string,
    textBody: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!this.transporter || !this.config) {
      throw new Error('Email service not initialized');
    }

    const mailOptions = {
      from: this.config.from,
      to,
      subject,
      html: htmlBody,
      text: textBody,
      headers: metadata
        ? {
            'X-Notification-Type': metadata['type'] || 'general',
            'X-Ticket-ID': metadata['ticketId'],
          }
        : undefined,
    };

    const info = await this.transporter.sendMail(mailOptions);
    return info.messageId;
  }

  static async sendTicketNotification(
    ticketId: string,
    notificationType: 'created' | 'updated' | 'assigned' | 'resolved' | 'closed',
    recipients: string[],
    additionalData?: Record<string, any>
  ): Promise<void> {
    // Get ticket details
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Get company details
    const company = await Company.findById(ticket.company_id);

    // Generate notification content based on type
    const { subject, htmlBody, textBody } = this.generateNotificationContent(
      notificationType,
      ticket,
      company,
      additionalData
    );

    await this.sendNotificationEmail(recipients, subject, htmlBody, textBody, {
      type: 'ticket_notification',
      ticketId,
      notificationType,
    });
  }

  private static formatEmailContent(emailRequest: SendEmailRequest): string {
    let content = `Email sent to: ${emailRequest.to.join(', ')}\n`;

    if (emailRequest.cc && emailRequest.cc.length > 0) {
      content += `CC: ${emailRequest.cc.join(', ')}\n`;
    }

    content += `Subject: ${emailRequest.subject}\n\n`;
    content += emailRequest.textBody || this.stripHtml(emailRequest.htmlBody);

    return content;
  }

  private static stripHtml(html: string | undefined): string {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  private static generateNotificationContent(
    type: string,
    ticket: any,
    company: any,
    additionalData?: Record<string, any>
  ): { subject: string; htmlBody: string; textBody: string } {
    const companyName = company?.name || 'Unknown Company';
    const ticketTitle = ticket.title;
    const ticketId = ticket.id;

    let subject: string;
    let action: string;

    switch (type) {
      case 'created':
        subject = `New Ticket Created: ${ticketTitle}`;
        action = 'A new ticket has been created';
        break;
      case 'updated':
        subject = `Ticket Updated: ${ticketTitle}`;
        action = 'A ticket has been updated';
        break;
      case 'assigned':
        subject = `Ticket Assigned: ${ticketTitle}`;
        action = `A ticket has been assigned${additionalData?.['assigneeName'] ? ` to ${additionalData['assigneeName']}` : ''}`;
        break;
      case 'resolved':
        subject = `Ticket Resolved: ${ticketTitle}`;
        action = 'A ticket has been resolved';
        break;
      case 'closed':
        subject = `Ticket Closed: ${ticketTitle}`;
        action = 'A ticket has been closed';
        break;
      default:
        subject = `Ticket Notification: ${ticketTitle}`;
        action = 'A ticket has been updated';
    }

    const textBody = `
${action}

Company: ${companyName}
Ticket ID: ${ticketId}
Title: ${ticketTitle}
Status: ${ticket.status}
Priority: ${ticket.priority}

${additionalData?.['message'] || ''}

Please log in to your account to view the full ticket details.
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${subject}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .content { padding: 20px 0; }
        .ticket-info { background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>${subject}</h2>
        </div>
        
        <div class="content">
            <p>${action}</p>
            
            <div class="ticket-info">
                <strong>Company:</strong> ${companyName}<br>
                <strong>Ticket ID:</strong> ${ticketId}<br>
                <strong>Title:</strong> ${ticketTitle}<br>
                <strong>Status:</strong> ${ticket.status}<br>
                <strong>Priority:</strong> ${ticket.priority}
            </div>
            
            ${additionalData?.['message'] ? `<p>${additionalData['message']}</p>` : ''}
            
            <p>Please log in to your account to view the full ticket details.</p>
        </div>
        
        <div class="footer">
            <p>This is an automated notification from the Bomizzel Ticketing System.</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    return { subject, htmlBody, textBody };
  }

  static parseEmailThread(
    references: string[],
    inReplyTo?: string
  ): {
    threadId: string;
    parentMessageId?: string;
  } {
    // Use the first reference as thread ID, or inReplyTo if no references
    const threadId = references.length > 0 ? (references[0] ?? '') : (inReplyTo ?? '');

    const result: { threadId: string; parentMessageId?: string } = { threadId };
    if (inReplyTo) {
      result.parentMessageId = inReplyTo;
    }

    return result;
  }

  static generateReplyReferences(
    originalMessageId: string,
    existingReferences?: string[]
  ): string[] {
    const references = existingReferences || [];

    // Add original message ID to references if not already present
    if (!references.includes(originalMessageId)) {
      references.push(originalMessageId);
    }

    // Limit references to prevent header size issues (RFC 2822 recommends max 998 chars)
    return references.slice(-10);
  }

  /**
   * Send welcome email based on subscription plan
   */
  static async sendWelcomeEmail(
    userEmail: string,
    userName: string,
    planName: string,
    planFeatures: string[],
    isTrialPlan: boolean = false,
    trialDays?: number
  ): Promise<void> {
    if (!this.transporter || !this.config) {
      throw new Error('Email service not initialized');
    }

    const subject = `Welcome to Bomizzel - Your ${planName} ${isTrialPlan ? 'Trial' : 'Account'} is Ready!`;

    const htmlBody = this.generateWelcomeEmailHTML(
      userName,
      planName,
      planFeatures,
      isTrialPlan,
      trialDays
    );
    const textBody = this.generateWelcomeEmailText(
      userName,
      planName,
      planFeatures,
      isTrialPlan,
      trialDays
    );

    const mailOptions = {
      from: this.config.from,
      to: userEmail,
      subject,
      html: htmlBody,
      text: textBody,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent successfully to ${userEmail}`);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  /**
   * Generate HTML content for welcome email
   */
  private static generateWelcomeEmailHTML(
    userName: string,
    planName: string,
    planFeatures: string[],
    isTrialPlan: boolean,
    trialDays?: number
  ): string {
    const trialText =
      isTrialPlan && trialDays
        ? `<p style="color: #059669; font-weight: 600;">🎉 You're starting with a ${trialDays}-day free trial!</p>`
        : '';

    const featuresHTML = planFeatures
      .map((feature) => `<li style="margin-bottom: 8px;">✅ ${feature}</li>`)
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to Bomizzel</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin-bottom: 10px;">Welcome to Bomizzel!</h1>
          <p style="font-size: 18px; color: #6b7280;">Your ${planName} account is ready to go</p>
          ${trialText}
        </div>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h2 style="color: #1f2937; margin-top: 0;">Hi ${userName},</h2>
          <p>Thank you for choosing Bomizzel for your ticket management needs! Your ${planName} ${isTrialPlan ? 'trial' : 'subscription'} is now active and ready to help you streamline your support operations.</p>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f2937;">What's included in your ${planName} plan:</h3>
          <ul style="list-style: none; padding: 0;">
            ${featuresHTML}
          </ul>
        </div>

        <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h3 style="color: #1e40af; margin-top: 0;">Getting Started</h3>
          <p>Here are some quick steps to get you up and running:</p>
          <ol style="margin: 0; padding-left: 20px;">
            <li>Log in to your dashboard</li>
            <li>Set up your company profile</li>
            <li>Create your first ticket</li>
            <li>Invite team members (if applicable)</li>
            <li>Explore the features included in your plan</li>
          </ol>
        </div>

        ${
          isTrialPlan
            ? `
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h3 style="color: #92400e; margin-top: 0;">Your Trial Period</h3>
          <p>You have ${trialDays} days to explore all the features of the ${planName} plan. We'll send you reminders as your trial progresses, and you can upgrade to a paid plan at any time.</p>
        </div>
        `
            : ''
        }

        <div style="text-align: center; margin-top: 40px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer" 
             style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Access Your Dashboard
          </a>
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
          <p>Need help? Contact our support team at support@bomizzel.com</p>
          <p>© 2024 Bomizzel. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate text content for welcome email
   */
  private static generateWelcomeEmailText(
    userName: string,
    planName: string,
    planFeatures: string[],
    isTrialPlan: boolean,
    trialDays?: number
  ): string {
    const trialText =
      isTrialPlan && trialDays ? `🎉 You're starting with a ${trialDays}-day free trial!\n\n` : '';

    const featuresText = planFeatures.map((feature) => `✅ ${feature}`).join('\n');

    return `
Welcome to Bomizzel!

Your ${planName} account is ready to go
${trialText}
Hi ${userName},

Thank you for choosing Bomizzel for your ticket management needs! Your ${planName} ${isTrialPlan ? 'trial' : 'subscription'} is now active and ready to help you streamline your support operations.

What's included in your ${planName} plan:
${featuresText}

Getting Started:
1. Log in to your dashboard
2. Set up your company profile
3. Create your first ticket
4. Invite team members (if applicable)
5. Explore the features included in your plan

${
  isTrialPlan
    ? `
Your Trial Period:
You have ${trialDays} days to explore all the features of the ${planName} plan. We'll send you reminders as your trial progresses, and you can upgrade to a paid plan at any time.
`
    : ''
}

Access your dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/customer

Need help? Contact our support team at support@bomizzel.com

© 2024 Bomizzel. All rights reserved.
    `.trim();
  }

  static async getEmailConfig(): Promise<EmailConfig | null> {
    return this.config;
  }

  static isInitialized(): boolean {
    return this.transporter !== null && this.config !== null;
  }
}
