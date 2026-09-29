import { CustomerSubscription } from '@/models/CustomerSubscription';
import { SubscriptionPlan } from '@/models/SubscriptionPlan';
import { Company } from '@/models/Company';
import { User } from '@/models/User';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface CustomSubscriptionLimits {
  maxUsers?: number;
  maxActiveTickets?: number;
  maxCompletedTickets?: number;
  maxTotalTickets?: number;
  storageQuotaGB?: number;
  maxAttachmentSizeMB?: number;
  maxCustomFields?: number;
  maxQueues?: number;
}

export interface ProvisionCustomerRequest {
  companyName: string;
  companyDomain?: string;
  companyDescription?: string;

  // Primary contact/admin user
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPhone?: string;

  // Subscription details
  planId?: string; // Use existing plan or custom
  customLimits?: CustomSubscriptionLimits;
  customPricing?: {
    monthlyPrice?: number;
    annualPrice?: number;
    setupFee?: number;
  };

  // Billing
  billingCycle?: 'monthly' | 'annual';
  trialDays?: number;
  startDate?: Date;

  // Additional settings
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ProvisioningResult {
  success: boolean;
  company: {
    id: string;
    name: string;
  };
  adminUser: {
    id: string;
    email: string;
    temporaryPassword?: string;
  };
  subscription: {
    id: string;
    planName: string;
    limits: CustomSubscriptionLimits;
    status: string;
  };
  message: string;
}

export class AdminProvisioningService {
  /**
   * Provision a new customer with company, admin user, and custom subscription
   */
  static async provisionCustomer(
    request: ProvisionCustomerRequest,
    provisionedBy: string
  ): Promise<ProvisioningResult> {
    try {
      logger.info('Starting customer provisioning', {
        companyName: request.companyName,
        adminEmail: request.adminEmail,
        provisionedBy,
      });

      // 1. Check if company already exists
      const existingCompany = await Company.findByName(request.companyName);
      if (existingCompany) {
        throw new AppError('Company with this name already exists', 400);
      }

      // 2. Check if admin user already exists
      const existingUser = await User.findByEmail(request.adminEmail);
      if (existingUser) {
        throw new AppError('User with this email already exists', 400);
      }

      // 3. Create company
      const company = await Company.create({
        name: request.companyName,
        domain: request.companyDomain,
        description: request.companyDescription,
        is_active: true,
      });

      // 4. Generate temporary password for admin
      const temporaryPassword = this.generateTemporaryPassword();
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

      // 5. Create admin user
      const adminUser = await User.create({
        email: request.adminEmail.toLowerCase(),
        password_hash: hashedPassword,
        first_name: request.adminFirstName,
        last_name: request.adminLastName,
        role: 'admin',
        is_active: true,
        email_verified: true, // Auto-verify for provisioned accounts
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            browser: true,
            ticketAssigned: true,
            ticketUpdated: true,
            ticketResolved: true,
          },
          dashboard: {
            defaultView: 'kanban',
            ticketsPerPage: 25,
          },
        },
      });

      // 6. Associate admin with company
      await Company.addUserToCompany(adminUser.id, company.id, 'admin');

      // 7. Create subscription with custom limits
      const subscription = await this.createCustomSubscription(
        company.id,
        adminUser.id,
        request,
        provisionedBy
      );

      // 8. Send welcome email with credentials
      await this.sendProvisioningEmail(adminUser, company, temporaryPassword);

      logger.info('Customer provisioning completed', {
        companyId: company.id,
        adminUserId: adminUser.id,
        subscriptionId: subscription.id,
      });

