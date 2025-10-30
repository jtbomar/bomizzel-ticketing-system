import { EmailTemplateService } from '@/services/EmailTemplateService';
import { EmailTemplate } from '@/models/EmailTemplate';

// Mock the EmailTemplate model
jest.mock('@/models/EmailTemplate');

const MockedEmailTemplate = EmailTemplate as jest.Mocked<typeof EmailTemplate>;

describe('EmailTemplateService', () => {
  const mockTemplate = {
    id: 'template-123',
    name: 'test_template',
    subject: 'Test Subject: {{ticket.title}}',
    html_body: '<p>Hello {{customer.firstName}}</p>',
    text_body: 'Hello {{customer.firstName}}',
    variables: ['ticket.title', 'customer.firstName'],
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTemplate', () => {
    it('should create template with extracted variables', async () => {
      MockedEmailTemplate.extractVariablesFromContent
        .mockReturnValueOnce(['ticket.title'])
        .mockReturnValueOnce(['customer.firstName'])
        .mockReturnValueOnce(['customer.firstName']);
      MockedEmailTemplate.createTemplate.mockResolvedValue(mockTemplate);
      MockedEmailTemplate.toModel.mockReturnValue({
        id: 'template-123',
        name: 'test_template',
        subject: 'Test Subject: {{ticket.title}}',
        htmlBody: '<p>Hello {{customer.firstName}}</p>',
        textBody: 'Hello {{customer.firstName}}',
        variables: ['ticket.title', 'customer.firstName'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await EmailTemplateService.createTemplate({
        name: 'test_template',
        subject: 'Test Subject: {{ticket.title}}',
        htmlBody: '<p>Hello {{customer.firstName}}</p>',
        textBody: 'Hello {{customer.firstName}}',
      });

      expect(MockedEmailTemplate.createTemplate).toHaveBeenCalledWith({
        name: 'test_template',
        subject: 'Test Subject: {{ticket.title}}',
        htmlBody: '<p>Hello {{customer.firstName}}</p>',
        textBody: 'Hello {{customer.firstName}}',
        variables: ['ticket.title', 'customer.firstName'],
      });
      expect(result.name).toBe('test_template');
    });

    it('should use provided variables if specified', async () => {
      MockedEmailTemplate.createTemplate.mockResolvedValue(mockTemplate);
      MockedEmailTemplate.toModel.mockReturnValue({} as any);

      await EmailTemplateService.createTemplate({
        name: 'test_template',
        subject: 'Test Subject',
        htmlBody: '<p>Hello</p>',
        textBody: 'Hello',
        variables: ['custom.variable'],
      });

      expect(MockedEmailTemplate.createTemplate).toHaveBeenCalledWith({
        name: 'test_template',
        subject: 'Test Subject',
        htmlBody: '<p>Hello</p>',
        textBody: 'Hello',
        variables: ['custom.variable'],
      });
    });
  });

  describe('getTemplateById', () => {
    it('should return template by ID', async () => {
      MockedEmailTemplate.findById.mockResolvedValue(mockTemplate);
      MockedEmailTemplate.toModel.mockReturnValue({} as any);

      const result = await EmailTemplateService.getTemplateById('template-123');

      expect(MockedEmailTemplate.findById).toHaveBeenCalledWith('template-123');
      expect(MockedEmailTemplate.toModel).toHaveBeenCalledWith(mockTemplate);
      expect(result).toBeDefined();
    });

    it('should return null if template not found', async () => {
      MockedEmailTemplate.findById.mockResolvedValue(null);

      const result = await EmailTemplateService.getTemplateById('template-123');

      expect(result).toBeNull();
    });
  });

  describe('getTemplateByName', () => {
    it('should return template by name', async () => {
      MockedEmailTemplate.findByName.mockResolvedValue(mockTemplate);
      MockedEmailTemplate.toModel.mockReturnValue({} as any);

      const result = await EmailTemplateService.getTemplateByName('test_template');

      expect(MockedEmailTemplate.findByName).toHaveBeenCalledWith('test_template');
      expect(result).toBeDefined();
    });

    it('should return null if template not found', async () => {
      MockedEmailTemplate.findByName.mockResolvedValue(null);

      const result = await EmailTemplateService.getTemplateByName('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAllTemplates', () => {
    it('should return all templates', async () => {
      MockedEmailTemplate.findAll.mockResolvedValue([mockTemplate]);
      MockedEmailTemplate.toModel.mockReturnValue({} as any);

      const result = await EmailTemplateService.getAllTemplates();

      expect(MockedEmailTemplate.findAll).toHaveBeenCalledWith({
        orderBy: 'name',
        orderDirection: 'asc',
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getActiveTemplates', () => {
    it('should return only active templates', async () => {
      MockedEmailTemplate.findActiveTemplates.mockResolvedValue([mockTemplate]);
      MockedEmailTemplate.toModel.mockReturnValue({} as any);

      const result = await EmailTemplateService.getActiveTemplates();

      expect(MockedEmailTemplate.findActiveTemplates).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('updateTemplate', () => {
    it('should update template with new variables extracted', async () => {
      MockedEmailTemplate.findById.mockResolvedValue(mockTemplate);
      MockedEmailTemplate.extractVariablesFromContent
        .mockReturnValueOnce(['new.variable'])
        .mockReturnValueOnce(['customer.firstName'])
        .mockReturnValueOnce(['customer.firstName']);
      MockedEmailTemplate.updateTemplate.mockResolvedValue({
        ...mockTemplate,
        subject: 'Updated Subject: {{new.variable}}',
      });
      MockedEmailTemplate.toModel.mockReturnValue({} as any);

      const result = await EmailTemplateService.updateTemplate('template-123', {
        subject: 'Updated Subject: {{new.variable}}',
      });

      expect(MockedEmailTemplate.updateTemplate).toHaveBeenCalledWith('template-123', {
        subject: 'Updated Subject: {{new.variable}}',
        variables: ['new.variable', 'customer.firstName'],
      });
      expect(result).toBeDefined();
    });

    it('should return null if template not found', async () => {
      MockedEmailTemplate.updateTemplate.mockResolvedValue(null);

      const result = await EmailTemplateService.updateTemplate('template-123', {
        subject: 'Updated Subject',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template', async () => {
      MockedEmailTemplate.delete.mockResolvedValue(true);

      const result = await EmailTemplateService.deleteTemplate('template-123');

      expect(MockedEmailTemplate.delete).toHaveBeenCalledWith('template-123');
      expect(result).toBe(true);
    });
  });

  describe('renderTemplate', () => {
    it('should render template with variables', async () => {
      MockedEmailTemplate.renderTemplate.mockResolvedValue({
        subject: 'Test Subject: My Ticket',
        htmlBody: '<p>Hello John</p>',
        textBody: 'Hello John',
      });

      const result = await EmailTemplateService.renderTemplate('template-123', {
        'ticket.title': 'My Ticket',
        'customer.firstName': 'John',
      });

      expect(MockedEmailTemplate.renderTemplate).toHaveBeenCalledWith('template-123', {
        'ticket.title': 'My Ticket',
        'customer.firstName': 'John',
      });
      expect(result?.subject).toBe('Test Subject: My Ticket');
    });
  });

  describe('renderTemplateByName', () => {
    it('should render template by name', async () => {
      MockedEmailTemplate.findByName.mockResolvedValue(mockTemplate);
      MockedEmailTemplate.renderTemplate.mockResolvedValue({
        subject: 'Rendered Subject',
        htmlBody: '<p>Rendered HTML</p>',
        textBody: 'Rendered Text',
      });

      const result = await EmailTemplateService.renderTemplateByName('test_template', {
        'customer.firstName': 'John',
      });

      expect(MockedEmailTemplate.findByName).toHaveBeenCalledWith('test_template');
      expect(MockedEmailTemplate.renderTemplate).toHaveBeenCalledWith(
        'template-123',
        { 'customer.firstName': 'John' }
      );
      expect(result?.subject).toBe('Rendered Subject');
    });

    it('should return null if template not found', async () => {
      MockedEmailTemplate.findByName.mockResolvedValue(null);

      const result = await EmailTemplateService.renderTemplateByName('nonexistent', {});

      expect(result).toBeNull();
    });
  });

  describe('validateTemplate', () => {
    it('should validate valid template', async () => {
      MockedEmailTemplate.extractVariablesFromContent
        .mockReturnValueOnce(['ticket.title'])
        .mockReturnValueOnce(['customer.firstName'])
        .mockReturnValueOnce([]);

      const result = await EmailTemplateService.validateTemplate({
        subject: 'Test {{ticket.title}}',
        htmlBody: '<p>Hello {{customer.firstName}}</p>',
        textBody: 'Hello',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.variables).toEqual(['ticket.title', 'customer.firstName']);
    });

    it('should return errors for invalid template', async () => {
      MockedEmailTemplate.extractVariablesFromContent
        .mockReturnValue(['invalid-variable-name']);

      const result = await EmailTemplateService.validateTemplate({
        subject: '',
        htmlBody: '',
        textBody: '',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Subject is required');
      expect(result.errors).toContain('Either HTML body or text body is required');
      expect(result.errors).toContain('Invalid variable names: invalid-variable-name');
    });
  });

  describe('duplicateTemplate', () => {
    it('should duplicate existing template', async () => {
      MockedEmailTemplate.findById.mockResolvedValue(mockTemplate);
      MockedEmailTemplate.createTemplate.mockResolvedValue({
        ...mockTemplate,
        id: 'template-456',
        name: 'duplicated_template',
      });
      MockedEmailTemplate.toModel.mockReturnValue({} as any);

      const result = await EmailTemplateService.duplicateTemplate(
        'template-123',
        'duplicated_template'
      );

      expect(MockedEmailTemplate.createTemplate).toHaveBeenCalledWith({
        name: 'duplicated_template',
        subject: mockTemplate.subject,
        htmlBody: mockTemplate.html_body,
        textBody: mockTemplate.text_body,
        variables: mockTemplate.variables,
      });
      expect(result).toBeDefined();
    });

    it('should return null if original template not found', async () => {
      MockedEmailTemplate.findById.mockResolvedValue(null);

      const result = await EmailTemplateService.duplicateTemplate(
        'template-123',
        'duplicated_template'
      );

      expect(result).toBeNull();
    });
  });

  describe('getDefaultTemplateVariables', () => {
    it('should return default template variables', () => {
      const result = EmailTemplateService.getDefaultTemplateVariables();

      expect(result).toHaveProperty('ticket');
      expect(result).toHaveProperty('customer');
      expect(result).toHaveProperty('company');
      expect(result).toHaveProperty('assignee');
      expect(result).toHaveProperty('system');
      expect(result.ticket).toContain('ticket.id');
      expect(result.customer).toContain('customer.firstName');
    });
  });
});