import { BaseModel } from './BaseModel';
import { CompanyTable } from '@/types/database';
import { Company as CompanyModel } from '@/types/models';

export class Company extends BaseModel {
  protected static tableName = 'companies';

  static async findByDomain(domain: string): Promise<CompanyTable | null> {
    const result = await this.query.where('domain', domain).first();
    return result || null;
  }

  static async findByName(name: string): Promise<CompanyTable | null> {
    const result = await this.query.where('name', name).first();
    return result || null;
  }

  static async createCompany(companyData: {
    name: string;
    domain?: string;
    description?: string;
  }): Promise<CompanyTable> {
    return this.create({
      name: companyData.name,
      domain: companyData.domain,
      description: companyData.description,
    });
  }

  static async findActiveCompanies(options: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): Promise<CompanyTable[]> {
    let query = this.query.where('is_active', true);

    if (options.search) {
      query = query.where(function() {
        this.where('name', 'ilike', `%${options.search}%`)
            .orWhere('domain', 'ilike', `%${options.search}%`);
      });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query.orderBy('name', 'asc');
  }

  static async addUserToCompany(userId: string, companyId: string, role: string = 'member'): Promise<void> {
    await this.db('user_company_associations').insert({
      user_id: userId,
      company_id: companyId,
      role,
    });
  }

  static async removeUserFromCompany(userId: string, companyId: string): Promise<void> {
    await this.db('user_company_associations')
      .where('user_id', userId)
      .where('company_id', companyId)
      .del();
  }

  static async getUserCompanies(userId: string): Promise<CompanyTable[]> {
    return this.db('companies as c')
      .join('user_company_associations as uca', 'c.id', 'uca.company_id')
      .where('uca.user_id', userId)
      .where('c.is_active', true)
      .select('c.*')
      .orderBy('c.name', 'asc');
  }

  static async getCompanyUsers(companyId: string): Promise<any[]> {
    return this.db('users as u')
      .join('user_company_associations as uca', 'u.id', 'uca.user_id')
      .where('uca.company_id', companyId)
      .where('u.is_active', true)
      .select(
        'u.*',
        'uca.role as company_role',
        'uca.created_at as association_created_at'
      )
      .orderBy('u.first_name', 'asc');
  }

  static async isUserInCompany(userId: string, companyId: string): Promise<boolean> {
    const association = await this.db('user_company_associations')
      .where('user_id', userId)
      .where('company_id', companyId)
      .first();
    
    return !!association;
  }

  static async updateUserCompanyRole(userId: string, companyId: string, role: string): Promise<void> {
    await this.db('user_company_associations')
      .where('user_id', userId)
      .where('company_id', companyId)
      .update({ role, updated_at: new Date() });
  }

  // Convert database record to API model
  static toModel(company: CompanyTable): CompanyModel {
    return {
      id: company.id,
      name: company.name,
      domain: company.domain,
      description: company.description,
      isActive: company.is_active,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    };
  }
}