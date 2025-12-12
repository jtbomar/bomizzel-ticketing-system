import {
  Department,
  DepartmentTable,
  DepartmentWithAgents,
  DepartmentTicketTemplate,
} from '../models/Department';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
  logo?: string;
  color?: string;
  is_active?: boolean;
  is_default?: boolean;
}

export interface UpdateDepartmentRequest {
  name?: string;
  description?: string;
  logo?: string;
  color?: string;
  is_active?: boolean;
  is_default?: boolean;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  template_fields: any;
  default_values?: any;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  is_active?: boolean;
  is_default?: boolean;
}

export class DepartmentService {
  // Get all departments for a company
  static async getDepartments(companyId: string): Promise<DepartmentWithAgents[]> {
    try {
      return await Department.getByCompany(companyId);
    } catch (error) {
      logger.error('Error fetching departments:', error);
      throw new AppError('Failed to fetch departments', 500, 'FETCH_DEPARTMENTS_FAILED');
    }
  }

  // Get department by ID
  static async getDepartmentById(
    id: number,
    companyId: string
  ): Promise<DepartmentWithAgents | null> {
    try {
      return await Department.getByIdWithAgents(id, companyId);
    } catch (error) {
      logger.error('Error fetching department:', error);
      throw new AppError('Failed to fetch department', 500, 'FETCH_DEPARTMENT_FAILED');
    }
  }

  // Create new department
  static async createDepartment(
    companyId: string,
    data: CreateDepartmentRequest
  ): Promise<DepartmentTable> {
    try {
      // Validate required fields
      if (!data.name?.trim()) {
        throw new AppError('Department name is required', 400, 'INVALID_DEPARTMENT_NAME');
      }

      // Check if department name already exists for this company
      const existingDepartments = await Department.getByCompany(companyId);
      const nameExists = existingDepartments.some(
        (dept) => dept.name.toLowerCase() === data.name.trim().toLowerCase()
      );

      if (nameExists) {
        throw new AppError('Department name already exists', 409, 'DEPARTMENT_NAME_EXISTS');
      }

      const departmentData: Omit<DepartmentTable, 'id' | 'created_at' | 'updated_at'> = {
        company_id: companyId,
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        logo: data.logo || undefined,
        color: data.color || '#3B82F6',
        is_active: data.is_active !== false,
        is_default: data.is_default || false,
      };

      const department = await Department.createDepartment(departmentData);

      logger.info(`Department created: ${department.name}`, {
        departmentId: department.id,
        companyId,
      });

      return department;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error creating department:', error);
      throw new AppError('Failed to create department', 500, 'CREATE_DEPARTMENT_FAILED');
    }
  }

