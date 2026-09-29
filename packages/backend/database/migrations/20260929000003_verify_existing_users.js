/**
 * Signing in now needs a confirmed email address. Everyone who already has an
 * account keeps working: mark existing users verified. (The column defaulted
 * to false, but nothing checked it, so no existing user was ever asked.)
 * New sign-ups after this start unverified and get a link by email.
 */
exports.up = async function (knex) {
  const count = await knex('users').where('email_verified', false).update({ email_verified: true });
  console.log(`✅ users: marked ${count} existing user(s) as verified`);
};

exports.down = async function () {
  // Not reversible: which users were unverified before isn't recorded.
};
