import { BaseModel } from './BaseModel';
import { db } from '../config/database';

export interface CustomerHappinessSettings {
  id?: number;
  company_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  survey_config: {
    rating_scale: 'five_star' | 'ten_point' | 'thumbs' | 'emoji';
    rating_question: string;
    custom_questions: Array<{
      id: string;
      question: string;
      type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'scale';
      required: boolean;
      options?: string[];
    }>;
    include_comments: boolean;
    comments_required: boolean;
    comments_placeholder: string;
  };
  trigger_conditions: {
    on_ticket_resolved: boolean;
    on_ticket_closed: boolean;
    department_ids: number[];
    priority_levels: string[];
    ticket_types: string[];
    exclude_internal_tickets: boolean;
  };
  email_template: {
    subject: string;
    header_text: string;
    footer_text: string;
    button_text: string;
    company_logo?: string;
    primary_color: string;
    include_ticket_details: boolean;
  };
  delay_hours: number;
  reminder_hours: number;
  max_reminders: number;
  thank_you_message: string;
  follow_up_message?: string;
  low_rating_threshold: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface CustomerFeedback {
  id?: number;
  ticket_id: string;
  customer_id: string;
  happiness_setting_id: number;
  survey_token: string;
  overall_rating?: number;
  question_responses?: Record<string, any>;
  comments?: string;
  status: 'pending' | 'completed' | 'expired';
  sent_at?: Date;
  completed_at?: Date;
  expires_at?: Date;
  reminder_count: number;
  last_reminder_at?: Date;
  ip_address?: string;
  user_agent?: string;
  response_metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface CustomerHappinessAnalytics {
  id?: number;
  company_id: string;
  happiness_setting_id: number;
  date: string;
  surveys_sent: number;
  surveys_completed: number;
  completion_rate: number;
  average_rating?: number;
  total_responses: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
  low_rating_count: number;
  follow_up_triggered: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface CustomerHappinessWithStats extends CustomerHappinessSettings {
  stats: {
    total_surveys_sent: number;
    total_responses: number;
    completion_rate: number;
    average_rating: number;
    last_30_days: {
      surveys_sent: number;
      responses: number;
      average_rating: number;
    };
  };
}

export class CustomerHappiness extends BaseModel {
  protected static tableName = 'customer_happiness_settings';

  // Get all happiness settings for a company
  static async getByCompany(companyId: string): Promise<CustomerHappinessWithStats[]> {
    const settings = await db('customer_happiness_settings')
      .where('company_id', companyId)
      .orderBy('is_default', 'desc')
      .orderBy('name', 'asc');

    const settingsWithStats = await Promise.all(
      settings.map(async (setting) => {
        // Get overall stats
        const totalStats = await db('customer_feedback')
          .where('happiness_setting_id', setting.id)
          .select(
            db.raw('COUNT(*) as total_surveys'),
            db.raw("COUNT(CASE WHEN status = 'completed' THEN 1 END) as total_responses"),
            db.raw(
              'AVG(CASE WHEN overall_rating IS NOT NULL THEN overall_rating END) as avg_rating'
            )
          )
          .first();

        // Get last 30 days stats
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentStats = await db('customer_feedback')
          .where('happiness_setting_id', setting.id)
          .where('created_at', '>=', thirtyDaysAgo)
          .select(
            db.raw('COUNT(*) as recent_surveys'),
            db.raw("COUNT(CASE WHEN status = 'completed' THEN 1 END) as recent_responses"),
            db.raw(
              'AVG(CASE WHEN overall_rating IS NOT NULL THEN overall_rating END) as recent_avg_rating'
            )
          )
          .first();

        const totalSurveys = parseInt(totalStats?.total_surveys || '0');
        const totalResponses = parseInt(totalStats?.total_responses || '0');
        const completionRate = totalSurveys > 0 ? (totalResponses / totalSurveys) * 100 : 0;

        return {
          ...setting,
          stats: {
            total_surveys_sent: totalSurveys,
            total_responses: totalResponses,
            completion_rate: Math.round(completionRate * 100) / 100,
            average_rating: parseFloat(totalStats?.avg_rating || '0') || 0,
            last_30_days: {
              surveys_sent: parseInt(recentStats?.recent_surveys || '0'),
              responses: parseInt(recentStats?.recent_responses || '0'),
              average_rating: parseFloat(recentStats?.recent_avg_rating || '0') || 0,
            },
          },
        };
      })
    );

    return settingsWithStats;
  }

  // Get happiness setting by ID
  static async getByIdWithStats(
    id: number,
    companyId: string
  ): Promise<CustomerHappinessWithStats | null> {
    const setting = await db('customer_happiness_settings')
      .where({ id, company_id: companyId })
      .first();

    if (!setting) {
      return null;
    }

    // Get stats (same logic as above)
    const totalStats = await db('customer_feedback')
      .where('happiness_setting_id', id)
      .select(
        db.raw('COUNT(*) as total_surveys'),
        db.raw("COUNT(CASE WHEN status = 'completed' THEN 1 END) as total_responses"),
        db.raw('AVG(CASE WHEN overall_rating IS NOT NULL THEN overall_rating END) as avg_rating')
      )
      .first();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentStats = await db('customer_feedback')
      .where('happiness_setting_id', id)
      .where('created_at', '>=', thirtyDaysAgo)
      .select(
        db.raw('COUNT(*) as recent_surveys'),
        db.raw('COUNT(CASE WHEN status = "completed" THEN 1 END) as recent_responses'),
        db.raw(
          'AVG(CASE WHEN overall_rating IS NOT NULL THEN overall_rating END) as recent_avg_rating'
        )
      )
      .first();

    const totalSurveys = parseInt(totalStats?.total_surveys || '0');
    const totalResponses = parseInt(totalStats?.total_responses || '0');
    const completionRate = totalSurveys > 0 ? (totalResponses / totalSurveys) * 100 : 0;

    return {
      ...setting,
      stats: {
        total_surveys_sent: totalSurveys,
        total_responses: totalResponses,
        completion_rate: Math.round(completionRate * 100) / 100,
        average_rating: parseFloat(totalStats?.avg_rating || '0') || 0,
        last_30_days: {
          surveys_sent: parseInt(recentStats?.recent_surveys || '0'),
          responses: parseInt(recentStats?.recent_responses || '0'),
          average_rating: parseFloat(recentStats?.recent_avg_rating || '0') || 0,
        },
      },
    };
  }

  // Create happiness setting
  static async createSetting(
    data: Omit<CustomerHappinessSettings, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CustomerHappinessSettings> {
    const trx = await db.transaction();

    try {
      // If this is being set as default, unset other defaults
      if (data.is_default) {
        await trx('customer_happiness_settings')
          .where('company_id', data.company_id)
          .update({ is_default: false });
      }

      const [setting] = await trx('customer_happiness_settings').insert(data).returning('*');

      await trx.commit();
      return setting;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Update happiness setting
  static async updateSetting(
    id: number,
    companyId: string,
    data: Partial<
      Omit<CustomerHappinessSettings, 'id' | 'company_id' | 'created_at' | 'updated_at'>
    >
  ): Promise<CustomerHappinessSettings | null> {
    const trx = await db.transaction();

    try {
      const existing = await trx('customer_happiness_settings')
        .where({ id, company_id: companyId })
        .first();

      if (!existing) {
        await trx.rollback();
        return null;
      }

      // If this is being set as default, unset other defaults
      if (data.is_default) {
        await trx('customer_happiness_settings')
          .where('company_id', companyId)
          .whereNot('id', id)
          .update({ is_default: false });
      }

      const [updated] = await trx('customer_happiness_settings')
        .where({ id, company_id: companyId })
        .update({
          ...data,
          updated_at: new Date(),
        })
        .returning('*');

      await trx.commit();
      return updated;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Delete happiness setting
  static async deleteSetting(id: number, companyId: string): Promise<boolean> {
    const trx = await db.transaction();

    try {
      const existing = await trx('customer_happiness_settings')
        .where({ id, company_id: companyId })
        .first();

      if (!existing) {
        await trx.rollback();
        return false;
      }

      // Don't allow deletion of default setting if it's the only one
      if (existing.is_default) {
        const count = await trx('customer_happiness_settings')
          .where('company_id', companyId)
          .count('id as total')
          .first();

        if (count && parseInt(count.total as string) === 1) {
          await trx.rollback();
          throw new Error('Cannot delete the only happiness setting');
        }

        // Set another setting as default
        const nextDefault = await trx('customer_happiness_settings')
          .where('company_id', companyId)
          .whereNot('id', id)
          .first();

        if (nextDefault) {
          await trx('customer_happiness_settings')
            .where('id', nextDefault.id)
            .update({ is_default: true });
        }
      }

      // Delete the setting (cascades will handle feedback records)
      await trx('customer_happiness_settings').where({ id, company_id: companyId }).del();

      await trx.commit();
      return true;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Get default happiness setting
  static async getDefault(companyId: string): Promise<CustomerHappinessSettings | null> {
    return await db('customer_happiness_settings')
      .where({ company_id: companyId, is_default: true, is_active: true })
      .first();
  }

  // Create feedback record
  static async createFeedback(
    data: Omit<CustomerFeedback, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CustomerFeedback> {
    const [feedback] = await db('customer_feedback').insert(data).returning('*');

    return feedback;
  }

  // Get feedback by survey token
  static async getFeedbackByToken(token: string): Promise<CustomerFeedback | null> {
    return await db('customer_feedback').where('survey_token', token).first();
  }

  // Update feedback response
  static async updateFeedbackResponse(
    token: string,
    data: {
      overall_rating?: number;
      question_responses?: Record<string, any>;
      comments?: string;
      ip_address?: string;
      user_agent?: string;
      response_metadata?: Record<string, any>;
    }
  ): Promise<CustomerFeedback | null> {
    const [updated] = await db('customer_feedback')
      .where('survey_token', token)
      .update({
        ...data,
        status: 'completed',
        completed_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    return updated || null;
  }

  // Get feedback analytics for date range
  static async getAnalytics(
    companyId: string,
    startDate: string,
    endDate: string,
    happinessSettingId?: number
  ): Promise<CustomerHappinessAnalytics[]> {
    let query = db('customer_happiness_analytics')
      .where('company_id', companyId)
      .whereBetween('date', [startDate, endDate])
      .orderBy('date', 'asc');

    if (happinessSettingId) {
      query = query.where('happiness_setting_id', happinessSettingId);
    }

    return await query;
  }

  // Get recent feedback responses
  static async getRecentFeedback(
    companyId: string,
    limit: number = 50,
    happinessSettingId?: number
  ): Promise<
    Array<
      CustomerFeedback & { ticket_title?: string; customer_name?: string; customer_email?: string }
    >
  > {
    let query = db('customer_feedback')
      .join(
        'customer_happiness_settings',
        'customer_feedback.happiness_setting_id',
        'customer_happiness_settings.id'
      )
      .leftJoin('tickets', 'customer_feedback.ticket_id', 'tickets.id')
      .leftJoin('users', 'customer_feedback.customer_id', 'users.id')
      .where('customer_happiness_settings.company_id', companyId)
      .where('customer_feedback.status', 'completed')
      .select(
        'customer_feedback.*',
        'tickets.title as ticket_title',
        db.raw('CONCAT(users.first_name, " ", users.last_name) as customer_name'),
        'users.email as customer_email'
      )
      .orderBy('customer_feedback.completed_at', 'desc')
      .limit(limit);

    if (happinessSettingId) {
      query = query.where('customer_feedback.happiness_setting_id', happinessSettingId);
    }

    return await query;
  }

  // Generate unique survey token
  static generateSurveyToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Update analytics (called by background job)
  static async updateAnalytics(
    companyId: string,
    happinessSettingId: number,
    date: string
  ): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get daily stats
    const stats = await db('customer_feedback')
      .where('happiness_setting_id', happinessSettingId)
      .whereBetween('created_at', [startOfDay, endOfDay])
      .select(
        db.raw('COUNT(*) as surveys_sent'),
        db.raw("COUNT(CASE WHEN status = 'completed' THEN 1 END) as surveys_completed"),
        db.raw(
          'AVG(CASE WHEN overall_rating IS NOT NULL THEN overall_rating END) as average_rating'
        ),
        db.raw("COUNT(CASE WHEN status = 'completed' THEN 1 END) as total_responses"),
        db.raw('COUNT(CASE WHEN overall_rating = 1 THEN 1 END) as rating_1_count'),
        db.raw('COUNT(CASE WHEN overall_rating = 2 THEN 1 END) as rating_2_count'),
        db.raw('COUNT(CASE WHEN overall_rating = 3 THEN 1 END) as rating_3_count'),
        db.raw('COUNT(CASE WHEN overall_rating = 4 THEN 1 END) as rating_4_count'),
        db.raw('COUNT(CASE WHEN overall_rating = 5 THEN 1 END) as rating_5_count')
      )
      .first();

    const surveysSent = parseInt(stats?.surveys_sent || '0');
    const surveysCompleted = parseInt(stats?.surveys_completed || '0');
    const completionRate = surveysSent > 0 ? (surveysCompleted / surveysSent) * 100 : 0;

    // Get happiness setting to determine low rating threshold
    const setting = await db('customer_happiness_settings').where('id', happinessSettingId).first();

    const lowRatingThreshold = setting?.low_rating_threshold || 3;
    const lowRatingStats = await db('customer_feedback')
      .where('happiness_setting_id', happinessSettingId)
      .whereBetween('created_at', [startOfDay, endOfDay])
      .where('overall_rating', '<=', lowRatingThreshold)
      .where('overall_rating', '>', 0)
      .count('id as low_rating_count')
      .first();

    const analyticsData = {
      company_id: companyId,
      happiness_setting_id: happinessSettingId,
      date,
      surveys_sent: surveysSent,
      surveys_completed: surveysCompleted,
      completion_rate: Math.round(completionRate * 100) / 100,
      average_rating: parseFloat(stats?.average_rating || '0') || null,
      total_responses: surveysCompleted,
      rating_1_count: parseInt(stats?.rating_1_count || '0'),
      rating_2_count: parseInt(stats?.rating_2_count || '0'),
      rating_3_count: parseInt(stats?.rating_3_count || '0'),
      rating_4_count: parseInt(stats?.rating_4_count || '0'),
      rating_5_count: parseInt(stats?.rating_5_count || '0'),
      low_rating_count: parseInt(String(lowRatingStats?.low_rating_count || '0')),
      follow_up_triggered: 0, // This would be updated by follow-up logic
    };

    // Upsert analytics record
    await db('customer_happiness_analytics')
      .insert(analyticsData)
      .onConflict(['company_id', 'happiness_setting_id', 'date'])
      .merge(analyticsData);
  }
}
