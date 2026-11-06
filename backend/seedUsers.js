// Creates the first login accounts. Run once:  npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

(async () => {
  const c = await pool.query('SELECT id FROM clinics ORDER BY created_at LIMIT 1');
  if (!c.rows[0]) {
    console.log('No clinic found. Run dental_clinic_schema.sql in your database first.');
    process.exit(1);
  }
  const users = [
    ['admin@clinic.com', 'admin123', 'Clinic', 'Owner', 'owner'],
    ['dentist@clinic.com', 'dentist123', 'Demo', 'Dentist', 'dentist'],
  ];
  for (const [email, pass, first, last, role] of users) {
    const hash = await bcrypt.hash(pass, 10);
    await pool.query(
      `INSERT INTO users (clinic_id, email, password_hash, first_name, last_name, role)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
      [c.rows[0].id, email, hash, first, last, role]
    );
    console.log(`Ready: ${email} / ${pass}`);
  }
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });