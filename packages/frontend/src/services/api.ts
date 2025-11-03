import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = `http://${window.location.hostname}:3001/api`;

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
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
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
    const response = await this.client.put(`/tickets/${ticketId}`, updates);
    return response.data;
  }

  // Ticket notes endpoints
  async getTicketNotes(ticketId: string, params?: {
    includeInternal?: boolean;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const response = await this.client.get(`/tickets/${ticketId}/notes`, { params });
    return response.data;
  }

  async createTicketNote(ticketId: string, noteData: {
    content: string;
    isInternal?: boolean;
  }): Promise<any> {
    const response = await this.client.post(`/tickets/${ticketId}/notes`, noteData);
    return response.data;
  }

  async updateNote(noteId: string, updates: {
    content?: string;
    isInternal?: boolean;
  }): Promise<any> {
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
  async getCompanies(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const response = await this.client.get('/companies', { params });
    return response.data;
  }

  async getCompany(companyId: string): Promise<any> {
    const response = await this.client.get(`/companies/${companyId}`);
    return response.data;
  }

  // Team endpoints
  async getTeams(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
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

  async updateTeam(teamId: string, updates: { name?: string; description?: string; isActive?: boolean }): Promise<any> {
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

  async getQueueTickets(queueId: string, params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const response = await this.client.get(`/queues/${queueId}/tickets`, { params });
    return response.data;
  }

  async getQueueMetrics(queueId: string): Promise<any> {
    const response = await this.client.get(`/queues/${queueId}/metrics`);
    return response.data;
  }

  // Ticket assignment and status endpoints
  async assignTicket(ticketId: string, assignedToId: string): Promise<any> {
    const response = await this.client.put(`/tickets/${ticketId}/assign`, { assignedToId });
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

  async createTeamStatus(teamId: string, statusData: {
    name: string;
    label: string;
    color: string;
    order: number;
    isDefault?: boolean;
    isClosed?: boolean;
  }): Promise<any> {
    const response = await this.client.post(`/teams/${teamId}/statuses`, statusData);
    return response.data;
  }

  async updateTeamStatus(statusId: string, updates: any): Promise<any> {
    const response = await this.client.put(`/statuses/${statusId}`, updates);
    return response.data;
  }

  async deleteTeamStatus(statusId: string): Promise<any> {
    const response = await this.client.delete(`/statuses/${statusId}`);
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

  async createSubscription(planId: string, options?: {
    startTrial?: boolean;
    paymentMethodId?: string;
  }): Promise<any> {
    const response = await this.client.post('/subscriptions', {
      planId,
      ...options
    });
    return response.data;
  }

  async upgradeSubscription(subscriptionId: string, newPlanId: string): Promise<any> {
    const response = await this.client.put(`/subscriptions/${subscriptionId}/upgrade`, {
      newPlanId
    });
    return response.data;
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<any> {
    const response = await this.client.put(`/subscriptions/${subscriptionId}/cancel`, {
      cancelAtPeriodEnd
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

  async updateUser(userId: string, userData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    isActive?: boolean;
    teamId?: string;
  }): Promise<any> {
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

  async canCreateTicket(): Promise<any> {
    const response = await this.client.get('/usage-alerts/can-create-ticket');
    return response.data;
  }

  // Trial management endpoints
  async startTrial(planSlug: string, options?: {
    trialDays?: number;
    sendWelcomeEmail?: boolean;
    metadata?: Record<string, any>;
  }): Promise<any> {
    const response = await this.client.post('/subscriptions/trial/start', {
      planSlug,
      ...options
    });
    return response.data;
  }

  async convertTrial(subscriptionId: string, options: {
    paymentMethodId: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    sendWelcomeEmail?: boolean;
  }): Promise<any> {
    const response = await this.client.post(`/subscriptions/${subscriptionId}/trial/convert`, options);
    return response.data;
  }

  async cancelTrial(subscriptionId: string, reason?: string): Promise<any> {
    const response = await this.client.post(`/subscriptions/${subscriptionId}/trial/cancel`, {
      reason
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
      reason
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

  async getArchivableTickets(params?: {
    limit?: number;
    olderThanDays?: number;
  }): Promise<any> {
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
}

export const apiService = new ApiService();
export default apiService;

// Export as 'api' for backward compatibility
export const api = apiService;