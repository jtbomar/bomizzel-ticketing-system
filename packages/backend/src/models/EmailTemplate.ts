import { BaseModel } from './BaseModel';

export interface EmailTemplateTable {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string;
  variables: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailTemplate extends BaseModel {
  protected static override tableName = 'email_templates';

  static async createTemplate(templateData: {
    name: string;
    subject: string;
    htmlBody: string;
    textBody: string;
    variables?: string[];
  }): Promise<EmailTemplateTable> {
    return this.create({
      name: templateData.name,
      subject: templateData.subject,
      html_body: templateData.htmlBody,
      text_body: templateData.textBody,
      variables: templateData.variables || [],
      is_active: true,
    });
  }

  static async findActiveTemplates(): Promise<EmailTemplateTable[]> {
    return this.query.where('is_active', true).orderBy('name', 'asc');
  }

  static async findByName(name: string): Promise<EmailTemplateTable | null> {
    const result = await this.query.where('name', name).first();
    return result || null;
  }

  static async updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      subject?: string;
      htmlBody?: string;
      textBody?: string;
      variables?: string[];
      isActive?: boolean;
    }
  ): Promise<EmailTemplateTable | null> {
    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.subject !== undefined) updateData.subject = updates.subject;
    if (updates.htmlBody !== undefined) updateData.html_body = updates.htmlBody;
    if (updates.textBody !== undefined) updateData.text_body = updates.textBody;
    if (updates.variables !== undefined) updateData.variables = updates.variables;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    return this.update(templateId, updateData);
  }

  static async deactivateTemplate(templateId: string): Promise<EmailTemplateTable | null> {
    return this.update(templateId, { is_active: false });
  }

  static async renderTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Promise<{ subject: string; htmlBody: string; textBody: string } | null> {
    const template = await this.findById(templateId);
    if (!template || !template.is_active) {
      return null;
    }

    const subject = this.replaceVariables(template.subject, variables);
    const htmlBody = this.replaceVariables(template.html_body, variables);
    const textBody = this.replaceVariables(template.text_body, variables);

    return { subject, htmlBody, textBody };
  }

  private static replaceVariables(content: string, variables: Record<string, any>): string {
    let result = content;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value || ''));
    }

    return result;
  }

  static async getTemplateVariables(templateId: string): Promise<string[]> {
    const template = await this.findById(templateId);
    return template ? template.variables : [];
  }

  static extractVariablesFromContent(content: string): string[] {
    const regex = /{{\\s*([^}]+)\\s*}}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      const variable = match[1].trim();
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables;
  }

  // Convert database record to API model
  static toModel(template: EmailTemplateTable): EmailTemplate {
    return {
      id: template.id,
      name: template.name,
      subject: template.subject,
      htmlBody: template.html_body,
      textBody: template.text_body,
      variables: template.variables,
      isActive: template.is_active,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    };
  }
}
