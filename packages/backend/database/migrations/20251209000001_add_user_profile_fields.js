/**
 * Add additional profile fields to users table
 */
exports.up = async function (knex) {
  // Check which columns already exist
  const hasJobTitle = await knex.schema.hasColumn('users', 'job_title');
  const hasLocation = await knex.schema.hasColumn('users', 'location');
  const hasTimeZone = await knex.schema.hasColumn('users', 'time_zone');
  const hasLanguage = await knex.schema.hasColumn('users', 'language');
  const hasPhone = await knex.schema.hasColumn('users', 'phone');
  const hasMobilePhone = await knex.schema.hasColumn('users', 'mobile_phone');
  const hasExtension = await knex.schema.hasColumn('users', 'extension');
  const hasAbout = await knex.schema.hasColumn('users', 'about');

  return knex.schema.table('users', function (table) {
    if (!hasJobTitle) table.string('job_title');
    if (!hasLocation) table.string('location');
    if (!hasTimeZone) table.string('time_zone').defaultTo('America/New_York');
    if (!hasLanguage) table.string('language').defaultTo('en');
    if (!hasPhone) table.string('phone');
    if (!hasMobilePhone) table.string('mobile_phone');
    if (!hasExtension) table.string('extension');
    if (!hasAbout) table.text('about');
  });
};

exports.down = function (knex) {
  return knex.schema.table('users', function (table) {
    table.dropColumn('job_title');
    table.dropColumn('location');
    table.dropColumn('time_zone');
    table.dropColumn('language');
    table.dropColumn('phone');
    table.dropColumn('mobile_phone');
    table.dropColumn('extension');
    table.dropColumn('about');
  });
};
