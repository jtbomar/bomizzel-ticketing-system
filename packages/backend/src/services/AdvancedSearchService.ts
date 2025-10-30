import { Ticket } from '../models/Ticket';
import { CustomField } from '../models/CustomField';
import { User } from '../models/User';
import { TicketTable } from '../types/database';
import { Ticket as TicketModel, PaginatedResponse } from '../types/models';
import { ValidationError } from '../utils/errors';

export interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_null' | 'is_not_null';
  value?: any;
  values?: any[];
}

export interface AdvancedSearchRequest {
  query?: string; // General text search
  filters: SearchFilter[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  teamId?: string;
  companyIds?: string[];
}

export interface SearchableField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'custom';
  options?: string[];
  searchable: boolean;
  sortable: boolean;
}

export class AdvancedSearchService {
  /**
   * Get searchable fields for a team
   */
  static async getSearchableFields(teamId: string): Promise<SearchableField[]> {
    const fields: SearchableField[] = [
      // Standard ticket fields
      { name: 'title', label: 'Title', type: 'string', searchable: true, sortable: true },
      { name: 'description', label: 'Description', type: 'string', searchable: true, sortable: false },
      { name: 'status', label: 'Status', type: 'select', searchable: true, sortable: true },
      { name: 'priority', label: 'Priority', type: 'number', searchable: true, sortable: true },
      { name: 'created_at', label: 'Created Date', type: 'date', searchable: true, sortable: true },
      { name: 'updated_at', label: 'Updated Date', type: 'date', searchable: true, sortable: true },
      { name: 'resolved_at', label: 'Resolved Date', type: 'date', searchable: true, sortable: true },
      { name: 'submitter_id', label: 'Submitter', type: 'select', searchable: true, sortable: true },
      { name: 'assigned_to_id', label: 'Assignee', type: 'select', searchable: true, sortable: true },
      { name: 'company_id', label: 'Company', type: 'select', searchable: true, sortable: true },
      { name: 'queue_id', label: 'Queue', type: 'select', searchable: true, sortable: true },
    ];

    // Add custom fields
    const customFields = await CustomField.findByTeam(teamId);
    for (const customField of customFields) {
      fields.push({
        name: `custom_field_${customField.name}`,
        label: customField.label,
        type: 'custom',
        options: customField.type === 'picklist' ? customField.options : undefined,
        searchable: true,
        sortable: customField.type !== 'string' || customField.type === 'picklist',
      });
    }

    return fields;
  }

  /**
   * Perform advanced search
   */
  static async search(
    request: AdvancedSearchRequest,
    userId: string,
    userRole: string
  ): Promise<PaginatedResponse<TicketModel>> {
    const {
      query,
      filters,
      sortBy = 'created_at',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      teamId,
      companyIds
    } = request;

    // Build base query
    let dbQuery = Ticket.db('tickets as t')
      .leftJoin('users as submitter', 't.submitter_id', 'submitter.id')
      .leftJoin('users as assignee', 't.assigned_to_id', 'assignee.id')
      .leftJoin('companies as c', 't.company_id', 'c.id')
      .leftJoin('queues as q', 't.queue_id', 'q.id')
      .select(
        't.*',
        'submitter.first_name as submitter_first_name',
        'submitter.last_name as submitter_last_name',
        'submitter.email as submitter_email',
        'assignee.first_name as assignee_first_name',
        'assignee.last_name as assignee_last_name',
        'assignee.email as assignee_email',
        'c.name as company_name',
        'q.name as queue_name'
      );

    // Apply permission filtering
    if (userRole === 'customer') {
      const userCompanies = await User.getUserCompanies(userId);
      const userCompanyIds = userCompanies.map(uc => uc.companyId);
      
      if (userCompanyIds.length === 0) {
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        };
      }
      
      dbQuery = dbQuery.whereIn('t.company_id', userCompanyIds);
    } else if (userRole === 'employee') {
      const userTeams = await User.getUserTeams(userId);
      const teamIds = userTeams.map(ut => ut.teamId);
      
      if (teamIds.length > 0) {
        dbQuery = dbQuery.where(function() {
          this.whereIn('t.team_id', teamIds).orWhere('t.assigned_to_id', userId);
        });
      } else {
        dbQuery = dbQuery.where('t.assigned_to_id', userId);
      }
    }

    // Apply team filter
    if (teamId) {
      dbQuery = dbQuery.where('t.team_id', teamId);
    }

    // Apply company filter
    if (companyIds && companyIds.length > 0) {
      dbQuery = dbQuery.whereIn('t.company_id', companyIds);
    }

    // Apply general text search
    if (query && query.trim()) {
      const searchTerm = `%${query.trim()}%`;
      dbQuery = dbQuery.where(function() {
        this.where('t.title', 'ilike', searchTerm)
          .orWhere('t.description', 'ilike', searchTerm)
          .orWhere('submitter.first_name', 'ilike', searchTerm)
          .orWhere('submitter.last_name', 'ilike', searchTerm)
          .orWhere('assignee.first_name', 'ilike', searchTerm)
          .orWhere('assignee.last_name', 'ilike', searchTerm)
          .orWhere('c.name', 'ilike', searchTerm);
      });
    }

    // Apply filters
    for (const filter of filters) {
      dbQuery = this.applyFilter(dbQuery, filter);
    }

    // Get total count
    const countQuery = dbQuery.clone().clearSelect().clearOrder().count('* as total');
    const [{ total }] = await countQuery;
    const totalCount = parseInt(total as string);

