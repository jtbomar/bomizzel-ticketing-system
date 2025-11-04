import { Company } from '@/models/Company';
import { User } from '@/models/User';
import { EmailService } from '@/services/EmailService';
import { AppError } from '@/middleware/errorHandler';
import { db } from '@/config/database';
import { JWTUtils } from '@/utils/jwt';
import bcrypt from 'bcryptjs';

export interface CompanyRegistrationData {
  // Company basic info
  companyName: string;
  domain?: string;
  description?: string;
  
  // Admin user info
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
  
  // Organization profile
  timezone?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  mobilePhone?: string;
  websiteUrl?: string;
  
  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  
  // Subscription
  subscriptionPlanId?: string;
  startTrial?: boolean;
}

export interface CompanyProfile {
  id: string;
  name: string;
  domain?: string;
  description?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  
  // Contact info
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  mobilePhone?: string;
  websiteUrl?: string;
  
  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  
  // Settings
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  language: string;
  
  // Subscription info
  subscriptionPlanId?: string;
  billingEmail?: string;
  trialEndsAt?: Date;
  isTrial: boolean;
  maxUsers: number;
  maxTicketsPerMonth: number;
  
  // Company settings
  allowPublicRegistration: boolean;
  requireEmailVerification: boolean;
  welcomeMessage?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export class CompanyRegistrationService {
  /**
   * Register a new company with admin user
   */
  static async registerCompany(data: CompanyRegistrationData): Promise<{
    company: CompanyProfile;
    adminUser: any;
    tokens: { token: string; refreshToken?: string };
  }> {
    const trx = await db.transaction();
    
    try {
      // Check if company name or domain already exists
      if (data.domain) {
        const existingCompany = await Company.findByDomain(data.domain);
        if (existingCompany) {
          throw new AppError('Company domain already exists', 400, 'DOMAIN_EXISTS');
        }
      }
      
      const existingCompanyByName = await Company.findByName(data.companyName);
      if (existingCompanyByName) {
        throw new AppError('Company name already exists', 400, 'COMPANY_EXISTS');
      }
      
      // Check if admin email already exists
      const existingUser = await User.findByEmail(data.adminEmail);
      if (existingUser) {
        throw new AppError('Admin email already exists', 400, 'EMAIL_EXISTS');
      }
      
      // Calculate trial end date (30 days from now)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);
      
      // Create company
      const companyData = {
        name: data.companyName,
        domain: data.domain,
        description: data.description,
        
        // Contact info
        primary_contact_name: data.primaryContactName || `${data.adminFirstName} ${data.adminLastName}`,
        primary_contact_email: data.primaryContactEmail || data.adminEmail,
        primary_contact_phone: data.primaryContactPhone,
        mobile_phone: data.mobilePhone,
        website_url: data.websiteUrl,
        
        // Address
        address_line_1: data.addressLine1,
        address_line_2: data.addressLine2,
        city: data.city,
        state_province: data.stateProvince,
        postal_code: data.postalCode,
        country: data.country,
        
        // Settings
        timezone: data.timezone || 'UTC',
        date_format: 'MM/DD/YYYY',
        time_format: '12',
        currency: 'USD',
        language: 'en',
        
        // Subscription
        subscription_plan_id: data.subscriptionPlanId,
        billing_email: data.adminEmail,
        trial_ends_at: trialEndsAt,
        is_trial: data.startTrial !== false,
        max_users: 5,
        max_tickets_per_month: 100,
        
        // Company settings
        allow_public_registration: false,
        require_email_verification: true,
        
        is_active: true,
      };
      
      const company = await trx('companies').insert(companyData).returning('*');
      const createdCompany = company[0];
      
      // Create admin user directly
      const hashedPassword = await bcrypt.hash(data.adminPassword, 12);
      
      const [adminUserRecord] = await trx('users').insert({
        first_name: data.adminFirstName,
        last_name: data.adminLastName,
        email: data.adminEmail,
        password_hash: hashedPassword,
        role: 'admin',
        is_active: true,
        email_verified: true,
      }).returning('*');
      
      // Generate tokens for the admin user
      const tokens = JWTUtils.generateTokenPair({
        userId: adminUserRecord.id,
        email: adminUserRecord.email,
        role: adminUserRecord.role,
      });
      
      const adminUser = {
        user: {
          id: adminUserRecord.id,
          email: adminUserRecord.email,
          firstName: adminUserRecord.first_name,
          lastName: adminUserRecord.last_name,
          role: adminUserRecord.role,
        },
        tokens: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      };
      
      // Associate admin user with company as owner
      await trx('user_company_associations').insert({
        user_id: adminUser.user.id,
        company_id: createdCompany.id,
        role: 'owner',
      });
      
      // Create default team for the company
      await trx('teams').insert({
        name: 'Default Team',
        description: 'Default team for new company',
        company_id: createdCompany.id,
        is_active: true,
      });
      
      // Create default queue for the company
      await trx('queues').insert({
        name: 'General Support',
        description: 'General support queue',
        company_id: createdCompany.id,
        is_active: true,
        sort_order: 1,
      });
      
      await trx.commit();
      
      // Send welcome email
      if (EmailService.isInitialized()) {
        try {
          await EmailService.sendWelcomeEmail(
            data.adminEmail,
            `${data.adminFirstName} ${data.adminLastName}`,
            'Trial Plan',
            ['5 Users', '100 Tickets/Month', '30-Day Trial'],
            true,
            30
          );
        } catch (emailError) {
          console.warn('Failed to send welcome email:', emailError);
        }
      }
      
      return {
        company: this.formatCompanyProfile(createdCompany),
        adminUser: adminUser.user,
        tokens: adminUser.tokens,
      };
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
  
  /**
   * Update company profile
   */
  static async updateCompanyProfile(
    companyId: string,
    updates: Partial<CompanyProfile>,
    userId: string
  ): Promise<CompanyProfile> {
    // Verify user has permission to update company
    const isOwnerOrAdmin = await this.verifyCompanyPermission(userId, companyId, ['owner', 'admin']);
    if (!isOwnerOrAdmin) {
      throw new AppError('Insufficient permissions to update company profile', 403, 'INSUFFICIENT_PERMISSIONS');
    }
    
    const updateData: any = {};
    
    // Map profile fields to database columns
    if (updates.name) updateData.name = updates.name;
    if (updates.domain) updateData.domain = updates.domain;
    if (updates.description) updateData.description = updates.description;
    if (updates.logoUrl) updateData.logo_url = updates.logoUrl;
    if (updates.primaryColor) updateData.primary_color = updates.primaryColor;
    if (updates.secondaryColor) updateData.secondary_color = updates.secondaryColor;
    
    // Contact info
    if (updates.primaryContactName) updateData.primary_contact_name = updates.primaryContactName;
    if (updates.primaryContactEmail) updateData.primary_contact_email = updates.primaryContactEmail;
    if (updates.primaryContactPhone) updateData.primary_contact_phone = updates.primaryContactPhone;
    if (updates.mobilePhone) updateData.mobile_phone = updates.mobilePhone;
    if (updates.websiteUrl) updateData.website_url = updates.websiteUrl;
    
    // Address
    if (updates.addressLine1) updateData.address_line_1 = updates.addressLine1;
    if (updates.addressLine2) updateData.address_line_2 = updates.addressLine2;
    if (updates.city) updateData.city = updates.city;
    if (updates.stateProvince) updateData.state_province = updates.stateProvince;
    if (updates.postalCode) updateData.postal_code = updates.postalCode;
    if (updates.country) updateData.country = updates.country;
    
    // Settings
    if (updates.timezone) updateData.timezone = updates.timezone;
    if (updates.dateFormat) updateData.date_format = updates.dateFormat;
    if (updates.timeFormat) updateData.time_format = updates.timeFormat;
    if (updates.currency) updateData.currency = updates.currency;
    if (updates.language) updateData.language = updates.language;
    
    // Company settings
    if (updates.allowPublicRegistration !== undefined) {
      updateData.allow_public_registration = updates.allowPublicRegistration;
    }
    if (updates.requireEmailVerification !== undefined) {
      updateData.require_email_verification = updates.requireEmailVerification;
    }
    if (updates.welcomeMessage) updateData.welcome_message = updates.welcomeMessage;
    
    updateData.updated_at = new Date();
    
    const [updatedCompany] = await db('companies')
      .where('id', companyId)
      .update(updateData)
      .returning('*');
    
    return this.formatCompanyProfile(updatedCompany);
  }
  
  /**
   * Get user's companies
   */
  static async getUserCompanies(userId: string): Promise<any[]> {
    return db('companies as c')
      .join('user_company_associations as uca', 'c.id', 'uca.company_id')
      .where('uca.user_id', userId)
      .where('c.is_active', true)
      .select('c.*', 'uca.role as company_role')
      .orderBy('c.name', 'asc');
  }

  /**
   * Get company profile
   */
  static async getCompanyProfile(companyId: string): Promise<CompanyProfile> {
    const company = await db('companies').where('id', companyId).first();
    
    if (!company) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }
    
    return this.formatCompanyProfile(company);
  }
  
  /**
   * Verify user has permission for company operations
   */
  private static async verifyCompanyPermission(
    userId: string,
    companyId: string,
    allowedRoles: string[] = ['owner', 'admin']
  ): Promise<boolean> {
    const association = await db('user_company_associations')
      .where('user_id', userId)
      .where('company_id', companyId)
      .first();
    
    return association && allowedRoles.includes(association.role);
  }
  
  /**
   * Format database company record to API model
   */
  private static formatCompanyProfile(company: any): CompanyProfile {
    return {
      id: company.id,
      name: company.name,
      domain: company.domain,
      description: company.description,
      logoUrl: company.logo_url,
      primaryColor: company.primary_color,
      secondaryColor: company.secondary_color,
      
      // Contact info
      primaryContactName: company.primary_contact_name,
      primaryContactEmail: company.primary_contact_email,
      primaryContactPhone: company.primary_contact_phone,
      mobilePhone: company.mobile_phone,
      websiteUrl: company.website_url,
      
      // Address
      addressLine1: company.address_line_1,
      addressLine2: company.address_line_2,
      city: company.city,
      stateProvince: company.state_province,
      postalCode: company.postal_code,
      country: company.country,
      
      // Settings
      timezone: company.timezone || 'UTC',
      dateFormat: company.date_format || 'MM/DD/YYYY',
      timeFormat: company.time_format || '12',
      currency: company.currency || 'USD',
      language: company.language || 'en',
      
      // Subscription info
      subscriptionPlanId: company.subscription_plan_id,
      billingEmail: company.billing_email,
      trialEndsAt: company.trial_ends_at,
      isTrial: company.is_trial,
      maxUsers: company.max_users || 5,
      maxTicketsPerMonth: company.max_tickets_per_month || 100,
      
      // Company settings
      allowPublicRegistration: company.allow_public_registration || false,
      requireEmailVerification: company.require_email_verification !== false,
      welcomeMessage: company.welcome_message,
      
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    };
  }
}