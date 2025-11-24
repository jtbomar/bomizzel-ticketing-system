import express from 'express';
import { DepartmentService } from '../services/DepartmentService';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const router = express.Router();

// Get all departments for the user's company
router.get('/', authenticate, async (req, res) => {
  try {
    const userRole = req.user!.role;
    
    // For admin/agent/team_lead, get all departments across all companies
    if (['admin', 'employee', 'team_lead'].includes(userRole)) {
      const departments = await db('departments')
        .select('*')
        .orderBy('name');
      return res.json(departments);
    }
    
    // For customers, get departments for their associated company
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;
    const departments = await DepartmentService.getDepartments(companyId);
    
    return res.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Get specific department by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user!.role;
    
    // For admin/agent/team_lead, get department without company restriction
    if (['admin', 'employee', 'team_lead'].includes(userRole)) {
      const department = await db('departments')
        .where('id', parseInt(id))
        .first();
      
      if (!department) {
        return res.status(404).json({ error: 'Department not found' });
      }
      return res.json(department);
    }
    
    // For customers, verify they have access to this department's company
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;
    const department = await DepartmentService.getDepartmentById(parseInt(id), companyId);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    return res.json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    return res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// Create new department (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, display_name, logo, color, is_active, is_default, display_in_help_center, associate_agent } = req.body;

    console.log('Creating department:', { name, user: req.user?.email });

    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    // Get user's company and org from associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    console.log('User company:', userCompany);
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    // Get user's current org - if not set, use the company_id as org_id
    const user = await db('users').where('id', req.user!.id).first();
    let orgId = user.current_org_id;

    console.log('User current_org_id:', orgId);

    // If no org is set, try to get the first organization for this user
    if (!orgId) {
      const userOrg = await db('user_organization_associations')
        .where('user_id', req.user!.id)
        .first();
      
      if (userOrg) {
        orgId = userOrg.org_id;
        // Update user's current_org_id
        await db('users').where('id', req.user!.id).update({ current_org_id: orgId });
        console.log('Set user org_id to:', orgId);
      } else {
        // Fallback: use company_id as org_id (for backwards compatibility)
        orgId = userCompany.company_id;
        console.log('Using company_id as org_id:', orgId);
      }
    }

    const companyId = userCompany.company_id;

    // Create department with org_id
    const departmentData: any = {
      company_id: companyId,
      org_id: orgId,
      name,
      description,
      logo,
      color: color || '#3B82F6',
      is_active: is_active !== false,
      is_default: is_default || false,
    };

    // Only add new fields if they exist in the schema
    const hasDisplayName = await db.schema.hasColumn('departments', 'display_name');
    const hasDisplayInHelpCenter = await db.schema.hasColumn('departments', 'display_in_help_center');
    
    if (hasDisplayName) {
      departmentData.display_name = display_name || name;
    }
    if (hasDisplayInHelpCenter) {
      departmentData.display_in_help_center = display_in_help_center !== false;
    }

    const [department] = await db('departments')
      .insert(departmentData)
      .returning('*');

    console.log('Department created:', department.id);

    // If associate_agent is provided, add them to the department
    if (associate_agent) {
      await db('department_agents').insert({
        department_id: department.id,
        user_id: associate_agent,
        role: 'member',
        is_active: true,
      });
    }

    return res.status(201).json(department);
  } catch (error: any) {
    console.error('Error creating department:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Department name already exists' });
    }
    return res.status(500).json({ error: 'Failed to create department', details: error.message });
  }
});

// Update department (admin only)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;
    const { name, description, logo, color, is_active, is_default } = req.body;

    const department = await DepartmentService.updateDepartment(parseInt(id), companyId, {
      name,
      description,
      logo,
      color,
      is_active,
      is_default,
    });

    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    return res.json(department);
  } catch (error: any) {
    console.error('Error updating department:', error);
    if (error.code === 'DEPARTMENT_NAME_EXISTS') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to update department' });
  }
});

// Delete department (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;
    const success = await DepartmentService.deleteDepartment(parseInt(id), companyId);

    if (!success) {
      return res.status(404).json({ error: 'Department not found' });
    }

    return res.json({ message: 'Department deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting department:', error);
    if (error.code === 'CANNOT_DELETE_ONLY_DEPARTMENT') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to delete department' });
  }
});

// Add agent to department (admin only)
router.post('/:id/agents', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, role = 'member' } = req.body;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!['member', 'lead', 'manager'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be member, lead, or manager' });
    }

    await DepartmentService.addAgent(parseInt(id), companyId, user_id, role);

    return res.json({ message: 'Agent added to department successfully' });
  } catch (error: any) {
    console.error('Error adding agent to department:', error);
    if (error.code === 'DEPARTMENT_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to add agent to department' });
  }
});

// Remove agent from department (admin only)
router.delete('/:id/agents/:userId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id, userId } = req.params;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;
    const success = await DepartmentService.removeAgent(parseInt(id), companyId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Agent assignment not found' });
    }

    return res.json({ message: 'Agent removed from department successfully' });
  } catch (error: any) {
    console.error('Error removing agent from department:', error);
    if (error.code === 'DEPARTMENT_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to remove agent from department' });
  }
});

// Get user's departments
router.get('/user/my-departments', authenticate, async (req, res) => {
  try {
    const departments = await DepartmentService.getUserDepartments(req.user!.id);
    return res.json(departments);
  } catch (error) {
    console.error('Error fetching user departments:', error);
    return res.status(500).json({ error: 'Failed to fetch user departments' });
  }
});

// Get department templates
router.get('/:id/templates', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;
    const templates = await DepartmentService.getDepartmentTemplates(parseInt(id), companyId);
    
    return res.json(templates);
  } catch (error: any) {
    console.error('Error fetching department templates:', error);
    if (error.code === 'DEPARTMENT_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to fetch department templates' });
  }
});

// Create department template (admin only)
router.post('/:id/templates', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;
    const { name, description, template_fields, default_values, priority, category, is_active, is_default } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const template = await DepartmentService.createTemplate(parseInt(id), companyId, {
      name,
      description,
      template_fields,
      default_values,
      priority,
      category,
      is_active,
      is_default,
    });

    return res.status(201).json(template);
  } catch (error: any) {
    console.error('Error creating department template:', error);
    if (error.code === 'DEPARTMENT_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to create department template' });
  }
});

// Update department template (admin only)
router.put('/templates/:templateId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { templateId } = req.params;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;
    const { name, description, template_fields, default_values, priority, category, is_active, is_default } = req.body;

    const template = await DepartmentService.updateTemplate(parseInt(templateId), companyId, {
      name,
      description,
      template_fields,
      default_values,
      priority,
      category,
      is_active,
      is_default,
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    return res.json(template);
  } catch (error) {
    console.error('Error updating department template:', error);
    return res.status(500).json({ error: 'Failed to update department template' });
  }
});

// Delete department template (admin only)
router.delete('/templates/:templateId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { templateId } = req.params;
    
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();
    
    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }
    
    const companyId = userCompany.company_id;
    const success = await DepartmentService.deleteTemplate(parseInt(templateId), companyId);

    if (!success) {
      return res.status(404).json({ error: 'Template not found' });
    }

    return res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting department template:', error);
    return res.status(500).json({ error: 'Failed to delete department template' });
  }
});

export default router;