import { CustomerHappiness, CustomerHappinessSettings, CustomerFeedback, CustomerHappinessWithStats } from '../models/CustomerHappiness';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface CreateHappinessSettingRequest {
  name: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
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
  delay_hours?: number;
  reminder_hours?: number;
  max_reminders?: number;
  thank_you_message?: string;
  follow_up_message?: string;
  low_rating_threshold?: number;
}

export interface UpdateHappinessSettingRequest {
  name?: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
  survey_config?: {
    rating_scale?: 'five_star' | 'ten_point' | 'thumbs' | 'emoji';
    rating_question?: string;
    custom_questions?: Array<{
      id: string;
      question: string;
      type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'scale';
      required: boolean;
      options?: string[];
    }>;
    include_comments?: boolean;
    comments_required?: boolean;
    comments_placeholder?: string;
  };
  trigger_conditions?: {
    on_ticket_resolved?: boolean;
    on_ticket_closed?: boolean;
    department_ids?: number[];
    priority_levels?: string[];
    ticket_types?: string[];
    exclude_internal_tickets?: boolean;
  };
  email_template?: {
    subject?: string;
    header_text?: string;
    footer_text?: string;
    button_text?: string;
    company_logo?: string;
    primary_color?: string;
    include_ticket_details?: boolean;
  };
  delay_hours?: number;
  reminder_hours?: number;
  max_reminders?: number;
  thank_you_message?: string;
  follow_up_message?: string;
  low_rating_threshold?: number;
}

export interface SubmitFeedbackRequest {
  overall_rating: number;
  question_responses?: Record<string, any>;
  comments?: string;
  ip_address?: string;
  user_agent?: string;
}

export class CustomerHappinessService {
  // Get all happiness settings for a company
  static async getHappinessSettings(companyId: string): Promise<CustomerHappinessWithStats[]> {
    try {
      return await CustomerHappiness.getByCompany(companyId);
    } catch (error) {
      logger.error('Error fetching happiness settings:', error);
      throw new AppError('Failed to fetch happiness settings', 500, 'FETCH_HAPPINESS_SETTINGS_FAILED');
    }
  }

  // Get happiness setting by ID
  static async getHappinessSettingById(id: number, companyId: string): Promise<CustomerHappinessWithStats | null> {
    try {
      return await CustomerHappiness.getByIdWithStats(id, companyId);
    } catch (error) {
      logger.error('Error fetching happiness setting:', error);
      throw new AppError('Failed to fetch happiness setting', 500, 'FETCH_HAPPINESS_SETTING_FAILED');
    }
  }

  // Create new happiness setting
  static async createHappinessSetting(companyId: string, data: CreateHappinessSettingRequest): Promise<CustomerHappinessSettings> {
    try {
      // Validate required fields
      if (!data.name?.trim()) {
        throw new AppError('Happiness setting name is required', 400, 'INVALID_HAPPINESS_SETTING_NAME');
      }

      if (!data.survey_config || !data.trigger_conditions || !data.email_template) {
        throw new AppError('Survey configuration, trigger conditions, and email template are required', 400, 'INVALID_HAPPINESS_SETTING_CONFIG');
      }

      // Check if name already exists for this company
      const existingSettings = await CustomerHappiness.getByCompany(companyId);
      const nameExists = existingSettings.some(
        setting => setting.name.toLowerCase() === data.name.trim().toLowerCase()
      );

      if (nameExists) {
        throw new AppError('Happiness setting name already exists', 409, 'HAPPINESS_SETTING_NAME_EXISTS');
      }

      const settingData: Omit<CustomerHappinessSettings, 'id' | 'created_at' | 'updated_at'> = {
        company_id: companyId,
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        is_active: data.is_active !== false,
        is_default: data.is_default || false,
        survey_config: data.survey_config,
        trigger_conditions: data.trigger_conditions,
        email_template: data.email_template,
        delay_hours: data.delay_hours || 24,
        reminder_hours: data.reminder_hours || 72,
        max_reminders: data.max_reminders || 1,
        thank_you_message: data.thank_you_message || 'Thank you for your feedback!',
        follow_up_message: data.follow_up_message || undefined,
        low_rating_threshold: data.low_rating_threshold || 3,
      };

      const setting = await CustomerHappiness.createSetting(settingData);
      
      logger.info(`Happiness setting created: ${setting.name}`, {
        settingId: setting.id,
        companyId,
      });

      return setting;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error creating happiness setting:', error);
      throw new AppError('Failed to create happiness setting', 500, 'CREATE_HAPPINESS_SETTING_FAILED');
    }
  }

