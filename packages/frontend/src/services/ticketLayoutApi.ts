import { apiService } from './api';
import { TicketLayout, TicketLayoutResponse, CreateLayoutRequest } from '../types/ticketLayout';

export class TicketLayoutApiService {
  async getLayoutsByTeam(teamId: string): Promise<TicketLayout[]> {
    const response = await apiService.client.get(`/ticket-layouts?teamId=${teamId}`);
    return response.data.layouts;
  }

  async getLayoutById(layoutId: string, includeFields = true): Promise<TicketLayoutResponse> {
    const response = await apiService.client.get(
      `/ticket-layouts/${layoutId}?includeFields=${includeFields}`
    );
    return response.data;
  }

  async getDefaultLayout(teamId: string): Promise<TicketLayoutResponse> {
    const response = await apiService.client.get(`/ticket-layouts/team/${teamId}/default`);
    return response.data;
  }

  async createLayout(teamId: string, request: CreateLayoutRequest): Promise<TicketLayoutResponse> {
    const response = await apiService.client.post('/ticket-layouts', {
      ...request,
      teamId,
    });
    return response.data;
  }

  async updateLayout(
    layoutId: string,
    request: Partial<CreateLayoutRequest>
  ): Promise<TicketLayoutResponse> {
    const response = await apiService.client.put(`/ticket-layouts/${layoutId}`, request);
    return response.data;
  }

  async deleteLayout(layoutId: string): Promise<void> {
    await apiService.client.delete(`/ticket-layouts/${layoutId}`);
  }

  async duplicateLayout(layoutId: string, newName: string): Promise<TicketLayoutResponse> {
    const response = await apiService.client.post(`/ticket-layouts/${layoutId}/duplicate`, {
      name: newName,
    });
    return response.data;
  }
}

export const ticketLayoutApi = new TicketLayoutApiService();
