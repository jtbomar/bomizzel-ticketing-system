import { db } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

export interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTime: number;
}

export interface TableInfo {
  tableName: string;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
}

export class QueryBuilderService {
  // List of tables that are safe to query
  private static readonly ALLOWED_TABLES = [
    'users',
    'companies',
    'customer_subscriptions',
    'subscription_plans',
    'tickets',
    'ticket_notes',
    'ticket_attachments',
    'custom_fields',
    'user_company_associations',
    'teams',
    'queues',
    'data_export_logs',
    'data_import_logs'
  ];

  // Dangerous SQL keywords that should be blocked
  private static readonly BLOCKED_KEYWORDS = [
    'DROP',
    'DELETE',
    'TRUNCATE',
    'ALTER',
    'CREATE',
    'INSERT',
    'UPDATE',
    'GRANT',
    'REVOKE'
  ];

  /**
   * Execute a read-only SQL query
   */
  static async executeQuery(query: string, userId: string): Promise<QueryResult> {
    try {
      const startTime = Date.now();

      // Validate query is read-only
      this.validateQuery(query);

      logger.info('Executing query', { userId, query: query.substring(0, 100) });

      // Execute query
      const result = await db.raw(query);
      
      const executionTime = Date.now() - startTime;

      // Extract columns and rows
      const rows = result.rows || [];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      // Log query execution
      await this.logQueryExecution(userId, query, rows.length, executionTime);

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTime
      };

    } catch (error) {
      logger.error('Query execution failed', { error, userId });
      throw new AppError(
        `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        400
      );
    }
  }

  /**
   * Validate that query is safe (read-only)
   */
  private static validateQuery(query: string): void {
    const upperQuery = query.toUpperCase().trim();

    // Must start with SELECT
    if (!upperQuery.startsWith('SELECT')) {
      throw new AppError('Only SELECT queries are allowed', 400);
    }

    // Check for blocked keywords
    for (const keyword of this.BLOCKED_KEYWORDS) {
      if (upperQuery.includes(keyword)) {
        throw new AppError(`Keyword '${keyword}' is not allowed`, 400);
      }
    }

    // Check query length (prevent extremely long queries)
    if (query.length > 10000) {
      throw new AppError('Query is too long (max 10000 characters)', 400);
    }
  }

  /**
   * Get list of available tables with their columns
   */
  static async getTableSchema(): Promise<TableInfo[]> {
    try {
      const tables: TableInfo[] = [];

      for (const tableName of this.ALLOWED_TABLES) {
        const columns = await db.raw(`
          SELECT 
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_name = ?
          ORDER BY ordinal_position
        `, [tableName]);

        tables.push({
          tableName,
          columns: columns.rows.map((col: any) => ({
            columnName: col.column_name,
            dataType: col.data_type,
            isNullable: col.is_nullable === 'YES'
          }))
        });
      }

      return tables;

    } catch (error) {
      logger.error('Failed to get table schema', { error });
      throw new AppError('Failed to retrieve database schema', 500);
    }
  }

  /**
   * Build a query from visual query builder parameters
   */
  static buildQuery(params: {
    table: string;
    columns: string[];
    joins?: Array<{ table: string; on: string; type: 'INNER' | 'LEFT' | 'RIGHT' }>;
    where?: string;
    orderBy?: string;
    limit?: number;
  }): string {
    // Validate table
    if (!this.ALLOWED_TABLES.includes(params.table)) {
      throw new AppError(`Table '${params.table}' is not allowed`, 400);
    }

    // Build SELECT clause
    const columns = params.columns.length > 0 
      ? params.columns.join(', ') 
      : '*';
    
    let query = `SELECT ${columns} FROM ${params.table}`;

    // Add JOINs
    if (params.joins && params.joins.length > 0) {
      for (const join of params.joins) {
        if (!this.ALLOWED_TABLES.includes(join.table)) {
          throw new AppError(`Join table '${join.table}' is not allowed`, 400);
        }
        query += ` ${join.type} JOIN ${join.table} ON ${join.on}`;
      }
    }

    // Add WHERE clause
    if (params.where) {
      query += ` WHERE ${params.where}`;
    }

    // Add ORDER BY
    if (params.orderBy) {
      query += ` ORDER BY ${params.orderBy}`;
    }

    // Add LIMIT
    if (params.limit) {
      query += ` LIMIT ${params.limit}`;
    }

    return query;
  }

  /**
   * Get query history for a user
   */
  static async getQueryHistory(userId: string, limit: number = 20): Promise<any[]> {
    try {
      const history = await db('query_execution_logs')
        .where('user_id', userId)
        .orderBy('executed_at', 'desc')
        .limit(limit)
        .select('*');

      return history;

    } catch (error) {
      logger.error('Failed to get query history', { error, userId });
      return [];
    }
  }

  /**
   * Log query execution
   */
  private static async logQueryExecution(
    userId: string,
    query: string,
    rowCount: number,
    executionTime: number
  ): Promise<void> {
    try {
      await db('query_execution_logs').insert({
        user_id: userId,
        query: query.substring(0, 5000), // Limit stored query length
        row_count: rowCount,
        execution_time_ms: executionTime,
        executed_at: new Date()
      });
    } catch (error) {
      logger.error('Failed to log query execution', { error });
      // Don't throw - logging failure shouldn't stop query execution
    }
  }

  /**
   * Export query results to CSV
   */
  static exportToCSV(result: QueryResult): string {
    const { columns, rows } = result;

    // Create CSV header
    const header = columns.join(',');

    // Create CSV rows
    const csvRows = rows.map(row => {
      return columns.map(col => {
        const value = row[col];
        // Escape quotes and wrap in quotes if contains comma or quote
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    return [header, ...csvRows].join('\n');
  }

  /**
   * Get common query templates
   */
  static getQueryTemplates(): Array<{ name: string; description: string; query: string }> {
    return [
      {
        name: 'All Active Users',
        description: 'List all active users with their companies',
        query: `SELECT u.email, u.first_name, u.last_name, u.role, c.name as company_name
FROM users u
LEFT JOIN user_company_associations uca ON u.id = uca.user_id
LEFT JOIN companies c ON uca.company_id = c.id
WHERE u.is_active = true
ORDER BY u.created_at DESC
LIMIT 100`
      },
      {
        name: 'Provisioned Customers',
        description: 'All provisioned customers with subscription details',
        query: `SELECT 
  c.name as company_name,
  c.domain,
  u.email as admin_email,
  cs.status,
  cs.limits,
  cs.created_at
FROM customer_subscriptions cs
JOIN companies c ON cs.company_id = c.id
JOIN users u ON cs.user_id = u.id
WHERE cs.is_custom = true
ORDER BY cs.created_at DESC`
      },
      {
        name: 'Recent Tickets',
        description: 'Recent tickets with creator and assignee info',
        query: `SELECT 
  t.id,
  t.title,
  t.status,
  t.priority,
  c.name as company_name,
  creator.email as created_by,
  assignee.email as assigned_to,
  t.created_at
FROM tickets t
JOIN companies c ON t.company_id = c.id
LEFT JOIN users creator ON t.created_by = creator.id
LEFT JOIN users assignee ON t.assigned_to = assignee.id
ORDER BY t.created_at DESC
LIMIT 50`
      },
      {
        name: 'Company Statistics',
        description: 'User and ticket counts per company',
        query: `SELECT 
  c.name as company_name,
  COUNT(DISTINCT uca.user_id) as user_count,
  COUNT(DISTINCT t.id) as ticket_count,
  c.created_at
FROM companies c
LEFT JOIN user_company_associations uca ON c.id = uca.company_id
LEFT JOIN tickets t ON c.id = t.company_id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.created_at
ORDER BY user_count DESC`
      },
      {
        name: 'Data Export Activity',
        description: 'Recent data export and import activity',
        query: `SELECT 
  'Export' as activity_type,
  c.name as company_name,
  u.email as user_email,
  del.exported_data as details,
  del.created_at
FROM data_export_logs del
JOIN companies c ON del.company_id = c.id
JOIN users u ON del.user_id = u.id
ORDER BY del.created_at DESC
LIMIT 50`
      }
    ];
  }
}
