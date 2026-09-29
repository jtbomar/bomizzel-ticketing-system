import { Router } from 'express';
import { User } from '@/models/User';
import { authenticate } from '@/middleware/auth';
import { UserTable } from '@/types/database';
import { UserService } from '@/services/UserService';
import { requireStaff } from '@/utils/tenant';
import { db } from '@/config/database';

const router = Router();

// The agent, contact and account directories are for a subscriber's staff,
// and show only that subscriber's people and accounts. They were open to any
// signed-in user and listed everyone on the platform.
router.use(authenticate, requireStaff);

/**
 * GET /agents
 * Get all active agents (agents, team leads, admins)
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { teamId, status } = req.query;

    // Get all active users with agent-like roles
    const agentRoles = ['employee', 'team_lead', 'admin'];
    const allAgents: UserTable[] = [];

    // Staff are members of the subscriber company itself.
    const staffIds = db('user_company_associations')
      .select('user_id')
      .where('company_id', req.user!.tenantId);

    // Fetch users for each role
    for (const role of agentRoles) {
      const users = await User.findActiveUsers({ role, idsIn: staffIds });
      allAgents.push(...users);
    }

    // Filter by team if specified
    let filteredAgents = allAgents;
    if (teamId && typeof teamId === 'string') {
      const agentTeams = await Promise.all(
        allAgents.map(async (agent: UserTable) => ({
          agent,
          teams: await User.getUserTeams(agent.id),
        }))
      );

      filteredAgents = agentTeams
        .filter((at: { agent: UserTable; teams: any[] }) =>
          at.teams.some((t: { teamId: string }) => t.teamId === teamId)
        )
        .map((at: { agent: UserTable }) => at.agent);
    }

    // Filter by status (active/inactive) if specified
    if (status && typeof status === 'string') {
      const isActive = status === 'active';
      filteredAgents = filteredAgents.filter((agent: UserTable) => agent.is_active === isActive);
    }

    // Convert to model format
    const agentModels = filteredAgents.map((agent: UserTable) => ({
      ...User.toModel(agent),
      status: agent.is_active ? 'active' : 'inactive',
    }));

    res.json({
      success: true,
      data: agentModels,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /agents/customers
 * Get all customers with their company associations
 */
router.get('/customers', authenticate, async (req, res, next) => {
  try {
    const customers = await UserService.getCustomersWithCompanies(req.user!.tenantId!);

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /agents/accounts
 * Get all companies (accounts)
 */
router.get('/accounts', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query;

    const companies = await UserService.getAllCompanies(
      req.user!.tenantId!,
      status === 'active' ? true : status === 'inactive' ? false : undefined
    );

    res.json({
      success: true,
      data: companies,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
