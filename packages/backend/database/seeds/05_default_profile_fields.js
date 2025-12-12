/**
 * Seed default profile field configurations
 */
exports.seed = async function (knex) {
  console.log('🔧 Setting up default profile field configurations...');

  // Get Bomar Corp organization
  const bomarOrg = await knex('organizations').where('name', 'Bomar Corp').first();

  if (!bomarOrg) {
    console.log('⚠️  Bomar Corp organization not found, skipping profile field setup');
    return;
  }

  // Check if profile fields already exist
  const existingFields = await knex('profile_field_config').where('org_id', bomarOrg.id).first();
  if (existingFields) {
    console.log('⏭️  Profile fields already configured, skipping');
    return;
  }

  // Default profile field configurations
  const profileFields = [
    // Required fields
    {
      org_id: bomarOrg.id,
      field_name: 'first_name',
      field_type: 'text',
      is_required: true,
      is_enabled: true,
      display_order: 1,
    },
    {
      org_id: bomarOrg.id,
      field_name: 'last_name',
      field_type: 'text',
      is_required: true,
      is_enabled: true,
      display_order: 2,
    },
    {
      org_id: bomarOrg.id,
      field_name: 'email',
      field_type: 'email',
      is_required: true,
      is_enabled: true,
      display_order: 3,
    },

    // Optional fields - enabled by default
    {
      org_id: bomarOrg.id,
      field_name: 'phone',
      field_type: 'tel',
      is_required: false,
      is_enabled: true,
      display_order: 4,
    },
    {
      org_id: bomarOrg.id,
      field_name: 'mobile_phone',
      field_type: 'tel',
      is_required: false,
      is_enabled: true,
      display_order: 5,
    },
    {
      org_id: bomarOrg.id,
      field_name: 'extension',
      field_type: 'text',
      is_required: false,
      is_enabled: true,
      display_order: 6,
    },
    {
      org_id: bomarOrg.id,
      field_name: 'job_title',
      field_type: 'text',
      is_required: false,
      is_enabled: true,
      display_order: 7,
    },
    {
      org_id: bomarOrg.id,
      field_name: 'location',
      field_type: 'text',
      is_required: false,
      is_enabled: false,
      display_order: 8,
    },
    {
      org_id: bomarOrg.id,
      field_name: 'time_zone',
      field_type: 'select',
      is_required: false,
      is_enabled: true,
      display_order: 9,
      options: JSON.stringify([
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Phoenix',
        'Pacific/Honolulu',
        'America/Anchorage',
      ]),
    },
    {
      org_id: bomarOrg.id,
      field_name: 'language',
      field_type: 'select',
      is_required: false,
      is_enabled: true,
      display_order: 10,
      options: JSON.stringify(['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja']),
    },
    {
      org_id: bomarOrg.id,
      field_name: 'about',
      field_type: 'textarea',
      is_required: false,
      is_enabled: true,
      display_order: 11,
    },
  ];

  await knex('profile_field_config').insert(profileFields);
  console.log(`✅ Created ${profileFields.length} default profile field configurations`);

  console.log('✨ Profile field setup complete!');
};
