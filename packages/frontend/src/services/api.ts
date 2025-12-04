import axios, { AxiosInstance } from 'axios';

// Determine API base URL
const getApiBaseUrl = () => {
  // If explicitly set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // For local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  
  // For production, construct from current protocol and hostname
  // Assumes backend is on same domain or you need to set VITE_API_URL
  const protocol = window.location.protocol;
  return `${protocol}//${window.location.hostname}/api`;
};

const API_BASE_URL = getApiBaseUrl();

console.log('[ApiService] API_BASE_URL:', API_BASE_URL);
console.log('[ApiService] VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('[ApiService] window.location:', window.location.href);

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<any> {
    try {
      console.log('[ApiService] Attempting login with baseURL:', this.client.defaults.baseURL);
      const response = await this.client.post('/auth/login', { email, password });
      console.log('[ApiService] Login successful:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[ApiService] Login error:', error);
      console.error('[ApiService] Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
    selectedPlanId?: string;
    startTrial?: boolean;
  }): Promise<any> {
    const response = await this.client.post('/auth/register', userData);
    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<any> {
    const response = await this.client.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  async getProfile(): Promise<any> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async updateProfile(profileData: any): Promise<any> {
    const response = await this.client.put('/auth/profile', profileData);
    return response.data;
  }

  async changePassword(passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<any> {
    const response = await this.client.put('/auth/change-password', passwordData);
    return response.data;
  }

  async uploadProfilePicture(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('profilePicture', file);

    const response = await this.client.post('/auth/profile-picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // User search endpoints
  async searchUsers(query: string, params?: { limit?: number; role?: string }): Promise<any> {
    const response = await this.client.get('/users/search', {
      params: { q: query, ...params },
    });
    return response.data;
  }

  async listUsers(params?: { role?: string; limit?: number }): Promise<any> {
    // Fallback to admin endpoint if /users/list doesn't exist
    try {
      const response = await this.client.get('/users/list', { params });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Fallback to admin endpoint with proper pagination
        const response = await this.client.get('/admin/users', {
          params: {
            ...params,
            page: 1,
            limit: params?.limit || 1000,
          },
        });
        return response.data;
      }
      throw error;
    }
  }

  // Ticket endpoints
  async getTickets(params?: {
    companyId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const response = await this.client.get('/tickets', { params });
    return response.data;
  }

  async getTicket(ticketId: string): Promise<any> {
    const response = await this.client.get(`/tickets/${ticketId}`);
    return response.data;
  }

  async createTicket(ticketData: {
    title: string;
    description: string;
    companyId: string;
    teamId: string;
    customFieldValues?: Record<string, any>;
  }): Promise<any> {
    const response = await this.client.post('/tickets', ticketData);
    return response.data;
  }

  async updateTicket(ticketId: string, updates: any): Promise<any> {
    console.log('[API] updateTicket called:', { ticketId, updates });
    const response = await this.client.put(`/tickets/${ticketId}`, updates);
    console.log('[API] updateTicket response:', response.data);
    return response.data;
  }

  // Ticket notes endpoints
  async getTicketNotes(
    ticketId: string,
    params?: {
      includeInternal?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const response = await this.client.get(`/tickets/${ticketId}/notes`, { params });
    return response.data;
  }

  async createTicketNote(
    ticketId: string,
    noteData: {
      content: string;
      isInternal?: boolean;
    }
  ): Promise<any> {
    const response = await this.client.post(`/tickets/${ticketId}/notes`, noteData);
    return response.data;
  }

  async updateNote(
    noteId: string,
    updates: {
      content?: string;
      isInternal?: boolean;
    }
  ): Promise<any> {
    const response = await this.client.put(`/notes/${noteId}`, updates);
    return response.data;
  }

  async deleteNote(noteId: string): Promise<any> {
    const response = await this.client.delete(`/notes/${noteId}`);
    return response.data;
  }

  // File attachment endpoints
  async uploadFile(ticketId: string, file: File, noteId?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (noteId) {
      formData.append('noteId', noteId);
    }

    const response = await this.client.post(`/tickets/${ticketId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getTicketAttachments(ticketId: string): Promise<any> {
    const response = await this.client.get(`/tickets/${ticketId}/attachments`);
    return response.data;
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const response = await this.client.get(`/files/${fileId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Company endpoints
  async getCompanies(params?: { search?: string; page?: number; limit?: number }): Promise<any> {
    const response = await this.client.get('/companies', { params });
    return response.data;
  }

  async getCompany(companyId: string): Promise<any> {
    const response = await this.client.get(`/companies/${companyId}`);
    return response.data;
  }

  async searchCompanies(query: string, params?: { limit?: number }): Promise<any> {
    const response = await this.client.get('/companies', {
      params: { search: query, ...params },
    });
    return response.data;
  }

  async createCompany(companyData: {
    name: string;
    domain?: string;
    primaryContact?: string;
    primaryEmail?: string;
    primaryPhone?: string;
  }): Promise<any> {
    const response = await this.client.post('/companies', companyData);
    return response.data;
  }

  async updateCompany(
    companyId: string,
    companyData: {
      name?: string;
      domain?: string;
      primaryContact?: string;
      primaryEmail?: string;
      primaryPhone?: string;
    }
  ): Promise<any> {
    const response = await this.client.put(`/companies/${companyId}`, companyData);
    return response.data;
  }

  async addUserToCompany(userId: string, companyId: string, role: string): Promise<any> {
    const response = await this.client.post(`/companies/${companyId}/users`, {
      userId,
      role,
    });
    return response.data;
  }

  async sendCustomerInvitation(userId: string): Promise<any> {
    const response = await this.client.post(`/users/${userId}/send-invitation`);
    return response.data;
  }

  // Team endpoints
  async getTeams(params?: { search?: string; page?: number; limit?: number }): Promise<any> {
    const response = await this.client.get('/teams', { params });
    return response.data;
  }

  async getTeam(teamId: string): Promise<any> {
    const response = await this.client.get(`/teams/${teamId}`);
    return response.data;
  }

  async createTeam(teamData: { name: string; description?: string }): Promise<any> {
    const response = await this.client.post('/teams', teamData);
    return response.data;
  }

  async updateTeam(
    teamId: string,
    updates: { name?: string; description?: string; isActive?: boolean }
  ): Promise<any> {
    const response = await this.client.put(`/teams/${teamId}`, updates);
    return response.data;
  }

  async getTeamMembers(teamId: string): Promise<any> {
    const response = await this.client.get(`/teams/${teamId}/members`);
    return response.data;
  }

  // Custom fields endpoints
  async getTeamCustomFields(teamId: string): Promise<any> {
    const response = await this.client.get(`/custom-fields/teams/${teamId}`);
    return response.data;
  }

  async createCustomField(customFieldData: {
    teamId: string;
    name: string;
    label: string;
    type: string;
    isRequired: boolean;
    options?: string[];
    validation?: any;
  }): Promise<any> {
    const response = await this.client.post('/custom-fields', customFieldData);
    return response.data;
  }

  async updateCustomField(fieldId: string, updates: any): Promise<any> {
    const response = await this.client.put(`/custom-fields/${fieldId}`, updates);
    return response.data;
  }

  async deleteCustomField(fieldId: string): Promise<any> {
    const response = await this.client.delete(`/custom-fields/${fieldId}`);
    return response.data;
  }

  async validateCustomFieldValues(teamId: string, values: Record<string, any>): Promise<any> {
    const response = await this.client.post(`/custom-fields/teams/${teamId}/validate`, { values });
    return response.data;
  }

  // Queue endpoints
  async getQueues(params?: {
    teamId?: string;
    type?: string;
    assignedToId?: string;
  }): Promise<any> {
    const response = await this.client.get('/queues', { params });
    return response.data;
  }

  async getQueue(queueId: string): Promise<any> {
    const response = await this.client.get(`/queues/${queueId}`);
    return response.data;
  }

  async getQueueTickets(
    queueId: string,
    params?: {
      status?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const response = await this.client.get(`/queues/${queueId}/tickets`, { params });
    return response.data;
  }

  async getQueueMetrics(queueId: string): Promise<any> {
    const response = await this.client.get(`/queues/${queueId}/metrics`);
    return response.data;
  }

  // Ticket assignment and status endpoints
  async assignTicket(ticketId: string, assignedToId: string): Promise<any> {
    const response = await this.client.post(`/tickets/${ticketId}/assign`, { assignedToId });
    return response.data;
  }

  async unassignTicket(ticketId: string): Promise<any> {
    const response = await this.client.post(`/tickets/${ticketId}/unassign`);
    return response.data;
  }

  async updateTicketStatus(ticketId: string, status: string): Promise<any> {
    const response = await this.client.put(`/tickets/${ticketId}/status`, { status });
    return response.data;
  }

  async updateTicketPriority(ticketId: string, priority: number): Promise<any> {
    const response = await this.client.put(`/tickets/${ticketId}/priority`, { priority });
    return response.data;
  }

  // Agent management endpoints
  async getAgents(params?: { status?: string; teamId?: string }): Promise<any> {
    const response = await this.client.get('/agents', { params });
    return response.data;
  }

  // User preferences endpoints
  async updateUserPreferences(preferences: any): Promise<any> {
    const response = await this.client.put('/auth/preferences', preferences);
    return response.data;
  }

  // Team status endpoints
  async getTeamStatuses(teamId: string): Promise<any> {
    const response = await this.client.get(`/teams/${teamId}/statuses`);
    return response.data;
  }

  async createTeamStatus(
    teamId: string,
    statusData: {
      name: string;
      label: string;
      color: string;
      order: number;
      isDefault?: boolean;
      isClosed?: boolean;
    }
  ): Promise<any> {
    const response = await this.client.post(`/teams/${teamId}/statuses`, statusData);
    return response.data;
  }

  async updateTeamStatus(teamId: string, statusId: string, updates: any): Promise<any> {
    const response = await this.client.put(`/teams/${teamId}/statuses/${statusId}`, updates);
    return response.data;
  }

  async deleteTeamStatus(teamId: string, statusId: string): Promise<any> {
    const response = await this.client.delete(`/teams/${teamId}/statuses/${statusId}`);
    return response.data;
  }

  // Bulk operations endpoints
  async bulkAssignTickets(ticketIds: string[], assignedToId: string): Promise<any> {
    const response = await this.client.post('/bulk/assign', { ticketIds, assignedToId });
    return response.data;
  }

  async bulkUpdateStatus(ticketIds: string[], status: string): Promise<any> {
    const response = await this.client.post('/bulk/status', { ticketIds, status });
    return response.data;
  }

  async bulkUpdatePriority(ticketIds: string[], priority: number): Promise<any> {
    const response = await this.client.post('/bulk/priority', { ticketIds, priority });
    return response.data;
  }

  async bulkMoveTickets(ticketIds: string[], queueId: string): Promise<any> {
    const response = await this.client.post('/bulk/move', { ticketIds, queueId });
    return response.data;
  }

  async bulkDeleteTickets(ticketIds: string[]): Promise<any> {
    const response = await this.client.delete('/bulk/delete', { data: { ticketIds } });
    return response.data;
  }

  async validateTicketAccess(ticketIds: string[]): Promise<any> {
    const response = await this.client.post('/bulk/validate-access', { ticketIds });
    return response.data;
  }

  // Search endpoints
  async getSearchableFields(teamId: string): Promise<any> {
    const response = await this.client.get(`/search/fields/${teamId}`);
    return response.data;
  }

  async advancedSearch(searchRequest: any): Promise<any> {
    const response = await this.client.post('/search/tickets', searchRequest);
    return response.data;
  }

  async saveSearch(name: string, searchRequest: any): Promise<any> {
    const response = await this.client.post('/search/save', { name, searchRequest });
    return response.data;
  }

  async getSavedSearches(): Promise<any> {
    const response = await this.client.get('/search/saved');
    return response.data;
  }

  // Ticket history endpoint
  async getTicketHistory(ticketId: string): Promise<any> {
    const response = await this.client.get(`/tickets/${ticketId}/history`);
    return response.data;
  }

  // Subscription endpoints
  async getAvailablePlans(): Promise<any> {
    const response = await this.client.get('/subscriptions/plans');
    return response.data;
  }

  async getUserSubscription(): Promise<any> {
    const response = await this.client.get('/subscriptions/current');
    return response.data;
  }

  async createSubscription(
    planId: string,
    options?: {
      startTrial?: boolean;
      paymentMethodId?: string;
    }
  ): Promise<any> {
    const response = await this.client.post('/subscriptions', {
      planId,
      ...options,
    });
    return response.data;
  }

  async upgradeSubscription(subscriptionId: string, newPlanId: string): Promise<any> {
    const response = await this.client.put(`/subscriptions/${subscriptionId}/upgrade`, {
      newPlanId,
    });
    return response.data;
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<any> {
    const response = await this.client.put(`/subscriptions/${subscriptionId}/cancel`, {
      cancelAtPeriodEnd,
    });
    return response.data;
  }

  // Admin endpoints
  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
    isActive?: boolean;
  }): Promise<any> {
    const response = await this.client.get('/admin/users', { params });
    return response.data;
  }

  async getUserDetails(userId: string): Promise<any> {
    const response = await this.client.get(`/admin/users/${userId}`);
    return response.data;
  }

  async updateUserRole(userId: string, role: string): Promise<any> {
    const response = await this.client.put(`/admin/users/${userId}/role`, { role });
    return response.data;
  }

  async updateUserStatus(userId: string, isActive: boolean): Promise<any> {
    const response = await this.client.put(`/admin/users/${userId}/status`, { isActive });
    return response.data;
  }

  async createUser(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
    teamId?: string;
  }): Promise<any> {
    const response = await this.client.post('/admin/users', userData);
    return response.data;
  }

  async updateUser(
    userId: string,
    userData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: string;
      isActive?: boolean;
      teamId?: string;
    }
  ): Promise<any> {
    const response = await this.client.put(`/admin/users/${userId}`, userData);
    return response.data;
  }

  async getRoleStats(): Promise<any> {
    const response = await this.client.get('/admin/stats/roles');
    return response.data;
  }

  // Usage alert endpoints
  async getUsageWarnings(): Promise<any> {
    const response = await this.client.get('/usage-alerts/warnings');
    return response.data;
  }

  async getDashboardWarnings(): Promise<any> {
    const response = await this.client.get('/usage-alerts/dashboard-warnings');
    return response.data;
  }

  async getTicketCreationWarning(): Promise<any> {
    const response = await this.client.get('/usage-alerts/ticket-creation-warning');
    return response.data;
  }

  async getUsageStats(): Promise<any> {
    const response = await this.client.get('/usage-alerts/usage-stats');
    return response.data;
  }

  // User deletion endpoints
  async checkUserTickets(userId: string): Promise<any> {
    const response = await this.client.get(`/admin/users/${userId}/assigned-tickets`);
    return response.data;
  }

  async permanentlyDeleteUser(userId: string): Promise<any> {
    const response = await this.client.delete(`/admin/users/${userId}/permanent`);
    return response.data;
  }

  async canCreateTicket(): Promise<any> {
    const response = await this.client.get('/usage-alerts/can-create-ticket');
    return response.data;
  }

  // Trial management endpoints
  async startTrial(
    planSlug: string,
    options?: {
      trialDays?: number;
      sendWelcomeEmail?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<any> {
    const response = await this.client.post('/subscriptions/trial/start', {
      planSlug,
      ...options,
    });
    return response.data;
  }

  async convertTrial(
    subscriptionId: string,
    options: {
      paymentMethodId: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      sendWelcomeEmail?: boolean;
    }
  ): Promise<any> {
    const response = await this.client.post(
      `/subscriptions/${subscriptionId}/trial/convert`,
      options
    );
    return response.data;
  }

  async cancelTrial(subscriptionId: string, reason?: string): Promise<any> {
    const response = await this.client.post(`/subscriptions/${subscriptionId}/trial/cancel`, {
      reason,
    });
    return response.data;
  }

  async getTrialStatus(subscriptionId: string): Promise<any> {
    const response = await this.client.get(`/subscriptions/${subscriptionId}/trial/status`);
    return response.data;
  }

  async extendTrial(subscriptionId: string, additionalDays: number, reason?: string): Promise<any> {
    const response = await this.client.post(`/subscriptions/${subscriptionId}/trial/extend`, {
      additionalDays,
      reason,
    });
    return response.data;
  }

  // Archival endpoints
  async getArchivalSuggestions(): Promise<any> {
    const response = await this.client.get('/tickets/archive/suggestions');
    return response.data;
  }

  async getAutoArchivalSuggestions(): Promise<any> {
    const response = await this.client.get('/tickets/archive/auto-suggestions');
    return response.data;
  }

  async archiveTicket(ticketId: string): Promise<any> {
    const response = await this.client.post(`/tickets/${ticketId}/archive`);
    return response.data;
  }

  async restoreTicket(ticketId: string): Promise<any> {
    const response = await this.client.post(`/tickets/${ticketId}/restore`);
    return response.data;
  }

  async bulkArchiveTickets(ticketIds: string[]): Promise<any> {
    const response = await this.client.post('/tickets/archive/bulk', { ticketIds });
    return response.data;
  }

  async getArchivableTickets(params?: { limit?: number; olderThanDays?: number }): Promise<any> {
    const response = await this.client.get('/tickets/archivable', { params });
    return response.data;
  }

  async searchArchivedTickets(params?: {
    query?: string;
    status?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
    page?: number;
    limit?: number;
  }): Promise<any> {
    const response = await this.client.get('/tickets/archived', { params });
    return response.data;
  }

  async getArchivalStats(): Promise<any> {
    const response = await this.client.get('/tickets/archive/stats');
    return response.data;
  }

  async getAutoArchivalConfig(): Promise<any> {
    const response = await this.client.get('/tickets/archive/auto-config');
    return response.data;
  }

  async updateAutoArchivalConfig(config: {
    enabled: boolean;
    daysAfterCompletion?: number;
    maxTicketsPerRun?: number;
  }): Promise<any> {
    const response = await this.client.post('/tickets/archive/auto-config', config);
    return response.data;
  }

  async triggerImmediateArchival(options?: {
    daysAfterCompletion?: number;
    maxTickets?: number;
  }): Promise<any> {
    const response = await this.client.post('/tickets/archive/trigger-immediate', options);
    return response.data;
  }

  async getAutomationStatus(): Promise<any> {
    const response = await this.client.get('/tickets/archive/automation-status');
    return response.data;
  }

  async runAutomatedArchival(): Promise<any> {
    const response = await this.client.post('/tickets/archive/run-automation');
    return response.data;
  }

  // Holiday List endpoints
  async getHolidayLists(): Promise<any> {
    const response = await this.client.get('/holiday-lists');
    return response.data;
  }

  async getHolidayList(id: number): Promise<any> {
    const response = await this.client.get(`/holiday-lists/${id}`);
    return response.data;
  }

  async createHolidayList(data: {
    holidayList: {
      name: string;
      description?: string;
      region?: string;
      is_active: boolean;
      is_default: boolean;
    };
    holidays: Array<{
      name: string;
      date: string;
      is_recurring: boolean;
      recurrence_pattern?: string;
      description?: string;
    }>;
  }): Promise<any> {
    const response = await this.client.post('/holiday-lists', data);
    return response.data;
  }

  async updateHolidayList(id: number, data: {
    holidayList: {
      name: string;
      description?: string;
      region?: string;
      is_active: boolean;
      is_default: boolean;
    };
    holidays: Array<{
      name: string;
      date: string;
      is_recurring: boolean;
      recurrence_pattern?: string;
      description?: string;
    }>;
  }): Promise<any> {
    const response = await this.client.put(`/holiday-lists/${id}`, data);
    return response.data;
  }

  async deleteHolidayList(id: number): Promise<any> {
    const response = await this.client.delete(`/holiday-lists/${id}`);
    return response.data;
  }

  async getDefaultHolidayList(): Promise<any> {
    const response = await this.client.get('/holiday-lists/default/current');
    return response.data;
  }

  async checkHoliday(date: string): Promise<any> {
    const response = await this.client.get(`/holiday-lists/check/${date}`);
    return response.data;
  }

  // Business Hours endpoints
  async getBusinessHours(): Promise<any> {
    const response = await this.client.get('/business-hours');
    return response.data;
  }

  async createBusinessHours(data: any): Promise<any> {
    const response = await this.client.post('/business-hours', data);
    return response.data;
  }

  async updateBusinessHours(id: number, data: any): Promise<any> {
    const response = await this.client.put(`/business-hours/${id}`, data);
    return response.data;
  }

  async deleteBusinessHours(id: number): Promise<any> {
    const response = await this.client.delete(`/business-hours/${id}`);
    return response.data;
  }

  async getDefaultBusinessHours(): Promise<any> {
    const response = await this.client.get('/business-hours/default/current');
    return response.data;
  }

  // Organization endpoints
  async getUserOrganizations(): Promise<any> {
    const response = await this.client.get('/orgs');
    return response.data;
  }

  async getDefaultOrganization(): Promise<any> {
    const response = await this.client.get('/orgs/default');
    return response.data;
  }

  async setDefaultOrganization(orgId: string): Promise<any> {
    const response = await this.client.post(`/orgs/${orgId}/set-default`);
    return response.data;
  }

  async getOrganization(orgId: string): Promise<any> {
    const response = await this.client.get(`/orgs/${orgId}`);
    return response.data;
  }

  // Company Profile endpoints
  async getCompanyProfile(): Promise<any> {
    const response = await this.client.get('/company-registration/profile');
    return response.data;
  }

  async updateCompanyProfile(data: {
    name?: string;
    logoUrl?: string;
    websiteUrl?: string;
    primaryContactName?: string;
    primaryContactEmail?: string;
    primaryContactPhone?: string;
    mobilePhone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
  }): Promise<any> {
    const response = await this.client.put('/company-registration/profile', data);
    return response.data;
  }

  // Branding endpoints
  async getBranding(): Promise<any> {
    const response = await this.client.get('/company-registration/branding');
    return response.data;
  }

  async updateBranding(data: {
    logo?: string;
    favicon?: string;
    linkbackUrl?: string;
    companyName?: string;
    tagline?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
  }): Promise<any> {
    const response = await this.client.put('/company-registration/branding', data);
    return response.data;
  }

  // Department endpoints
  async getDepartments(): Promise<any> {
    const response = await this.client.get('/departments');
    return response.data;
  }

  async getDepartment(id: number): Promise<any> {
    const response = await this.client.get(`/departments/${id}`);
    return response.data;
  }

  async createDepartment(data: {
    name: string;
    description?: string;
    logo?: string;
    color?: string;
    is_active?: boolean;
    is_default?: boolean;
  }): Promise<any> {
    const response = await this.client.post('/departments', data);
    return response.data;
  }

  async updateDepartment(id: number, data: {
    name?: string;
    description?: string;
    logo?: string;
    color?: string;
    is_active?: boolean;
    is_default?: boolean;
  }): Promise<any> {
    const response = await this.client.put(`/departments/${id}`, data);
    return response.data;
  }

  async deleteDepartment(id: number): Promise<any> {
    const response = await this.client.delete(`/departments/${id}`);
    return response.data;
  }

  async addAgentToDepartment(departmentId: number, userId: string, role: 'member' | 'lead' | 'manager' = 'member'): Promise<any> {
    const response = await this.client.post(`/departments/${departmentId}/agents`, { user_id: userId, role });
    return response.data;
  }

  async removeAgentFromDepartment(departmentId: number, userId: string): Promise<any> {
    const response = await this.client.delete(`/departments/${departmentId}/agents/${userId}`);
    return response.data;
  }

  async getUserDepartments(): Promise<any> {
    const response = await this.client.get('/departments/user/my-departments');
    return response.data;
  }

  async getDepartmentTemplates(departmentId: number): Promise<any> {
    const response = await this.client.get(`/departments/${departmentId}/templates`);
    return response.data;
  }

  async createDepartmentTemplate(departmentId: number, data: {
    name: string;
    description?: string;
    template_fields: any;
    default_values?: any;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    category?: string;
    is_active?: boolean;
    is_default?: boolean;
  }): Promise<any> {
    const response = await this.client.post(`/departments/${departmentId}/templates`, data);
    return response.data;
  }

  async updateDepartmentTemplate(templateId: number, data: {
    name?: string;
    description?: string;
    template_fields?: any;
    default_values?: any;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    category?: string;
    is_active?: boolean;
    is_default?: boolean;
  }): Promise<any> {
    const response = await this.client.put(`/departments/templates/${templateId}`, data);
    return response.data;
  }

  async deleteDepartmentTemplate(templateId: number): Promise<any> {
    const response = await this.client.delete(`/departments/templates/${templateId}`);
    return response.data;
  }

  // Customer Happiness endpoints
  async getCustomerHappinessSettings(): Promise<any> {
    const response = await this.client.get('/customer-happiness');
    return response.data;
  }

  async getCustomerHappinessSetting(id: number): Promise<any> {
    const response = await this.client.get(`/customer-happiness/${id}`);
    return response.data;
  }

  async createCustomerHappinessSetting(data: {
    name: string;
    description?: string;
    is_active?: boolean;
    is_default?: boolean;
    survey_config: any;
    trigger_conditions: any;
    email_template: any;
    delay_hours?: number;
    reminder_hours?: number;
    max_reminders?: number;
    thank_you_message?: string;
    follow_up_message?: string;
    low_rating_threshold?: number;
  }): Promise<any> {
    const response = await this.client.post('/customer-happiness', data);
    return response.data;
  }

  async updateCustomerHappinessSetting(id: number, data: {
    name?: string;
    description?: string;
    is_active?: boolean;
    is_default?: boolean;
    survey_config?: any;
    trigger_conditions?: any;
    email_template?: any;
    delay_hours?: number;
    reminder_hours?: number;
    max_reminders?: number;
    thank_you_message?: string;
    follow_up_message?: string;
    low_rating_threshold?: number;
  }): Promise<any> {
    const response = await this.client.put(`/customer-happiness/${id}`, data);
    return response.data;
  }

  async deleteCustomerHappinessSetting(id: number): Promise<any> {
    const response = await this.client.delete(`/customer-happiness/${id}`);
    return response.data;
  }

  async getCustomerHappinessAnalytics(startDate: string, endDate: string, happinessSettingId?: number): Promise<any> {
    const params: any = { start_date: startDate, end_date: endDate };
    if (happinessSettingId) params.happiness_setting_id = happinessSettingId;
    
    const response = await this.client.get('/customer-happiness/analytics/overview', { params });
    return response.data;
  }

  async getRecentCustomerFeedback(limit?: number, happinessSettingId?: number): Promise<any> {
    const params: any = {};
    if (limit) params.limit = limit;
    if (happinessSettingId) params.happiness_setting_id = happinessSettingId;
    
    const response = await this.client.get('/customer-happiness/feedback/recent', { params });
    return response.data;
  }

  // Public survey endpoints (no auth required)
  async getSurveyByToken(token: string): Promise<any> {
    const response = await this.client.get(`/customer-happiness/survey/${token}`);
    return response.data;
  }

  async submitSurveyResponse(token: string, data: {
    overall_rating: number;
    question_responses?: Record<string, any>;
    comments?: string;
  }): Promise<any> {
    const response = await this.client.post(`/customer-happiness/survey/${token}/submit`, data);
    return response.data;
  }

  // Generic HTTP methods for flexibility
  async get(url: string, config?: any): Promise<any> {
    const response = await this.client.get(url, config);
    return response;
  }

  async post(url: string, data?: any, config?: any): Promise<any> {
    const response = await this.client.post(url, data, config);
    return response;
  }

  async put(url: string, data?: any, config?: any): Promise<any> {
    const response = await this.client.put(url, data, config);
    return response;
  }

  async delete(url: string, config?: any): Promise<any> {
    const response = await this.client.delete(url, config);
    return response;
  }

  // Organizational Roles
  async getOrganizationalRoles(): Promise<any> {
    const response = await this.client.get('/organizational-roles');
    return response.data;
  }

  async createOrganizationalRole(data: { name: string; description?: string; hierarchy_level: number }): Promise<any> {
    const response = await this.client.post('/organizational-roles', data);
    return response.data;
  }

  async updateOrganizationalRole(id: number, data: { name?: string; description?: string; hierarchy_level?: number }): Promise<any> {
    const response = await this.client.put(`/organizational-roles/${id}`, data);
    return response.data;
  }

  async deleteOrganizationalRole(id: number): Promise<any> {
    const response = await this.client.delete(`/organizational-roles/${id}`);
    return response.data;
  }

  // Products
  async getProducts(params?: { department_id?: string }): Promise<any> {
    const response = await this.client.get('/products', { params });
    return response.data;
  }

  async createProduct(data: { product_code: string; name: string; description?: string; department_id: string }): Promise<any> {
    const response = await this.client.post('/products', data);
    return response.data;
  }

  async updateProduct(id: number, data: { product_code?: string; name?: string; description?: string }): Promise<any> {
    const response = await this.client.put(`/products/${id}`, data);
    return response.data;
  }

  async deleteProduct(id: number): Promise<any> {
    const response = await this.client.delete(`/products/${id}`);
    return response.data;
  }

  // Gamification
  async getTrophies(): Promise<any> {
    const response = await this.client.get('/gamification/trophies');
    return response.data;
  }

  async getBadges(): Promise<any> {
    const response = await this.client.get('/gamification/badges');
    return response.data;
  }

  async getLeaderboard(): Promise<any> {
    const response = await this.client.get('/gamification/leaderboard');
    return response.data;
  }

  async createTrophy(data: any): Promise<any> {
    const response = await this.client.post('/gamification/trophies', data);
    return response.data;
  }

  async updateTrophy(id: number, data: any): Promise<any> {
    const response = await this.client.put(`/gamification/trophies/${id}`, data);
    return response.data;
  }

  async createBadge(data: any): Promise<any> {
    const response = await this.client.post('/gamification/badges', data);
    return response.data;
  }

  async updateBadge(id: number, data: any): Promise<any> {
    const response = await this.client.put(`/gamification/badges/${id}`, data);
    return response.data;
  }

  // User Profiles
  async getUserProfiles(): Promise<any> {
    const response = await this.client.get('/user-profiles');
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;

// Export as 'api' for backward compatibility
export const api = apiService;