  // Update happiness setting
  static async updateHappinessSetting(
    id: number,
    companyId: string,
    data: UpdateHappinessSettingRequest
  ): Promise<CustomerHappinessSettings | null> {
    try {
      // Validate name if provided
      if (data.name !== undefined) {
        if (!data.name?.trim()) {
          throw new AppError('Happiness setting name is required', 400, 'INVALID_HAPPINESS_SETTING_NAME');
        }

        // Check if name already exists (excluding current setting)
        const existingSettings = await CustomerHappiness.getByCompany(companyId);
        const nameExists = existingSettings.some(
          setting => setting.id !== id && setting.name.toLowerCase() === data.name!.trim().toLowerCase()
        );

        if (nameExists) {
          throw new AppError('Happiness setting name already exists', 409, 'HAPPINESS_SETTING_NAME_EXISTS');
        }
      }

      const updateData: Partial<Omit<CustomerHappinessSettings, 'id' | 'company_id' | 'created_at' | 'updated_at'>> = {};

      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.description !== undefined) updateData.description = data.description?.trim() || undefined;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;
      if (data.is_default !== undefined) updateData.is_default = data.is_default;
      if (data.survey_config !== undefined) updateData.survey_config = data.survey_config as any;
      if (data.trigger_conditions !== undefined) updateData.trigger_conditions = data.trigger_conditions as any;
      if (data.email_template !== undefined) updateData.email_template = data.email_template as any;
      if (data.delay_hours !== undefined) updateData.delay_hours = data.delay_hours;
      if (data.reminder_hours !== undefined) updateData.reminder_hours = data.reminder_hours;
      if (data.max_reminders !== undefined) updateData.max_reminders = data.max_reminders;
      if (data.thank_you_message !== undefined) updateData.thank_you_message = data.thank_you_message;
      if (data.follow_up_message !== undefined) updateData.follow_up_message = data.follow_up_message || undefined;
      if (data.low_rating_threshold !== undefined) updateData.low_rating_threshold = data.low_rating_threshold;

      const updated = await CustomerHappiness.updateSetting(id, companyId, updateData);

      if (updated) {
        logger.info(`Happiness setting updated: ${updated.name}`, {
          settingId: id,
          companyId,
        });
      }

      return updated;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating happiness setting:', error);
      throw new AppError('Failed to update happiness setting', 500, 'UPDATE_HAPPINESS_SETTING_FAILED');
    }
  }

  // Delete happiness setting
  static async deleteHappinessSetting(id: number, companyId: string): Promise<boolean> {
    try {
      const success = await CustomerHappiness.deleteSetting(id, companyId);

      if (success) {
        logger.info(`Happiness setting deleted`, {
          settingId: id,
          companyId,
        });
      }

      return success;
    } catch (error) {
      if (error instanceof Error && error.message === 'Cannot delete the only happiness setting') {
        throw new AppError('Cannot delete the only happiness setting', 400, 'CANNOT_DELETE_ONLY_HAPPINESS_SETTING');
      }
      logger.error('Error deleting happiness setting:', error);
      throw new AppError('Failed to delete happiness setting', 500, 'DELETE_HAPPINESS_SETTING_FAILED');
    }
  }

  // Get feedback by survey token
  static async getFeedbackByToken(token: string): Promise<CustomerFeedback | null> {
    try {
      const feedback = await CustomerHappiness.getFeedbackByToken(token);
      
      if (!feedback) {
        return null;
      }

      // Check if survey has expired
      if (feedback.expires_at && new Date() > new Date(feedback.expires_at)) {
        // Mark as expired if not already
        if (feedback.status === 'pending') {
          await CustomerHappiness.updateFeedbackResponse(token, { response_metadata: { expired: true } });
        }
        throw new AppError('Survey has expired', 400, 'SURVEY_EXPIRED');
      }

      // Check if already completed
      if (feedback.status === 'completed') {
        throw new AppError('Survey has already been completed', 400, 'SURVEY_ALREADY_COMPLETED');
      }

      return feedback;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching feedback by token:', error);
      throw new AppError('Failed to fetch survey', 500, 'FETCH_SURVEY_FAILED');
    }
  }

  // Submit feedback response
  static async submitFeedback(token: string, data: SubmitFeedbackRequest): Promise<CustomerFeedback> {
    try {
      // Validate the survey token first
      const existingFeedback = await this.getFeedbackByToken(token);
      
      if (!existingFeedback) {
        throw new AppError('Invalid survey token', 404, 'INVALID_SURVEY_TOKEN');
      }

      // Validate rating
      if (!data.overall_rating || data.overall_rating < 1 || data.overall_rating > 10) {
        throw new AppError('Invalid rating. Must be between 1 and 10', 400, 'INVALID_RATING');
      }

      const updated = await CustomerHappiness.updateFeedbackResponse(token, {
        overall_rating: data.overall_rating,
        question_responses: data.question_responses || {},
        comments: data.comments?.trim() || undefined,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
        response_metadata: {
          submitted_at: new Date().toISOString(),
          user_agent: data.user_agent,
          ip_address: data.ip_address,
        },
      });

      if (!updated) {
        throw new AppError('Failed to submit feedback', 500, 'SUBMIT_FEEDBACK_FAILED');
      }

      logger.info(`Feedback submitted for survey token: ${token}`, {
        feedbackId: updated.id,
        rating: data.overall_rating,
        hasComments: !!data.comments,
      });

      // TODO: Trigger follow-up actions for low ratings
      // TODO: Update analytics

      return updated;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error submitting feedback:', error);
      throw new AppError('Failed to submit feedback', 500, 'SUBMIT_FEEDBACK_FAILED');
    }
  }

  // Get analytics for a company
  static async getAnalytics(
    companyId: string,
    startDate: string,
    endDate: string,
    happinessSettingId?: number
  ) {
    try {
      const analytics = await CustomerHappiness.getAnalytics(companyId, startDate, endDate, happinessSettingId);
      return analytics;
    } catch (error) {
      logger.error('Error fetching happiness analytics:', error);
      throw new AppError('Failed to fetch analytics', 500, 'FETCH_ANALYTICS_FAILED');
    }
  }

  // Get recent feedback responses
  static async getRecentFeedback(
    companyId: string,
    limit: number = 50,
    happinessSettingId?: number
  ) {
    try {
      const feedback = await CustomerHappiness.getRecentFeedback(companyId, limit, happinessSettingId);
      return feedback;
    } catch (error) {
      logger.error('Error fetching recent feedback:', error);
      throw new AppError('Failed to fetch recent feedback', 500, 'FETCH_RECENT_FEEDBACK_FAILED');
    }
  }

  // Create default happiness setting for a company
  static async createDefaultHappinessSetting(companyId: string): Promise<CustomerHappinessSettings> {
    try {
      const defaultData: CreateHappinessSettingRequest = {
        name: 'Default Customer Satisfaction Survey',
        description: 'Standard customer satisfaction survey sent after ticket resolution',
        is_active: true,
        is_default: true,
        survey_config: {
          rating_scale: 'five_star',
          rating_question: 'How satisfied are you with the support you received?',
          custom_questions: [
            {
              id: 'resolution_speed',
              question: 'How would you rate the speed of resolution?',
              type: 'scale',
              required: false,
              options: ['Very Slow', 'Slow', 'Average', 'Fast', 'Very Fast'],
            },
            {
              id: 'agent_helpfulness',
              question: 'How helpful was our support agent?',
              type: 'scale',
              required: false,
              options: ['Not Helpful', 'Slightly Helpful', 'Moderately Helpful', 'Very Helpful', 'Extremely Helpful'],
            },
          ],
          include_comments: true,
          comments_required: false,
          comments_placeholder: 'Please share any additional feedback or suggestions...',
        },
        trigger_conditions: {
          on_ticket_resolved: true,
          on_ticket_closed: false,
          department_ids: [],
          priority_levels: [],
          ticket_types: [],
          exclude_internal_tickets: true,
        },
        email_template: {
          subject: 'How was your support experience?',
          header_text: 'We hope we were able to help you! Please take a moment to rate your experience.',
          footer_text: 'Thank you for choosing our support services.',
          button_text: 'Rate Your Experience',
          primary_color: '#3B82F6',
          include_ticket_details: true,
        },
        delay_hours: 24,
        reminder_hours: 72,
        max_reminders: 1,
        thank_you_message: 'Thank you for your feedback! We appreciate you taking the time to help us improve.',
        follow_up_message: 'We\'re sorry to hear about your experience. A member of our team will reach out to you shortly to address your concerns.',
        low_rating_threshold: 3,
      };

      return await this.createHappinessSetting(companyId, defaultData);
    } catch (error) {
      logger.error('Error creating default happiness setting:', error);
      throw new AppError('Failed to create default happiness setting', 500, 'CREATE_DEFAULT_HAPPINESS_SETTING_FAILED');
    }
  }

  // Trigger survey for ticket (called when ticket is resolved/closed)
  static async triggerSurveyForTicket(
    ticketId: string,
    customerId: string,
    companyId: string
  ): Promise<CustomerFeedback | null> {
    try {
      // Get default happiness setting for company
      const setting = await CustomerHappiness.getDefault(companyId);
      
      if (!setting || !setting.is_active) {
        logger.debug(`No active happiness setting found for company ${companyId}`);
        return null;
      }

      // Check if survey already exists for this ticket
      const existingFeedback = await CustomerHappiness.getFeedbackByToken(`ticket_${ticketId}`);
      if (existingFeedback) {
        logger.debug(`Survey already exists for ticket ${ticketId}`);
        return null;
      }

      // Generate survey token
      const surveyToken = CustomerHappiness.generateSurveyToken();
      
      // Calculate expiry date (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Calculate send date based on delay
      const sendAt = new Date();
      sendAt.setHours(sendAt.getHours() + setting.delay_hours);

      const feedbackData: Omit<CustomerFeedback, 'id' | 'created_at' | 'updated_at'> = {
        ticket_id: ticketId,
        customer_id: customerId,
        happiness_setting_id: setting.id!,
        survey_token: surveyToken,
        status: 'pending',
        sent_at: sendAt,
        expires_at: expiresAt,
        reminder_count: 0,
      };

      const feedback = await CustomerHappiness.createFeedback(feedbackData);

      logger.info(`Survey scheduled for ticket ${ticketId}`, {
        feedbackId: feedback.id,
        surveyToken,
        sendAt,
        expiresAt,
      });

      // TODO: Schedule email to be sent at sendAt time
      // TODO: This would typically be handled by a background job queue

      return feedback;
    } catch (error) {
      logger.error('Error triggering survey for ticket:', error);
      // Don't throw error to avoid breaking ticket resolution flow
      return null;
    }
  }
}