  // Update department
  static async updateDepartment(
    id: number,
    companyId: string,
    data: UpdateDepartmentRequest
  ): Promise<DepartmentTable | null> {
    try {
      // Validate name if provided
      if (data.name !== undefined) {
        if (!data.name?.trim()) {
          throw new AppError('Department name is required', 400, 'INVALID_DEPARTMENT_NAME');
        }

        // Check if name already exists (excluding current department)
        const existingDepartments = await Department.getByCompany(companyId);
        const nameExists = existingDepartments.some(
          (dept) => dept.id !== id && dept.name.toLowerCase() === data.name!.trim().toLowerCase()
        );

        if (nameExists) {
          throw new AppError('Department name already exists', 409, 'DEPARTMENT_NAME_EXISTS');
        }
      }

      const updateData: Partial<
        Omit<DepartmentTable, 'id' | 'company_id' | 'created_at' | 'updated_at'>
      > = {};

      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.description !== undefined)
        updateData.description = data.description?.trim() || undefined;
      if (data.logo !== undefined) updateData.logo = data.logo || undefined;
      if (data.color !== undefined) updateData.color = data.color || '#3B82F6';
      if (data.is_active !== undefined) updateData.is_active = data.is_active;
      if (data.is_default !== undefined) updateData.is_default = data.is_default;

      const updated = await Department.updateDepartment(id, companyId, updateData);

      if (updated) {
        logger.info(`Department updated: ${updated.name}`, {
          departmentId: id,
          companyId,
        });
      }

      return updated;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating department:', error);
      throw new AppError('Failed to update department', 500, 'UPDATE_DEPARTMENT_FAILED');
    }
  }

  // Delete department
  static async deleteDepartment(id: number, companyId: string): Promise<boolean> {
    try {
      const success = await Department.deleteDepartment(id, companyId);

      if (success) {
        logger.info(`Department deleted`, {
          departmentId: id,
          companyId,
        });
      }

      return success;
    } catch (error) {
      if (error instanceof Error && error.message === 'Cannot delete the only department') {
        throw new AppError(
          'Cannot delete the only department',
          400,
          'CANNOT_DELETE_ONLY_DEPARTMENT'
        );
      }
      logger.error('Error deleting department:', error);
      throw new AppError('Failed to delete department', 500, 'DELETE_DEPARTMENT_FAILED');
    }
  }

  // Add agent to department
  static async addAgent(
    departmentId: number,
    companyId: string,
    userId: string,
    role: 'member' | 'lead' | 'manager' = 'member'
  ): Promise<void> {
    try {
      // Verify department exists and belongs to company
      const department = await Department.getByIdWithAgents(departmentId, companyId);
      if (!department) {
        throw new AppError('Department not found', 404, 'DEPARTMENT_NOT_FOUND');
      }

      // Verify user exists and is active
      const user = await User.findById(userId);
      if (!user || !user.is_active) {
        throw new AppError('User not found or inactive', 404, 'USER_NOT_FOUND');
      }

      await Department.addAgent(departmentId, userId, role);

      logger.info(`Agent added to department`, {
        departmentId,
        userId,
        role,
        companyId,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error adding agent to department:', error);
      throw new AppError('Failed to add agent to department', 500, 'ADD_AGENT_FAILED');
    }
  }

  // Remove agent from department
  static async removeAgent(
    departmentId: number,
    companyId: string,
    userId: string
  ): Promise<boolean> {
    try {
      // Verify department exists and belongs to company
      const department = await Department.getByIdWithAgents(departmentId, companyId);
      if (!department) {
        throw new AppError('Department not found', 404, 'DEPARTMENT_NOT_FOUND');
      }

      const success = await Department.removeAgent(departmentId, userId);

      if (success) {
        logger.info(`Agent removed from department`, {
          departmentId,
          userId,
          companyId,
        });
      }

      return success;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error removing agent from department:', error);
      throw new AppError('Failed to remove agent from department', 500, 'REMOVE_AGENT_FAILED');
    }
  }

  // Get user's departments
  static async getUserDepartments(userId: string): Promise<DepartmentTable[]> {
    try {
      return await Department.getUserDepartments(userId);
    } catch (error) {
      logger.error('Error fetching user departments:', error);
      throw new AppError('Failed to fetch user departments', 500, 'FETCH_USER_DEPARTMENTS_FAILED');
    }
  }

  // Get department templates
  static async getDepartmentTemplates(
    departmentId: number,
    companyId: string
  ): Promise<DepartmentTicketTemplate[]> {
    try {
      // Verify department exists and belongs to company
      const department = await Department.getByIdWithAgents(departmentId, companyId);
      if (!department) {
        throw new AppError('Department not found', 404, 'DEPARTMENT_NOT_FOUND');
      }

      return await Department.getTemplates(departmentId);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching department templates:', error);
      throw new AppError('Failed to fetch department templates', 500, 'FETCH_TEMPLATES_FAILED');
    }
  }

  // Create department template
  static async createTemplate(
    departmentId: number,
    companyId: string,
    data: CreateTemplateRequest
  ): Promise<DepartmentTicketTemplate> {
    try {
      // Verify department exists and belongs to company
      const department = await Department.getByIdWithAgents(departmentId, companyId);
      if (!department) {
        throw new AppError('Department not found', 404, 'DEPARTMENT_NOT_FOUND');
      }

      // Validate required fields
      if (!data.name?.trim()) {
        throw new AppError('Template name is required', 400, 'INVALID_TEMPLATE_NAME');
      }

      const templateData: Omit<DepartmentTicketTemplate, 'id' | 'created_at' | 'updated_at'> = {
        department_id: departmentId,
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        template_fields: data.template_fields || {},
        default_values: data.default_values || {},
        priority: data.priority || 'medium',
        category: data.category?.trim() || undefined,
        is_active: data.is_active !== false,
        is_default: data.is_default || false,
      };

      const template = await Department.createTemplate(templateData);

      logger.info(`Department template created: ${template.name}`, {
        templateId: template.id,
        departmentId,
        companyId,
      });

      return template;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error creating department template:', error);
      throw new AppError('Failed to create department template', 500, 'CREATE_TEMPLATE_FAILED');
    }
  }

  // Update department template
  static async updateTemplate(
    templateId: number,
    companyId: string,
    data: Partial<CreateTemplateRequest>
  ): Promise<DepartmentTicketTemplate | null> {
    try {
      // Validate name if provided
      if (data.name !== undefined && !data.name?.trim()) {
        throw new AppError('Template name is required', 400, 'INVALID_TEMPLATE_NAME');
      }

      const updateData: Partial<
        Omit<DepartmentTicketTemplate, 'id' | 'department_id' | 'created_at' | 'updated_at'>
      > = {};

      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.description !== undefined)
        updateData.description = data.description?.trim() || undefined;
      if (data.template_fields !== undefined) updateData.template_fields = data.template_fields;
      if (data.default_values !== undefined) updateData.default_values = data.default_values;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.category !== undefined) updateData.category = data.category?.trim() || undefined;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;
      if (data.is_default !== undefined) updateData.is_default = data.is_default;

      const updated = await Department.updateTemplate(templateId, updateData);

      if (updated) {
        logger.info(`Department template updated: ${updated.name}`, {
          templateId,
          companyId,
        });
      }

      return updated;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating department template:', error);
      throw new AppError('Failed to update department template', 500, 'UPDATE_TEMPLATE_FAILED');
    }
  }

  // Delete department template
  static async deleteTemplate(templateId: number, companyId: string): Promise<boolean> {
    try {
      const success = await Department.deleteTemplate(templateId);

      if (success) {
        logger.info(`Department template deleted`, {
          templateId,
          companyId,
        });
      }

      return success;
    } catch (error) {
      logger.error('Error deleting department template:', error);
      throw new AppError('Failed to delete department template', 500, 'DELETE_TEMPLATE_FAILED');
    }
  }

  // Create default department for a company
  static async createDefaultDepartment(companyId: string): Promise<DepartmentTable> {
    try {
      const defaultData: CreateDepartmentRequest = {
        name: 'General Support',
        description: 'Default department for general support tickets',
        color: '#3B82F6',
        is_active: true,
        is_default: true,
      };

      return await this.createDepartment(companyId, defaultData);
    } catch (error) {
      logger.error('Error creating default department:', error);
      throw new AppError(
        'Failed to create default department',
        500,
        'CREATE_DEFAULT_DEPARTMENT_FAILED'
      );
    }
  }
}
