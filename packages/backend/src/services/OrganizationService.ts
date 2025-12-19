import { db } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface UserOrganization {
  id: string;
  name: string;
  logoUrl?: string;
  role: string;
  isDefault: boolean;
  lastAccessedAt?: Date;
}

export class OrganizationService {
  /**
   * Get all organizations a user has access to
   */
  static async getUserOrganizations(userId: string): Promise<UserOrganization[]> {
    const orgs = await db('companies as c')
      .join('user_company_associations as uca', 'c.id', 'uca.company_id')
      .where('uca.user_id', userId)
      .where('c.is_active', true)
      .select(
        'c.id',
        'c.name',
        'c.logo_url as logoUrl',
        'uca.role',
        'uca.is_default as isDefault',
        'uca.last_accessed_at as lastAccessedAt'
      )
      .orderBy('uca.last_accessed_at', 'desc');

    return orgs;
  }

  /**
   * Set user's default organization
   */
  static async setDefaultOrganization(userId: string, orgId: string): Promise<void> {
    // Verify user has access to this org
    const association = await db('user_company_associations')
      .where('user_id', userId)
      .where('company_id', orgId)
      .first();

    if (!association) {
      throw new AppError('Access denied to this organization', 403, 'ORG_ACCESS_DENIED');
    }

    // Remove default from all user's orgs
    await db('user_company_associations').where('user_id', userId).update({ is_default: false });

    // Set new default
    await db('user_company_associations')
      .where('user_id', userId)
      .where('company_id', orgId)
      .update({
        is_default: true,
        last_accessed_at: db.fn.now(),
      });

    // Update user's current_org_id
    await db('users').where('id', userId).update({ current_org_id: orgId });
  }

  /**
   * Get user's default organization
   */
  static async getDefaultOrganization(userId: string): Promise<UserOrganization | null> {
    // Try to get default org
    let org = await db('companies as c')
      .join('user_company_associations as uca', 'c.id', 'uca.company_id')
      .where('uca.user_id', userId)
      .where('uca.is_default', true)
      .where('c.is_active', true)
      .select(
        'c.id',
        'c.name',
        'c.logo_url as logoUrl',
        'uca.role',
        'uca.is_default as isDefault',
        'uca.last_accessed_at as lastAccessedAt'
      )
      .first();

    // If no default, return most recently accessed
    if (!org) {
      org = await db('companies as c')
        .join('user_company_associations as uca', 'c.id', 'uca.company_id')
        .where('uca.user_id', userId)
        .where('c.is_active', true)
        .select(
          'c.id',
          'c.name',
          'c.logo_url as logoUrl',
          'uca.role',
          'uca.is_default as isDefault',
          'uca.last_accessed_at as lastAccessedAt'
        )
        .orderBy('uca.last_accessed_at', 'desc')
        .first();
    }

    return org || null;
  }

  /**
   * Get organization details (checks both organizations and companies tables)
   */
  static async getOrganization(orgId: string): Promise<any> {
    // First try organizations table
    let org = await db('organizations').where('id', orgId).where('is_active', true).first();
    
    if (org) {
      const settings = org.settings || {};
      return {
        id: org.id,
        name: org.name,
        logoUrl: org.logo_url,
        description: org.description,
        websiteUrl: settings.websiteUrl,
        domain: org.domain,
        settings: settings,
        createdAt: org.created_at,
        updatedAt: org.updated_at,
      };
    }

    // Fallback to companies table for backward compatibility
    org = await db('companies').where('id', orgId).where('is_active', true).first();

    if (!org) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    return {
      id: org.id,
      name: org.name,
      logoUrl: org.logo_url,
      description: org.description,
      websiteUrl: org.website_url,
      domain: org.domain,
      timezone: org.timezone,
      dateFormat: org.date_format,
      timeFormat: org.time_format,
      currency: org.currency,
      language: org.language,
    };
  }

  /**
   * Update organization details
   */
  static async updateOrganization(orgId: string, updateData: any): Promise<any> {
    // First try organizations table
    const orgExists = await db('organizations').where('id', orgId).first();
    
    if (orgExists) {
      const updateFields: any = {
        updated_at: db.fn.now(),
      };

      if (updateData.name) updateFields.name = updateData.name;
      if (updateData.description) updateFields.description = updateData.description;
      if (updateData.domain) updateFields.domain = updateData.domain;
      if (updateData.logoUrl) updateFields.logo_url = updateData.logoUrl;
      
      // Handle settings (including websiteUrl)
      if (updateData.websiteUrl || updateData.settings) {
        const currentSettings = orgExists.settings || {};
        const newSettings = { ...currentSettings };
        
        if (updateData.websiteUrl) {
          newSettings.websiteUrl = updateData.websiteUrl;
        }
        
        if (updateData.settings) {
          Object.assign(newSettings, updateData.settings);
        }
        
        updateFields.settings = newSettings;
      }

      await db('organizations').where('id', orgId).update(updateFields);
      
      return this.getOrganization(orgId);
    }

    // Fallback to companies table
    const companyExists = await db('companies').where('id', orgId).first();
    
    if (!companyExists) {
      throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
    }

    const updateFields: any = {
      updated_at: db.fn.now(),
    };

    if (updateData.name) updateFields.name = updateData.name;
    if (updateData.description) updateFields.description = updateData.description;
    if (updateData.websiteUrl) updateFields.website_url = updateData.websiteUrl;
    if (updateData.domain) updateFields.domain = updateData.domain;
    if (updateData.logoUrl) updateFields.logo_url = updateData.logoUrl;

    await db('companies').where('id', orgId).update(updateFields);
    
    return this.getOrganization(orgId);
  }

  /**
   * Check if user has access to organization
   */
  static async hasAccess(userId: string, orgId: string): Promise<boolean> {
    const association = await db('user_company_associations')
      .where('user_id', userId)
      .where('company_id', orgId)
      .first();

    return !!association;
  }

  /**
   * Get user's role in organization
   */
  static async getUserRole(userId: string, orgId: string): Promise<string | null> {
    const association = await db('user_company_associations')
      .where('user_id', userId)
      .where('company_id', orgId)
      .first();

    return association?.role || null;
  }
}
