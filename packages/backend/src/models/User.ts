import { BaseModel } from './BaseModel';
import { UserTable } from '@/types/database';
import { User as UserModel, UserCompanyAssociation } from '@/types/models';
import bcrypt from 'bcryptjs';

export class User extends BaseModel {
  protected static tableName = 'users';

  static async findByEmail(email: string): Promise<UserTable | null> {
    const result = await this.query.where('email', email).first();
    return result || null;
  }

  static async findByEmailVerificationToken(token: string): Promise<UserTable | null> {
    const result = await this.query
      .where('email_verification_token', token)
      .where('email_verification_expires_at', '>', new Date())
      .first();
    return result || null;
  }

  static async findByPasswordResetToken(token: string): Promise<UserTable | null> {
    const result = await this.query
      .where('password_reset_token', token)
      .where('password_reset_expires_at', '>', new Date())
      .first();
    return result || null;
  }

  static async createUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: 'customer' | 'agent' | 'team_lead' | 'admin';
  }): Promise<UserTable> {
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    const user = await this.create({
      email: userData.email.toLowerCase(),
      password_hash: hashedPassword,
      first_name: userData.firstName,
      last_name: userData.lastName,
      role: userData.role || 'customer',
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

    return user;
  }

  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.update(userId, {
      password_hash: hashedPassword,
      password_reset_token: null,
      password_reset_expires_at: null,
    });
  }

  static async setEmailVerificationToken(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    await this.update(userId, {
      email_verification_token: token,
      email_verification_expires_at: expiresAt,
    });
  }

  static async verifyEmail(userId: string): Promise<void> {
    await this.update(userId, {
      email_verified: true,
      email_verification_token: null,
      email_verification_expires_at: null,
    });
  }

  static async setPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    await this.update(userId, {
      password_reset_token: token,
      password_reset_expires_at: expiresAt,
    });
  }

  static async findWithCompanies(
    userId: string
  ): Promise<(UserTable & { companies: UserCompanyAssociation[] }) | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    const companies = await this.db('user_company_associations as uca')
      .join('companies as c', 'uca.company_id', 'c.id')
      .where('uca.user_id', userId)
      .select(
        'uca.user_id as userId',
        'uca.company_id as companyId',
        'uca.role',
        'uca.created_at as createdAt',
        'c.id as company.id',
        'c.name as company.name',
        'c.domain as company.domain',
        'c.description as company.description',
        'c.is_active as company.isActive',
        'c.created_at as company.createdAt',
        'c.updated_at as company.updatedAt'
      );

    return {
      ...user,
      companies: companies.map((c) => ({
        userId: c.userId,
        companyId: c.companyId,
        role: c.role,
        createdAt: c.createdAt,
        company: {
          id: c['company.id'],
          name: c['company.name'],
          domain: c['company.domain'],
          description: c['company.description'],
          isActive: c['company.isActive'],
          createdAt: c['company.createdAt'],
          updatedAt: c['company.updatedAt'],
        },
      })),
    };
  }

  static async findActiveUsers(
    options: {
      role?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<UserTable[]> {
    let query = this.query.where('is_active', true);

    if (options.role) {
      query = query.where('role', options.role);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('created_at', 'desc');
  }

  static async getUserCompanies(userId: string): Promise<UserCompanyAssociation[]> {
    const companies = await this.db('user_company_associations as uca')
      .join('companies as c', 'uca.company_id', 'c.id')
      .where('uca.user_id', userId)
      .select(
        'uca.user_id as userId',
        'uca.company_id as companyId',
        'uca.role',
        'uca.created_at as createdAt',
        'c.id as company_id',
        'c.name as company_name',
        'c.domain as company_domain',
        'c.description as company_description',
        'c.is_active as company_is_active',
        'c.created_at as company_created_at',
        'c.updated_at as company_updated_at'
      );

    return companies.map((c) => ({
      userId: c.userId,
      companyId: c.companyId,
      role: c.role,
      createdAt: c.createdAt,
      company: {
        id: c.company_id,
        name: c.company_name,
        domain: c.company_domain,
        description: c.company_description,
        isActive: c.company_is_active,
        createdAt: c.company_created_at,
        updatedAt: c.company_updated_at,
      },
    }));
  }

  static async getUserTeams(
    userId: string
  ): Promise<{ userId: string; teamId: string; role: string; createdAt: Date }[]> {
    const teams = await this.db('team_memberships')
      .where('user_id', userId)
      .select('user_id as userId', 'team_id as teamId', 'role', 'created_at as createdAt');

    return teams;
  }

  // Convert database record to API model
  static toModel(user: UserTable): UserModel {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: user.is_active,
      emailVerified: user.email_verified,
      preferences: user.preferences,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}
