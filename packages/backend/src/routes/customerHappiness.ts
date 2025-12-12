import express from 'express';
import { CustomerHappinessService } from '../services/CustomerHappinessService';
import { authenticate, authorize } from '../middleware/auth';
import { db } from '../config/database';

const router = express.Router();

// Get all happiness settings for the user's company
router.get('/', authenticate, async (req, res) => {
  try {
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;
    const settings = await CustomerHappinessService.getHappinessSettings(companyId);

    return res.json(settings);
  } catch (error) {
    console.error('Error fetching happiness settings:', error);
    return res.status(500).json({ error: 'Failed to fetch happiness settings' });
  }
});

// Get specific happiness setting by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;
    const setting = await CustomerHappinessService.getHappinessSettingById(parseInt(id), companyId);

    if (!setting) {
      return res.status(404).json({ error: 'Happiness setting not found' });
    }

    return res.json(setting);
  } catch (error) {
    console.error('Error fetching happiness setting:', error);
    return res.status(500).json({ error: 'Failed to fetch happiness setting' });
  }
});

// Create new happiness setting (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;
    const {
      name,
      description,
      is_active,
      is_default,
      survey_config,
      trigger_conditions,
      email_template,
      delay_hours,
      reminder_hours,
      max_reminders,
      thank_you_message,
      follow_up_message,
      low_rating_threshold,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Happiness setting name is required' });
    }

    if (!survey_config || !trigger_conditions || !email_template) {
      return res.status(400).json({
        error: 'Survey configuration, trigger conditions, and email template are required',
      });
    }

    const setting = await CustomerHappinessService.createHappinessSetting(companyId, {
      name,
      description,
      is_active,
      is_default,
      survey_config,
      trigger_conditions,
      email_template,
      delay_hours,
      reminder_hours,
      max_reminders,
      thank_you_message,
      follow_up_message,
      low_rating_threshold,
    });

    return res.status(201).json(setting);
  } catch (error: any) {
    console.error('Error creating happiness setting:', error);
    if (error.code === 'HAPPINESS_SETTING_NAME_EXISTS') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to create happiness setting' });
  }
});

// Update happiness setting (admin only)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;
    const {
      name,
      description,
      is_active,
      is_default,
      survey_config,
      trigger_conditions,
      email_template,
      delay_hours,
      reminder_hours,
      max_reminders,
      thank_you_message,
      follow_up_message,
      low_rating_threshold,
    } = req.body;

    const setting = await CustomerHappinessService.updateHappinessSetting(parseInt(id), companyId, {
      name,
      description,
      is_active,
      is_default,
      survey_config,
      trigger_conditions,
      email_template,
      delay_hours,
      reminder_hours,
      max_reminders,
      thank_you_message,
      follow_up_message,
      low_rating_threshold,
    });

    if (!setting) {
      return res.status(404).json({ error: 'Happiness setting not found' });
    }

    return res.json(setting);
  } catch (error: any) {
    console.error('Error updating happiness setting:', error);
    if (error.code === 'HAPPINESS_SETTING_NAME_EXISTS') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to update happiness setting' });
  }
});

// Delete happiness setting (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;
    const success = await CustomerHappinessService.deleteHappinessSetting(parseInt(id), companyId);

    if (!success) {
      return res.status(404).json({ error: 'Happiness setting not found' });
    }

    return res.json({ message: 'Happiness setting deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting happiness setting:', error);
    if (error.code === 'CANNOT_DELETE_ONLY_HAPPINESS_SETTING') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to delete happiness setting' });
  }
});

// Get analytics for happiness settings
router.get('/analytics/overview', authenticate, async (req, res) => {
  try {
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;
    const { start_date, end_date, happiness_setting_id } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const analytics = await CustomerHappinessService.getAnalytics(
      companyId,
      start_date as string,
      end_date as string,
      happiness_setting_id ? parseInt(happiness_setting_id as string) : undefined
    );

    return res.json(analytics);
  } catch (error) {
    console.error('Error fetching happiness analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get recent feedback responses
router.get('/feedback/recent', authenticate, async (req, res) => {
  try {
    // Get user's company ID from user_company_associations
    const userCompany = await db('user_company_associations')
      .where('user_id', req.user!.id)
      .first();

    if (!userCompany) {
      return res.status(400).json({ error: 'User not associated with any company' });
    }

    const companyId = userCompany.company_id;
    const { limit, happiness_setting_id } = req.query;

    const feedback = await CustomerHappinessService.getRecentFeedback(
      companyId,
      limit ? parseInt(limit as string) : 50,
      happiness_setting_id ? parseInt(happiness_setting_id as string) : undefined
    );

    return res.json(feedback);
  } catch (error) {
    console.error('Error fetching recent feedback:', error);
    return res.status(500).json({ error: 'Failed to fetch recent feedback' });
  }
});

// Public survey endpoints (no authentication required)

// Get survey by token (public)
router.get('/survey/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const feedback = await CustomerHappinessService.getFeedbackByToken(token);

    if (!feedback) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // Get the happiness setting to show survey configuration
    const setting = await db('customer_happiness_settings')
      .where('id', feedback.happiness_setting_id)
      .first();

    if (!setting) {
      return res.status(404).json({ error: 'Survey configuration not found' });
    }

    // Get ticket details if needed
    let ticketDetails = null;
    if (setting.email_template.include_ticket_details) {
      ticketDetails = await db('tickets')
        .where('id', feedback.ticket_id)
        .select('id', 'title', 'description', 'created_at', 'updated_at')
        .first();
    }

    return res.json({
      survey_token: feedback.survey_token,
      survey_config: setting.survey_config,
      email_template: setting.email_template,
      ticket_details: ticketDetails,
      expires_at: feedback.expires_at,
    });
  } catch (error: any) {
    console.error('Error fetching survey:', error);
    if (error.code === 'SURVEY_EXPIRED') {
      return res.status(400).json({ error: error.message, code: 'SURVEY_EXPIRED' });
    }
    if (error.code === 'SURVEY_ALREADY_COMPLETED') {
      return res.status(400).json({ error: error.message, code: 'SURVEY_ALREADY_COMPLETED' });
    }
    return res.status(500).json({ error: 'Failed to fetch survey' });
  }
});

// Submit survey response (public)
router.post('/survey/:token/submit', async (req, res) => {
  try {
    const { token } = req.params;
    const { overall_rating, question_responses, comments } = req.body;

    if (!overall_rating) {
      return res.status(400).json({ error: 'Overall rating is required' });
    }

    const feedback = await CustomerHappinessService.submitFeedback(token, {
      overall_rating,
      question_responses,
      comments,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
    });

    // Get thank you message from settings
    const setting = await db('customer_happiness_settings')
      .where('id', feedback.happiness_setting_id)
      .first();

    return res.json({
      message: setting?.thank_you_message || 'Thank you for your feedback!',
      feedback_id: feedback.id,
      submitted_at: feedback.completed_at,
    });
  } catch (error: any) {
    console.error('Error submitting feedback:', error);
    if (error.code === 'INVALID_SURVEY_TOKEN') {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 'SURVEY_EXPIRED' || error.code === 'SURVEY_ALREADY_COMPLETED') {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    if (error.code === 'INVALID_RATING') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;
