import { BaseModel } from './BaseModel';
import { db } from '../config/database';

export interface DepartmentTable {
  id: number;
  company_id: string;
  name: string;
  description?: string;
  logo?: string;
  color: string;
  is_active: boolean;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DepartmentAgent {
  id: number;
  department_id: number;
  user_id: string;
  role: 'member' | 'lead' | 'manager';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DepartmentTicketTemplate {
  id: number;
  department_id: number;
  name: string;
  description?: string;
  template_fields: any;
  default_values: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DepartmentWithAgents extends DepartmentTable {
  agents: Array<{
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    department_role: 'member' | 'lead' | 'manager';
    is_active: boolean;
  }>;
  agent_count: number;
  template_count: number;
}

export class Department extends BaseModel {
  protected static tableName = 'departments';

  // Get all departments for a company
  static async getByCompany(companyId: string): Promise<DepartmentWithAgents[]> {
    const departments = await db('departments')
      .where('company_id', companyId)
      .orderBy('is_default', 'desc')
      .orderBy('name', 'asc');

    const departmentsWithDetails = await Promise.all(
      departments.map(async (dept) => {
        // Get agents for this department
        const agents = await db('department_agents')
          .join('users', 'department_agents.user_id', 'users.id')
          .where('department_agents.department_id', dept.id)
          .where('department_agents.is_active', true)
          .select(
            'users.id as user_id',
            'users.first_name',
            'users.last_name',
            'users.email',
            'users.role',
            'department_agents.role as department_role',
            'department_agents.is_active'
          );

        // Get template count
        const templateCount = await db('department_ticket_templates')
          .where('department_id', dept.id)
          .where('is_active', true)
          .count('id as count')
          .first();

        return {
          ...dept,
          agents,
          agent_count: agents.length,
          template_count: parseInt(templateCount?.count as string) || 0,
        };
      })
    );

    return departmentsWithDetails;
  }

  // Get department by ID with agents
  static async getByIdWithAgents(
    id: number,
    companyId: string
  ): Promise<DepartmentWithAgents | null> {
    const department = await db('departments').where({ id, company_id: companyId }).first();

    if (!department) {
      return null;
    }

    const agents = await db('department_agents')
      .join('users', 'department_agents.user_id', 'users.id')
      .where('department_agents.department_id', id)
      .where('department_agents.is_active', true)
      .select(
        'users.id as user_id',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.role',
        'department_agents.role as department_role',
        'department_agents.is_active'
      );

    const templateCount = await db('department_ticket_templates')
      .where('department_id', id)
      .where('is_active', true)
      .count('id as count')
      .first();

    return {
      ...department,
      agents,
      agent_count: agents.length,
      template_count: parseInt(templateCount?.count as string) || 0,
    };
  }

  // Create department
  static async createDepartment(
    data: Omit<DepartmentTable, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DepartmentTable> {
    const trx = await db.transaction();

    try {
      // If this is being set as default, unset other defaults
      if (data.is_default) {
        await trx('departments').where('company_id', data.company_id).update({ is_default: false });
      }

      const [department] = await trx('departments').insert(data).returning('*');

      await trx.commit();
      return department;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Update department
  static async updateDepartment(
    id: number,
    companyId: string,
    data: Partial<Omit<DepartmentTable, 'id' | 'company_id' | 'created_at' | 'updated_at'>>
  ): Promise<DepartmentTable | null> {
    const trx = await db.transaction();

    try {
      // Check if department exists
      const existing = await trx('departments').where({ id, company_id: companyId }).first();

      if (!existing) {
        await trx.rollback();
        return null;
      }

      // If this is being set as default, unset other defaults
      if (data.is_default) {
        await trx('departments')
          .where('company_id', companyId)
          .whereNot('id', id)
          .update({ is_default: false });
      }

      const [updated] = await trx('departments')
        .where({ id, company_id: companyId })
        .update({
          ...data,
          updated_at: new Date(),
        })
        .returning('*');

      await trx.commit();
      return updated;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Delete department
  static async deleteDepartment(id: number, companyId: string): Promise<boolean> {
    const trx = await db.transaction();

    try {
      const existing = await trx('departments').where({ id, company_id: companyId }).first();

      if (!existing) {
        await trx.rollback();
        return false;
      }

      // Don't allow deletion of default department if it's the only one
      if (existing.is_default) {
        const count = await trx('departments')
          .where('company_id', companyId)
          .count('id as total')
          .first();

        if (count && parseInt(count.total as string) === 1) {
          await trx.rollback();
          throw new Error('Cannot delete the only department');
        }

        // Set another department as default
        const nextDefault = await trx('departments')
          .where('company_id', companyId)
          .whereNot('id', id)
          .first();

        if (nextDefault) {
          await trx('departments').where('id', nextDefault.id).update({ is_default: true });
        }
      }

      // Update tickets to remove department association
      await trx('tickets').where('department_id', id).update({ department_id: null });

      // Delete department (cascades will handle agents and templates)
      await trx('departments').where({ id, company_id: companyId }).del();

      await trx.commit();
      return true;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Add agent to department
  static async addAgent(
    departmentId: number,
    userId: string,
    role: 'member' | 'lead' | 'manager' = 'member'
  ): Promise<DepartmentAgent> {
    const [agent] = await db('department_agents')
      .insert({
        department_id: departmentId,
        user_id: userId,
        role,
        is_active: true,
      })
      .returning('*')
      .onConflict(['department_id', 'user_id'])
      .merge({
        role,
        is_active: true,
        updated_at: new Date(),
      });

    return agent;
  }

  // Remove agent from department
  static async removeAgent(departmentId: number, userId: string): Promise<boolean> {
    const deleted = await db('department_agents')
      .where({
        department_id: departmentId,
        user_id: userId,
      })
      .del();

    return deleted > 0;
  }

  // Get departments for a user
  static async getUserDepartments(userId: string): Promise<DepartmentTable[]> {
    return await db('departments')
      .join('department_agents', 'departments.id', 'department_agents.department_id')
      .where('department_agents.user_id', userId)
      .where('department_agents.is_active', true)
      .where('departments.is_active', true)
      .select('departments.*', 'department_agents.role as department_role')
      .orderBy('departments.name', 'asc');
  }

  // Get default department for company
  static async getDefault(companyId: string): Promise<DepartmentTable | null> {
    return await db('departments')
      .where({ company_id: companyId, is_default: true, is_active: true })
      .first();
  }

  // Get department templates
  static async getTemplates(departmentId: number): Promise<DepartmentTicketTemplate[]> {
    return await db('department_ticket_templates')
      .where('department_id', departmentId)
      .where('is_active', true)
      .orderBy('is_default', 'desc')
      .orderBy('name', 'asc');
  }

  // Create department template
  static async createTemplate(
    data: Omit<DepartmentTicketTemplate, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DepartmentTicketTemplate> {
    const trx = await db.transaction();

    try {
      // If this is being set as default, unset other defaults for this department
      if (data.is_default) {
        await trx('department_ticket_templates')
          .where('department_id', data.department_id)
          .update({ is_default: false });
      }

      const [template] = await trx('department_ticket_templates').insert(data).returning('*');

      await trx.commit();
      return template;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Update department template
  static async updateTemplate(
    id: number,
    data: Partial<
      Omit<DepartmentTicketTemplate, 'id' | 'department_id' | 'created_at' | 'updated_at'>
    >
  ): Promise<DepartmentTicketTemplate | null> {
    const trx = await db.transaction();

    try {
      const existing = await trx('department_ticket_templates').where('id', id).first();

      if (!existing) {
        await trx.rollback();
        return null;
      }

      // If this is being set as default, unset other defaults for this department
      if (data.is_default) {
        await trx('department_ticket_templates')
          .where('department_id', existing.department_id)
          .whereNot('id', id)
          .update({ is_default: false });
      }

      const [updated] = await trx('department_ticket_templates')
        .where('id', id)
        .update({
          ...data,
          updated_at: new Date(),
        })
        .returning('*');

      await trx.commit();
      return updated;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Delete department template
  static async deleteTemplate(id: number): Promise<boolean> {
    const deleted = await db('department_ticket_templates').where('id', id).del();

    return deleted > 0;
  }
}
