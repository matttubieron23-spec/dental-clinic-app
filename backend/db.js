require('dotenv').config();
const { Pool, types } = require('pg');

// OID 1082 = PostgreSQL DATE type.
// Return DATE columns as plain 'YYYY-MM-DD' strings so Express never converts them to UTC ISO timestamps.
types.setTypeParser(1082, (val) => val);

module.exports = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || ''),
  database: process.env.DB_NAME || 'dental_clinic',
});