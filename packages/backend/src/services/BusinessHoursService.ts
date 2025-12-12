import { Request, Response } from 'express';
import { db } from '../config/database';

export interface BusinessHours {
  id?: number;
  company_id: string;
  title: string;
  description?: string;
  timezone: string;
  is_active: boolean;
  is_default: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface BusinessHoursSchedule {
  id?: number;
  business_hours_id: number;
  day_of_week: number; // 0 = Sunday, 1 = Monday, etc.
  is_working_day: boolean;
  start_time?: string; // HH:MM:SS format
  end_time?: string;
  break_start?: string;
  break_end?: string;
}

export interface BusinessHoursWithSchedule extends BusinessHours {
  schedule: BusinessHoursSchedule[];
}

export class BusinessHoursService {
  // Get all business hours for a company
  static async getBusinessHours(companyId: string): Promise<BusinessHoursWithSchedule[]> {
    const businessHours = await db('business_hours')
      .where('company_id', companyId)
      .orderBy('is_default', 'desc')
      .orderBy('title', 'asc');

    const businessHoursWithSchedule: BusinessHoursWithSchedule[] = [];

    for (const bh of businessHours) {
      const schedule = await db('business_hours_schedule')
        .where('business_hours_id', bh.id)
        .orderBy('day_of_week', 'asc');

      businessHoursWithSchedule.push({
        ...bh,
        schedule,
      });
    }

    return businessHoursWithSchedule;
  }

  // Get a specific business hours configuration
  static async getBusinessHoursById(
    id: number,
    companyId: string
  ): Promise<BusinessHoursWithSchedule | null> {
    const businessHours = await db('business_hours').where({ id, company_id: companyId }).first();

    if (!businessHours) {
      return null;
    }

    const schedule = await db('business_hours_schedule')
      .where('business_hours_id', id)
      .orderBy('day_of_week', 'asc');

    return {
      ...businessHours,
      schedule,
    };
  }

