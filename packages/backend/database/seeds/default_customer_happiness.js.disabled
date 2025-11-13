/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Get all companies
  const companies = await knex('companies').select('id', 'name');
  
  if (companies.length === 0) {
    console.log('No companies found, skipping customer happiness seed');
    return;
  }

  for (const company of companies) {
    // Check if company already has happiness settings
    const existingSettings = await knex('customer_happiness_settings').where('company_id', company.id);
    
    if (existingSettings.length > 0) {
      console.log(`Company ${company.name} already has happiness settings, skipping`);
      continue;
    }

    // Create default customer happiness setting
    const happinessSetting = {
      company_id: company.id,
      name: 'Default Customer Satisfaction Survey',
      description: 'Standard customer satisfaction survey sent after ticket resolution',
      is_active: true,
      is_default: true,
      survey_config: JSON.stringify({
        rating_scale: 'five_star',
        rating_question: 'How satisfied are you with the support you received?',
        custom_questions: [
          {
            id: 'resolution_speed',
            question: 'How would you rate the speed of resolution?',
            type: 'scale',
            required: false,
            options: ['Very Slow', 'Slow', 'Average', 'Fast', 'Very Fast']
          },
          {
            id: 'agent_helpfulness',
            question: 'How helpful was our support agent?',
            type: 'scale',
            required: false,
            options: ['Not Helpful', 'Slightly Helpful', 'Moderately Helpful', 'Very Helpful', 'Extremely Helpful']
          },
          {
            id: 'communication_clarity',
            question: 'How clear was the communication from our support team?',
            type: 'scale',
            required: false,
            options: ['Very Unclear', 'Unclear', 'Average', 'Clear', 'Very Clear']
          }
        ],
        include_comments: true,
        comments_required: false,
        comments_placeholder: 'Please share any additional feedback or suggestions...'
      }),
      trigger_conditions: JSON.stringify({
        on_ticket_resolved: true,
        on_ticket_closed: false,
        department_ids: [],
        priority_levels: [],
        ticket_types: [],
        exclude_internal_tickets: true
      }),
      email_template: JSON.stringify({
        subject: 'How was your support experience?',
        header_text: 'We hope we were able to help you! Please take a moment to rate your experience.',
        footer_text: 'Thank you for choosing our support services.',
        button_text: 'Rate Your Experience',
        primary_color: '#3B82F6',
        include_ticket_details: true
      }),
      delay_hours: 24,
      reminder_hours: 72,
      max_reminders: 1,
      thank_you_message: 'Thank you for your feedback! We appreciate you taking the time to help us improve.',
      follow_up_message: 'We\'re sorry to hear about your experience. A member of our team will reach out to you shortly to address your concerns.',
      low_rating_threshold: 3
    };

    await knex('customer_happiness_settings').insert(happinessSetting);

    console.log(`✅ Default customer happiness setting created for ${company.name}`);
  }
};