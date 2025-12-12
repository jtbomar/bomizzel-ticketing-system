import { db } from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { Company } from '@/models/Company';

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

export class CustomerQueryBuilderService {
  // Tables that customers can query (only their own data)
  private static readonly ALLOWED_TABLES = [
    'tickets',
    'ticket_notes',
    'ticket_attachments',
    'users',
    'custom_fields',
    'teams',
    'queues',
  ];

  // Blocked keywords for safety
  private static readonly BLOCKED_KEYWORDS = [
    'DROP',
    'DELETE',
    'TRUNCATE',
    'ALTER',
    'CREATE',
    'INSERT',
    'UPDATE',
    'GRANT',
    'REVOKE',
    'EXEC',
    'EXECUTE',
  ];

  /**
   * Execute a read-only SQL query scoped to customer's company
   */
  static async executeQuery(
    query: string,
    userId: string,
    companyId: string
  ): Promise<QueryResult> {
    try {
      const startTime = Date.now();

      // Validate user has access to company
      const hasAccess = await Company.isUserInCompany(userId, companyId);
      if (!hasAccess) {
        throw new AppError('Access denied to this company', 403);
      }

      // Validate query is read-only
      this.validateQuery(query);

      // Add company filter to query
      const scopedQuery = this.addCompanyScope(query, companyId);

      logger.info('Executing customer query', {
        userId,
        companyId,
        query: scopedQuery.substring(0, 100),
      });

      // Execute query
      const result = await db.raw(scopedQuery);

      const executionTime = Date.now() - startTime;

      // Extract columns and rows
      const rows = result.rows || [];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      // Log query execution
      await this.logQueryExecution(userId, companyId, query, rows.length, executionTime);

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTime,
      };
    } catch (error) {
      logger.error('Customer query execution failed', { error, userId, companyId });
      throw new AppError(
        `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        400
      );
    }
  }

  /**
   * Add company_id filter to query to scope results
   */
  private static addCompanyScope(query: string, companyId: string): string {
    // This is a simplified approach - in production you'd want more sophisticated query parsing
    // For now, we'll add a WHERE clause or AND condition

    const upperQuery = query.toUpperCase();

    // Find the main table being queried
    const fromMatch = query.match(/FROM\s+(\w+)/i);
    if (!fromMatch) {
      throw new AppError('Could not determine table from query', 400);
    }

    const tableName = fromMatch[1];
    const tableAlias = this.getTableAlias(query, tableName);
    const prefix = tableAlias || tableName;

    // Check if table has company_id column
    if (['tickets', 'custom_fields', 'teams', 'queues'].includes(tableName.toLowerCase())) {
      // Add company filter
      if (upperQuery.includes('WHERE')) {
        // Add to existing WHERE clause
        return query.replace(/WHERE/i, `WHERE ${prefix}.company_id = '${companyId}' AND`);
      } else if (upperQuery.includes('GROUP BY')) {
        // Add WHERE before GROUP BY
        return query.replace(/GROUP BY/i, `WHERE ${prefix}.company_id = '${companyId}' GROUP BY`);
      } else if (upperQuery.includes('ORDER BY')) {
        // Add WHERE before ORDER BY
        return query.replace(/ORDER BY/i, `WHERE ${prefix}.company_id = '${companyId}' ORDER BY`);
      } else if (upperQuery.includes('LIMIT')) {
        // Add WHERE before LIMIT
        return query.replace(/LIMIT/i, `WHERE ${prefix}.company_id = '${companyId}' LIMIT`);
      } else {
        // Add WHERE at the end
        return `${query} WHERE ${prefix}.company_id = '${companyId}'`;
      }
    }

    // For tables without company_id (like users), we need to join through associations
    if (tableName.toLowerCase() === 'users') {
      // Users must be filtered through user_company_associations
      const hasJoin = upperQuery.includes('USER_COMPANY_ASSOCIATIONS');
      if (!hasJoin) {
        throw new AppError('Users query must include user_company_associations join', 400);
      }
      // Add filter on the association
      if (upperQuery.includes('WHERE')) {
        return query.replace(/WHERE/i, `WHERE uca.company_id = '${companyId}' AND`);
      } else {
        return query.replace(/ORDER BY|LIMIT|$/i, `WHERE uca.company_id = '${companyId}' $&`);
      }
    }

    return query;
  }

  /**
   * Get table alias from query if exists
   */
  private static getTableAlias(query: string, tableName: string): string | null {
    const aliasMatch = query.match(new RegExp(`FROM\\s+${tableName}\\s+(\\w+)`, 'i'));
    return aliasMatch ? aliasMatch[1] : null;
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

    // Check query length
    if (query.length > 5000) {
      throw new AppError('Query is too long (max 5000 characters)', 400);
    }

    // Ensure query only references allowed tables
    const fromMatch = query.match(/FROM\s+(\w+)/i);
    if (fromMatch) {
      const tableName = fromMatch[1].toLowerCase();
      if (!this.ALLOWED_TABLES.includes(tableName)) {
        throw new AppError(`Table '${tableName}' is not accessible`, 400);
      }
    }
  }

  /**
   * Get list of available tables with their columns (customer-accessible only)
   */
  static async getTableSchema(): Promise<TableInfo[]> {
    try {
      const tables: TableInfo[] = [];

      for (const tableName of this.ALLOWED_TABLES) {
        const columns = await db.raw(
          `
          SELECT 
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_name = ?
          ORDER BY ordinal_position
        `,
          [tableName]
        );

        tables.push({
          tableName,
          columns: columns.rows.map((col: any) => ({
            columnName: col.column_name,
            dataType: col.data_type,
            isNullable: col.is_nullable === 'YES',
          })),
        });
      }

      return tables;
    } catch (error) {
      logger.error('Failed to get table schema', { error });
      throw new AppError('Failed to retrieve database schema', 500);
    }
  }

  /**
   * Get customer-specific query templates
   */
  static getQueryTemplates(): Array<{ name: string; description: string; query: string }> {
    return [
      {
        name: 'All Open Tickets',
        description: 'List all open tickets for your company',
        query: `SELECT 
  id,
  title,
  status,
  priority,
  created_at,
  updated_at
FROM tickets
WHERE status IN ('open', 'in_progress')
ORDER BY created_at DESC
LIMIT 100`,
      },
      {
        name: 'Tickets by Status',
        description: 'Count tickets grouped by status',
        query: `SELECT 
  status,
  COUNT(*) as ticket_count
FROM tickets
GROUP BY status
ORDER BY ticket_count DESC`,
      },
      {
        name: 'Tickets by Priority',
        description: 'Count tickets grouped by priority',
        query: `SELECT 
  priority,
  COUNT(*) as ticket_count
FROM tickets
GROUP BY priority
ORDER BY 
  CASE priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END`,
      },
      {
        name: 'Recent Ticket Activity',
        description: 'Tickets created in the last 7 days',
        query: `SELECT 
  id,
  title,
  status,
  priority,
  created_at
FROM tickets
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC`,
      },
      {
        name: 'Tickets with Most Notes',
        description: 'Tickets with the highest number of notes',
        query: `SELECT 
  t.id,
  t.title,
  t.status,
  COUNT(tn.id) as note_count
FROM tickets t
LEFT JOIN ticket_notes tn ON t.id = tn.ticket_id
GROUP BY t.id, t.title, t.status
ORDER BY note_count DESC
LIMIT 20`,
      },
      {
        name: 'My Company Users',
        description: 'All users in your company',
        query: `SELECT 
  u.email,
  u.first_name,
  u.last_name,
  u.role,
  u.is_active,
  uca.role as company_role
FROM users u
JOIN user_company_associations uca ON u.id = uca.user_id
WHERE u.is_active = true
ORDER BY u.first_name, u.last_name`,
      },
      {
        name: 'Ticket Resolution Time',
        description: 'Average time to resolve tickets',
        query: `SELECT 
  status,
  COUNT(*) as ticket_count,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_hours_to_resolve
FROM tickets
WHERE resolved_at IS NOT NULL
GROUP BY status`,
      },
      {
        name: 'Tickets by Category',
        description: 'Count tickets by category',
        query: `SELECT 
  category,
  COUNT(*) as ticket_count
FROM tickets
WHERE category IS NOT NULL
GROUP BY category
ORDER BY ticket_count DESC`,
      },
    ];
  }

  /**
   * Log query execution
   */
  private static async logQueryExecution(
    userId: string,
    companyId: string,
    query: string,
    rowCount: number,
    executionTime: number
  ): Promise<void> {
    try {
      await db('customer_query_logs').insert({
        user_id: userId,
        company_id: companyId,
        query: query.substring(0, 2000),
        row_count: rowCount,
        execution_time_ms: executionTime,
        executed_at: new Date(),
      });
    } catch (error) {
      logger.error('Failed to log customer query execution', { error });
    }
  }

  /**
   * Export query results to CSV
   */
  static exportToCSV(result: QueryResult): string {
    const { columns, rows } = result;

    const header = columns.join(',');

    const csvRows = rows.map((row) => {
      return columns
        .map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (
            stringValue.includes(',') ||
            stringValue.includes('"') ||
            stringValue.includes('\n')
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',');
    });

    return [header, ...csvRows].join('\n');
  }
}