    // Apply sorting
    if (sortBy.startsWith('custom_field_')) {
      const customFieldName = sortBy.replace('custom_field_', '');
      dbQuery = dbQuery.orderByRaw(`t.custom_field_values->>'${customFieldName}' ${sortOrder}`);
    } else if (sortBy === 'submitter_name') {
      dbQuery = dbQuery.orderBy('submitter.first_name', sortOrder).orderBy('submitter.last_name', sortOrder);
    } else if (sortBy === 'assignee_name') {
      dbQuery = dbQuery.orderBy('assignee.first_name', sortOrder).orderBy('assignee.last_name', sortOrder);
    } else {
      dbQuery = dbQuery.orderBy(`t.${sortBy}`, sortOrder);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    dbQuery = dbQuery.limit(limit).offset(offset);

    // Execute query
    const tickets = await dbQuery;

    // Convert to models
    const ticketModels = tickets.map(ticket => this.enrichTicketFromJoin(ticket));

    return {
      data: ticketModels,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  /**
   * Apply a single filter to the query
   */
  private static applyFilter(query: any, filter: SearchFilter): any {
    const { field, operator, value, values } = filter;

    // Handle custom fields
    if (field.startsWith('custom_field_')) {
      const customFieldName = field.replace('custom_field_', '');
      return this.applyCustomFieldFilter(query, customFieldName, operator, value, values);
    }

    // Handle standard fields
    const dbField = `t.${field}`;

    switch (operator) {
      case 'equals':
        return query.where(dbField, value);
      
      case 'contains':
        return query.where(dbField, 'ilike', `%${value}%`);
      
      case 'starts_with':
        return query.where(dbField, 'ilike', `${value}%`);
      
      case 'ends_with':
        return query.where(dbField, 'ilike', `%${value}`);
      
      case 'greater_than':
        return query.where(dbField, '>', value);
      
      case 'less_than':
        return query.where(dbField, '<', value);
      
      case 'in':
        return query.whereIn(dbField, values || []);
      
      case 'not_in':
        return query.whereNotIn(dbField, values || []);
      
      case 'is_null':
        return query.whereNull(dbField);
      
      case 'is_not_null':
        return query.whereNotNull(dbField);
      
      default:
        throw new ValidationError(`Unsupported operator: ${operator}`);
    }
  }

  /**
   * Apply filter to custom field
   */
  private static applyCustomFieldFilter(
    query: any,
    fieldName: string,
    operator: string,
    value: any,
    values?: any[]
  ): any {
    const jsonPath = `custom_field_values->>'${fieldName}'`;

    switch (operator) {
      case 'equals':
        return query.whereRaw(`${jsonPath} = ?`, [value]);
      
      case 'contains':
        return query.whereRaw(`${jsonPath} ILIKE ?`, [`%${value}%`]);
      
      case 'starts_with':
        return query.whereRaw(`${jsonPath} ILIKE ?`, [`${value}%`]);
      
      case 'ends_with':
        return query.whereRaw(`${jsonPath} ILIKE ?`, [`%${value}`]);
      
      case 'greater_than':
        return query.whereRaw(`(${jsonPath})::numeric > ?`, [value]);
      
      case 'less_than':
        return query.whereRaw(`(${jsonPath})::numeric < ?`, [value]);
      
      case 'in':
        return query.whereRaw(`${jsonPath} = ANY(?)`, [values]);
      
      case 'not_in':
        return query.whereRaw(`${jsonPath} != ALL(?)`, [values]);
      
      case 'is_null':
        return query.whereRaw(`${jsonPath} IS NULL OR ${jsonPath} = ''`);
      
      case 'is_not_null':
        return query.whereRaw(`${jsonPath} IS NOT NULL AND ${jsonPath} != ''`);
      
      default:
        throw new ValidationError(`Unsupported operator for custom field: ${operator}`);
    }
  }

  /**
   * Enrich ticket data from joined query
   */
  private static enrichTicketFromJoin(row: any): TicketModel {
    const ticket = Ticket.toModel({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      submitter_id: row.submitter_id,
      company_id: row.company_id,
      assigned_to_id: row.assigned_to_id,
      queue_id: row.queue_id,
      team_id: row.team_id,
      custom_field_values: row.custom_field_values,
      resolved_at: row.resolved_at,
      closed_at: row.closed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });

    // Add related data
    if (row.submitter_first_name) {
      (ticket as any).submitter = {
        id: row.submitter_id,
        firstName: row.submitter_first_name,
        lastName: row.submitter_last_name,
        email: row.submitter_email,
      };
    }

    if (row.assignee_first_name) {
      (ticket as any).assignedTo = {
        id: row.assigned_to_id,
        firstName: row.assignee_first_name,
        lastName: row.assignee_last_name,
        email: row.assignee_email,
      };
    }

    if (row.company_name) {
      (ticket as any).company = {
        id: row.company_id,
        name: row.company_name,
      };
    }

    if (row.queue_name) {
      (ticket as any).queue = {
        id: row.queue_id,
        name: row.queue_name,
      };
    }

    return ticket;
  }

  /**
   * Save search query for later use
   */
  static async saveSearch(
    userId: string,
    name: string,
    searchRequest: AdvancedSearchRequest
  ): Promise<void> {
    // This could be implemented to save user's search queries
    // For now, we'll just log it
    console.log(`Saving search "${name}" for user ${userId}:`, searchRequest);
  }

  /**
   * Get saved searches for user
   */
  static async getSavedSearches(userId: string): Promise<any[]> {
    // This could be implemented to retrieve user's saved searches
    // For now, return empty array
    return [];
  }
}

export default AdvancedSearchService;