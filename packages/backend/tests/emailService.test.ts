import { EmailService, EmailConfig } from '@/services/EmailService';
import { TicketNoteService } from '@/services/TicketNoteService';
import { Ticket } from '@/models/Ticket';
import { User } from '@/models/User';
import { Company } from '@/models/Company';

// Mock dependencies
jest.mock('@/services/TicketNoteService');
jest.mock('@/models/Ticket');
jest.mock('@/models/User');
jest.mock('@/models/Company');
jest.mock('nodemailer');

const MockedTicketNoteService = TicketNoteService as jest.Mocked<typeof TicketNoteService>;
const MockedTicket = Ticket as jest.Mocked<typeof Ticket>;
const MockedUser = User as jest.Mocked<typeof User>;
const MockedCompany = Company as jest.Mocked<typeof Company>;

// Mock nodemailer
const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockCreateTransporter = jest.fn(() => ({
  sendMail: mockSendMail,
  verify: mockVerify,
}));

jest.mock('nodemailer', () => ({
  createTransporter: mockCreateTransporter,
}));

describe('EmailService', () => {
  const mockConfig: EmailConfig = {
    host: 'smtp.test.com',
    port: 587,
    secure: false,
    auth: {
      user: 'test@test.com',
      pass: 'password',
    },
    from: 'noreply@test.com',
  };

  const mockTicket = {
    id: 'ticket-123',
    title: 'Test Ticket',
    company_id: 'company-123',
    status: 'open',
    priority: 1,
  };

  const mockUser = {
    id: 'user-123',
    email: 'user@test.com',
    first_name: 'John',
    last_name: 'Doe',
  };

  const mockCompany = {
    id: 'company-123',
    name: 'Test Company',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    EmailService.initialize(mockConfig);
  });

  describe('initialize', () => {
    it('should initialize email service with config', () => {
      EmailService.initialize(mockConfig);
      expect(mockCreateTransporter).toHaveBeenCalledWith({
        host: mockConfig.host,
        port: mockConfig.port,
        secure: mockConfig.secure,
        auth: mockConfig.auth,
      });
    });

    it('should return true for isInitialized after initialization', () => {
      EmailService.initialize(mockConfig);
      expect(EmailService.isInitialized()).toBe(true);
    });
  });

  describe('verifyConnection', () => {
    it('should verify email connection successfully', async () => {
      mockVerify.mockResolvedValue(true);

      const result = await EmailService.verifyConnection();

      expect(mockVerify).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when verification fails', async () => {
      mockVerify.mockRejectedValue(new Error('Connection failed'));

      const result = await EmailService.verifyConnection();

      expect(result).toBe(false);
    });

    it('should throw error when not initialized', async () => {
      // Create a new instance without initialization
      const EmailServiceClass = require('@/services/EmailService').EmailService;
      EmailServiceClass['transporter'] = null;

      await expect(EmailServiceClass.verifyConnection()).rejects.toThrow(
        'Email service not initialized'
      );
    });
  });

  describe('sendTicketEmail', () => {
    const emailRequest = {
      ticketId: 'ticket-123',
      to: ['customer@test.com'],
      cc: ['manager@test.com'],
      subject: 'Test Email',
      htmlBody: '<p>Test HTML content</p>',
      textBody: 'Test text content',
      replyTo: 'support@test.com',
    };

    beforeEach(() => {
      MockedTicket.findById.mockResolvedValue(mockTicket);
      MockedUser.findById.mockResolvedValue(mockUser);
      MockedTicketNoteService.createEmailNote.mockResolvedValue({} as any);
      mockSendMail.mockResolvedValue({
        messageId: 'msg-123',
        accepted: ['customer@test.com'],
      });
    });

    it('should send email and create note successfully', async () => {
      const result = await EmailService.sendTicketEmail('user-123', emailRequest);

      expect(MockedTicket.findById).toHaveBeenCalledWith('ticket-123');
      expect(MockedUser.findById).toHaveBeenCalledWith('user-123');
      expect(mockSendMail).toHaveBeenCalledWith({
        from: mockConfig.from,
        to: emailRequest.to,
        cc: emailRequest.cc,
        bcc: undefined,
        subject: emailRequest.subject,
        html: emailRequest.htmlBody,
        text: emailRequest.textBody,
        replyTo: emailRequest.replyTo,
        inReplyTo: undefined,
        references: undefined,
        headers: {
          'X-Ticket-ID': 'ticket-123',
          'X-Sender-ID': 'user-123',
        },
      });
      expect(MockedTicketNoteService.createEmailNote).toHaveBeenCalled();
      expect(result.messageId).toBe('msg-123');
    });

    it('should throw error when ticket not found', async () => {
      MockedTicket.findById.mockResolvedValue(null);

      await expect(EmailService.sendTicketEmail('user-123', emailRequest)).rejects.toThrow(
        'Ticket not found'
      );
    });

    it('should throw error when sender not found', async () => {
      MockedUser.findById.mockResolvedValue(null);

      await expect(EmailService.sendTicketEmail('user-123', emailRequest)).rejects.toThrow(
        'Sender not found'
      );
    });

    it('should throw error when not initialized', async () => {
      const EmailServiceClass = require('@/services/EmailService').EmailService;
      EmailServiceClass['transporter'] = null;

      await expect(EmailServiceClass.sendTicketEmail('user-123', emailRequest)).rejects.toThrow(
        'Email service not initialized'
      );
    });
  });

  describe('sendNotificationEmail', () => {
    beforeEach(() => {
      mockSendMail.mockResolvedValue({
        messageId: 'notification-123',
      });
    });

    it('should send notification email successfully', async () => {
      const result = await EmailService.sendNotificationEmail(
        ['user@test.com'],
        'Test Notification',
        '<p>HTML content</p>',
        'Text content',
        { type: 'test', ticketId: 'ticket-123' }
      );

      expect(mockSendMail).toHaveBeenCalledWith({
        from: mockConfig.from,
        to: ['user@test.com'],
        subject: 'Test Notification',
        html: '<p>HTML content</p>',
        text: 'Text content',
        headers: {
          'X-Notification-Type': 'test',
          'X-Ticket-ID': 'ticket-123',
        },
      });
      expect(result).toBe('notification-123');
    });

    it('should send notification without metadata', async () => {
      const result = await EmailService.sendNotificationEmail(
        ['user@test.com'],
        'Test Notification',
        '<p>HTML content</p>',
        'Text content'
      );

      expect(mockSendMail).toHaveBeenCalledWith({
        from: mockConfig.from,
        to: ['user@test.com'],
        subject: 'Test Notification',
        html: '<p>HTML content</p>',
        text: 'Text content',
        headers: undefined,
      });
      expect(result).toBe('notification-123');
    });
  });

  describe('sendTicketNotification', () => {
    beforeEach(() => {
      MockedTicket.findById.mockResolvedValue(mockTicket);
      MockedCompany.findById.mockResolvedValue(mockCompany);
      mockSendMail.mockResolvedValue({ messageId: 'notification-123' });
    });

    it('should send ticket created notification', async () => {
      await EmailService.sendTicketNotification('ticket-123', 'created', ['customer@test.com']);

      expect(MockedTicket.findById).toHaveBeenCalledWith('ticket-123');
      expect(MockedCompany.findById).toHaveBeenCalledWith('company-123');
      expect(mockSendMail).toHaveBeenCalled();

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('New Ticket Created');
      expect(callArgs.to).toEqual(['customer@test.com']);
    });

    it('should send ticket assigned notification', async () => {
      await EmailService.sendTicketNotification('ticket-123', 'assigned', ['customer@test.com'], {
        assigneeName: 'John Doe',
      });

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.subject).toContain('Ticket Assigned');
      expect(callArgs.html).toContain('John Doe');
    });

    it('should throw error when ticket not found', async () => {
      MockedTicket.findById.mockResolvedValue(null);

      await expect(
        EmailService.sendTicketNotification('ticket-123', 'created', ['customer@test.com'])
      ).rejects.toThrow('Ticket not found');
    });
  });

  describe('parseEmailThread', () => {
    it('should parse email thread with references', () => {
      const references = ['msg-1', 'msg-2', 'msg-3'];
      const inReplyTo = 'msg-3';

      const result = EmailService.parseEmailThread(references, inReplyTo);

      expect(result.threadId).toBe('msg-1');
      expect(result.parentMessageId).toBe('msg-3');
    });

    it('should use inReplyTo as threadId when no references', () => {
      const result = EmailService.parseEmailThread([], 'msg-1');

      expect(result.threadId).toBe('msg-1');
      expect(result.parentMessageId).toBe('msg-1');
    });

    it('should return empty threadId when no references or inReplyTo', () => {
      const result = EmailService.parseEmailThread([]);

      expect(result.threadId).toBe('');
      expect(result.parentMessageId).toBeUndefined();
    });
  });

  describe('generateReplyReferences', () => {
    it('should add original message to references', () => {
      const result = EmailService.generateReplyReferences('msg-new', ['msg-1', 'msg-2']);

      expect(result).toEqual(['msg-1', 'msg-2', 'msg-new']);
    });

    it('should not duplicate existing message ID', () => {
      const result = EmailService.generateReplyReferences('msg-2', ['msg-1', 'msg-2']);

      expect(result).toEqual(['msg-1', 'msg-2']);
    });

    it('should limit references to 10 items', () => {
      const existingRefs = Array.from({ length: 12 }, (_, i) => `msg-${i}`);
      const result = EmailService.generateReplyReferences('msg-new', existingRefs);

      expect(result.length).toBe(10);
      expect(result[result.length - 1]).toBe('msg-new');
    });
  });

  describe('getEmailConfig', () => {
    it('should return current email config', async () => {
      const config = await EmailService.getEmailConfig();

      expect(config).toEqual(mockConfig);
    });
  });
});
