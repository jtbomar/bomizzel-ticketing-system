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
      // `variables` is jsonb. node-postgres renders a raw JS array as a
      // Postgres array literal ({a,b,c}), which jsonb rejects with "invalid
      // input syntax for type json", so it has to be stringified - the same
      // thing SubscriptionPlan.createPlan does for `features`.
      //
      // This only started failing once extractVariablesFromContent was fixed:
      // before that it always returned [], and an empty array happens to
      // render as {}, which is valid JSON.
      variables: JSON.stringify(templateData.variables || []),
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
    // jsonb column - see createTemplate above.
    if (updates.variables !== undefined) updateData.variables = JSON.stringify(updates.variables);
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
    // The HTML body is the one place a user-supplied value is interpolated into
    // markup, so it is the one place the value has to be escaped. Subject and
    // text body are plain text - escaping there would just show people &amp;.
    const htmlBody = this.replaceVariables(template.html_body, variables, true);
    const textBody = this.replaceVariables(template.text_body, variables);

    return { subject, htmlBody, textBody };
  }

  private static replaceVariables(
    content: string,
    variables: Record<string, any>,
    escapeHtml = false
  ): string {
    let result = content;

    for (const [key, value] of Object.entries(variables)) {
      // The key goes into a regex, so a name containing regex punctuation would
      // otherwise either throw or match the wrong thing.
      const pattern = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`{{\\s*${pattern}\\s*}}`, 'g');
      const replacement = String(value ?? '');
      result = result.replace(
        regex,
        // Literal replacement: $& and friends in a ticket subject must not be
        // read as replacement patterns.
        () => (escapeHtml ? EmailTemplate.escapeHtml(replacement) : replacement)
      );
    }

    return result;
  }

  private static escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  static async getTemplateVariables(templateId: string): Promise<string[]> {
    const template = await this.findById(templateId);
    return template ? template.variables : [];
  }

  static extractVariablesFromContent(content: string): string[] {
    // `\\s` here meant a literal backslash followed by "s", not whitespace, so
    // the pattern required `{{\...}}` and matched nothing in a real template.
    // Every template was stored with an empty variables list.
    const regex = /{{\s*([^}]+?)\s*}}/g;
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