      return {
        success: true,
        company: {
          id: company.id,
          name: company.name,
        },
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
          temporaryPassword,
        },
        subscription: {
          id: subscription.id,
          planName: subscription.planName,
          limits: subscription.limits,
          status: subscription.status,
        },
        message: 'Customer provisioned successfully',
      };
    } catch (error) {
      logger.error('Customer provisioning failed', { error, request });
      throw error;
    }
  }

  /**
   * Create custom subscription with specific limits
   */
  private static async createCustomSubscription(
    companyId: string,
    userId: string,
    request: ProvisionCustomerRequest,
    provisionedBy: string
  ) {
    let plan;
    let limits: CustomSubscriptionLimits;

    if (request.planId) {
      // Use existing plan as base
      plan = await SubscriptionPlan.findById(request.planId);
      if (!plan) {
        throw new AppError('Subscription plan not found', 404);
      }

      // Merge plan limits with custom limits
      limits = {
        maxUsers: request.customLimits?.maxUsers ?? plan.limits?.maxUsers ?? 100,
        maxActiveTickets:
          request.customLimits?.maxActiveTickets ?? plan.limits?.maxActiveTickets ?? 1000,
        maxCompletedTickets:
          request.customLimits?.maxCompletedTickets ?? plan.limits?.maxCompletedTickets ?? 5000,
        maxTotalTickets:
          request.customLimits?.maxTotalTickets ?? plan.limits?.maxTotalTickets ?? 10000,
        storageQuotaGB: request.customLimits?.storageQuotaGB ?? plan.limits?.storageQuotaGB ?? 100,
        maxAttachmentSizeMB:
          request.customLimits?.maxAttachmentSizeMB ?? plan.limits?.maxAttachmentSizeMB ?? 25,
        maxCustomFields:
          request.customLimits?.maxCustomFields ?? plan.limits?.maxCustomFields ?? 50,
        maxQueues: request.customLimits?.maxQueues ?? plan.limits?.maxQueues ?? 20,
      };
    } else {
      // Create fully custom subscription
      limits = request.customLimits || {
        maxUsers: 100,
        maxActiveTickets: 1000,
        maxCompletedTickets: 5000,
        maxTotalTickets: 10000,
        storageQuotaGB: 100,
        maxAttachmentSizeMB: 25,
        maxCustomFields: 50,
        maxQueues: 20,
      };
    }

    const now = new Date();
    const startDate = request.startDate || now;
    const trialEndDate = request.trialDays
      ? new Date(startDate.getTime() + request.trialDays * 24 * 60 * 60 * 1000)
      : null;

    const currentPeriodEnd = new Date(startDate);
    currentPeriodEnd.setMonth(
      currentPeriodEnd.getMonth() + (request.billingCycle === 'annual' ? 12 : 1)
    );

    const subscription = await CustomerSubscription.create({
      user_id: userId,
      company_id: companyId,
      plan_id: request.planId || 'ec16f41b-6991-4562-a8f1-9cdd519049bf', // Default to Enterprise plan
      status: request.trialDays ? 'trial' : 'active',
      current_period_start: startDate,
      current_period_end: currentPeriodEnd,
      trial_end: trialEndDate,
      cancel_at_period_end: false,
      limits: JSON.stringify(limits),
      custom_pricing: request.customPricing ? JSON.stringify(request.customPricing) : null,
      billing_cycle: request.billingCycle || 'monthly',
      is_custom: true,
      provisioned_by: provisionedBy,
      notes: request.notes,
      metadata: request.metadata ? JSON.stringify(request.metadata) : null,
    });

    return {
      id: subscription.id,
      planName: plan?.name || 'Custom Plan',
      limits,
      status: subscription.status,
    };
  }

  /**
   * Update subscription limits for existing customer
   */
  static async updateSubscriptionLimits(
    subscriptionId: string,
    newLimits: CustomSubscriptionLimits,
    updatedBy: string,
    reason?: string
  ) {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      const currentLimits = subscription.limits ? JSON.parse(subscription.limits) : {};
      const updatedLimits = { ...currentLimits, ...newLimits };

      await CustomerSubscription.update(subscriptionId, {
        limits: JSON.stringify(updatedLimits),
        updated_by: updatedBy,
        updated_at: new Date(),
      });

      logger.info('Subscription limits updated', {
        subscriptionId,
        previousLimits: currentLimits,
        newLimits: updatedLimits,
        updatedBy,
        reason,
      });

      return {
        success: true,
        subscriptionId,
        limits: updatedLimits,
        message: 'Subscription limits updated successfully',
      };
    } catch (error) {
      logger.error('Failed to update subscription limits', { error, subscriptionId });
      throw error;
    }
  }

  /**
   * Every subscriber on the platform: companies that signed up at bomizzel.com
   * and companies provisioned here. A subscriber's own accounts (their
   * customers' companies) are not included.
   *
   * Subscribers and accounts are both rows in `companies`. A company counts as
   * a subscriber when it has an owner/admin who is staff (not a customer
   * contact), or when it has a provisioned (is_custom) subscription. Sign-ups
   * don't create a subscription row, so those fields come from the company.
   */
  static async getProvisionedCustomers(
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {}
  ) {
    try {
      const db = CustomerSubscription.db;
      const rows = await db
        .select(
          'c.id as company_id',
          'c.name as company_name',
          'c.domain',
          'c.is_active',
          'c.is_trial',
          'c.trial_ends_at',
          'c.max_users',
          'c.max_tickets_per_month',
          'c.created_at',
          'cs.id as subscription_id',
          'cs.status as subscription_status',
          'cs.limits',
          'cs.current_period_start',
          'cs.current_period_end',
          'adm.id as admin_id',
          'adm.email as admin_email',
          'adm.first_name',
          'adm.last_name',
          db.raw(
            `(SELECT count(*) FROM user_company_associations a
                JOIN users u ON u.id = a.user_id
               WHERE a.company_id = c.id AND u.role <> 'customer')::int AS staff_count`
          )
        )
        .from('companies as c')
        .joinRaw(
          `LEFT JOIN LATERAL (
             SELECT * FROM customer_subscriptions s
              WHERE s.company_id = c.id AND s.is_custom = true
              ORDER BY s.created_at DESC LIMIT 1
           ) cs ON true`
        )
        .joinRaw(
          `LEFT JOIN LATERAL (
             SELECT u.* FROM user_company_associations a
               JOIN users u ON u.id = a.user_id
              WHERE a.company_id = c.id
                AND a.role IN ('owner', 'admin')
                AND u.role IN ('admin', 'employee', 'team_lead')
              ORDER BY (a.role = 'owner') DESC, a.created_at ASC LIMIT 1
           ) adm ON true`
        )
        .where((q) => q.whereNotNull('adm.id').orWhereNotNull('cs.id'))
        .orderBy('c.created_at', 'desc')
        .limit(options.limit || 50)
        .offset(options.offset || 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const customers = rows.map((row: any) => {
        let status: string = row.subscription_status;
        if (!status) {
          if (!row.is_active) status = 'suspended';
          else if (row.is_trial) {
            status =
              row.trial_ends_at && new Date(row.trial_ends_at) < today ? 'trial_expired' : 'trial';
          } else status = 'active';
        }

        return {
          subscriptionId: row.subscription_id || null,
          source: row.subscription_id ? 'provisioned' : 'signup',
          status,
          limits: row.limits || {
            maxUsers: row.max_users,
            maxActiveTickets: row.max_tickets_per_month,
            storageQuotaGB: null,
          },
          currentPeriod: {
            start: row.current_period_start || row.created_at,
            end: row.current_period_end || row.trial_ends_at || null,
          },
          company: {
            id: row.company_id,
            name: row.company_name,
            domain: row.domain,
          },
          admin: row.admin_id
            ? {
                id: row.admin_id,
                email: row.admin_email,
                name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
              }
            : null,
          staffCount: row.staff_count,
          createdAt: row.created_at,
        };
      });

      return options.status ? customers.filter((c) => c.status === options.status) : customers;
    } catch (error) {
      console.error('Failed to get provisioned customers - DETAILED ERROR:', error);
      logger.error('Failed to get provisioned customers', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Generate a secure temporary password
   */
  private static generateTemporaryPassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * Send provisioning email with credentials
   */
  private static async sendProvisioningEmail(user: any, company: any, temporaryPassword: string) {
    try {
      const EmailService = require('./EmailService').EmailService;

      const htmlBody = `
        <h2>Welcome to Bomizzel Ticketing System!</h2>
        <p>Hi ${user.first_name},</p>
        <p>Your company <strong>${company.name}</strong> has been provisioned with Bomizzel Ticketing System.</p>
        <p>You have been set up as the administrator for your company account.</p>
        
        <h3>Your Login Credentials:</h3>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
        
        <p><strong>Important:</strong> Please change your password immediately after your first login.</p>
        
        <p><a href="${process.env.FRONTEND_URL}/login">Login to Your Account</a></p>
        
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>The Bomizzel Team</p>
      `;

      const textBody = `
        Welcome to Bomizzel Ticketing System!
        
        Hi ${user.first_name},
        
        Your company ${company.name} has been provisioned with Bomizzel Ticketing System.
        You have been set up as the administrator for your company account.
        
        Your Login Credentials:
        Email: ${user.email}
        Temporary Password: ${temporaryPassword}
        
        Important: Please change your password immediately after your first login.
        
        Login at: ${process.env.FRONTEND_URL}/login
        
        If you have any questions, please contact our support team.
        
        Best regards,
        The Bomizzel Team
      `;

      await EmailService.sendNotificationEmail(
        [user.email],
        'Welcome to Bomizzel - Your Account is Ready',
        htmlBody,
        textBody,
        { type: 'customer_provisioning', userId: user.id, companyId: company.id }
      );
    } catch (error) {
      logger.error('Failed to send provisioning email', { error, userId: user.id });
      // Don't throw - provisioning should succeed even if email fails
    }
  }

  /**
   * Disable a customer (blocks all users from using the system)
   */
  static async disableCustomer(subscriptionId: string, disabledBy: string, reason?: string) {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      // Update subscription to suspended status
      await CustomerSubscription.update(subscriptionId, {
        status: 'suspended',
        updated_at: new Date(),
      });

      // Deactivate the company
      if (subscription.company_id) {
        await Company.update(subscription.company_id, {
          is_active: false,
          updated_at: new Date(),
        });
      }

      // Deactivate all users in the company
      if (subscription.company_id) {
        await User.db('users as u')
          .join('user_company_associations as uca', 'u.id', 'uca.user_id')
          .where('uca.company_id', subscription.company_id)
          .update({ is_active: false, updated_at: new Date() });
      }

      logger.info('Customer disabled', {
        subscriptionId,
        companyId: subscription.company_id,
        disabledBy,
        reason,
      });

      return {
        success: true,
        message:
          'Customer disabled successfully. All users have been blocked from accessing the system.',
        subscriptionId,
      };
    } catch (error) {
      logger.error('Failed to disable customer', { error, subscriptionId });
      throw error;
    }
  }

  /**
   * Enable a customer (allows users to use the system again)
   */
  static async enableCustomer(subscriptionId: string, enabledBy: string, reason?: string) {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      // Update subscription to active status
      await CustomerSubscription.update(subscriptionId, {
        status: 'active',
        updated_at: new Date(),
      });

      // Reactivate the company
      if (subscription.company_id) {
        await Company.update(subscription.company_id, {
          is_active: true,
          updated_at: new Date(),
        });
      }

      // Reactivate all users in the company
      if (subscription.company_id) {
        await User.db('users as u')
          .join('user_company_associations as uca', 'u.id', 'uca.user_id')
          .where('uca.company_id', subscription.company_id)
          .update({ is_active: true, updated_at: new Date() });
      }

      logger.info('Customer enabled', {
        subscriptionId,
        companyId: subscription.company_id,
        enabledBy,
        reason,
      });

      return {
        success: true,
        message: 'Customer enabled successfully. All users can now access the system.',
        subscriptionId,
      };
    } catch (error) {
      logger.error('Failed to enable customer', { error, subscriptionId });
      throw error;
    }
  }

  /**
   * Delete a customer (permanently removes company, users, and all data)
   */
  static async deleteCustomer(subscriptionId: string, deletedBy: string, reason?: string) {
    try {
      const subscription = await CustomerSubscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      const companyId = subscription.company_id;

      // Delete subscription
      await CustomerSubscription.delete(subscriptionId);

      // Delete company (cascade will handle user associations and tickets)
      if (companyId) {
        await Company.delete(companyId);
      }

      logger.info('Customer deleted', {
        subscriptionId,
        companyId,
        deletedBy,
        reason,
      });

      return {
        success: true,
        message: 'Customer deleted successfully. All data has been permanently removed.',
        subscriptionId,
      };
    } catch (error) {
      logger.error('Failed to delete customer', { error, subscriptionId });
      throw error;
    }
  }
}
