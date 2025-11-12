/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Get the first company to create business hours for
  const companies = await knex('companies').select('id').limit(1);
  
  if (companies.length === 0) {
    console.log('No companies found, skipping business hours seed');
    return;
  }

  const companyId = companies[0].id;

  // Check if business hours already exist for this company
  const existingBH = await knex('business_hours').where('company_id', companyId).first();
  
  if (existingBH) {
    console.log('Business hours already exist for company, skipping seed');
    return;
  }

  // Insert default business hours
  const [businessHoursId] = await knex('business_hours').insert({
    company_id: companyId,
    title: 'Standard Business Hours',
    description: 'Monday to Friday, 9 AM to 5 PM with lunch break',
    timezone: 'America/New_York',
    is_active: true,
    is_default: true
  }).returning('id');

  const id = typeof businessHoursId === 'object' ? businessHoursId.id : businessHoursId;

  // Insert schedule for all 7 days
  const schedule = [
    { day_of_week: 0, is_working_day: false, start_time: null, end_time: null }, // Sunday
    { day_of_week: 1, is_working_day: true, start_time: '09:00:00', end_time: '17:00:00', break_start: '12:00:00', break_end: '13:00:00' }, // Monday
    { day_of_week: 2, is_working_day: true, start_time: '09:00:00', end_time: '17:00:00', break_start: '12:00:00', break_end: '13:00:00' }, // Tuesday
    { day_of_week: 3, is_working_day: true, start_time: '09:00:00', end_time: '17:00:00', break_start: '12:00:00', break_end: '13:00:00' }, // Wednesday
    { day_of_week: 4, is_working_day: true, start_time: '09:00:00', end_time: '17:00:00', break_start: '12:00:00', break_end: '13:00:00' }, // Thursday
    { day_of_week: 5, is_working_day: true, start_time: '09:00:00', end_time: '17:00:00', break_start: '12:00:00', break_end: '13:00:00' }, // Friday
    { day_of_week: 6, is_working_day: false, start_time: null, end_time: null }, // Saturday
  ];

  const scheduleData = schedule.map(s => ({
    ...s,
    business_hours_id: id
  }));

  await knex('business_hours_schedule').insert(scheduleData);

  console.log('✅ Default business hours created successfully');
};