import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
// Restart trigger

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://192.168.0.117:3000',
    /^http:\/\/192\.168\.0\.\d+:3000$/
  ],
  credentials: true,
}));
app.use(express.json());


// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'bomizzel-backend'
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    message: 'Bomizzel API is running',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to debug
app.get('/api/test', (_req: Request, res: Response) => {
  res.json({ message: 'Test endpoint working' });
});

// Mock user data (from database seeds)
const users = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'admin@bomizzel.com',
    password: 'password123', // In real app, this would be hashed
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'john.doe@customer.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe',
    role: 'customer'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    email: 'jane.smith@bomizzel.com',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'user'
  }
];

// Login endpoint
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password (in real app, compare with hashed password)
    if (password !== user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );
    
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user endpoint
app.get('/api/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    return res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Mock tickets data with more realistic priorities
let mockTickets = [
  {
    id: 'bb0e8400-e29b-41d4-a716-446655440001',
    title: 'Login page not loading',
    description: 'The login page shows a blank screen when I try to access it from Chrome.',
    status: 'open',
    priority: 75, // High priority
    createdAt: new Date().toISOString(),
    submitter: { firstName: 'John', lastName: 'Doe' }
  },
  {
    id: 'bb0e8400-e29b-41d4-a716-446655440002',
    title: 'Need help with account setup',
    description: 'I need assistance setting up my new enterprise account.',
    status: 'in_progress',
    priority: 50, // Medium priority
    createdAt: new Date().toISOString(),
    submitter: { firstName: 'Jane', lastName: 'Smith' }
  },
  {
    id: 'bb0e8400-e29b-41d4-a716-446655440003',
    title: 'Feature request: Dark mode',
    description: 'Would love to have a dark mode option for the dashboard.',
    status: 'open',
    priority: 25, // Low priority
    createdAt: new Date().toISOString(),
    submitter: { firstName: 'Alice', lastName: 'Johnson' }
  },
  {
    id: 'bb0e8400-e29b-41d4-a716-446655440004',
    title: 'Critical bug in payment processing',
    description: 'Payments are failing for all customers since this morning.',
    status: 'open',
    priority: 95, // Critical priority
    createdAt: new Date().toISOString(),
    submitter: { firstName: 'Bob', lastName: 'Wilson' }
  }
];

app.get('/api/tickets', (_req: Request, res: Response) => {
  res.json(mockTickets);
});

// Mock queues endpoint
app.get('/api/queues', (_req: Request, res: Response) => {
  const mockQueues = [
    {
      id: 'queue-1',
      name: 'Technical Support',
      teamId: 'team-1',
      ticketCount: mockTickets.length,
      assignedToId: null
    },
    {
      id: 'queue-2', 
      name: 'Customer Success',
      teamId: 'team-2',
      ticketCount: 0,
      assignedToId: null
    }
  ];
  
  res.json({
    success: true,
    data: mockQueues
  });
});

// Mock queue tickets endpoint
app.get('/api/queues/:queueId/tickets', (req: Request, res: Response) => {
  const { queueId } = req.params;
  
  // For now, return all tickets for any queue
  res.json({
    success: true,
    data: mockTickets,
    pagination: {
      page: 1,
      limit: 20,
      total: mockTickets.length,
      totalPages: 1
    }
  });
});

// Mock team statuses endpoint
app.get('/api/teams/:teamId/statuses', (req: Request, res: Response) => {
  const { teamId } = req.params;
  
  const mockStatuses = [
    {
      id: 'status-1',
      teamId,
      name: 'open',
      label: 'Open',
      color: '#3B82F6',
      order: 1,
      isDefault: true,
      isClosed: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'status-2',
      teamId,
      name: 'in_progress',
      label: 'In Progress',
      color: '#F59E0B',
      order: 2,
      isDefault: false,
      isClosed: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'status-3',
      teamId,
      name: 'resolved',
      label: 'Resolved',
      color: '#10B981',
      order: 3,
      isDefault: false,
      isClosed: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  res.json({
    success: true,
    data: mockStatuses
  });
});

// Update ticket status endpoint
app.put('/api/tickets/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const ticketIndex = mockTickets.findIndex(t => t.id === id);
  if (ticketIndex === -1) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  
  mockTickets[ticketIndex].status = status;
  
  return res.json({
    success: true,
    data: mockTickets[ticketIndex]
  });
});

// Update ticket priority endpoint
app.put('/api/tickets/:id/priority', (req: Request, res: Response) => {
  const { id } = req.params;
  const { priority } = req.body;
  
  if (typeof priority !== 'number' || priority < 0 || priority > 100) {
    return res.status(400).json({ error: 'Priority must be a number between 0 and 100' });
  }
  
  const ticketIndex = mockTickets.findIndex(t => t.id === id);
  if (ticketIndex === -1) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  
  mockTickets[ticketIndex].priority = priority;
  
  return res.json({
    success: true,
    data: mockTickets[ticketIndex]
  });
});

// Mock admin endpoints for user management
app.get('/api/admin/users', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const currentUser = users.find(u => u.id === decoded.userId);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Add more mock internal users for demonstration (employees and admins only)
    const allInternalUsers = [
      ...users.filter(u => u.role !== 'customer'), // Exclude customers from internal user management
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        email: 'mike.johnson@bomizzel.com',
        password: 'password123',
        firstName: 'Mike',
        lastName: 'Johnson',
        role: 'user'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440007',
        email: 'sarah.davis@bomizzel.com',
        password: 'password123',
        firstName: 'Sarah',
        lastName: 'Davis',
        role: 'user'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440008',
        email: 'david.wilson@bomizzel.com',
        password: 'password123',
        firstName: 'David',
        lastName: 'Wilson',
        role: 'admin'
      }
    ];
    
    const { page = 1, limit = 25, search = '', role = '', isActive = '' } = req.query;
    
    let filteredUsers = allInternalUsers.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: true,
      teamCount: Math.floor(Math.random() * 3),
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
    }));
    
    // Apply filters
    if (search) {
      const searchLower = search.toString().toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        user.firstName.toLowerCase().includes(searchLower) ||
        user.lastName.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    }
    
    if (role) {
      filteredUsers = filteredUsers.filter(user => user.role === role);
    }
    
    if (isActive !== '') {
      const activeFilter = isActive === 'true';
      filteredUsers = filteredUsers.filter(user => user.isActive === activeFilter);
    }
    
    // Pagination
    const pageNum = parseInt(page.toString());
    const limitNum = parseInt(limit.toString());
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    
    return res.json({
      data: paginatedUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredUsers.length,
        totalPages: Math.ceil(filteredUsers.length / limitNum)
      }
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Update user role endpoint
app.put('/api/admin/users/:userId/role', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const currentUser = users.find(u => u.id === decoded.userId);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { userId } = req.params;
    const { role } = req.body;
    
    // Find and update user (in a real app, this would update the database)
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex].role = role;
    }
    
    return res.json({ 
      message: 'User role updated successfully',
      user: users[userIndex] 
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Update user endpoint (comprehensive)
app.put('/api/admin/users/:userId', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const currentUser = users.find(u => u.id === decoded.userId);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { userId } = req.params;
    const { firstName, lastName, email, role, isActive, teamId } = req.body;
    
    // Find and update user (in a real app, this would update the database)
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user properties
    if (firstName !== undefined) users[userIndex].firstName = firstName;
    if (lastName !== undefined) users[userIndex].lastName = lastName;
    if (email !== undefined) users[userIndex].email = email;
    if (role !== undefined) users[userIndex].role = role;
    // Note: isActive and teamId would be handled in a real database
    
    return res.json({ 
      message: 'User updated successfully',
      user: users[userIndex] 
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Mock teams data
let teams = [
  { 
    id: '1', 
    name: 'Technical Support', 
    description: 'Handles technical issues and bug reports',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  { 
    id: '2', 
    name: 'Customer Success', 
    description: 'Manages customer onboarding and account issues',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  { 
    id: '3', 
    name: 'Sales Team', 
    description: 'Handles sales inquiries and demos',
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

// Get teams endpoint
app.get('/api/teams', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const currentUser = users.find(u => u.id === decoded.userId);
    
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    return res.json({ data: teams });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Create team endpoint
app.post('/api/teams', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const currentUser = users.find(u => u.id === decoded.userId);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }
    
    // Check if team name already exists
    const existingTeam = teams.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existingTeam) {
      return res.status(409).json({ error: 'Team with this name already exists' });
    }
    
    const newTeam = {
      id: (teams.length + 1).toString(),
      name,
      description: description || '',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    teams.push(newTeam);
    
    return res.status(201).json({ team: newTeam });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Update team endpoint
app.put('/api/teams/:teamId', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const currentUser = users.find(u => u.id === decoded.userId);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { teamId } = req.params;
    const { name, description, isActive } = req.body;
    
    const teamIndex = teams.findIndex(t => t.id === teamId);
    if (teamIndex === -1) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Update team properties
    if (name !== undefined) teams[teamIndex].name = name;
    if (description !== undefined) teams[teamIndex].description = description;
    if (isActive !== undefined) teams[teamIndex].isActive = isActive;
    
    return res.json({ team: teams[teamIndex] });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Get team members endpoint
app.get('/api/teams/:teamId/members', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const currentUser = users.find(u => u.id === decoded.userId);
    
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const { teamId } = req.params;
    
    // Mock team members data
    const mockMembers = [
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@bomizzel.com',
        teamRole: 'lead',
        membershipDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike.johnson@bomizzel.com',
        teamRole: 'member',
        membershipDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    
    return res.json({ members: mockMembers });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Update user status endpoint
app.put('/api/admin/users/:userId/status', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const currentUser = users.find(u => u.id === decoded.userId);
    
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { userId } = req.params;
    const { isActive } = req.body;
    
    return res.json({ 
      message: 'User status updated successfully',
      user: { id: userId, isActive }
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Update user profile endpoint
app.put('/api/auth/profile', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const userIndex = users.findIndex(u => u.id === decoded.userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { firstName, lastName, email, phone, bio } = req.body;
    
    // Update user data
    if (firstName !== undefined) users[userIndex].firstName = firstName;
    if (lastName !== undefined) users[userIndex].lastName = lastName;
    if (email !== undefined) users[userIndex].email = email;
    // Note: phone and bio would be stored in a real database
    
    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: users[userIndex]
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Change password endpoint
app.put('/api/auth/change-password', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    const userIndex = users.findIndex(u => u.id === decoded.userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    // Verify current password
    if (users[userIndex].password !== currentPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Update password
    users[userIndex].password = newPassword;
    
    return res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Upload profile picture endpoint (mock)
app.post('/api/auth/profile-picture', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  // In a real app, you'd handle file upload with multer
  // For now, just return a mock URL
  const mockProfilePictureUrl = `https://ui-avatars.com/api/?name=Profile&size=96&background=3b82f6&color=ffffff&t=${Date.now()}`;
  
  return res.json({
    success: true,
    message: 'Profile picture uploaded successfully',
    profilePictureUrl: mockProfilePictureUrl
  });
});

// Mock subscription plans endpoint
app.get('/api/subscriptions/plans', (_req: Request, res: Response) => {
  const mockPlans = [
    {
      id: '1',
      name: 'Free Tier',
      slug: 'free-tier',
      price: 0,
      currency: 'USD',
      billingInterval: 'month',
      limits: {
        activeTickets: 10,
        completedTickets: 50,
        totalTickets: 60
      },
      features: [
        'Up to 10 active tickets',
        'Basic ticket management',
        'Email notifications',
        'Community support'
      ],
      trialDays: 0,
      description: 'Perfect for small teams getting started',
      sortOrder: 1
    },
    {
      id: '2',
      name: 'Starter',
      slug: 'starter',
      price: 29,
      currency: 'USD',
      billingInterval: 'month',
      limits: {
        activeTickets: 50,
        completedTickets: 500,
        totalTickets: 550
      },
      features: [
        'Up to 50 active tickets',
        'Advanced ticket management',
        'Custom fields',
        'Email integration',
        'Priority support'
      ],
      trialDays: 14,
      description: 'Great for growing teams',
      sortOrder: 2
    },
    {
      id: '3',
      name: 'Professional',
      slug: 'professional',
      price: 79,
      currency: 'USD',
      billingInterval: 'month',
      limits: {
        activeTickets: 200,
        completedTickets: 2000,
        totalTickets: 2200
      },
      features: [
        'Up to 200 active tickets',
        'Advanced automation',
        'Team management',
        'Custom workflows',
        'Analytics & reporting',
        'API access',
        'Priority support'
      ],
      trialDays: 14,
      description: 'Perfect for professional teams',
      sortOrder: 3
    },
    {
      id: '4',
      name: 'Business',
      slug: 'business',
      price: 149,
      currency: 'USD',
      billingInterval: 'month',
      limits: {
        activeTickets: 500,
        completedTickets: 5000,
        totalTickets: 5500
      },
      features: [
        'Up to 500 active tickets',
        'Advanced integrations',
        'Multi-team support',
        'Advanced security',
        'Custom branding',
        'Dedicated support',
        'SLA guarantees'
      ],
      trialDays: 14,
      description: 'Ideal for larger organizations',
      sortOrder: 4
    },
    {
      id: '5',
      name: 'Enterprise',
      slug: 'enterprise',
      price: 299,
      currency: 'USD',
      billingInterval: 'month',
      limits: {
        activeTickets: -1,
        completedTickets: -1,
        totalTickets: -1
      },
      features: [
        'Unlimited tickets',
        'Enterprise integrations',
        'Advanced compliance',
        'Custom development',
        'Dedicated account manager',
        '24/7 phone support',
        'Custom SLA'
      ],
      trialDays: 30,
      description: 'Complete solution for enterprises',
      sortOrder: 5
    }
  ];

  res.json({
    success: true,
    data: mockPlans
  });
});

// Import and register subscription routes (commented out for now to avoid dependency issues)
// try {
//   const subscriptionRoutes = require('./routes/subscriptions');
//   app.use('/api/subscriptions', subscriptionRoutes.default);
//   console.log('💳 Subscription routes registered');
// } catch (error) {
//   console.warn('⚠️ Could not register subscription routes:', error);
// }

// Start archival scheduler (only in production or when enabled)
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_ARCHIVAL_SCHEDULER === 'true') {
  try {
    const { ArchivalScheduledJobs } = require('./services/ArchivalScheduledJobs');
    ArchivalScheduledJobs.start();
    console.log('📦 Archival scheduler started');
  } catch (error) {
    console.warn('⚠️ Could not start archival scheduler:', error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bomizzel backend server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`🔗 API health check at http://localhost:${PORT}/api/health`);
  console.log(`👤 Test admin login: admin@bomizzel.com / password123`);
  console.log(`🔧 User management endpoints available at /api/admin/users`);
});

export { app };