import { db } from '../config/database';

export interface HolidayList {
  id?: number;
  company_id: string;
  name: string;
  description?: string;
  region?: string;
  is_active: boolean;
  is_default: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface Holiday {
  id?: number;
  holiday_list_id: number;
  name: string;
  date: string; // YYYY-MM-DD format
  is_recurring: boolean;
  recurrence_pattern?: string;
  description?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface HolidayListWithHolidays extends HolidayList {
  holidays: Holiday[];
}

export class HolidayListService {
  // Get all holiday lists for a company
  static async getHolidayLists(companyId: string): Promise<HolidayListWithHolidays[]> {
    const holidayLists = await db('holiday_lists')
      .where('company_id', companyId)
      .orderBy('is_default', 'desc')
      .orderBy('name', 'asc');

    const holidayListsWithHolidays: HolidayListWithHolidays[] = [];

    for (const list of holidayLists) {
      const holidays = await db('holidays')
        .where('holiday_list_id', list.id)
        .orderBy('date', 'asc');

      holidayListsWithHolidays.push({
        ...list,
        holidays
      });
    }

    return holidayListsWithHolidays;
  }

  // Get a specific holiday list
  static async getHolidayListById(id: number, companyId: string): Promise<HolidayListWithHolidays | null> {
    const holidayList = await db('holiday_lists')
      .where({ id, company_id: companyId })
      .first();

    if (!holidayList) {
      return null;
    }

    const holidays = await db('holidays')
      .where('holiday_list_id', id)
      .orderBy('date', 'asc');

    return {
      ...holidayList,
      holidays
    };
  }

  // Create new holiday list
  static async createHolidayList(data: HolidayList, holidays: Omit<Holiday, 'holiday_list_id'>[]): Promise<HolidayListWithHolidays> {
    const trx = await db.transaction();

    try {
      // If this is being set as default, unset other defaults
      if (data.is_default) {
        await trx('holiday_lists')
          .where('company_id', data.company_id)
          .update({ is_default: false });
      }

      const [holidayListId] = await trx('holiday_lists').insert(data).returning('id');
      const id = typeof holidayListId === 'object' ? holidayListId.id : holidayListId;

      // Insert holidays
      if (holidays.length > 0) {
        const holidayData = holidays.map(h => ({
          ...h,
          holiday_list_id: id
        }));

        await trx('holidays').insert(holidayData);
      }

      await trx.commit();

      const result = await this.getHolidayListById(id, data.company_id);
      return result!;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Update holiday list
  static async updateHolidayList(id: number, companyId: string, data: Partial<HolidayList>, holidays?: Omit<Holiday, 'holiday_list_id'>[]): Promise<HolidayListWithHolidays | null> {
    const trx = await db.transaction();

    try {
      // Check if holiday list exists
      const existing = await trx('holiday_lists')
        .where({ id, company_id: companyId })
        .first();

      if (!existing) {
        await trx.rollback();
        return null;
      }

      // If this is being set as default, unset other defaults
      if (data.is_default) {
        await trx('holiday_lists')
          .where('company_id', companyId)
          .whereNot('id', id)
          .update({ is_default: false });
      }

      // Update holiday list
      await trx('holiday_lists')
        .where({ id, company_id: companyId })
        .update({
          ...data,
          updated_at: new Date()
        });

      // Update holidays if provided
      if (holidays) {
        await trx('holidays')
          .where('holiday_list_id', id)
          .del();

        if (holidays.length > 0) {
          const holidayData = holidays.map(h => ({
            ...h,
            holiday_list_id: id
          }));

          await trx('holidays').insert(holidayData);
        }
      }

      await trx.commit();

      const result = await this.getHolidayListById(id, companyId);
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Delete holiday list
  static async deleteHolidayList(id: number, companyId: string): Promise<boolean> {
    const trx = await db.transaction();

    try {
      const existing = await trx('holiday_lists')
        .where({ id, company_id: companyId })
        .first();

      if (!existing) {
        await trx.rollback();
        return false;
      }

      // Don't allow deletion of default holiday list if it's the only one
      if (existing.is_default) {
        const count = await trx('holiday_lists')
          .where('company_id', companyId)
          .count('id as total')
          .first();

        if (count && parseInt(count.total as string) === 1) {
          await trx.rollback();
          throw new Error('Cannot delete the only holiday list configuration');
        }

        // Set another one as default
        const nextDefault = await trx('holiday_lists')
          .where('company_id', companyId)
          .whereNot('id', id)
          .first();

        if (nextDefault) {
          await trx('holiday_lists')
            .where('id', nextDefault.id)
            .update({ is_default: true });
        }
      }

      // Delete holidays first (cascade should handle this, but being explicit)
      await trx('holidays')
        .where('holiday_list_id', id)
        .del();

      // Delete business hours associations
      await trx('business_hours_holiday_lists')
        .where('holiday_list_id', id)
        .del();

      await trx('holiday_lists')
        .where({ id, company_id: companyId })
        .del();

      await trx.commit();
      return true;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Get default holiday list for a company
  static async getDefaultHolidayList(companyId: string): Promise<HolidayListWithHolidays | null> {
    const holidayList = await db('holiday_lists')
      .where({ company_id: companyId, is_default: true })
      .first();

    if (!holidayList) {
      return null;
    }

    const holidays = await db('holidays')
      .where('holiday_list_id', holidayList.id)
      .orderBy('date', 'asc');

    return {
      ...holidayList,
      holidays
    };
  }

  // Create default US holiday list for a new company
  static async createDefaultUSHolidayList(companyId: string): Promise<HolidayListWithHolidays> {
    const currentYear = new Date().getFullYear();
    
    const defaultHolidays = [
      { name: 'New Year\'s Day', date: `${currentYear}-01-01`, is_recurring: true, recurrence_pattern: 'yearly', description: 'New Year\'s Day' },
      { name: 'Independence Day', date: `${currentYear}-07-04`, is_recurring: true, recurrence_pattern: 'yearly', description: 'Independence Day' },
      { name: 'Christmas Day', date: `${currentYear}-12-25`, is_recurring: true, recurrence_pattern: 'yearly', description: 'Christmas Day' },
      { name: 'Thanksgiving', date: `${currentYear}-11-28`, is_recurring: true, recurrence_pattern: 'yearly', description: 'Thanksgiving Day (4th Thursday in November)' },
      { name: 'Labor Day', date: `${currentYear}-09-02`, is_recurring: true, recurrence_pattern: 'yearly', description: 'Labor Day (1st Monday in September)' },
    ];

    const holidayList: HolidayList = {
      company_id: companyId,
      name: 'US Federal Holidays',
      description: 'Standard US federal holidays',
      region: 'US',
      is_active: true,
      is_default: true
    };

    return await this.createHolidayList(holidayList, defaultHolidays);
  }

  // Check if a date is a holiday
  static async isHoliday(companyId: string, date: string, holidayListId?: number): Promise<boolean> {
    let query = db('holidays')
      .join('holiday_lists', 'holidays.holiday_list_id', 'holiday_lists.id')
      .where('holiday_lists.company_id', companyId)
      .where('holiday_lists.is_active', true)
      .where('holidays.date', date);

    if (holidayListId) {
      query = query.where('holidays.holiday_list_id', holidayListId);
    }

    const holiday = await query.first();
    return !!holiday;
  }

  // Get holidays for a date range
  static async getHolidaysInRange(companyId: string, startDate: string, endDate: string, holidayListId?: number): Promise<Holiday[]> {
    let query = db('holidays')
      .join('holiday_lists', 'holidays.holiday_list_id', 'holiday_lists.id')
      .where('holiday_lists.company_id', companyId)
      .where('holiday_lists.is_active', true)
      .whereBetween('holidays.date', [startDate, endDate])
      .orderBy('holidays.date', 'asc');

    if (holidayListId) {
      query = query.where('holidays.holiday_list_id', holidayListId);
    }

    return await query.select('holidays.*');
  }
}