  // Create new business hours
  static async createBusinessHours(
    data: BusinessHours,
    schedule: Omit<BusinessHoursSchedule, 'business_hours_id'>[]
  ): Promise<BusinessHoursWithSchedule> {
    const trx = await db.transaction();

    try {
      // If this is being set as default, unset other defaults
      if (data.is_default) {
        await trx('business_hours')
          .where('company_id', data.company_id)
          .update({ is_default: false });
      }

      const [businessHoursId] = await trx('business_hours').insert(data).returning('id');
      const id = typeof businessHoursId === 'object' ? businessHoursId.id : businessHoursId;

      // Insert schedule
      const scheduleData = schedule.map((s) => ({
        ...s,
        business_hours_id: id,
      }));

      await trx('business_hours_schedule').insert(scheduleData);

      await trx.commit();

      const result = await this.getBusinessHoursById(id, data.company_id);
      return result!;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Update business hours
  static async updateBusinessHours(
    id: number,
    companyId: string,
    data: Partial<BusinessHours>,
    schedule?: Omit<BusinessHoursSchedule, 'business_hours_id'>[]
  ): Promise<BusinessHoursWithSchedule | null> {
    const trx = await db.transaction();

    try {
      // Check if business hours exists
      const existing = await trx('business_hours').where({ id, company_id: companyId }).first();

      if (!existing) {
        await trx.rollback();
        return null;
      }

      // If this is being set as default, unset other defaults
      if (data.is_default) {
        await trx('business_hours')
          .where('company_id', companyId)
          .whereNot('id', id)
          .update({ is_default: false });
      }

      // Update business hours
      await trx('business_hours')
        .where({ id, company_id: companyId })
        .update({
          ...data,
          updated_at: new Date(),
        });

      // Update schedule if provided
      if (schedule) {
        await trx('business_hours_schedule').where('business_hours_id', id).del();

        const scheduleData = schedule.map((s) => ({
          ...s,
          business_hours_id: id,
        }));

        await trx('business_hours_schedule').insert(scheduleData);
      }

      await trx.commit();

      const result = await this.getBusinessHoursById(id, companyId);
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Delete business hours
  static async deleteBusinessHours(id: number, companyId: string): Promise<boolean> {
    const trx = await db.transaction();

    try {
      const existing = await trx('business_hours').where({ id, company_id: companyId }).first();

      if (!existing) {
        await trx.rollback();
        return false;
      }

      // Don't allow deletion of default business hours if it's the only one
      if (existing.is_default) {
        const count = await trx('business_hours')
          .where('company_id', companyId)
          .count('id as total')
          .first();

        if (count && parseInt(count.total as string) === 1) {
          await trx.rollback();
          throw new Error('Cannot delete the only business hours configuration');
        }

        // Set another one as default
        const nextDefault = await trx('business_hours')
          .where('company_id', companyId)
          .whereNot('id', id)
          .first();

        if (nextDefault) {
          await trx('business_hours').where('id', nextDefault.id).update({ is_default: true });
        }
      }

      await trx('business_hours_schedule').where('business_hours_id', id).del();

      await trx('business_hours').where({ id, company_id: companyId }).del();

      await trx.commit();
      return true;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Get default business hours for a company
  static async getDefaultBusinessHours(
    companyId: string
  ): Promise<BusinessHoursWithSchedule | null> {
    const businessHours = await db('business_hours')
      .where({ company_id: companyId, is_default: true })
      .first();

    if (!businessHours) {
      return null;
    }

    const schedule = await db('business_hours_schedule')
      .where('business_hours_id', businessHours.id)
      .orderBy('day_of_week', 'asc');

    return {
      ...businessHours,
      schedule,
    };
  }

  // Create default business hours for a new company
  static async createDefaultBusinessHours(companyId: string): Promise<BusinessHoursWithSchedule> {
    const defaultSchedule = [
      { day_of_week: 0, is_working_day: false, start_time: undefined, end_time: undefined }, // Sunday
      { day_of_week: 1, is_working_day: true, start_time: '09:00:00', end_time: '17:00:00' }, // Monday
      { day_of_week: 2, is_working_day: true, start_time: '09:00:00', end_time: '17:00:00' }, // Tuesday
      { day_of_week: 3, is_working_day: true, start_time: '09:00:00', end_time: '17:00:00' }, // Wednesday
      { day_of_week: 4, is_working_day: true, start_time: '09:00:00', end_time: '17:00:00' }, // Thursday
      { day_of_week: 5, is_working_day: true, start_time: '09:00:00', end_time: '17:00:00' }, // Friday
      { day_of_week: 6, is_working_day: false, start_time: undefined, end_time: undefined }, // Saturday
    ];

    const businessHours: BusinessHours = {
      company_id: companyId,
      title: 'Default Business Hours',
      description: 'Standard Monday to Friday, 9 AM to 5 PM business hours',
      timezone: 'America/New_York',
      is_active: true,
      is_default: true,
    };

    return await this.createBusinessHours(businessHours, defaultSchedule);
  }

  // Check if current time is within business hours
  static isWithinBusinessHours(
    schedule: BusinessHoursSchedule[],
    currentTime: Date,
    timezone: string
  ): boolean {
    const dayOfWeek = currentTime.getDay();
    const daySchedule = schedule.find((s) => s.day_of_week === dayOfWeek);

    if (
      !daySchedule ||
      !daySchedule.is_working_day ||
      !daySchedule.start_time ||
      !daySchedule.end_time
    ) {
      return false;
    }

    const currentTimeString = currentTime.toTimeString().substring(0, 8);

    // Check if within main working hours
    if (currentTimeString >= daySchedule.start_time && currentTimeString <= daySchedule.end_time) {
      // Check if not in break time
      if (daySchedule.break_start && daySchedule.break_end) {
        if (
          currentTimeString >= daySchedule.break_start &&
          currentTimeString <= daySchedule.break_end
        ) {
          return false; // In break time
        }
      }
      return true;
    }

    return false;
  }
}
