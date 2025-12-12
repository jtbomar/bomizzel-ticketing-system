/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  // Get all companies
  const companies = await knex('companies').select('id', 'name');

  if (companies.length === 0) {
    console.log('No companies found, skipping departments seed');
    return;
  }

  for (const company of companies) {
    // Check if company already has departments
    const existingDepts = await knex('departments').where('company_id', company.id);

    if (existingDepts.length > 0) {
      console.log(`Company ${company.name} already has departments, skipping`);
      continue;
    }

    // Create default departments for each company
    const departments = [
      {
        company_id: company.id,
        name: 'General Support',
        description: 'Default department for general support tickets',
        color: '#3B82F6',
        is_active: true,
        is_default: true,
      },
      {
        company_id: company.id,
        name: 'Technical Support',
        description: 'Technical issues and troubleshooting',
        color: '#10B981',
        is_active: true,
        is_default: false,
      },
      {
        company_id: company.id,
        name: 'Sales',
        description: 'Sales inquiries and pre-sales support',
        color: '#F59E0B',
        is_active: true,
        is_default: false,
      },
    ];

    await knex('departments').insert(departments);

    // Get the created departments
    const createdDepts = await knex('departments')
      .where('company_id', company.id)
      .select('id', 'name');

    // Create default templates for each department
    for (const dept of createdDepts) {
      const templates = [];

      if (dept.name === 'General Support') {
        templates.push({
          department_id: dept.id,
          name: 'General Inquiry',
          description: 'Standard template for general inquiries',
          template_fields: JSON.stringify({
            subject: { type: 'text', required: true, label: 'Subject' },
            description: { type: 'textarea', required: true, label: 'Description' },
            priority: {
              type: 'select',
              required: true,
              label: 'Priority',
              options: ['low', 'medium', 'high', 'urgent'],
            },
            category: {
              type: 'select',
              required: false,
              label: 'Category',
              options: ['question', 'request', 'complaint', 'other'],
            },
          }),
          default_values: JSON.stringify({
            priority: 'medium',
            category: 'question',
          }),
          priority: 'medium',
          category: 'general',
          is_active: true,
          is_default: true,
        });
      } else if (dept.name === 'Technical Support') {
        templates.push({
          department_id: dept.id,
          name: 'Bug Report',
          description: 'Template for reporting bugs and technical issues',
          template_fields: JSON.stringify({
            subject: { type: 'text', required: true, label: 'Subject' },
            description: { type: 'textarea', required: true, label: 'Description' },
            steps_to_reproduce: { type: 'textarea', required: true, label: 'Steps to Reproduce' },
            expected_behavior: { type: 'textarea', required: true, label: 'Expected Behavior' },
            actual_behavior: { type: 'textarea', required: true, label: 'Actual Behavior' },
            browser: {
              type: 'select',
              required: false,
              label: 'Browser',
              options: ['Chrome', 'Firefox', 'Safari', 'Edge', 'Other'],
            },
            operating_system: {
              type: 'select',
              required: false,
              label: 'Operating System',
              options: ['Windows', 'macOS', 'Linux', 'iOS', 'Android', 'Other'],
            },
            priority: {
              type: 'select',
              required: true,
              label: 'Priority',
              options: ['low', 'medium', 'high', 'urgent'],
            },
          }),
          default_values: JSON.stringify({
            priority: 'high',
          }),
          priority: 'high',
          category: 'bug',
          is_active: true,
          is_default: true,
        });
      } else if (dept.name === 'Sales') {
        templates.push({
          department_id: dept.id,
          name: 'Sales Inquiry',
          description: 'Template for sales and pre-sales inquiries',
          template_fields: JSON.stringify({
            subject: { type: 'text', required: true, label: 'Subject' },
            company_name: { type: 'text', required: true, label: 'Company Name' },
            contact_person: { type: 'text', required: true, label: 'Contact Person' },
            email: { type: 'email', required: true, label: 'Email' },
            phone: { type: 'tel', required: false, label: 'Phone Number' },
            inquiry_type: {
              type: 'select',
              required: true,
              label: 'Inquiry Type',
              options: ['pricing', 'demo', 'features', 'partnership', 'other'],
            },
            description: { type: 'textarea', required: true, label: 'Description' },
            budget_range: {
              type: 'select',
              required: false,
              label: 'Budget Range',
              options: [
                '< $1,000',
                '$1,000 - $5,000',
                '$5,000 - $10,000',
                '$10,000+',
                'Not specified',
              ],
            },
            timeline: {
              type: 'select',
              required: false,
              label: 'Timeline',
              options: ['Immediate', 'Within 1 month', '1-3 months', '3-6 months', '6+ months'],
            },
          }),
          default_values: JSON.stringify({
            inquiry_type: 'pricing',
          }),
          priority: 'medium',
          category: 'sales',
          is_active: true,
          is_default: true,
        });
      }

      if (templates.length > 0) {
        await knex('department_ticket_templates').insert(templates);
      }
    }

    console.log(`✅ Default departments and templates created for ${company.name}`);
  }
};
