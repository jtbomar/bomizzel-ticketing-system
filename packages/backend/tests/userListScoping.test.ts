import request from 'supertest';

jest.mock('../src/models/User', () => ({
  User: {
    findById: jest.fn(),
    getUserCompanies: jest.fn().mockResolvedValue([]),
    query: {},
  },
}));

import { app } from '../src/index';
import { User } from '../src/models/User';
import { UserService } from '../src/services/UserService';
import { JWTUtils } from '../src/utils/jwt';

const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

describe('GET /api/users', () => {
  let getUsers: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    (User.findById as jest.Mock).mockResolvedValue({
      id: ADMIN_ID,
      email: 'admin@test.com',
      role: 'admin',
      is_active: true,
      organization_id: null,
    });
    getUsers = jest.spyOn(UserService, 'getUsers').mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
    } as any);
  });

  const asAdmin = () =>
    request(app)
      .get('/api/users')
      .set(
        'Authorization',
        `Bearer ${JWTUtils.generateAccessToken({
          userId: ADMIN_ID,
          email: 'admin@test.com',
          role: 'admin',
        })}`
      );

  it('passes the role filter through to the service', async () => {
    // validate() strips keys the schema does not declare and then replaces
    // req.query, so while the route validated against the bare pagination
    // schema, `role` was removed before the handler could read it - the filter
    // was accepted and silently ignored.
    await asAdmin().query({ role: 'customer' }).expect(200);

    expect(getUsers).toHaveBeenCalledWith(expect.objectContaining({ role: 'customer' }));
  });

  it('passes isActive through as a boolean', async () => {
    await asAdmin().query({ isActive: 'true' }).expect(200);

    expect(getUsers).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });

  it('rejects a role that is not a real role', async () => {
    await asAdmin().query({ role: 'wizard' }).expect(400);

    expect(getUsers).not.toHaveBeenCalled();
  });

  it('still applies pagination defaults', async () => {
    await asAdmin().expect(200);

    expect(getUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 25 }));
  });
});
