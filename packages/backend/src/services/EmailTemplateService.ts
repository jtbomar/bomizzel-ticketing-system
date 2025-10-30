import { EmailTemplate } from '@/models/EmailTemplate';
import { EmailTemplate as EmailTemplateModel } from '@/types/models';

export interface CreateEmailTemplateRequest {
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables?: string[];
}

export interface UpdateEmailTemplateRequest {
  name?: string;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  variables?: string[];
  isActive?: boolean;
}

export class EmailTemplateService {
  static async createTemplate(templateData: CreateEmailTemplateRequest): Promise<EmailTemplateModel> {
    // Extract variables from content if not provided
    const extractedVariables = [
      ...EmailTemplate.extractVariablesFromContent(templateData.subject),
      ...EmailTemplate.extractVariablesFromContent(templateData.htmlBody),
      ...EmailTemplate.extractVariablesFromContent(templateData.textBody),
    ];

    const uniqueVariables = [...new Set(extractedVariables)];
    const variables = templateData.variables || uniqueVariables;

    const template = await EmailTemplate.createTemplate({
      name: templateData.name,
      subject: templateData.subject,
      htmlBody: templateData.htmlBody,
      textBody: templateData.textBody,
      variables,
    });

    return EmailTemplate.toModel(template);
  }

  static async getTemplateById(templateId: string): Promise<EmailTemplateModel | null> {
    const template = await EmailTemplate.findById(templateId);
    return template ? EmailTemplate.toModel(template) : null;
  }

  static async getTemplateByName(name: string): Promise<EmailTemplateModel | null> {
    const template = await EmailTemplate.findByName(name);
    return template ? EmailTemplate.toModel(template) : null;
  }

  static async getAllTemplates(): Promise<EmailTemplateModel[]> {
    const templates = await EmailTemplate.findAll({
      orderBy: 'name',
      orderDirection: 'asc',
    });
    return templates.map(template => EmailTemplate.toModel(template));
  }

  static async getActiveTemplates(): Promise<EmailTemplateModel[]> {
    const templates = await EmailTemplate.findActiveTemplates();
    return templates.map(template => EmailTemplate.toModel(template));
  }

  static async updateTemplate(
    templateId: string,
    updates: UpdateEmailTemplateRequest
  ): Promise<EmailTemplateModel | null> {
    // Extract variables from updated content if content is being updated
    let variables = updates.variables;
    
    if (!variables && (updates.subject || updates.htmlBody || updates.textBody)) {
      const currentTemplate = await EmailTemplate.findById(templateId);
      if (currentTemplate) {
        const subject = updates.subject || currentTemplate.subject;
        const htmlBody = updates.htmlBody || currentTemplate.html_body;
        const textBody = updates.textBody || currentTemplate.text_body;

        const extractedVariables = [
          ...EmailTemplate.extractVariablesFromContent(subject),
          ...EmailTemplate.extractVariablesFromContent(htmlBody),
          ...EmailTemplate.extractVariablesFromContent(textBody),
        ];

        variables = [...new Set(extractedVariables)];
      }
    }

    const updateData: any = { ...updates };
    if (variables) {
      updateData.variables = variables;
    }
    
    const template = await EmailTemplate.updateTemplate(templateId, updateData);

    return template ? EmailTemplate.toModel(template) : null;
  }

  static async deleteTemplate(templateId: string): Promise<boolean> {
    return EmailTemplate.delete(templateId);
  }

  static async deactivateTemplate(templateId: string): Promise<EmailTemplateModel | null> {
    const template = await EmailTemplate.deactivateTemplate(templateId);
    return template ? EmailTemplate.toModel(template) : null;
  }

  static async renderTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Promise<{ subject: string; htmlBody: string; textBody: string } | null> {
    return EmailTemplate.renderTemplate(templateId, variables);
  }

  static async renderTemplateByName(
    templateName: string,
    variables: Record<string, any>
  ): Promise<{ subject: string; htmlBody: string; textBody: string } | null> {
    const template = await EmailTemplate.findByName(templateName);
    if (!template) {
      return null;
    }

    return EmailTemplate.renderTemplate(template.id, variables);
  }

  static async getTemplateVariables(templateId: string): Promise<string[]> {
    return EmailTemplate.getTemplateVariables(templateId);
  }

  static async validateTemplate(templateData: {
    subject: string;
    htmlBody: string;
    textBody: string;
  }): Promise<{
    isValid: boolean;
    errors: string[];
    variables: string[];
  }> {
    const errors: string[] = [];
    
    // Basic validation
    if (!templateData.subject.trim()) {
      errors.push('Subject is required');
    }
    
    if (!templateData.htmlBody.trim() && !templateData.textBody.trim()) {
      errors.push('Either HTML body or text body is required');
    }

    // Extract and validate variables
    const variables = [
      ...EmailTemplate.extractVariablesFromContent(templateData.subject),
      ...EmailTemplate.extractVariablesFromContent(templateData.htmlBody),
      ...EmailTemplate.extractVariablesFromContent(templateData.textBody),
    ];

    const uniqueVariables = [...new Set(variables)];

    // Check for malformed variables
    const malformedVariables = uniqueVariables.filter(variable => 
      !variable.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    );

    if (malformedVariables.length > 0) {
      errors.push(`Invalid variable names: ${malformedVariables.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      variables: uniqueVariables,
    };
  }

  static async duplicateTemplate(
    templateId: string,
    newName: string
  ): Promise<EmailTemplateModel | null> {
    const originalTemplate = await EmailTemplate.findById(templateId);
    if (!originalTemplate) {
      return null;
    }

    const duplicatedTemplate = await EmailTemplate.createTemplate({
      name: newName,
      subject: originalTemplate.subject,
      htmlBody: originalTemplate.html_body,
      textBody: originalTemplate.text_body,
      variables: originalTemplate.variables,
    });

    return EmailTemplate.toModel(duplicatedTemplate);
  }

  static getDefaultTemplateVariables(): Record<string, string[]> {
    return {
      ticket: [
        'ticket.id',
        'ticket.title',
        'ticket.description',
        'ticket.status',
        'ticket.priority',
        'ticket.createdAt',
        'ticket.updatedAt',
      ],
      customer: [
        'customer.firstName',
        'customer.lastName',
        'customer.email',
        'customer.fullName',
      ],
      company: [
        'company.name',
        'company.domain',
      ],
      assignee: [
        'assignee.firstName',
        'assignee.lastName',
        'assignee.email',
        'assignee.fullName',
      ],
      system: [
        'system.baseUrl',
        'system.supportEmail',
        'system.currentDate',
        'system.currentTime',
      ],
    };
  }
}