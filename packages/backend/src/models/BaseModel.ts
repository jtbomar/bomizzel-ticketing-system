import { db } from '@/config/database';
import { Knex } from 'knex';

export abstract class BaseModel {
  protected static tableName: string;
  public static db = db;

  static get query(): Knex.QueryBuilder {
    return this.db(this.tableName);
  }

  static async findById(id: string): Promise<any | null> {
    const result = await this.query.where('id', id).first();
    return result || null;
  }

  static async findAll(
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
      where?: Record<string, any>;
    } = {}
  ): Promise<any[]> {
    let query = this.query;

    if (options.where) {
      query = query.where(options.where);
    }

    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.orderDirection || 'asc');
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }

  static async create(data: Record<string, any>): Promise<any> {
    const [result] = await this.query.insert(data).returning('*');
    return result;
  }

  static async update(id: string, data: Record<string, any>): Promise<any | null> {
    const [result] = await this.query
      .where('id', id)
      .update({ ...data, updated_at: new Date() })
      .returning('*');
    return result || null;
  }

  static async delete(id: string): Promise<boolean> {
    const deletedCount = await this.query.where('id', id).del();
    return deletedCount > 0;
  }

  static async count(where?: Record<string, any>): Promise<number> {
    let query = this.query.count('* as count');

    if (where) {
      query = query.where(where);
    }

    const result = await query.first();
    return parseInt(result?.count || '0', 10);
  }

  static async exists(where: Record<string, any>): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  // Transaction support
  static async transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(callback);
  }

  // Utility method to convert snake_case to camelCase
  protected static toCamelCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = value;
    }

    return result;
  }

  // Utility method to convert camelCase to snake_case
  protected static toSnakeCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = value;
    }

    return result;
  }
}
