require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const { sendEmail, buildOtpHtml } = require('./sendEmail');

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN || 'https://dental-clinic-app-mauve.vercel.app';
app.use(cors({
  origin: [clientOrigin, 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// ============================================================================
// CENTRALIZED CLINIC SETTINGS
// ============================================================================
const CLINIC_CONFIG = {
  name: 'Smile Avenue Dental Clinic',
  phone: '0969 059 1928',
  email: 'smileavdental@gmail.com',
  address: 'G/F Yankit Building, Landco Business Park, Legazpi, Philippines, 4500',
  hours: 'Monday to Saturday, 8:00 AM to 5:00 PM',
  lunchBreak: '12:00 PM to 12:59 PM',
  termsVersion: 'v1.0',
  privacyVersion: 'v1.0',
  slots: [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  ],
};

const ALLOWED_STAFF_ROLES = [
  'Admin',
  'Dentist',
  'Receptionist',
  'owner',
  'admin',
  'dentist',
  'staff',
];
const ALLOWED_IDENTITY_FIELDS = ['first_name', 'middle_name', 'last_name', 'birth_date', 'sex'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const val = (x) => (x === undefined || x === null || String(x).trim() === '' ? null : String(x).trim());

const toTitleCase = (str = '') =>
  String(str)
    .trim()
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

const isPhilippinePhone = (p = '') => {
  const digits = String(p).replace(/[\s\-()]/g, '');
  return /^(09\d{9}|\+639\d{9}|639\d{9})$/.test(digits);
};

function normalizeRole(rawRole = '') {
  const r = String(rawRole || '').trim().toLowerCase();
  if (r === 'admin' || r === 'owner') return 'Admin';
  if (r === 'dentist') return 'Dentist';
  if (r === 'receptionist' || r === 'staff') return 'Receptionist';
  return String(rawRole || '').trim();
}

function getManilaNow() {
  const nowManila = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const y = nowManila.getFullYear();
  const m = String(nowManila.getMonth() + 1).padStart(2, '0');
  const d = String(nowManila.getDate()).padStart(2, '0');
  const hh = String(nowManila.getHours()).padStart(2, '0');
  const mm = String(nowManila.getMinutes()).padStart(2, '0');
  const ss = String(nowManila.getSeconds()).padStart(2, '0');
  return { 
    dateStr: `${y}-${m}-${d}`, 
    timeStr: `${hh}:${mm}`,
    timeSecStr: `${hh}:${mm}:${ss}`
  };
}

function parsePlainDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (y < 1900) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return { y, m, d, dayOfWeek: dt.getDay() };
}

function calcAgeFromPlainDate(dateStr) {
  const parsed = parsePlainDate(dateStr);
  if (!parsed) return null;
  const { dateStr: todayStr } = getManilaNow();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  let age = ty - parsed.y;
  if (tm < parsed.m || (tm === parsed.m && td < parsed.d)) age--;
  return age;
}

function maskEmail(email = '') {
  const [user, domain] = String(email).split('@');
  if (!user || !domain) return '***@***';
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  if (user.length <= 4) return `${user.slice(0, 2)}***@${domain}`;
  return `${user.slice(0, 3)}***${user.slice(-1)}@${domain}`;
}

const rateLimits = new Map();
function rateLimit({ windowMs = 60000, max = 15, keyFn, message = 'Too many requests. Please wait a moment and try again.' } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const customKey = keyFn ? keyFn(req) : ip;
    const key = `${req.baseUrl}${req.path}:${customKey}`;
    const now = Date.now();
    const entry = rateLimits.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    rateLimits.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// ============================================================================
// AUTHENTICATION & RBAC MIDDLEWARE
// ============================================================================
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'patient' || !ALLOWED_STAFF_ROLES.includes(decoded.role)) {
      return res.status(403).json({ error: 'Access denied: Staff credentials required' });
    }
    req.user = {
      ...decoded,
      role: normalizeRole(decoded.role),
    };
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

function authorizeRoles(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((r) => normalizeRole(r));
  return (req, res, next) => {
    if (!req.user || req.user.type === 'patient') {
      return res.status(403).json({ error: 'Forbidden: Staff credentials required.' });
    }
    const userRole = normalizeRole(req.user.role);
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        error: `Forbidden: This action requires ${allowedRoles.join(' or ')} permissions (your role: ${userRole}).`,
      });
    }
    next();
  };
}

function patientAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'patient') {
      return res.status(403).json({ error: 'Access denied: Patient login required' });
    }
    req.patient = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

async function ownsPatient(req, id) {
  const r = await pool.query('SELECT 1 FROM patients WHERE id = $1 AND clinic_id = $2', [id, req.user.clinic_id]);
  return r.rowCount > 0;
}

async function nextPatientNo(db, clinicId) {
  const n = await db.query(
    `SELECT COALESCE(MAX(SUBSTRING(patient_no FROM 3)::int), 0) + 1 AS next
     FROM patients WHERE clinic_id = $1 AND patient_no ~ '^P-[0-9]+$'`,
    [clinicId]
  );
  return 'P-' + String(n.rows[0].next).padStart(6, '0');
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateReferenceNo() {
  const { dateStr } = getManilaNow();
  const compactDate = dateStr.replace(/-/g, '');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REF-${compactDate}-${rand}`;
}

// ============================================================================
// ACTIVITY LOG HELPER
// ============================================================================
async function logActivity(staffId, actionType, targetId, description, patientId = null) {
  try {
    const validTargetId =
      targetId && UUID_REGEX.test(String(targetId).trim()) ? String(targetId).trim() : null;
    const validPatientId =
      patientId && UUID_REGEX.test(String(patientId).trim()) ? String(patientId).trim() : null;

    await pool.query(
      `INSERT INTO activity_logs (staff_id, action_type, target_id, patient_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [staffId || null, actionType, validTargetId, validPatientId, description]
    );
  } catch (err) {
    console.error('Failed to record activity log:', err.message);
  }
}

// ============================================================================
// TERMINAL EMAIL LOGGERS
// ============================================================================
function printBookingConfirmationEmail(email, patientName, refNo, dateStr, timeStr, services) {
  console.log('\n============================================================');
  console.log(` [${CLINIC_CONFIG.name}] APPOINTMENT REQUEST RECEIVED`);
  console.log(` To:             ${email}`);
  console.log(` Patient:        ${patientName}`);
  console.log(` Reference No:   ${refNo}`);
  console.log(` Requested Date: ${dateStr} at ${timeStr}`);
  console.log(` Services:       ${services.join(', ')}`);
  console.log(' Status:         PENDING (Awaiting Clinic Staff Confirmation)');
  console.log(` Clinic Phone:   ${CLINIC_CONFIG.phone}`);
  console.log(` Clinic Email:   ${CLINIC_CONFIG.email}`);
  console.log(` Address:        ${CLINIC_CONFIG.address}`);
  console.log('============================================================\n');
}

function printCancellationEmail(email, patientName, targetType, details) {
  console.log('\n============================================================');
  console.log(` [${CLINIC_CONFIG.name}] CANCELLATION NOTICE`);
  console.log(` To:           ${email}`);
  console.log(` Patient:      ${patientName}`);
  console.log(` Action:       Patient cancelled ${targetType}`);
  console.log(` Details:      ${details}`);
  console.log(` Clinic Phone: ${CLINIC_CONFIG.phone}`);
  console.log('============================================================\n');
}

function printStaffDecisionEmail(email, patientName, refNo, action, details) {
  console.log('\n============================================================');
  console.log(` [${CLINIC_CONFIG.name}] APPOINTMENT ${action.toUpperCase()}`);
  console.log(` To:           ${email}`);
  console.log(` Patient:      ${patientName}`);
  console.log(` Reference No: ${refNo}`);
  console.log(` Status:       ${action.toUpperCase()}`);
  if (details.dentistName) console.log(` Assigned To:  Dr. ${details.dentistName}`);
  if (details.dateStr && details.timeStr) console.log(` Schedule:     ${details.dateStr} at ${details.timeStr}`);
  if (details.reason) console.log(` Clinic Note:  ${details.reason}`);
  console.log(` Clinic Phone: ${CLINIC_CONFIG.phone}`);
  console.log(` Address:      ${CLINIC_CONFIG.address}`);
  console.log('============================================================\n');
}

function printIdentityCorrectionEmail(email, patientName, action, details) {
  console.log('\n============================================================');
  console.log(` [${CLINIC_CONFIG.name}] IDENTITY CORRECTION ${action.toUpperCase()}`);
  console.log(` To:           ${email || 'No email on file'}`);
  console.log(` Patient:      ${patientName}`);
  console.log(` Field:        ${details.field_name}`);
  console.log(` Old Value:    ${details.old_value || 'None'}`);
  console.log(` New Value:    ${details.new_value}`);
  console.log(` Status:       ${action.toUpperCase()}`);
  console.log(` Reviewed By:  ${details.staff_name}`);
  if (details.staff_reason) console.log(` Staff Reason: ${details.staff_reason}`);
  console.log(` Clinic Phone: ${CLINIC_CONFIG.phone}`);
  console.log('============================================================\n');
}

// ============================================================================
// HEALTH CHECK & PUBLIC INQUIRY ROUTE
// ============================================================================
app.get('/api/health', wrap(async (req, res) => {
  const r = await pool.query('SELECT now() AS time');
  res.json({ ok: true, db_time: r.rows[0].time, clinic: CLINIC_CONFIG.name });
}));

app.post('/api/public/inquiries', rateLimit({ windowMs: 10 * 60000, max: 5 }), wrap(async (req, res) => {
  const { name, email, phone, message, bot_field } = req.body;
  if (bot_field) {
    return res.status(200).json({ ok: true, message: 'Inquiry sent successfully! We will contact you soon.' });
  }
  if (!val(name) || !val(email) || !val(phone) || !val(message)) {
    return res.status(400).json({ error: 'All fields (name, email, mobile number, and message) are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val(email))) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!isPhilippinePhone(phone)) {
    return res.status(400).json({ error: 'Please enter a valid Philippine mobile number (e.g. 0917 123 4567).' });
  }

  const c = await pool.query('SELECT id FROM clinics WHERE is_active ORDER BY created_at LIMIT 1');
  if (!c.rowCount) return res.status(500).json({ error: 'No clinic configured in database.' });

  const ins = await pool.query(
    `INSERT INTO inquiries (clinic_id, name, email, phone, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [c.rows[0].id, val(name), val(email).toLowerCase(), val(phone), val(message)]
  );

  const matchPat = await pool.query(
    `SELECT id FROM patients WHERE LOWER(email) = $1 OR phone = $2 LIMIT 1`,
    [val(email).toLowerCase(), val(phone)]
  );
  const matchedPatientId = matchPat.rowCount ? matchPat.rows[0].id : null;

  await logActivity(
    null,
    'Inquiry',
    ins.rows[0].id,
    `Web inquiry received from ${val(name)} (${val(email)}): "${val(message).slice(0, 80)}${val(message).length > 80 ? '...' : ''}"`,
    matchedPatientId
  );

  res.status(201).json({
    ok: true,
    message: 'Thank you for reaching out! Your message has been received by Smile Avenue Dental Clinic.',
  });
}));

// ============================================================================
// PATIENT REVIEWS & PRIVACY MASKING ROUTES
// ============================================================================
function maskWord(word = '') {
  const clean = String(word || '').trim();
  if (!clean) return 'P***t';
  if (clean.length === 1) return `${clean}*`;
  if (clean.length === 2) return `${clean[0]}*`;
  return `${clean[0]}${'*'.repeat(clean.length - 2)}${clean[clean.length - 1]}`;
}

function maskPatientName(firstName = '') {
  const parts = String(firstName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P*****t';
  return parts.map(maskWord).join(' ');
}

app.get('/api/public/reviews', wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT
       rv.id,
       rv.rating,
       rv.review_text,
       to_char(rv.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS created_date,
       p.first_name
     FROM reviews rv
     JOIN patients p ON p.id = rv.patient_id
     ORDER BY rv.created_at DESC
     LIMIT 30`
  );

  const safeReviews = r.rows.map((row) => ({
    id: row.id,
    masked_name: maskPatientName(row.first_name),
    rating: Number(row.rating),
    review_text: row.review_text,
    created_date: row.created_date,
  }));

  res.json(safeReviews);
}));

app.get('/api/patient/reviews/me', patientAuth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT id, rating, review_text,
            to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS created_date
     FROM reviews
     WHERE patient_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [req.patient.patient_id]
  );
  res.json({ review: r.rows[0] || null });
}));

app.post(
  '/api/patient/reviews',
  patientAuth,
  rateLimit({ windowMs: 60000, max: 5 }),
  wrap(async (req, res) => {
    const rating = Number(req.body.rating);
    const reviewText = val(req.body.review_text);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Please select a star rating between 1 and 5.' });
    }
    if (!reviewText || reviewText.length < 5) {
      return res.status(400).json({ error: 'Please write a short review (at least 5 characters).' });
    }
    if (reviewText.length > 600) {
      return res.status(400).json({ error: 'Review text must be 600 characters or less.' });
    }

    const ins = await pool.query(
      `INSERT INTO reviews (patient_id, rating, review_text)
       VALUES ($1, $2, $3)
       RETURNING id, rating, review_text,
                 to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS created_date`,
      [req.patient.patient_id, rating, reviewText]
    );

    res.status(201).json({
      ok: true,
      review: ins.rows[0],
      message: 'Thank you for your review!',
    });
  })
);

// ============================================================================
// STAFF AUTHENTICATION & EMAIL OTP VERIFICATION
// ============================================================================
app.post('/api/auth/login', rateLimit({ windowMs: 60000, max: 15 }), wrap(async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (val(email) || '').toLowerCase();

  const r = await pool.query(
    'SELECT * FROM users WHERE LOWER(email) = $1 AND is_active = true',
    [cleanEmail]
  );
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }

  if (u.is_verified === false) {
    const now = new Date();
    const hasValidOtp = u.otp_code && u.otp_expiry && new Date(u.otp_expiry) > now;
    const otpCode = hasValidOtp ? u.otp_code : generateCode();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE users
       SET otp_code = $1, otp_expiry = $2
       WHERE id = $3`,
      [otpCode, otpExpiry, u.id]
    );

    try {
      const htmlContent = buildOtpHtml({
        title: 'Staff Portal Email Verification',
        subtitle: `Hello ${u.first_name || 'Staff'}, please verify your account using the 6-digit OTP code below:`,
        code: otpCode,
        footerNote: `Assigned Role: ${normalizeRole(u.role)}`,
      });
      await sendEmail(u.email, 'Your Staff Verification OTP - Smile Avenue', htmlContent);
    } catch (emailErr) {
      console.error('Nodemailer login OTP error:', emailErr.message);
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    return res.status(403).json({
      error: 'Please verify your email first.',
      requiresVerification: true,
      needs_verification: true,
      email: u.email,
    });
  }

  const cleanRole = normalizeRole(u.role);
  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [u.id]);

  await logActivity(
    u.id,
    'Login',
    u.id,
    `Logged in to Staff Portal as ${cleanRole} (${u.first_name} ${u.last_name} · ${u.email})`
  );

  const token = jwt.sign(
    { id: u.id, clinic_id: u.clinic_id, role: cleanRole, type: 'staff' },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({
    token,
    user: {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: cleanRole,
    },
  });
}));

app.post('/api/auth/verify-otp', rateLimit({ windowMs: 60000, max: 15 }), wrap(async (req, res) => {
  const cleanEmail = (val(req.body.email) || '').toLowerCase().trim();
  const cleanCode = String(val(req.body.code) || '').trim();

  if (!cleanEmail || !cleanCode) {
    return res.status(400).json({ error: 'Email and 6-digit OTP code are required.' });
  }

  const r = await pool.query(
    'SELECT * FROM users WHERE LOWER(TRIM(email)) = $1 AND is_active = true',
    [cleanEmail]
  );
  const u = r.rows[0];
  if (!u) {
    return res.status(404).json({ error: 'Staff account not found.' });
  }

  if (u.is_verified === true) {
    return res.status(400).json({ error: 'This staff account is already verified. Please log in.' });
  }

  if (!u.otp_code || !u.otp_expiry) {
    return res.status(400).json({ error: 'No active OTP found. Please click Resend Code.' });
  }

  if (new Date() > new Date(u.otp_expiry)) {
    return res.status(400).json({ error: 'OTP code has expired. Please click Resend Code.' });
  }

  const dbOtp = String(u.otp_code).replace(/\D/g, '').trim();
  const inputOtp = cleanCode.replace(/\D/g, '').trim();

  if (dbOtp !== inputOtp) {
    return res.status(400).json({ error: 'Invalid 6-digit OTP code. Please check your latest email and try again.' });
  }

  const cleanRole = normalizeRole(u.role);
  await pool.query(
    `UPDATE users
     SET is_verified = true,
         otp_code = NULL,
         otp_expiry = NULL,
         last_login_at = now()
     WHERE id = $1`,
    [u.id]
  );

  await logActivity(
    u.id,
    'Login',
    u.id,
    `Verified email via OTP and logged in as ${cleanRole} (${u.first_name} ${u.last_name} · ${u.email})`
  );

  const token = jwt.sign(
    { id: u.id, clinic_id: u.clinic_id, role: cleanRole, type: 'staff' },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    ok: true,
    token,
    user: {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      role: cleanRole,
    },
  });
}));

app.post('/api/auth/resend-otp', rateLimit({ windowMs: 60000, max: 10 }), wrap(async (req, res) => {
  const cleanEmail = (val(req.body.email) || '').toLowerCase();
  if (!cleanEmail) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const r = await pool.query(
    'SELECT id, email, first_name, role, is_verified FROM users WHERE LOWER(email) = $1 AND is_active = true',
    [cleanEmail]
  );
  const u = r.rows[0];
  if (!u) {
    return res.status(404).json({ error: 'Staff account not found.' });
  }
  if (u.is_verified === true) {
    return res.status(400).json({ error: 'This account is already verified.' });
  }

  const otpCode = generateCode();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    `UPDATE users
     SET otp_code = $1, otp_expiry = $2
     WHERE id = $3`,
    [otpCode, otpExpiry, u.id]
  );

  try {
    const htmlContent = buildOtpHtml({
      title: 'Staff Verification Code (Resent)',
      subtitle: `Hello ${u.first_name || 'Staff'}, here is your new 6-digit verification code:`,
      code: otpCode,
    });
    await sendEmail(u.email, 'New Staff Verification OTP - Smile Avenue', htmlContent);
  } catch (emailErr) {
    console.error('Nodemailer resend error:', emailErr.message);
    return res.status(500).json({ error: 'Failed to send email. Please try again.' });
  }

  res.json({
    ok: true,
    message: 'A new 6-digit OTP code has been sent to your email address.',
  });
}));

// ============================================================================
// PATIENT AUTHENTICATION & SECURITY QUESTIONS
// ============================================================================
app.post('/api/patient/auth/check-email', rateLimit({ windowMs: 60000, max: 10 }), wrap(async (req, res) => {
  const email = val(req.body.email)?.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.json({ exists: false });
  }
  const r = await pool.query(
    'SELECT 1 FROM patient_accounts WHERE email = $1 AND is_email_verified = true',
    [email]
  );
  res.json({ exists: r.rowCount > 0 });
}));

app.post('/api/patient/auth/register', rateLimit({ windowMs: 60000, max: 10 }), wrap(async (req, res) => {
  const b = req.body;
  const email = val(b.email)?.toLowerCase();
  const password = val(b.password);
  const firstName = val(b.first_name);
  const lastName = val(b.last_name);
  const birthDate = val(b.birth_date);
  const sex = val(b.sex)?.toLowerCase();
  const phone = val(b.phone);
  const securityQuestion = val(b.security_question);
  const rawSecurityAnswer = val(b.security_answer);

  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  if (!firstName || !lastName) return res.status(400).json({ error: 'First and last name are required' });
  if (!birthDate || !parsePlainDate(birthDate)) return res.status(400).json({ error: 'Valid date of birth is required' });

  const bdate = new Date(`${birthDate}T00:00:00+08:00`);
  if (isNaN(bdate.getTime()) || bdate > new Date()) {
    return res.status(400).json({ error: 'Please enter a valid date of birth that is not in the future' });
  }

  if (!['male', 'female', 'other'].includes(sex)) return res.status(400).json({ error: 'Please select a valid gender' });
  if (!phone || !isPhilippinePhone(phone)) {
    return res.status(400).json({ error: 'Please enter a valid Philippine mobile number (e.g. 0917 123 4567)' });
  }

  if (!securityQuestion) {
    return res.status(400).json({ error: 'Please select a security question for account recovery.' });
  }
  if (!rawSecurityAnswer || rawSecurityAnswer.length < 2) {
    return res.status(400).json({ error: 'Please provide a security answer (at least 2 characters).' });
  }

  if (!b.terms_accepted) return res.status(400).json({ error: 'You must agree to the Terms and Conditions' });
  if (!b.privacy_accepted) return res.status(400).json({ error: 'You must agree to the Privacy Policy (RA 10173)' });

  const age = Math.floor((Date.now() - bdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 18) {
    if (!val(b.guardian_name)) {
      return res.status(400).json({ error: 'Parent or guardian name is required for patients under 18' });
    }
    if (!val(b.guardian_phone) || !isPhilippinePhone(b.guardian_phone)) {
      return res.status(400).json({ error: 'A valid Philippine contact number for the parent or guardian is required for patients under 18' });
    }
  }

  const med = b.medical_history || {};
  if (med.answers && typeof med.answers === 'object') {
    for (const [, answer] of Object.entries(med.answers)) {
      if (answer && typeof answer === 'object' && answer.choice === 'yes' && (!answer.details || !String(answer.details).trim())) {
        return res.status(400).json({ error: 'Please provide explanatory details for all affirmative ("Yes") medical history questions' });
      }
    }
  }

  const clinicQuery = await pool.query('SELECT id FROM clinics WHERE is_active ORDER BY created_at LIMIT 1');
  if (!clinicQuery.rowCount) return res.status(500).json({ error: 'No clinic configured in system' });
  const clinicId = clinicQuery.rows[0].id;

  // Check if an account already exists with this email
  const existingAcc = await pool.query('SELECT id, is_email_verified, is_claimed FROM patient_accounts WHERE email = $1', [email]);
  if (existingAcc.rowCount > 0 && existingAcc.rows[0].is_email_verified && existingAcc.rows[0].is_claimed !== false) {
    return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
  }

  const cleanFirst = toTitleCase(firstName);
  const cleanMiddle = val(b.middle_name) ? toTitleCase(b.middle_name) : null;
  const cleanLast = toTitleCase(lastName);

  // Check for existing patient record matching Name + DOB
  const dupPatientRes = await pool.query(
    `SELECT p.id, p.patient_no, pa.id AS account_id, pa.is_claimed, pa.is_email_verified
     FROM patients p
     LEFT JOIN patient_accounts pa ON pa.patient_id = p.id
     WHERE p.clinic_id = $1
       AND p.is_active = true
       AND LOWER(TRIM(p.first_name)) = LOWER(TRIM($2))
       AND COALESCE(LOWER(TRIM(p.middle_name)), '') = COALESCE(LOWER(TRIM($3)), '')
       AND LOWER(TRIM(p.last_name)) = LOWER(TRIM($4))
       AND p.birth_date::date = $5::date
     LIMIT 1`,
    [clinicId, cleanFirst, cleanMiddle || '', cleanLast, birthDate]
  );

  if (dupPatientRes.rowCount > 0) {
    const dup = dupPatientRes.rows[0];
    // If the patient already has an active, claimed portal account, reject registration
    if (dup.account_id && dup.is_claimed !== false && dup.is_email_verified) {
      return res.status(409).json({
        error: `A patient portal account already exists for ${cleanFirst} ${cleanLast}. Please log in or use "Forgot password".`,
      });
    }
  }

  const hashedSecurityAnswer = await bcrypt.hash(rawSecurityAnswer.toLowerCase().trim(), 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let patientId;
    // Check if matching patient exists (by Name+DOB or by email/phone)
    if (dupPatientRes.rowCount > 0) {
      patientId = dupPatientRes.rows[0].id;
      await client.query(
        `UPDATE patients
         SET phone = $1, email = $2, address = $3, unit = $4, province = $5, city = $6,
             barangay = $7, postal_code = $8, civil_status = $9, occupation = $10,
             guardian_name = $11, guardian_phone = $12, religion = $13,
             security_question = $14, security_answer = $15, updated_at = now()
         WHERE id = $16`,
        [phone, email, val(b.address), val(b.unit), val(b.province), val(b.city),
         val(b.barangay), val(b.postal_code), val(b.civil_status), val(b.occupation),
         val(b.guardian_name), val(b.guardian_phone), val(b.religion),
         securityQuestion, hashedSecurityAnswer, patientId]
      );
    } else {
      const matchEmailPhone = await client.query(
        `SELECT p.id FROM patients p
         LEFT JOIN patient_accounts pa ON pa.patient_id = p.id
         WHERE p.clinic_id = $1 AND (p.email = $2 OR p.phone = $3) AND pa.id IS NULL
         ORDER BY p.created_at LIMIT 1`,
        [clinicId, email, phone]
      );

      if (matchEmailPhone.rowCount > 0) {
        patientId = matchEmailPhone.rows[0].id;
        await client.query(
          `UPDATE patients
           SET first_name = $1, middle_name = $2, last_name = $3, birth_date = $4, sex = $5,
               phone = $6, email = $7, address = $8, unit = $9, province = $10, city = $11,
               barangay = $12, postal_code = $13, civil_status = $14, occupation = $15,
               guardian_name = $16, guardian_phone = $17, religion = $18,
               security_question = $19, security_answer = $20, updated_at = now()
           WHERE id = $21`,
          [cleanFirst, cleanMiddle, cleanLast, birthDate, sex, phone, email,
           val(b.address), val(b.unit), val(b.province), val(b.city),
           val(b.barangay), val(b.postal_code), val(b.civil_status), val(b.occupation),
           val(b.guardian_name), val(b.guardian_phone), val(b.religion),
           securityQuestion, hashedSecurityAnswer, patientId]
        );
      } else {
        const patientNo = await nextPatientNo(client, clinicId);
        const newPat = await client.query(
          `INSERT INTO patients (clinic_id, patient_no, first_name, middle_name, last_name, birth_date, sex,
             phone, email, address, unit, province, city, barangay, postal_code, civil_status, occupation,
             guardian_name, guardian_phone, religion, security_question, security_answer, reminders_enabled)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,true)
           RETURNING id`,
          [clinicId, patientNo, cleanFirst, cleanMiddle, cleanLast, birthDate, sex,
           phone, email, val(b.address), val(b.unit), val(b.province), val(b.city),
           val(b.barangay), val(b.postal_code), val(b.civil_status), val(b.occupation),
           val(b.guardian_name), val(b.guardian_phone), val(b.religion),
           securityQuestion, hashedSecurityAnswer]
        );
        patientId = newPat.rows[0].id;
      }
    }

    const passHash = await bcrypt.hash(password, 10);
    if (existingAcc.rowCount > 0) {
      await client.query(
        `UPDATE patient_accounts
         SET password_hash = $1, patient_id = $2, is_claimed = true, updated_at = now()
         WHERE email = $3`,
        [passHash, patientId, email]
      );
    } else {
      await client.query(
        `INSERT INTO patient_accounts (clinic_id, patient_id, email, password_hash, is_email_verified, is_claimed)
         VALUES ($1, $2, $3, $4, false, true)
         ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             patient_id = EXCLUDED.patient_id,
             is_claimed = true,
             updated_at = now()`,
        [clinicId, patientId, email, passHash]
      );
    }

    await client.query(
      `INSERT INTO medical_histories (patient_id, allergies, medications, is_pregnant, has_bleeding_issue, other_notes, answers)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [patientId, val(med.allergies), val(med.medications),
       med.is_pregnant === true, med.has_bleeding_issue === true,
       val(med.other_notes), JSON.stringify(med.answers || {})]
    );

    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const termsVer = val(b.terms_version) || CLINIC_CONFIG.termsVersion;
    const privVer = val(b.privacy_version) || CLINIC_CONFIG.privacyVersion;

    await client.query(
      `INSERT INTO consents (patient_id, consent_type, signed_by, version, ip_address)
       VALUES ($1, 'terms_and_conditions', $2, $3, $5),
              ($1, 'privacy_policy', $2, $4, $5)`,
      [patientId, `${cleanFirst} ${cleanLast}`, termsVer, privVer, clientIp]
    );

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await client.query('DELETE FROM verification_codes WHERE email = $1 AND purpose = $2', [email, 'signup']);
    await client.query(
      `INSERT INTO verification_codes (email, code_hash, purpose, expires_at)
       VALUES ($1, $2, 'signup', $3)`,
      [email, codeHash, expiresAt]
    );

    try {
      const htmlContent = buildOtpHtml({
        title: 'Verify Your Patient Account',
        subtitle: `Hi ${cleanFirst}, thank you for registering with Smile Avenue Dental Clinic. Please enter the 6-digit verification code below to activate your account:`,
        code,
      });
      await sendEmail(email, 'Your Verification Code - Smile Avenue Dental Clinic', htmlContent);
    } catch (emailErr) {
      await client.query('ROLLBACK');
      console.error('Nodemailer error (Patient Sign-Up):', emailErr.message);
      return res.status(500).json({ error: 'Failed to send email. Please try again.' });
    }

    await client.query('COMMIT');

    await logActivity(
      null,
      'Add Patient',
      patientId,
      `New patient registered online: ${cleanFirst} ${cleanLast} (${email})`,
      patientId
    );

    res.status(201).json({
      ok: true,
      message: 'Account created. Please enter the 6-digit verification code sent to your email.',
      email,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// ============================================================================
// ACCOUNT CLAIMING ENDPOINTS (FOR PATIENTS ADDED BY STAFF)
// ============================================================================
app.post(
  '/api/patient/auth/claim/initiate',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
  wrap(async (req, res) => {
    const rawEmail = val(req.body.email);
    const rawDob = val(req.body.birth_date);

    if (!rawEmail || !rawDob) {
      return res.status(400).json({ error: 'Email and Date of Birth are required.' });
    }

    const cleanEmail = rawEmail.toLowerCase().trim();
    if (!parsePlainDate(rawDob)) {
      return res.status(400).json({ error: 'Please enter a valid date of birth (YYYY-MM-DD).' });
    }

    const r = await pool.query(
      `SELECT p.id AS patient_id, p.first_name, p.last_name, p.clinic_id,
              pa.id AS account_id, pa.is_claimed, pa.password_hash
       FROM patients p
       LEFT JOIN patient_accounts pa ON pa.patient_id = p.id
       WHERE LOWER(TRIM(p.email)) = $1
         AND p.birth_date::date = $2::date
         AND p.is_active = true
       LIMIT 1`,
      [cleanEmail, rawDob]
    );

    if (!r.rowCount) {
      return res.status(404).json({
        error: 'No clinic patient record found matching this email and date of birth.',
      });
    }

    const patient = r.rows[0];

    if (patient.is_claimed === true || (patient.password_hash && patient.is_claimed !== false)) {
      return res.status(400).json({
        error: 'This account has already been claimed. Please log in or use "Forgot password".',
      });
    }

    if (!patient.account_id) {
      await pool.query(
        `INSERT INTO patient_accounts (clinic_id, patient_id, email, password_hash, is_email_verified, is_claimed)
         VALUES ($1, $2, $3, NULL, false, false)
         ON CONFLICT (email) DO UPDATE SET patient_id = EXCLUDED.patient_id`,
        [patient.clinic_id, patient.patient_id, cleanEmail]
      );
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query('DELETE FROM verification_codes WHERE email = $1 AND purpose = $2', [cleanEmail, 'claim_account']);
    await pool.query(
      `INSERT INTO verification_codes (email, code_hash, purpose, expires_at)
       VALUES ($1, $2, 'claim_account', $3)`,
      [cleanEmail, codeHash, expiresAt]
    );

    try {
      const htmlContent = buildOtpHtml({
        title: 'Claim Your Smile Avenue Patient Portal Account',
        subtitle: `Hello ${toTitleCase(patient.first_name)}, enter this 6-digit verification code to claim and activate your portal account:`,
        code,
      });
      await sendEmail(cleanEmail, 'Claim Your Patient Account - Smile Avenue', htmlContent);
    } catch (emailErr) {
      console.error('Nodemailer error (Account Claim):', emailErr.message);
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    res.json({
      ok: true,
      message: 'Verification code sent to your registered email address.',
    });
  })
);

app.post(
  '/api/patient/auth/claim/complete',
  rateLimit({ windowMs: 60000, max: 10 }),
  wrap(async (req, res) => {
    const { claim_token, password, confirm_password, security_question, security_answer } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    if (confirm_password && password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    let cleanEmail;
    try {
      const decoded = jwt.verify(claim_token, process.env.JWT_SECRET);
      if (decoded.purpose !== 'claim_account') throw new Error();
      cleanEmail = decoded.email;
    } catch {
      return res.status(400).json({ error: 'Claim session expired. Please start over.' });
    }

    const accRes = await pool.query(
      `SELECT pa.id AS account_id, pa.patient_id, pa.clinic_id,
              p.first_name, p.middle_name, p.last_name, p.patient_no
       FROM patient_accounts pa
       JOIN patients p ON p.id = pa.patient_id
       WHERE LOWER(TRIM(pa.email)) = $1`,
      [cleanEmail]
    );

    if (!accRes.rowCount) {
      return res.status(404).json({ error: 'Patient account not found.' });
    }

    const u = accRes.rows[0];
    const passHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE patient_accounts
         SET password_hash = $1,
             is_claimed = true,
             is_email_verified = true,
             last_login_at = now(),
             updated_at = now()
         WHERE id = $2`,
        [passHash, u.account_id]
      );

      if (val(security_question) && val(security_answer)) {
        const hashedSec = await bcrypt.hash(val(security_answer).toLowerCase().trim(), 10);
        await client.query(
          `UPDATE patients
           SET security_question = $1, security_answer = $2, updated_at = now()
           WHERE id = $3`,
          [val(security_question), hashedSec, u.patient_id]
        );
      }

      await client.query('DELETE FROM verification_codes WHERE email = $1 AND purpose = $2', [cleanEmail, 'claim_account']);

      await client.query('COMMIT');

      const patName = [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ');
      await logActivity(
        null,
        'Account Recovery',
        u.patient_id,
        `${patName} successfully claimed their patient portal account (${cleanEmail}).`,
        u.patient_id
      );

      const token = jwt.sign(
        { id: u.account_id, patient_id: u.patient_id, clinic_id: u.clinic_id, type: 'patient' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        ok: true,
        token,
        patient: {
          id: u.account_id,
          patient_id: u.patient_id,
          email: cleanEmail,
          first_name: u.first_name,
          middle_name: u.middle_name,
          last_name: u.last_name,
          patient_no: u.patient_no,
        },
        message: 'Account successfully claimed! Logging you in...',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// ============================================================================
// ACCOUNT RECOVERY VIA SECURITY QUESTIONS
// ============================================================================
app.post(
  '/api/patient/auth/recover/lookup',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many recovery attempts. Please wait 15 minutes before trying again.',
  }),
  wrap(async (req, res) => {
    const firstName = val(req.body.first_name);
    const lastName = val(req.body.last_name);
    const birthDate = val(req.body.birth_date);

    if (!firstName || !lastName || !birthDate) {
      return res.status(400).json({ error: 'First name, last name, and date of birth are required.' });
    }

    if (!parsePlainDate(birthDate)) {
      return res.status(400).json({ error: 'Please enter a valid date of birth (YYYY-MM-DD).' });
    }

    const r = await pool.query(
      `SELECT p.id, p.security_question, p.security_answer, pa.id AS account_id
       FROM patients p
       JOIN patient_accounts pa ON pa.patient_id = p.id
       WHERE LOWER(TRIM(p.first_name)) = LOWER(TRIM($1))
         AND LOWER(TRIM(p.last_name)) = LOWER(TRIM($2))
         AND p.birth_date::date = $3::date`,
      [firstName, lastName, birthDate]
    );

    if (!r.rowCount) {
      return res.status(404).json({
        error: 'No registered patient account found matching this name and date of birth.',
      });
    }

    const patient = r.rows[0];

    if (!patient.security_question || !patient.security_answer) {
      return res.status(400).json({
        error: 'This account does not have a security question configured. Please visit the clinic reception for account assistance.',
      });
    }

    res.json({
      ok: true,
      patient_id: patient.id,
      security_question: patient.security_question,
    });
  })
);

app.post(
  '/api/patient/auth/recover/verify',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many recovery attempts. Please wait 15 minutes before trying again.',
  }),
  wrap(async (req, res) => {
    const patientId = String(req.body.patient_id || '').trim();
    const rawAnswer = val(req.body.security_answer);

    if (!UUID_REGEX.test(patientId)) {
      return res.status(400).json({ error: 'Invalid patient recovery identifier.' });
    }
    if (!rawAnswer) {
      return res.status(400).json({ error: 'Please provide your security answer.' });
    }

    const r = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.security_answer, pa.email
       FROM patients p
       JOIN patient_accounts pa ON pa.patient_id = p.id
       WHERE p.id = $1`,
      [patientId]
    );

    if (!r.rowCount) {
      return res.status(404).json({ error: 'Patient account not found.' });
    }

    const patient = r.rows[0];
    const match = await bcrypt.compare(rawAnswer.toLowerCase().trim(), patient.security_answer);

    if (!match) {
      await logActivity(
        null,
        'Failed Recovery',
        patient.id,
        `Failed security answer attempt for ${patient.first_name} ${patient.last_name}.`,
        patient.id
      );
      return res.status(400).json({
        error: 'Incorrect security answer. Please check your spelling and try again.',
      });
    }

    await logActivity(
      null,
      'Account Recovery',
      patient.id,
      `Successfully completed security question verification for ${patient.first_name} ${patient.last_name}.`,
      patient.id
    );

    res.json({
      ok: true,
      message: 'Security answer verified successfully.',
      masked_email: maskEmail(patient.email),
    });
  })
);

app.post(
  '/api/patient/auth/recover/reset-password',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many recovery attempts. Please wait 15 minutes before trying again.',
  }),
  wrap(async (req, res) => {
    const patientId = String(req.body.patient_id || '').trim();
    const rawAnswer = val(req.body.security_answer);
    const newPassword = val(req.body.new_password);

    if (!UUID_REGEX.test(patientId)) {
      return res.status(400).json({ error: 'Invalid patient recovery identifier.' });
    }
    if (!rawAnswer) {
      return res.status(400).json({ error: 'Security answer is required.' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    const r = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.security_answer, pa.id AS account_id, pa.email
       FROM patients p
       JOIN patient_accounts pa ON pa.patient_id = p.id
       WHERE p.id = $1`,
      [patientId]
    );

    if (!r.rowCount) {
      return res.status(404).json({ error: 'Patient account not found.' });
    }

    const patient = r.rows[0];
    const match = await bcrypt.compare(rawAnswer.toLowerCase().trim(), patient.security_answer);
    if (!match) {
      await logActivity(
        null,
        'Failed Recovery',
        patient.id,
        `Failed password reset attempt (incorrect security answer) for ${patient.first_name} ${patient.last_name}.`,
        patient.id
      );
      return res.status(400).json({
        error: 'Incorrect security answer. Password was not changed.',
      });
    }

    const newPassHash = await bcrypt.hash(newPassword, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE patient_accounts
         SET password_hash = $1, updated_at = now()
         WHERE patient_id = $2`,
        [newPassHash, patient.id]
      );

      await client.query(
        `UPDATE patients
         SET updated_at = now()
         WHERE id = $1`,
        [patient.id]
      );

      await client.query('COMMIT');

      await logActivity(
        null,
        'Password Reset',
        patient.id,
        `Password reset successfully via security question recovery for ${patient.first_name} ${patient.last_name}.`,
        patient.id
      );

      res.json({
        ok: true,
        email: patient.email,
        message: 'Password reset successfully! You can now log in with your new password.',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

app.post('/api/patient/auth/verify-code', rateLimit({ windowMs: 60000, max: 15 }), wrap(async (req, res) => {
  const { email, code, purpose = 'signup' } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and 6-digit code are required' });

  const r = await pool.query(
    `SELECT id, code_hash, attempts, expires_at
     FROM verification_codes
     WHERE email = $1 AND purpose = $2
     ORDER BY created_at DESC LIMIT 1`,
    [email.toLowerCase().trim(), purpose]
  );
  const row = r.rows[0];

  if (!row) return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
  if (row.attempts >= 5) {
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  }
  if (new Date() > new Date(row.expires_at)) {
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }

  const match = await bcrypt.compare(String(code).trim(), row.code_hash);
  if (!match) {
    await pool.query('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    const remaining = 4 - row.attempts;
    return res.status(400).json({
      error: `Incorrect code. ${remaining > 0 ? remaining + ' attempts remaining.' : 'Please request a new code.'}`,
    });
  }

  await pool.query('DELETE FROM verification_codes WHERE id = $1', [row.id]);

  if (purpose === 'signup') {
    const acc = await pool.query(
      `UPDATE patient_accounts
       SET is_email_verified = true, last_login_at = now()
       WHERE email = $1
       RETURNING id, patient_id, clinic_id, email`,
      [email.toLowerCase().trim()]
    );
    const u = acc.rows[0];
    const pat = (await pool.query('SELECT first_name, middle_name, last_name, patient_no FROM patients WHERE id = $1', [u.patient_id])).rows[0];

    const token = jwt.sign(
      { id: u.id, patient_id: u.patient_id, clinic_id: u.clinic_id, type: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({
      ok: true,
      token,
      patient: {
        id: u.id,
        patient_id: u.patient_id,
        email: u.email,
        first_name: pat.first_name,
        middle_name: pat.middle_name,
        last_name: pat.last_name,
        patient_no: pat.patient_no,
      },
    });
  }

  if (purpose === 'claim_account') {
    const claimToken = jwt.sign(
      { email: email.toLowerCase().trim(), purpose: 'claim_account' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    return res.json({
      ok: true,
      claim_token: claimToken,
      message: 'Code verified successfully. Please create your password.',
    });
  }

  const resetToken = jwt.sign(
    { email: email.toLowerCase().trim(), purpose: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  res.json({ ok: true, reset_token: resetToken, message: 'Code verified successfully.' });
}));

app.post('/api/patient/auth/resend-code', rateLimit({ windowMs: 60000, max: 5 }), wrap(async (req, res) => {
  const { email, purpose = 'signup' } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const cleanEmail = email.toLowerCase().trim();
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query('DELETE FROM verification_codes WHERE email = $1 AND purpose = $2', [cleanEmail, purpose]);
  await pool.query(
    `INSERT INTO verification_codes (email, code_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [cleanEmail, codeHash, purpose, expiresAt]
  );

  try {
    const htmlContent = buildOtpHtml({
      title: 'Your Verification Code',
      subtitle: 'Please enter the following 6-digit verification code:',
      code,
    });
    await sendEmail(cleanEmail, 'Your Verification Code - Smile Avenue Dental Clinic', htmlContent);
  } catch (emailErr) {
    console.error('Nodemailer resend error:', emailErr.message);
    return res.status(500).json({ error: 'Failed to send email. Please try again.' });
  }

  res.json({ ok: true, message: 'A new 6-digit verification code has been sent.' });
}));

app.post('/api/patient/auth/login', rateLimit({ windowMs: 60000, max: 10 }), wrap(async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();

  const r = await pool.query(
    `SELECT pa.id, pa.patient_id, pa.clinic_id, pa.email, pa.password_hash, pa.is_email_verified,
            p.first_name, p.middle_name, p.last_name, p.patient_no
     FROM patient_accounts pa
     JOIN patients p ON p.id = pa.patient_id
     WHERE pa.email = $1`,
    [cleanEmail]
  );
  const u = r.rows[0];

  if (!u || !u.password_hash || !(await bcrypt.compare(password || '', u.password_hash))) {
    await logActivity(
      null,
      'Failed Login',
      u ? u.patient_id : null,
      `Failed login attempt for ${cleanEmail || 'unknown'}.`,
      u ? u.patient_id : null
    );
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!u.is_email_verified) {
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 8);
    await pool.query('DELETE FROM verification_codes WHERE email = $1 AND purpose = $2', [cleanEmail, 'signup']);
    await pool.query(
      `INSERT INTO verification_codes (email, code_hash, purpose, expires_at)
       VALUES ($1, $2, 'signup', $3)`,
      [cleanEmail, codeHash, new Date(Date.now() + 10 * 60 * 1000)]
    );

    try {
      const htmlContent = buildOtpHtml({
        title: 'Verify Your Email Address',
        subtitle: `Hello ${u.first_name}, please verify your email address to continue to your Patient Portal:`,
        code,
      });
      await sendEmail(cleanEmail, 'Verify Your Email - Smile Avenue Dental Clinic', htmlContent);
    } catch (emailErr) {
      console.error('Nodemailer login unverified error:', emailErr.message);
    }

    return res.status(403).json({
      error: 'Please verify your email address to continue.',
      needs_verification: true,
      requiresVerification: true,
      email: u.email,
    });
  }

  await pool.query('UPDATE patient_accounts SET last_login_at = now() WHERE id = $1', [u.id]);

  const patName = [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ');
  await logActivity(
    null,
    'Patient Login',
    u.patient_id,
    `${patName} logged in.`,
    u.patient_id
  );

  const token = jwt.sign(
    { id: u.id, patient_id: u.patient_id, clinic_id: u.clinic_id, type: 'patient' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({
    token,
    patient: {
      id: u.id,
      patient_id: u.patient_id,
      email: u.email,
      first_name: u.first_name,
      middle_name: u.middle_name,
      last_name: u.last_name,
      patient_no: u.patient_no,
    },
  });
}));

app.post('/api/patient/auth/forgot-password', rateLimit({ windowMs: 60000, max: 5 }), wrap(async (req, res) => {
  const { email } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();

  if (cleanEmail) {
    const r = await pool.query('SELECT id FROM patient_accounts WHERE email = $1', [cleanEmail]);
    if (r.rowCount > 0) {
      const code = generateCode();
      const codeHash = await bcrypt.hash(code, 8);
      await pool.query('DELETE FROM verification_codes WHERE email = $1 AND purpose = $2', [cleanEmail, 'password_reset']);
      await pool.query(
        `INSERT INTO verification_codes (email, code_hash, purpose, expires_at)
         VALUES ($1, $2, 'password_reset', $3)`,
        [cleanEmail, codeHash, new Date(Date.now() + 10 * 60 * 1000)]
      );

      try {
        const htmlContent = buildOtpHtml({
          title: 'Reset Your Password',
          subtitle: 'Use this 6-digit verification code to reset your patient portal password:',
          code,
        });
        await sendEmail(cleanEmail, 'Password Reset Code - Smile Avenue Dental Clinic', htmlContent);
      } catch (emailErr) {
        return res.status(500).json({ error: 'Failed to send reset code.' });
      }
    }
  }

  res.json({
    ok: true,
    message: 'If an account exists with this email, a 6-digit verification code has been sent.',
  });
}));

app.post('/api/patient/auth/reset-password', rateLimit({ windowMs: 60000, max: 10 }), wrap(async (req, res) => {
  const { email, code, reset_token, new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  let cleanEmail;
  if (reset_token) {
    try {
      const decoded = jwt.verify(reset_token, process.env.JWT_SECRET);
      if (decoded.purpose !== 'password_reset') throw new Error();
      cleanEmail = decoded.email;
    } catch {
      return res.status(400).json({ error: 'Reset session expired. Please request a new code.' });
    }
  } else if (email && code) {
    cleanEmail = email.toLowerCase().trim();
    const r = await pool.query(
      `SELECT id, code_hash, expires_at FROM verification_codes
       WHERE email = $1 AND purpose = 'password_reset'
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail]
    );
    const row = r.rows[0];
    if (!row || new Date() > new Date(row.expires_at) || !(await bcrypt.compare(String(code).trim(), row.code_hash))) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }
    await pool.query('DELETE FROM verification_codes WHERE id = $1', [row.id]);
  } else {
    return res.status(400).json({ error: 'Verification code is required' });
  }

  const newHash = await bcrypt.hash(new_password, 10);
  await pool.query('UPDATE patient_accounts SET password_hash = $1, updated_at = now() WHERE email = $2', [newHash, cleanEmail]);
  res.json({ ok: true, message: 'Password updated successfully. You can now log in.' });
}));

// ============================================================================
// PATIENT PORTAL: MY HISTORY (CLINICAL & FINANCIAL RECORDS)
// ============================================================================
app.get(
  ['/api/patient/me/history', '/api/patient/patients/:id/history'],
  patientAuth,
  wrap(async (req, res) => {
    const tokenPatientId = String(req.patient.patient_id || '').trim();

    if (req.params.id && String(req.params.id).trim() !== tokenPatientId) {
      return res.status(403).json({
        error: "Forbidden: You are not authorized to access another patient's records.",
      });
    }

    const clinicalRes = await pool.query(
      `SELECT
         pt.id,
         pt.patient_id,
         pt.tooth_number,
         pt.procedure_name,
         pt.surface,
         pt.status,
         pt.price::float AS price,
         pt.created_at,
         to_char(pt.created_at AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY') AS treatment_date,
         to_char(pt.created_at AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') AS treatment_time,
         COALESCE(appt_u.dentist_name, tr_u.dentist_name, 'Smile Avenue Dentist') AS dentist_name
       FROM patient_treatments pt
       LEFT JOIN LATERAL (
         SELECT u.first_name || ' ' || u.last_name AS dentist_name
         FROM appointments a
         JOIN users u ON u.id = a.dentist_id
         WHERE a.patient_id = pt.patient_id
           AND a.status = 'completed'
           AND (a.starts_at AT TIME ZONE 'Asia/Manila')::date = (pt.created_at AT TIME ZONE 'Asia/Manila')::date
         ORDER BY a.starts_at DESC
         LIMIT 1
       ) appt_u ON true
       LEFT JOIN LATERAL (
         SELECT u.first_name || ' ' || u.last_name AS dentist_name
         FROM tooth_records tr
         JOIN users u ON u.id = tr.recorded_by
         WHERE tr.patient_id = pt.patient_id
           AND tr.tooth_number = pt.tooth_number
         ORDER BY tr.created_at DESC
         LIMIT 1
       ) tr_u ON true
       WHERE pt.patient_id = $1 AND pt.status = 'Done'
       ORDER BY pt.created_at DESC`,
      [tokenPatientId]
    );

    const ledgerRes = await pool.query(
      `WITH ordered_ledger AS (
         SELECT
           id, patient_id, treatment_id, type,
           amount::numeric(12,2) AS amount,
           COALESCE(discount_type, 'None') AS discount_type,
           COALESCE(discount_amount, 0)::numeric(12,2) AS discount_amount,
           payment_method, description, patient_signature, created_at,
           to_char(created_at AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY') AS date,
           to_char(created_at AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') AS time,
           SUM(
             CASE
               WHEN type = 'Charge' THEN amount
               ELSE -(amount + COALESCE(discount_amount, 0))
             END
           ) OVER (PARTITION BY patient_id ORDER BY created_at ASC, id ASC)::float AS running_balance,
           CASE
             WHEN type = 'Payment' THEN
               'REC-' || LPAD(
                 (SUM(CASE WHEN type = 'Payment' THEN 1 ELSE 0 END)
                   OVER (PARTITION BY patient_id ORDER BY created_at ASC, id ASC))::text,
                 4, '0'
               )
             ELSE NULL
           END AS receipt_no
         FROM patient_ledger
         WHERE patient_id = $1
       )
       SELECT
         id, patient_id, treatment_id, type,
         amount::float AS amount,
         discount_type,
         discount_amount::float AS discount_amount,
         (amount + discount_amount)::float AS gross_amount,
         payment_method, description, patient_signature,
         created_at, date, time,
         GREATEST(0, running_balance)::float AS running_balance,
         receipt_no
       FROM ordered_ledger
       ORDER BY created_at DESC, id DESC`,
      [tokenPatientId]
    );

    res.json({
      clinical: clinicalRes.rows,
      financial: ledgerRes.rows,
    });
  })
);

app.get(
  ['/api/patient/me/receipt/:transactionId', '/api/patient/patients/:id/receipt/:transactionId'],
  patientAuth,
  wrap(async (req, res) => {
    const tokenPatientId = String(req.patient.patient_id || '').trim();
    const transactionId = String(req.params.transactionId || '').trim();

    if (req.params.id && String(req.params.id).trim() !== tokenPatientId) {
      return res.status(403).json({
        error: "Forbidden: You are not authorized to view another patient's receipt.",
      });
    }

    if (!UUID_REGEX.test(transactionId)) {
      return res.status(400).json({ error: 'Invalid transaction ID format' });
    }

    const txRes = await pool.query(
      `WITH ordered_ledger AS (
         SELECT
           l.id, l.patient_id, l.treatment_id, l.type,
           l.amount::float AS amount,
           COALESCE(l.discount_type, 'None') AS discount_type,
           COALESCE(l.discount_amount, 0)::float AS discount_amount,
           l.payment_method, l.description, l.patient_signature, l.created_at,
           to_char(l.created_at AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY') AS date,
           to_char(l.created_at AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') AS time_formatted,
           SUM(
             CASE
               WHEN l.type = 'Charge' THEN l.amount
               ELSE -(l.amount + COALESCE(l.discount_amount, 0))
             END
           ) OVER (PARTITION BY l.patient_id ORDER BY l.created_at ASC, id ASC)::float AS running_balance,
           CASE
             WHEN l.type = 'Payment' THEN
               'REC-' || LPAD(
                 (SUM(CASE WHEN l.type = 'Payment' THEN 1 ELSE 0 END)
                   OVER (PARTITION BY l.patient_id ORDER BY l.created_at ASC, id ASC))::text,
                 4, '0'
               )
             ELSE NULL
           END AS receipt_no
         FROM patient_ledger l
         WHERE l.patient_id = $1
       )
       SELECT * FROM ordered_ledger WHERE id = $2`,
      [tokenPatientId, transactionId]
    );

    if (!txRes.rowCount) {
      return res.status(404).json({ error: 'Receipt not found.' });
    }

    const tx = txRes.rows[0];
    if (tx.type !== 'Payment') {
      return res.status(400).json({ error: 'Receipts can only be generated for payment transactions.' });
    }

    const patRes = await pool.query(
      `SELECT patient_no, first_name, middle_name, last_name FROM patients WHERE id = $1`,
      [tokenPatientId]
    );
    const pat = patRes.rows[0] || {};
    const patientName = [pat.first_name, pat.middle_name, pat.last_name].filter(Boolean).join(' ');

    res.json({
      receipt_no: tx.receipt_no || 'REC-0001',
      transaction_id: tx.id,
      date: tx.date,
      time: tx.time_formatted,
      created_at: tx.created_at,
      clinic: {
        name: CLINIC_CONFIG.name,
        address: CLINIC_CONFIG.address,
        phone: CLINIC_CONFIG.phone,
        email: CLINIC_CONFIG.email,
      },
      patient: {
        id: tokenPatientId,
        name: patientName || 'Patient',
        patient_no: pat.patient_no || 'N/A',
      },
      line_item: {
        description: tx.description || 'Payment Received',
        gross_amount: Number((tx.amount + (tx.discount_amount || 0)).toFixed(2)),
        discount_type: tx.discount_type || 'None',
        discount_amount: tx.discount_amount || 0,
        amount_paid: tx.amount,
        payment_method: tx.payment_method || 'Cash',
        remaining_balance: Math.max(0, Number(tx.running_balance) || 0),
      },
      patient_signature: tx.patient_signature || null,
      received_by: 'Smile Avenue Clinic Staff',
    });
  })
);

app.get('/api/patient/me', patientAuth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT p.id, p.patient_no, p.first_name, p.middle_name, p.last_name,
            to_char(p.birth_date, 'YYYY-MM-DD') AS birth_date, p.sex, p.phone, p.email,
            p.address, p.unit, p.province, p.city, p.barangay, p.postal_code,
            p.civil_status, p.occupation, p.guardian_name, p.guardian_phone,
            p.security_question,
            to_char(p.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS registered_date,
            (SELECT json_build_object(
               'recorded_date', to_char(mh.recorded_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD'),
               'recorded_at', mh.recorded_at,
               'allergies', mh.allergies,
               'medications', mh.medications,
               'is_pregnant', mh.is_pregnant,
               'has_bleeding_issue', mh.has_bleeding_issue,
               'other_notes', mh.other_notes,
               'answers', mh.answers
             ) FROM medical_histories mh WHERE mh.patient_id = p.id ORDER BY mh.recorded_at DESC LIMIT 1) AS medical_history
     FROM patients p
     WHERE p.id = $1`,
    [req.patient.patient_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Patient profile not found' });
  res.json(r.rows[0]);
}));

app.put('/api/patient/me/profile', patientAuth, rateLimit({ windowMs: 60000, max: 10 }), wrap(async (req, res) => {
  const b = req.body;
  if (!b.phone || !isPhilippinePhone(b.phone)) {
    return res.status(400).json({ error: 'A valid Philippine mobile number is required.' });
  }

  const p = await pool.query('SELECT birth_date FROM patients WHERE id = $1', [req.patient.patient_id]);
  if (!p.rowCount) return res.status(404).json({ error: 'Patient not found' });

  const bdate = new Date(`${p.rows[0].birth_date}T00:00:00+08:00`);
  const age = Math.floor((Date.now() - bdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  if (age < 18) {
    if (!val(b.guardian_name)) return res.status(400).json({ error: 'Guardian name is required for minors.' });
    if (!val(b.guardian_phone) || !isPhilippinePhone(b.guardian_phone)) {
      return res.status(400).json({ error: 'Valid Philippine contact number for guardian is required.' });
    }
  }

  let secAnswerClause = '';
  const params = [
    val(b.phone), val(b.address), val(b.unit), val(b.province), val(b.city), val(b.barangay),
    val(b.postal_code), val(b.civil_status), val(b.occupation),
    val(b.guardian_name), val(b.guardian_phone),
    val(b.security_question) || null,
  ];

  if (val(b.security_answer)) {
    const hashed = await bcrypt.hash(val(b.security_answer).toLowerCase().trim(), 10);
    params.push(hashed);
    secAnswerClause = `, security_answer = $${params.length}`;
  }

  params.push(req.patient.patient_id);
  const patientIdIdx = params.length;

  await pool.query(
    `UPDATE patients
     SET phone = $1, address = $2, unit = $3, province = $4, city = $5, barangay = $6,
         postal_code = $7, civil_status = $8, occupation = $9, guardian_name = $10,
         guardian_phone = $11, security_question = COALESCE($12, security_question)${secAnswerClause},
         updated_at = now()
     WHERE id = $${patientIdIdx}`,
    params
  );
  res.json({ ok: true, message: 'Profile updated successfully.' });
}));

app.post('/api/patient/me/medical-history', patientAuth, rateLimit({ windowMs: 60000, max: 10 }), wrap(async (req, res) => {
  const med = req.body;
  if (med.answers && typeof med.answers === 'object') {
    for (const [, answer] of Object.entries(med.answers)) {
      if (answer?.choice === 'yes' && (!answer.details || !String(answer.details).trim())) {
        return res.status(400).json({ error: 'Please provide details for all "Yes" medical history responses.' });
      }
    }
  }

  await pool.query(
    `INSERT INTO medical_histories (patient_id, allergies, medications, is_pregnant, has_bleeding_issue, other_notes, answers)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [req.patient.patient_id, val(med.allergies), val(med.medications),
     med.is_pregnant === true, med.has_bleeding_issue === true,
     val(med.other_notes), JSON.stringify(med.answers || {})]
  );
  res.json({ ok: true, message: 'Medical history updated and saved with today\'s date.' });
}));

app.get('/api/patient/identity-corrections', patientAuth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT id, field_name, old_value, new_value, reason, status, staff_reason,
            created_at, reviewed_at,
            to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS created_date,
            to_char(created_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS created_time
     FROM identity_correction_requests
     WHERE patient_id = $1
     ORDER BY created_at DESC`,
    [req.patient.patient_id]
  );
  res.json(r.rows);
}));

app.post(
  '/api/patient/identity-corrections',
  patientAuth,
  rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 5,
    keyFn: (req) => req.patient?.patient_id || req.ip,
    message: 'You have reached the limit of 5 identity correction requests per day.',
  }),
  wrap(async (req, res) => {
    const patientId = req.patient.patient_id;
    const clinicId = req.patient.clinic_id;
    const fieldName = val(req.body.field_name);
    const rawNewValue = val(req.body.new_value);
    const reason = val(req.body.reason);

    if (!fieldName || !ALLOWED_IDENTITY_FIELDS.includes(fieldName)) {
      return res.status(400).json({ error: 'Please select a valid field to correct (first_name, middle_name, last_name, birth_date, or sex).' });
    }
    if (!rawNewValue) {
      return res.status(400).json({ error: 'Please enter the corrected value.' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'Please provide a short reason for this correction request.' });
    }

    const dailyCountRes = await pool.query(
      `SELECT count(*)::int AS count
       FROM identity_correction_requests
       WHERE patient_id = $1
         AND (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date`,
      [patientId]
    );
    if (dailyCountRes.rows[0].count >= 5) {
      return res.status(429).json({
        error: 'You have reached the limit of 5 identity correction requests per day.',
      });
    }

    let cleanNewValue = rawNewValue;
    if (['first_name', 'middle_name', 'last_name'].includes(fieldName)) {
      cleanNewValue = toTitleCase(rawNewValue);
    } else if (fieldName === 'birth_date') {
      const parsed = parsePlainDate(rawNewValue);
      const { dateStr: todayStr } = getManilaNow();
      if (!parsed) {
        return res.status(400).json({ error: 'Please enter a valid date of birth with a 4-digit year (YYYY-MM-DD).' });
      }
      if (rawNewValue > todayStr) {
        return res.status(400).json({ error: 'Date of birth cannot be in the future.' });
      }
    } else if (fieldName === 'sex') {
      cleanNewValue = rawNewValue.toLowerCase();
      if (!['male', 'female', 'other'].includes(cleanNewValue)) {
        return res.status(400).json({ error: 'Gender must be male, female, or other.' });
      }
    }

    const patRes = await pool.query(
      `SELECT first_name, middle_name, last_name,
              to_char(birth_date, 'YYYY-MM-DD') AS birth_date, sex
       FROM patients WHERE id = $1 AND clinic_id = $2`,
      [patientId, clinicId]
    );
    if (!patRes.rowCount) return res.status(404).json({ error: 'Patient not found.' });

    const currentVal = patRes.rows[0][fieldName] || '';
    if (String(currentVal).toLowerCase() === String(cleanNewValue).toLowerCase()) {
      return res.status(400).json({ error: 'The requested value is identical to your current record.' });
    }

    const existingPending = await pool.query(
      `SELECT 1 FROM identity_correction_requests
       WHERE patient_id = $1 AND field_name = $2 AND status = 'pending'`,
      [patientId, fieldName]
    );
    if (existingPending.rowCount > 0) {
      return res.status(409).json({
        error: 'You already have a pending correction request for this field. Please wait for clinic staff review.',
      });
    }

    const ins = await pool.query(
      `INSERT INTO identity_correction_requests (
         clinic_id, patient_id, field_name, old_value, new_value, reason, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id, field_name, old_value, new_value, reason, status, created_at,
                 to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS created_date,
                 to_char(created_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS created_time`,
      [clinicId, patientId, fieldName, currentVal || null, cleanNewValue, reason]
    );

    res.status(201).json({
      ok: true,
      request: ins.rows[0],
      message: 'Identity correction request submitted. Clinic staff will review your request.',
    });
  })
);

app.get('/api/patient/appointments', patientAuth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT a.id,
            a.starts_at,
            a.ends_at,
            to_char(a.starts_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS appointment_date,
            to_char(a.starts_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS appointment_time,
            a.status,
            regexp_replace(COALESCE(a.reason, ''), '^Request #REF-[0-9]{8}-[A-Z0-9]{4}( \\(Rescheduled\\))?:\\s*', '') AS reason,
            a.notes,
            u.first_name || ' ' || u.last_name AS dentist_name,
            ar.reference_no,
            ar.services
     FROM appointments a
     LEFT JOIN users u ON u.id = a.dentist_id
     LEFT JOIN appointment_requests ar ON ar.appointment_id = a.id
     WHERE a.patient_id = $1
     ORDER BY a.starts_at DESC`,
    [req.patient.patient_id]
  );
  res.json(r.rows);
}));

app.get('/api/patient/appointments/requests', patientAuth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT id,
            reference_no,
            services,
            referral_source,
            remarks,
            to_char(preferred_date, 'YYYY-MM-DD') AS preferred_date,
            preferred_time,
            starts_at,
            ends_at,
            status,
            declined_reason,
            created_at,
            reschedule_for_appointment_id
     FROM appointment_requests
     WHERE patient_id = $1
     ORDER BY created_at DESC`,
    [req.patient.patient_id]
  );
  res.json(r.rows);
}));

app.get('/api/patient/appointments/requests/:id', patientAuth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT r.id, r.reference_no, r.services, r.referral_source, r.remarks,
            to_char(r.preferred_date, 'YYYY-MM-DD') AS preferred_date,
            r.preferred_time, r.starts_at, r.ends_at, r.status, r.declined_reason,
            p.first_name, p.last_name, p.patient_no
     FROM appointment_requests r
     JOIN patients p ON p.id = r.patient_id
     WHERE r.id = $1 AND r.patient_id = $2`,
    [req.params.id, req.patient.patient_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Appointment request not found' });
  res.json(r.rows[0]);
}));

app.put('/api/patient/appointments/requests/:id/cancel', patientAuth, rateLimit({ windowMs: 60000, max: 10 }), wrap(async (req, res) => {
  const r = await pool.query(
    `UPDATE appointment_requests
     SET status = 'cancelled', updated_at = now()
     WHERE id = $1 AND patient_id = $2 AND status = 'pending'
     RETURNING reference_no`,
    [req.params.id, req.patient.patient_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Pending request not found.' });

  const p = (await pool.query('SELECT first_name, last_name, email FROM patients WHERE id = $1', [req.patient.patient_id])).rows[0];
  printCancellationEmail(p.email, `${p.first_name} ${p.last_name}`, `Pending Request ${r.rows[0].reference_no}`, 'Cancelled by patient via dashboard.');
  res.json({ ok: true, message: 'Request cancelled successfully.' });
}));

app.put('/api/patient/appointments/:id/cancel', patientAuth, rateLimit({ windowMs: 60000, max: 10 }), wrap(async (req, res) => {
  const a = await pool.query(
    `SELECT id, starts_at, status,
            to_char(starts_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI') AS manila_time
     FROM appointments WHERE id = $1 AND patient_id = $2`,
    [req.params.id, req.patient.patient_id]
  );
  if (!a.rowCount) return res.status(404).json({ error: 'Appointment not found.' });
  const appt = a.rows[0];

  if (['cancelled', 'completed', 'no_show'].includes(appt.status)) {
    return res.status(400).json({ error: 'This appointment cannot be cancelled.' });
  }

  const msUntil = new Date(appt.starts_at).getTime() - Date.now();
  if (msUntil < 24 * 60 * 60 * 1000) {
    return res.status(400).json({
      error: `Please call the clinic at ${CLINIC_CONFIG.phone} to cancel an appointment within 24 hours.`,
    });
  }

  await pool.query(`UPDATE appointments SET status = 'cancelled', updated_at = now() WHERE id = $1`, [appt.id]);
  const p = (await pool.query('SELECT first_name, last_name, email FROM patients WHERE id = $1', [req.patient.patient_id])).rows[0];
  printCancellationEmail(p.email, `${p.first_name} ${p.last_name}`, 'Confirmed Appointment', `Scheduled for ${appt.manila_time}. Cancelled via dashboard.`);
  res.json({ ok: true, message: 'Appointment cancelled successfully.' });
}));

// ============================================================================
// ONLINE BOOKING & RESCHEDULING (LOGS BOOKING TO ACTIVITY LOG)
// ============================================================================
app.get('/api/patient/appointments/available-slots', patientAuth, wrap(async (req, res) => {
  const { date } = req.query;
  const parsed = parsePlainDate(date);
  if (!parsed) {
    return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required' });
  }

  if (parsed.dayOfWeek === 0) {
    return res.json({ date, is_closed: true, available_slots: [] });
  }

  const { dateStr: todayManilaStr, timeStr: currentHourMin } = getManilaNow();
  if (date < todayManilaStr) {
    return res.json({ date, is_closed: false, available_slots: [] });
  }

  const clinicId = req.patient.clinic_id;
  const dentistCountRes = await pool.query(
    "SELECT count(*)::int AS count FROM users WHERE clinic_id = $1 AND LOWER(role) = 'dentist' AND is_active",
    [clinicId]
  );
  const activeDentists = Math.max(1, dentistCountRes.rows[0].count);

  const apptsRes = await pool.query(
    `SELECT to_char(starts_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS start_hm,
            to_char(ends_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS end_hm
     FROM appointments
     WHERE clinic_id = $1
       AND status NOT IN ('cancelled', 'no_show')
       AND (starts_at AT TIME ZONE 'Asia/Manila')::date = $2::date`,
    [clinicId, date]
  );

  const isToday = date === todayManilaStr;

  const available = CLINIC_CONFIG.slots.filter((slot) => {
    if (isToday && slot <= currentHourMin) return false;

    const [sh, sm] = slot.split(':').map(Number);
    const slotStartMin = sh * 60 + sm;
    const slotEndMin = slotStartMin + 30;

    const overlapping = apptsRes.rows.filter((a) => {
      const [ash, asm] = a.start_hm.split(':').map(Number);
      const [aeh, aem] = a.end_hm.split(':').map(Number);
      const aStartMin = ash * 60 + asm;
      const aEndMin = aeh * 60 + aem;
      return slotStartMin < aEndMin && slotEndMin > aStartMin;
    }).length;

    return overlapping < activeDentists;
  });

  res.json({ date, is_closed: false, available_slots: available });
}));

app.post('/api/patient/appointments/request', patientAuth, rateLimit({ windowMs: 15 * 60000, max: 10 }), wrap(async (req, res) => {
  const { services = [], referral_source, remarks, preferred_date, preferred_time } = req.body;
  const patientId = req.patient.patient_id;
  const clinicId = req.patient.clinic_id;

  if (!Array.isArray(services) || services.length === 0) {
    return res.status(400).json({ error: 'Please select at least one reason for visit.' });
  }
  const parsedDate = parsePlainDate(preferred_date);
  if (!parsedDate) {
    return res.status(400).json({ error: 'Valid appointment date (YYYY-MM-DD) is required.' });
  }
  if (parsedDate.dayOfWeek === 0) {
    return res.status(400).json({ error: 'Smile Avenue Dental Clinic is closed on Sundays. Please choose Monday to Saturday.' });
  }
  if (preferred_time === '12:00' || preferred_time === '12:30') {
    return res.status(400).json({ error: `No booking slots are available during our lunch break (${CLINIC_CONFIG.lunchBreak}).` });
  }
  if (!preferred_time || !CLINIC_CONFIG.slots.includes(preferred_time)) {
    return res.status(400).json({ error: `Please select a valid 30-minute slot within clinic hours (${CLINIC_CONFIG.hours}).` });
  }

  const startIso = new Date(`${preferred_date}T${preferred_time}:00+08:00`);
  const endIso = new Date(startIso.getTime() + 30 * 60 * 1000);

  if (startIso <= new Date()) {
    return res.status(400).json({ error: 'You cannot request an appointment slot in the past.' });
  }

  const countPending = await pool.query(
    "SELECT count(*)::int AS count FROM appointment_requests WHERE patient_id = $1 AND status = 'pending'",
    [patientId]
  );
  if (countPending.rows[0].count >= 3) {
    return res.status(400).json({
      error: 'You have reached the limit of 3 pending requests. Please wait for clinic confirmation or cancel an existing request.',
    });
  }

  const dentistCountRes = await pool.query(
    "SELECT count(*)::int AS count FROM users WHERE clinic_id = $1 AND LOWER(role) = 'dentist' AND is_active",
    [clinicId]
  );
  const activeDentists = Math.max(1, dentistCountRes.rows[0].count);

  const bookedAppts = await pool.query(
    `SELECT 1 FROM appointments
     WHERE clinic_id = $1
       AND status NOT IN ('cancelled', 'no_show')
       AND starts_at < $3 AND ends_at > $2`,
    [clinicId, startIso.toISOString(), endIso.toISOString()]
  );
  if (bookedAppts.rowCount >= activeDentists) {
    return res.status(409).json({ error: 'That time slot is already fully booked. Please select another time.' });
  }

  let refNo = generateReferenceNo();
  while ((await pool.query('SELECT 1 FROM appointment_requests WHERE reference_no = $1', [refNo])).rowCount > 0) {
    refNo = generateReferenceNo();
  }

  const ins = await pool.query(
    `INSERT INTO appointment_requests (
       clinic_id, patient_id, reference_no, services, referral_source, remarks,
       preferred_date, preferred_time, starts_at, ends_at, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
     RETURNING id, reference_no, services, referral_source, remarks,
               to_char(preferred_date, 'YYYY-MM-DD') AS preferred_date,
               preferred_time, starts_at, ends_at, status, created_at`,
    [clinicId, patientId, refNo, services, val(referral_source), val(remarks),
     preferred_date, preferred_time, startIso.toISOString(), endIso.toISOString()]
  );

  const pat = (await pool.query('SELECT first_name, last_name, email FROM patients WHERE id = $1', [patientId])).rows[0];
  printBookingConfirmationEmail(pat.email, `${pat.first_name} ${pat.last_name}`, refNo, preferred_date, preferred_time, services);

  const serviceList = Array.isArray(services) ? services.join(', ') : services;
  await logActivity(
    null,
    'Booking',
    ins.rows[0].id,
    `Online booking request #${refNo} for ${preferred_date} at ${preferred_time} (${serviceList})`,
    patientId
  );

  res.status(201).json({
    ok: true,
    request: ins.rows[0],
    message: 'Your appointment request has been submitted. Status is Pending.',
  });
}));

app.post('/api/patient/appointments/:id/reschedule', patientAuth, rateLimit({ windowMs: 15 * 60000, max: 10 }), wrap(async (req, res) => {
  const { preferred_date, preferred_time, remarks } = req.body;
  const a = await pool.query(
    `SELECT a.*, ar.services AS orig_services
     FROM appointments a
     LEFT JOIN appointment_requests ar ON ar.appointment_id = a.id
     WHERE a.id = $1 AND a.patient_id = $2 AND a.status NOT IN ('cancelled', 'completed', 'no_show')`,
    [req.params.id, req.patient.patient_id]
  );
  if (!a.rowCount) return res.status(404).json({ error: 'Valid appointment not found.' });

  const msUntil = new Date(a.rows[0].starts_at).getTime() - Date.now();
  if (msUntil < 24 * 60 * 60 * 1000) {
    return res.status(400).json({
      error: `Please call the clinic at ${CLINIC_CONFIG.phone} to reschedule an appointment within 24 hours.`,
    });
  }

  const parsedDate = parsePlainDate(preferred_date);
  if (!parsedDate || parsedDate.dayOfWeek === 0) {
    return res.status(400).json({ error: 'Please select a valid Monday through Saturday date.' });
  }
  if (preferred_time === '12:00' || preferred_time === '12:30') {
    return res.status(400).json({ error: `No slots are available during our lunch break (${CLINIC_CONFIG.lunchBreak}).` });
  }
  if (!preferred_time || !CLINIC_CONFIG.slots.includes(preferred_time)) {
    return res.status(400).json({ error: 'Please select a valid clinic time slot.' });
  }

  const startIso = new Date(`${preferred_date}T${preferred_time}:00+08:00`);
  if (startIso <= new Date()) {
    return res.status(400).json({ error: 'You cannot reschedule to a past time.' });
  }

  let refNo = generateReferenceNo();
  while ((await pool.query('SELECT 1 FROM appointment_requests WHERE reference_no = $1', [refNo])).rowCount > 0) {
    refNo = generateReferenceNo();
  }

  const cleanReason = String(a.rows[0].reason || 'Checkup').replace(/^Request #REF-[0-9]{8}-[A-Z0-9]{4}( \(Rescheduled\))?:\s*/, '');
  const servicesList = Array.isArray(a.rows[0].orig_services) && a.rows[0].orig_services.length
    ? a.rows[0].orig_services
    : [cleanReason];

  const ins = await pool.query(
    `INSERT INTO appointment_requests (
       clinic_id, patient_id, reference_no, services, remarks,
       preferred_date, preferred_time, starts_at, ends_at, status, reschedule_for_appointment_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
     RETURNING id, reference_no, services, remarks,
               to_char(preferred_date, 'YYYY-MM-DD') AS preferred_date,
               preferred_time, starts_at, ends_at, status, reschedule_for_appointment_id`,
    [req.patient.clinic_id, req.patient.patient_id, refNo, servicesList, val(remarks),
     preferred_date, preferred_time, startIso.toISOString(), new Date(startIso.getTime() + 30 * 60000).toISOString(), a.rows[0].id]
  );

  res.status(201).json({
    ok: true,
    request: ins.rows[0],
    message: 'Reschedule request sent. Your current appointment stays active until clinic staff confirm the new time.',
  });
}));

// ============================================================================
// STAFF ROUTES: IDENTITY CORRECTIONS, INQUIRIES, REQUESTS & CONSENT
// ============================================================================
app.get('/api/staff/identity-corrections', auth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT icr.id, icr.patient_id, icr.field_name, icr.old_value, icr.new_value,
            icr.reason, icr.status, icr.staff_reason, icr.created_at, icr.reviewed_at,
            to_char(icr.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS created_date,
            to_char(icr.created_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS created_time,
            to_char(icr.reviewed_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS reviewed_date,
            to_char(icr.reviewed_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS reviewed_time,
            p.patient_no,
            concat_ws(' ', p.first_name, p.middle_name, p.last_name) AS patient_name,
            p.email AS patient_email,
            p.guardian_name,
            p.guardian_phone,
            u.first_name || ' ' || u.last_name AS reviewed_by_name
     FROM identity_correction_requests icr
     JOIN patients p ON p.id = icr.patient_id
     LEFT JOIN users u ON u.id = icr.reviewed_by
     WHERE icr.clinic_id = $1
     ORDER BY CASE WHEN icr.status = 'pending' THEN 0 ELSE 1 END, icr.created_at DESC
     LIMIT 150`,
    [req.user.clinic_id]
  );
  res.json(r.rows);
}));

app.post('/api/staff/identity-corrections/:id/approve', auth, wrap(async (req, res) => {
  const clinicId = req.user.clinic_id;
  const requestId = req.params.id;

  const staffRes = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [req.user.id]);
  const staffName = staffRes.rows[0]
    ? `${staffRes.rows[0].first_name} ${staffRes.rows[0].last_name}`
    : 'Staff';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqRes = await client.query(
      `SELECT * FROM identity_correction_requests
       WHERE id = $1 AND clinic_id = $2
       FOR UPDATE`,
      [requestId, clinicId]
    );
    if (!reqRes.rowCount || reqRes.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Correction request not found or already processed.' });
    }
    const corr = reqRes.rows[0];

    if (!ALLOWED_IDENTITY_FIELDS.includes(corr.field_name)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid field on correction request.' });
    }

    const patRes = await client.query(
      `SELECT id, first_name, middle_name, last_name,
              to_char(birth_date, 'YYYY-MM-DD') AS birth_date, sex, email,
              guardian_name, guardian_phone
       FROM patients
       WHERE id = $1 AND clinic_id = $2
       FOR UPDATE`,
      [corr.patient_id, clinicId]
    );
    if (!patRes.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient record not found.' });
    }
    const pat = patRes.rows[0];
    const previousValue = pat[corr.field_name] || null;

    const col = corr.field_name;
    await client.query(
      `UPDATE patients
       SET ${col} = $1, updated_at = now()
       WHERE id = $2 AND clinic_id = $3`,
      [corr.new_value, corr.patient_id, clinicId]
    );

    await client.query(
      `UPDATE identity_correction_requests
       SET status = 'approved',
           old_value = COALESCE(old_value, $1),
           reviewed_by = $2,
           reviewed_at = now(),
           updated_at = now()
       WHERE id = $3`,
      [previousValue, req.user.id, corr.id]
    );

    const clientIp = req.ip || req.connection?.remoteAddress || 'staff_terminal';
    await client.query(
      `INSERT INTO audit_logs (clinic_id, user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, 'identity_correction_approved', 'patient', $3, $4, $5)`,
      [
        clinicId,
        req.user.id,
        corr.patient_id,
        JSON.stringify({
          request_id: corr.id,
          field_name: corr.field_name,
          old_value: previousValue,
          new_value: corr.new_value,
          patient_reason: corr.reason,
          approved_by_name: staffName,
        }),
        clientIp,
      ]
    );

    await client.query('COMMIT');

    let guardianNotice = '';
    if (corr.field_name === 'birth_date') {
      const oldAge = calcAgeFromPlainDate(previousValue);
      const newAge = calcAgeFromPlainDate(corr.new_value);
      if (newAge !== null) {
        if (newAge < 18 && (oldAge === null || oldAge >= 18)) {
          guardianNotice = ` Note: This birth date change makes the patient a minor (${newAge} yrs). Please check and record guardian details.`;
        } else if (newAge >= 18 && oldAge !== null && oldAge < 18) {
          guardianNotice = ` Note: This birth date change makes the patient an adult (${newAge} yrs). Please review guardian details.`;
        } else if (newAge < 18 && (!pat.guardian_name || !pat.guardian_phone)) {
          guardianNotice = ` Note: Patient is a minor (${newAge} yrs). Please check guardian details.`;
        }
      }
    }

    const updatedPatName = [
      corr.field_name === 'first_name' ? corr.new_value : pat.first_name,
      corr.field_name === 'middle_name' ? corr.new_value : pat.middle_name,
      corr.field_name === 'last_name' ? corr.new_value : pat.last_name,
    ]
      .filter(Boolean)
      .join(' ');

    printIdentityCorrectionEmail(pat.email, updatedPatName, 'Approved', {
      field_name: corr.field_name,
      old_value: previousValue,
      new_value: corr.new_value,
      staff_name: staffName,
    });

    res.json({
      ok: true,
      message: `Approved ${corr.field_name} change for ${updatedPatName} (${previousValue || 'None'} → ${corr.new_value}).${guardianNotice}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

app.post('/api/staff/identity-corrections/:id/decline', auth, wrap(async (req, res) => {
  const clinicId = req.user.clinic_id;
  const requestId = req.params.id;
  const staffReason = val(req.body.staff_reason || req.body.reason);

  if (!staffReason) {
    return res.status(400).json({ error: 'A reason is required when declining an identity correction request.' });
  }

  const staffRes = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [req.user.id]);
  const staffName = staffRes.rows[0]
    ? `${staffRes.rows[0].first_name} ${staffRes.rows[0].last_name}`
    : 'Staff';

  const r = await pool.query(
    `UPDATE identity_correction_requests
     SET status = 'declined',
         staff_reason = $1,
         reviewed_by = $2,
         reviewed_at = now(),
         updated_at = now()
     WHERE id = $3 AND clinic_id = $4 AND status = 'pending'
     RETURNING *`,
    [staffReason, req.user.id, requestId, clinicId]
  );
  if (!r.rowCount) {
    return res.status(400).json({ error: 'Pending correction request not found.' });
  }
  const corr = r.rows[0];

  const patRes = await pool.query(
    'SELECT first_name, middle_name, last_name, email FROM patients WHERE id = $1',
    [corr.patient_id]
  );
  const pat = patRes.rows[0] || {};
  const patName = [pat.first_name, pat.middle_name, pat.last_name].filter(Boolean).join(' ');

  const clientIp = req.ip || req.connection?.remoteAddress || 'staff_terminal';
  await pool.query(
    `INSERT INTO audit_logs (clinic_id, user_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, 'identity_correction_declined', 'patient', $3, $4, $5)`,
    [
      clinicId,
      req.user.id,
      corr.patient_id,
      JSON.stringify({
        request_id: corr.id,
        field_name: corr.field_name,
        old_value: corr.old_value,
        requested_new_value: corr.new_value,
        staff_reason: staffReason,
        declined_by_name: staffName,
      }),
      clientIp,
    ]
  );

  printIdentityCorrectionEmail(pat.email, patName, 'Declined', {
    field_name: corr.field_name,
    old_value: corr.old_value,
    new_value: corr.new_value,
    staff_name: staffName,
    staff_reason: staffReason,
  });

  res.json({
    ok: true,
    message: `Declined ${corr.field_name} correction request for ${patName}.`,
  });
}));

app.get('/api/staff/inquiries', auth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT id, clinic_id, name, email, phone, message, is_read, created_at,
            to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS created_date,
            to_char(created_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS created_time
     FROM inquiries
     WHERE clinic_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [req.user.clinic_id]
  );
  res.json(r.rows);
}));

app.all('/api/staff/inquiries/:id/read', auth, wrap(async (req, res) => {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const nextRead = req.body?.is_read !== undefined ? Boolean(req.body.is_read) : true;
  await pool.query(
    'UPDATE inquiries SET is_read = $1 WHERE id = $2 AND clinic_id = $3',
    [nextRead, req.params.id, req.user.clinic_id]
  );
  res.json({ ok: true, is_read: nextRead });
}));

// ============================================================================
// STAFF PATIENT DETAIL & DUPLICATES ENDPOINTS
// ============================================================================
app.get(
  '/api/staff/patients/duplicates',
  auth,
  authorizeRoles('Admin', 'Receptionist'),
  wrap(async (req, res) => {
    const clinicId = req.user.clinic_id;

    const r = await pool.query(
      `WITH duplicate_clusters AS (
         SELECT
           LOWER(TRIM(first_name)) AS norm_first,
           COALESCE(LOWER(TRIM(middle_name)), '') AS norm_middle,
           LOWER(TRIM(last_name)) AS norm_last,
           birth_date::date AS norm_dob
         FROM patients
         WHERE clinic_id = $1 AND is_active = true
         GROUP BY
           LOWER(TRIM(first_name)),
           COALESCE(LOWER(TRIM(middle_name)), ''),
           LOWER(TRIM(last_name)),
           birth_date::date
         HAVING COUNT(*) > 1
       )
       SELECT
         p.id,
         p.patient_no,
         p.first_name,
         p.middle_name,
         p.last_name,
         to_char(p.birth_date, 'YYYY-MM-DD') AS birth_date,
         p.phone,
         p.email,
         to_char(p.created_at AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY') AS registered_date,
         dc.norm_first,
         dc.norm_middle,
         dc.norm_last,
         dc.norm_dob
       FROM patients p
       JOIN duplicate_clusters dc
         ON LOWER(TRIM(p.first_name)) = dc.norm_first
        AND COALESCE(LOWER(TRIM(p.middle_name)), '') = dc.norm_middle
        AND LOWER(TRIM(p.last_name)) = dc.norm_last
        AND p.birth_date::date = dc.norm_dob
       WHERE p.clinic_id = $1 AND p.is_active = true
       ORDER BY dc.norm_last, dc.norm_first, p.created_at ASC`,
      [clinicId]
    );

    const clustersMap = new Map();
    r.rows.forEach((row) => {
      const clusterKey = `${row.norm_first}|${row.norm_middle}|${row.norm_last}|${row.norm_dob}`;
      if (!clustersMap.has(clusterKey)) {
        clustersMap.set(clusterKey, {
          patient_name: [row.last_name ? `${row.last_name},` : '', row.first_name, row.middle_name].filter(Boolean).join(' '),
          birth_date: row.birth_date,
          records: [],
        });
      }
      clustersMap.get(clusterKey).records.push({
        id: row.id,
        patient_no: row.patient_no,
        first_name: row.first_name,
        middle_name: row.middle_name,
        last_name: row.last_name,
        phone: row.phone,
        email: row.email,
        registered_date: row.registered_date,
      });
    });

    res.json(Array.from(clustersMap.values()));
  })
);

app.get('/api/staff/patients/:id', auth, wrap(async (req, res) => {
  const targetId = String(req.params.id || '').trim();
  if (!UUID_REGEX.test(targetId)) {
    return res.status(400).json({ error: 'Invalid patient ID format' });
  }

  if (!(await ownsPatient(req, targetId))) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  const pRes = await pool.query(
    `SELECT p.id, p.patient_no, p.first_name, p.middle_name, p.last_name,
            to_char(p.birth_date, 'YYYY-MM-DD') AS birth_date, p.sex, p.phone, p.email,
            p.address, p.unit, p.province, p.city, p.barangay, p.postal_code,
            p.civil_status, p.occupation, p.religion,
            p.guardian_name, p.guardian_phone, p.notes, p.is_active,
            to_char(p.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS registered_date,
            COALESCE(pa.is_claimed, false) AS is_claimed,
            (EXISTS (SELECT 1 FROM consents ct WHERE ct.patient_id = p.id AND ct.consent_type = 'terms_and_conditions')
             AND EXISTS (SELECT 1 FROM consents cp WHERE cp.patient_id = p.id AND cp.consent_type = 'privacy_policy')) AS has_consent,
            lc.version AS consent_version,
            lc.consent_date,
            lc.consent_recorded_by_name
     FROM patients p
     LEFT JOIN patient_accounts pa ON pa.patient_id = p.id
     LEFT JOIN LATERAL (
       SELECT c.version,
              to_char(c.signed_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS consent_date,
              u.first_name || ' ' || u.last_name AS consent_recorded_by_name
       FROM consents c
       LEFT JOIN users u ON u.id = c.recorded_by
       WHERE c.patient_id = p.id
       ORDER BY c.signed_at DESC
       LIMIT 1
     ) lc ON true
     WHERE p.id = $1 AND p.clinic_id = $2`,
    [targetId, req.user.clinic_id]
  );

  if (!pRes.rowCount) return res.status(404).json({ error: 'Patient not found' });

  const mhRes = await pool.query(
    `SELECT *, to_char(recorded_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS recorded_date
     FROM medical_histories
     WHERE patient_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [targetId]
  );

  const apptRes = await pool.query(
    `SELECT a.id, a.starts_at, a.ends_at, a.status,
            to_char(a.starts_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS appointment_date,
            to_char(a.starts_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS appointment_time,
            regexp_replace(COALESCE(a.reason, ''), '^Request #REF-[0-9]{8}-[A-Z0-9]{4}( \\(Rescheduled\\))?:\\s*', '') AS reason,
            a.notes,
            u.first_name || ' ' || u.last_name AS dentist_name,
            ar.reference_no
     FROM appointments a
     LEFT JOIN users u ON u.id = a.dentist_id
     LEFT JOIN appointment_requests ar ON ar.appointment_id = a.id
     WHERE a.patient_id = $1 AND a.clinic_id = $2
     ORDER BY a.starts_at DESC`,
    [targetId, req.user.clinic_id]
  );

  res.json({
    patient: pRes.rows[0],
    medical_history: mhRes.rows[0] || null,
    appointments: apptRes.rows,
  });
}));

app.put('/api/staff/patients/:id', auth, wrap(async (req, res) => {
  if (!(await ownsPatient(req, req.params.id))) {
    return res.status(404).json({ error: 'Patient not found' });
  }
  const b = req.body;
  if (!val(b.first_name) || !val(b.last_name)) {
    return res.status(400).json({ error: 'First and last name are required.' });
  }
  if (!val(b.phone) || !isPhilippinePhone(b.phone)) {
    return res.status(400).json({ error: 'A valid Philippine mobile number is required.' });
  }

  const r = await pool.query(
    `UPDATE patients
     SET first_name = $1,
         middle_name = $2,
         last_name = $3,
         birth_date = $4,
         sex = $5,
         civil_status = $6,
         occupation = $7,
         phone = $8,
         email = $9,
         address = $10,
         province = $11,
         city = $12,
         barangay = $13,
         guardian_name = $14,
         guardian_phone = $15,
         updated_at = now()
     WHERE id = $16 AND clinic_id = $17
     RETURNING *`,
    [
      toTitleCase(b.first_name),
      val(b.middle_name) ? toTitleCase(b.middle_name) : null,
      toTitleCase(b.last_name),
      val(b.birth_date),
      val(b.sex)?.toLowerCase(),
      val(b.civil_status),
      val(b.occupation) ? toTitleCase(b.occupation) : null,
      val(b.phone),
      val(b.email)?.toLowerCase() || null,
      val(b.address) ? toTitleCase(b.address) : null,
      val(b.province),
      val(b.city),
      val(b.barangay),
      val(b.guardian_name) ? toTitleCase(b.guardian_name) : null,
      val(b.guardian_phone),
      req.params.id,
      req.user.clinic_id,
    ]
  );

  res.json({ ok: true, patient: r.rows[0] });
}));

app.patch('/api/staff/patients/:id/archive', auth, wrap(async (req, res) => {
  if (!(await ownsPatient(req, req.params.id))) {
    return res.status(404).json({ error: 'Patient not found' });
  }
  const nextActive = Boolean(req.body.is_active);
  const r = await pool.query(
    `UPDATE patients
     SET is_active = $1, updated_at = now()
     WHERE id = $2 AND clinic_id = $3
     RETURNING id, is_active`,
    [nextActive, req.params.id, req.user.clinic_id]
  );
  res.json(r.rows[0]);
}));

app.post('/api/staff/patients/:id/consent', auth, wrap(async (req, res) => {
  if (!(await ownsPatient(req, req.params.id))) {
    return res.status(404).json({ error: 'Patient not found' });
  }
  const { terms_accepted, privacy_accepted } = req.body;
  if (!terms_accepted || !privacy_accepted) {
    return res.status(400).json({ error: 'Both Terms and Conditions and Privacy Policy checkboxes are required.' });
  }

  const patRes = await pool.query(
    'SELECT first_name, last_name FROM patients WHERE id = $1 AND clinic_id = $2',
    [req.params.id, req.user.clinic_id]
  );
  const pat = patRes.rows[0];

  const staffRes = await pool.query(
    'SELECT first_name, last_name FROM users WHERE id = $1',
    [req.user.id]
  );
  const staff = staffRes.rows[0];
  const staffName = staff ? `${staff.first_name} ${staff.last_name}` : 'Staff';
  const signedBy = `${pat.first_name} ${pat.last_name}`;
  const clientIp = req.ip || req.connection?.remoteAddress || 'staff_terminal';

  const ins = await pool.query(
    `INSERT INTO consents (patient_id, consent_type, signed_by, recorded_by, version, ip_address)
     VALUES ($1, 'terms_and_conditions', $2, $3, $4, $6),
            ($1, 'privacy_policy', $2, $3, $5, $6)
     RETURNING to_char(signed_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS recorded_date,
               to_char(signed_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS recorded_time`,
    [
      req.params.id,
      signedBy,
      req.user.id,
      CLINIC_CONFIG.termsVersion,
      CLINIC_CONFIG.privacyVersion,
      clientIp,
    ]
  );

  res.status(201).json({
    ok: true,
    version: CLINIC_CONFIG.termsVersion,
    recorded_date: ins.rows[0].recorded_date,
    recorded_time: ins.rows[0].recorded_time,
    recorded_by_name: staffName,
  });
}));

app.delete('/api/staff/patients/:id/consent', auth, wrap(async (req, res) => {
  if (!(await ownsPatient(req, req.params.id))) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  await pool.query('DELETE FROM consents WHERE patient_id = $1', [req.params.id]);

  const clientIp = req.ip || req.connection?.remoteAddress || 'staff_terminal';
  await pool.query(
    `INSERT INTO audit_logs (clinic_id, user_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, 'consent_withdrawn', 'patient', $3, $4, $5)`,
    [
      req.user.clinic_id,
      req.user.id,
      req.params.id,
      JSON.stringify({ withdrawn_at: new Date().toISOString() }),
      clientIp,
    ]
  );

  res.json({ ok: true, message: 'Patient consent withdrawn.' });
}));

app.get('/api/staff/patients/:id/medical-history', auth, wrap(async (req, res) => {
  if (!(await ownsPatient(req, req.params.id))) return res.status(404).json({ error: 'Patient not found' });
  const r = await pool.query(
    `SELECT *, to_char(recorded_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS recorded_date
     FROM medical_histories WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
    [req.params.id]
  );
  res.json(r.rows[0] || null);
}));

app.post('/api/staff/patients/:id/medical-history', auth, wrap(async (req, res) => {
  if (!(await ownsPatient(req, req.params.id))) return res.status(404).json({ error: 'Patient not found' });
  const med = req.body;
  if (med.answers && typeof med.answers === 'object') {
    for (const [key, answer] of Object.entries(med.answers)) {
      if (key === 'good_health' || key === 'selected_conditions') continue;
      if (answer?.choice === 'yes' && (!answer.details || !String(answer.details).trim())) {
        return res.status(400).json({ error: 'Please provide details for all "Yes" medical history answers.' });
      }
    }
  }

  const ins = await pool.query(
    `INSERT INTO medical_histories (patient_id, allergies, medications, is_pregnant, has_bleeding_issue, other_notes, answers, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *, to_char(recorded_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS recorded_date`,
    [
      req.params.id,
      val(med.allergies),
      val(med.medications),
      med.is_pregnant === true,
      med.has_bleeding_issue === true,
      val(med.other_notes),
      JSON.stringify(med.answers || {}),
      req.user.id,
    ]
  );

  res.status(201).json({ ok: true, medical_history: ins.rows[0] });
}));

// ============================================================================
// STAFF PORTAL: APPOINTMENT REQUEST CONFIRMATIONS & RESCHEDULING
// ============================================================================
app.get('/api/staff/appointment-requests', auth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT r.id, r.reference_no, r.services, r.referral_source, r.remarks,
            to_char(r.preferred_date, 'YYYY-MM-DD') AS preferred_date,
            r.preferred_time, r.starts_at, r.ends_at, r.status, r.created_at,
            r.declined_reason, r.dentist_id, r.reschedule_for_appointment_id,
            p.id AS patient_id, p.first_name, p.last_name, p.patient_no, p.phone, p.email,
            u.first_name || ' ' || u.last_name AS dentist_name,
            (SELECT count(*)::int FROM appointment_requests cr
             WHERE cr.clinic_id = r.clinic_id AND cr.status = 'pending' AND cr.starts_at = r.starts_at) AS conflict_count,
            (SELECT count(*)::int FROM appointments ca
             WHERE ca.clinic_id = r.clinic_id AND ca.status NOT IN ('cancelled', 'no_show')
               AND ca.starts_at < r.ends_at AND ca.ends_at > r.starts_at) AS confirmed_occupants
     FROM appointment_requests r
     JOIN patients p ON p.id = r.patient_id
     LEFT JOIN users u ON u.id = r.dentist_id
     WHERE r.clinic_id = $1
     ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC`,
    [req.user.clinic_id]
  );
  res.json(r.rows);
}));

app.post('/api/staff/appointment-requests/:id/confirm', auth, wrap(async (req, res) => {
  const { dentist_id } = req.body;
  if (!dentist_id) return res.status(400).json({ error: 'Please assign a dentist to confirm this appointment.' });

  const clinicId = req.user.clinic_id;
  const requestId = req.params.id;

  const d = await pool.query(
    "SELECT id, first_name, last_name FROM users WHERE id = $1 AND clinic_id = $2 AND LOWER(role) = 'dentist' AND is_active",
    [dentist_id, clinicId]
  );
  if (!d.rowCount) return res.status(404).json({ error: 'Assigned dentist not found or inactive.' });
  const dentist = d.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqRes = await client.query(
      `SELECT *, to_char(preferred_date, 'YYYY-MM-DD') AS plain_date
       FROM appointment_requests WHERE id = $1 AND clinic_id = $2 FOR UPDATE`,
      [requestId, clinicId]
    );
    if (!reqRes.rowCount || reqRes.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Appointment request not found or already processed.' });
    }
    const request = reqRes.rows[0];

    if (request.reschedule_for_appointment_id) {
      await client.query(
        "UPDATE appointments SET status = 'cancelled', notes = CONCAT(notes, ' (Replaced by confirmed reschedule)') WHERE id = $1",
        [request.reschedule_for_appointment_id]
      );
    }

    const apptReason = request.services.join(', ');
    const apptNotes = request.remarks || null;

    const apptRes = await client.query(
      `INSERT INTO appointments (clinic_id, patient_id, dentist_id, starts_at, ends_at, status, reason, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, $7, $8)
       RETURNING *`,
      [clinicId, request.patient_id, dentist_id, request.starts_at, request.ends_at, apptReason, apptNotes, req.user.id]
    );

    await client.query(
      `UPDATE appointment_requests
       SET status = 'confirmed', dentist_id = $1, appointment_id = $2, updated_at = now()
       WHERE id = $3`,
      [dentist_id, apptRes.rows[0].id, requestId]
    );

    await client.query('COMMIT');

    const p = (await pool.query('SELECT first_name, last_name, email FROM patients WHERE id = $1', [request.patient_id])).rows[0];
    printStaffDecisionEmail(p.email, `${p.first_name} ${p.last_name}`, request.reference_no, 'Confirmed', {
      dentistName: `${dentist.first_name} ${dentist.last_name}`,
      dateStr: request.plain_date,
      timeStr: request.preferred_time,
    });

    res.json({
      ok: true,
      message: `Appointment confirmed for ${request.plain_date} at ${request.preferred_time} with Dr. ${dentist.first_name} ${dentist.last_name}.`,
      appointment: apptRes.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23P01') {
      return res.status(409).json({ error: `Dr. ${dentist.first_name} ${dentist.last_name} already has an appointment booked at this time.` });
    }
    throw err;
  } finally {
    client.release();
  }
}));

app.post('/api/staff/appointment-requests/:id/decline', auth, wrap(async (req, res) => {
  const { reason = '' } = req.body;
  const r = await pool.query(
    `UPDATE appointment_requests
     SET status = 'declined', declined_reason = $1, updated_at = now()
     WHERE id = $2 AND clinic_id = $3 AND status = 'pending'
     RETURNING *`,
    [val(reason), req.params.id, req.user.clinic_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Pending appointment request not found.' });

  const request = r.rows[0];
  const p = (await pool.query('SELECT first_name, last_name, email FROM patients WHERE id = $1', [request.patient_id])).rows[0];
  printStaffDecisionEmail(p.email, `${p.first_name} ${p.last_name}`, request.reference_no, 'Declined', {
    reason: val(reason) || 'No specific reason provided.',
  });

  res.json({ ok: true, message: 'Request declined.' });
}));

app.post('/api/staff/appointment-requests/:id/reschedule', auth, wrap(async (req, res) => {
  const { dentist_id, date, time, reason = '' } = req.body;
  if (!dentist_id || !date || !time) {
    return res.status(400).json({ error: 'Dentist, date, and time are required to reschedule.' });
  }
  if (!CLINIC_CONFIG.slots.includes(time)) {
    return res.status(400).json({ error: 'Selected time is outside clinic booking slots or during lunch break.' });
  }

  const clinicId = req.user.clinic_id;
  const requestId = req.params.id;

  const d = await pool.query(
    "SELECT id, first_name, last_name FROM users WHERE id = $1 AND clinic_id = $2 AND LOWER(role) = 'dentist' AND is_active",
    [dentist_id, clinicId]
  );
  if (!d.rowCount) return res.status(404).json({ error: 'Assigned dentist not found or inactive.' });
  const dentist = d.rows[0];

  const startIso = new Date(`${date}T${time}:00+08:00`);
  const endIso = new Date(startIso.getTime() + 30 * 60 * 1000);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqRes = await client.query(
      'SELECT * FROM appointment_requests WHERE id = $1 AND clinic_id = $2 FOR UPDATE',
      [requestId, clinicId]
    );
    if (!reqRes.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment request not found.' });
    }
    const request = reqRes.rows[0];

    if (request.reschedule_for_appointment_id) {
      await client.query(
        "UPDATE appointments SET status = 'cancelled', notes = CONCAT(notes, ' (Replaced by confirmed reschedule)') WHERE id = $1",
        [request.reschedule_for_appointment_id]
      );
    }

    const apptReason = request.services.join(', ');
    const apptNotes = reason ? `Rescheduled by clinic: ${reason}. ${request.remarks || ''}`.trim() : request.remarks;

    const apptRes = await client.query(
      `INSERT INTO appointments (clinic_id, patient_id, dentist_id, starts_at, ends_at, status, reason, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, $7, $8)
       RETURNING *`,
      [clinicId, request.patient_id, dentist_id, startIso.toISOString(), endIso.toISOString(), apptReason, apptNotes, req.user.id]
    );

    await client.query(
      `UPDATE appointment_requests
       SET status = 'confirmed', dentist_id = $1, appointment_id = $2,
           preferred_date = $3, preferred_time = $4, starts_at = $5, ends_at = $6,
           remarks = $7, updated_at = now()
       WHERE id = $8`,
      [dentist_id, apptRes.rows[0].id, date, time, startIso.toISOString(), endIso.toISOString(), apptNotes, requestId]
    );

    await client.query('COMMIT');

    const p = (await pool.query('SELECT first_name, last_name, email FROM patients WHERE id = $1', [request.patient_id])).rows[0];
    printStaffDecisionEmail(p.email, `${p.first_name} ${p.last_name}`, request.reference_no, 'Rescheduled & Confirmed', {
      dentistName: `${dentist.first_name} ${dentist.last_name}`,
      dateStr: date,
      timeStr: time,
      reason: val(reason) || 'Rescheduled to an open slot by front desk.',
    });

    res.json({
      ok: true,
      message: `Appointment rescheduled to ${date} at ${time} and confirmed with Dr. ${dentist.first_name} ${dentist.last_name}.`,
      appointment: apptRes.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23P01') {
      return res.status(409).json({ error: `Dr. ${dentist.first_name} ${dentist.last_name} already has an appointment booked at this time.` });
    }
    throw err;
  } finally {
    client.release();
  }
}));

// ============================================================================
// STAFF OVERVIEW DASHBOARD ROUTE
// ============================================================================
app.get('/api/staff/overview', auth, wrap(async (req, res) => {
  const clinicId = req.user.clinic_id;

  const [
    apptCountRes,
    patientCountRes,
    revenueTodayRes,
    pendingReqCountRes,
    scheduleTodayRes,
    recentActivityRes,
  ] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS count
       FROM appointments
       WHERE clinic_id = $1
         AND status NOT IN ('cancelled')
         AND (starts_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date`,
      [clinicId]
    ),

    pool.query(
      `SELECT count(*)::int AS count
       FROM patients
       WHERE clinic_id = $1 AND is_active = true`,
      [clinicId]
    ),

    pool.query(
      `SELECT COALESCE(SUM(l.amount), 0)::float AS revenue_today
       FROM patient_ledger l
       JOIN patients p ON p.id = l.patient_id
       WHERE p.clinic_id = $1
         AND l.type = 'Payment'
         AND (l.created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date`,
      [clinicId]
    ),

    pool.query(
      `SELECT count(*)::int AS count
       FROM appointment_requests
       WHERE clinic_id = $1 AND status = 'pending'`,
      [clinicId]
    ),

    pool.query(
      `SELECT
         a.id,
         a.patient_id,
         a.dentist_id,
         a.starts_at,
         a.ends_at,
         to_char(a.starts_at AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') AS appointment_time,
         a.status,
         regexp_replace(COALESCE(a.reason, 'Consultation'), '^Request #REF-[0-9]{8}-[A-Z0-9]{4}( \\(Rescheduled\\))?:\\s*', '') AS reason,
         p.first_name || ' ' || p.last_name AS patient_name,
         p.patient_no,
         u.first_name || ' ' || u.last_name AS dentist_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN users u ON u.id = a.dentist_id
       WHERE a.clinic_id = $1
         AND (a.starts_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
       ORDER BY a.starts_at ASC`,
      [clinicId]
    ),

    pool.query(
      `SELECT
         al.id,
         al.staff_id,
         al.action_type,
         al.target_id,
         al.description,
         al.created_at,
         COALESCE(u.first_name || ' ' || u.last_name, 'Admin') AS staff_name,
         u.role AS staff_role
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.staff_id
       ORDER BY al.created_at DESC
       LIMIT 10`
    ),
  ]);

  res.json({
    metrics: {
      todays_appointments: apptCountRes.rows[0]?.count || 0,
      total_patients: patientCountRes.rows[0]?.count || 0,
      todays_revenue: revenueTodayRes.rows[0]?.revenue_today || 0,
      pending_requests: pendingReqCountRes.rows[0]?.count || 0,
    },
    todays_schedule: scheduleTodayRes.rows,
    recent_activity: recentActivityRes.rows,
  });
}));

// ============================================================================
// STAFF PATIENTS DIRECTORY ENDPOINTS
// ============================================================================
app.get('/api/patients', auth, wrap(async (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const r = await pool.query(
    `SELECT p.id, p.patient_no, p.first_name, p.middle_name, p.last_name,
            to_char(p.birth_date, 'YYYY-MM-DD') AS birth_date, p.sex, p.phone, p.email,
            p.address, p.barangay, p.city, p.province, p.civil_status, p.occupation,
            p.guardian_name, p.guardian_phone, p.tags, p.is_active,
            to_char(p.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS registered_date,
            COALESCE(pa.is_claimed, false) AS is_claimed,
            (SELECT to_char(MAX(a.starts_at AT TIME ZONE 'Asia/Manila'), 'YYYY-MM-DD')
               FROM appointments a WHERE a.patient_id = p.id AND a.status = 'completed') AS last_visit,
            (SELECT COALESCE(SUM(b.balance), 0) FROM invoice_balances b
               WHERE b.patient_id = p.id AND b.status NOT IN ('void', 'draft')) AS balance,
            (EXISTS (SELECT 1 FROM consents ct WHERE ct.patient_id = p.id AND ct.consent_type = 'terms_and_conditions')
             AND EXISTS (SELECT 1 FROM consents cp WHERE cp.patient_id = p.id AND cp.consent_type = 'privacy_policy')) AS has_consent,
            lc.version AS consent_version,
            lc.consent_date,
            lc.consent_recorded_by_name
     FROM patients p
     LEFT JOIN patient_accounts pa ON pa.patient_id = p.id
     LEFT JOIN LATERAL (
       SELECT c.version,
              to_char(c.signed_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS consent_date,
              u.first_name || ' ' || u.last_name AS consent_recorded_by_name
       FROM consents c
       LEFT JOIN users u ON u.id = c.recorded_by
       WHERE c.patient_id = p.id
       ORDER BY c.signed_at DESC
       LIMIT 1
     ) lc ON true
     WHERE p.clinic_id = $1
       AND (p.first_name || ' ' || p.last_name ILIKE $2 OR p.phone ILIKE $2 OR p.patient_no ILIKE $2)
     ORDER BY p.last_name, p.first_name LIMIT 200`,
    [req.user.clinic_id, q]
  );
  res.json(r.rows);
}));

app.get('/api/patients/next-no', auth, wrap(async (req, res) => {
  res.json({ patient_no: await nextPatientNo(pool, req.user.clinic_id) });
}));

app.post('/api/patients', auth, wrap(async (req, res) => {
  const b = req.body;
  if (!val(b.first_name) || !val(b.last_name)) {
    return res.status(400).json({ error: 'First and last name are required' });
  }
  if (!val(b.birth_date)) {
    return res.status(400).json({ error: 'Date of birth is required' });
  }

  const hasSeparateConsents = b.terms_accepted && b.privacy_accepted;
  if (!hasSeparateConsents && !b.consent) {
    return res.status(400).json({ error: 'Terms and Data-Privacy consent are required before saving' });
  }

  const clinicId = req.user.clinic_id;
  const cleanFirst = toTitleCase(b.first_name);
  const cleanMiddle = val(b.middle_name) ? toTitleCase(b.middle_name) : null;
  const cleanLast = toTitleCase(b.last_name);
  const birthDate = val(b.birth_date);
  const cleanEmail = val(b.email) ? val(b.email).toLowerCase() : null;

  const dupCheck = await pool.query(
    `SELECT id, patient_no, first_name, middle_name, last_name,
            to_char(birth_date, 'YYYY-MM-DD') AS birth_date
     FROM patients
     WHERE clinic_id = $1
       AND is_active = true
       AND LOWER(TRIM(first_name)) = LOWER(TRIM($2))
       AND COALESCE(LOWER(TRIM(middle_name)), '') = COALESCE(LOWER(TRIM($3)), '')
       AND LOWER(TRIM(last_name)) = LOWER(TRIM($4))
       AND birth_date::date = $5::date
     LIMIT 1`,
    [clinicId, cleanFirst, cleanMiddle || '', cleanLast, birthDate]
  );

  if (dupCheck.rowCount > 0) {
    const existing = dupCheck.rows[0];
    return res.status(409).json({
      error: `A patient with this name and birthday already exists (Chart #${existing.patient_no}).`,
      duplicate_patient_no: existing.patient_no,
      duplicate_patient_id: existing.id,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const patient_no = val(b.patient_no) || (await nextPatientNo(client, clinicId));

    const r = await client.query(
      `INSERT INTO patients (clinic_id, patient_no, first_name, middle_name, last_name, birth_date, sex, phone, email,
         address, unit, province, city, barangay, postal_code, occupation, civil_status, religion,
         guardian_name, guardian_phone, notes, reminders_enabled, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [clinicId, patient_no, cleanFirst, cleanMiddle, cleanLast, birthDate, val(b.sex),
       val(b.phone), cleanEmail, val(b.address) ? toTitleCase(b.address) : null, val(b.unit), val(b.province), val(b.city), val(b.barangay),
       val(b.postal_code), val(b.occupation) ? toTitleCase(b.occupation) : null, val(b.civil_status), val(b.religion), val(b.guardian_name) ? toTitleCase(b.guardian_name) : null,
       val(b.guardian_phone), val(b.notes), b.reminders_enabled !== false,
       Array.isArray(b.tags) ? b.tags.map(String) : [], req.user.id]
    );

    const newPatientId = r.rows[0].id;

    if (cleanEmail) {
      await client.query(
        `INSERT INTO patient_accounts (clinic_id, patient_id, email, password_hash, is_email_verified, is_claimed)
         VALUES ($1, $2, $3, NULL, false, false)
         ON CONFLICT (email) DO UPDATE
         SET patient_id = EXCLUDED.patient_id
         WHERE patient_accounts.is_claimed = false`,
        [clinicId, newPatientId, cleanEmail]
      );
    }

    const clientIp = req.ip || req.connection?.remoteAddress || 'staff_terminal';
    const signedBy = `${cleanFirst} ${cleanLast}`;
    await client.query(
      `INSERT INTO consents (patient_id, consent_type, signed_by, recorded_by, version, ip_address)
       VALUES ($1, 'terms_and_conditions', $2, $3, $4, $6),
              ($1, 'privacy_policy', $2, $3, $5, $6)`,
      [newPatientId, signedBy, req.user.id, CLINIC_CONFIG.termsVersion, CLINIC_CONFIG.privacyVersion, clientIp]
    );

    if (b.medical_history || val(b.allergies) || val(b.medications)) {
      const med = b.medical_history || {};
      await client.query(
        `INSERT INTO medical_histories (patient_id, allergies, medications, is_pregnant, has_bleeding_issue, other_notes, answers, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newPatientId,
          val(b.allergies) || val(med.allergies),
          val(b.medications) || val(med.medications),
          b.is_pregnant === true || med.is_pregnant === true,
          b.has_bleeding_issue === true || med.has_bleeding_issue === true,
          val(b.medical_notes) || val(med.other_notes),
          JSON.stringify(med.answers || {}),
          req.user.id,
        ]
      );
    }

    await client.query('COMMIT');

    const formattedName = [cleanLast, [cleanFirst, cleanMiddle].filter(Boolean).join(' ')].join(', ');
    await logActivity(
      req.user.id,
      'Create Patient',
      newPatientId,
      `Created patient ${formattedName} (${r.rows[0].patient_no})`,
      newPatientId
    );

    res.status(201).json(r.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'That chart no. is already used by another patient' });
    throw e;
  } finally {
    client.release();
  }
}));

app.post(
  '/api/patients/:id/teeth',
  auth,
  authorizeRoles('Admin', 'Dentist'),
  wrap(async (req, res) => {
    if (!(await ownsPatient(req, req.params.id))) return res.status(404).json({ error: 'Patient not found' });
    const { tooth_number, condition, surfaces = [], notes } = req.body;
    const r = await pool.query(
      `INSERT INTO tooth_records (clinic_id, patient_id, tooth_number, surfaces, kind, condition, notes, recorded_by)
       VALUES ($1,$2,$3,$4,'condition',$5,$6,$7) RETURNING *`,
      [req.user.clinic_id, req.params.id, tooth_number, surfaces, condition, notes || null, req.user.id]
    );
    res.status(201).json(r.rows[0]);
  })
);

app.get('/api/patients/:id/teeth', auth, wrap(async (req, res) => {
  if (!(await ownsPatient(req, req.params.id))) return res.status(404).json({ error: 'Patient not found' });
  const r = await pool.query(
    `SELECT DISTINCT ON (tooth_number) tooth_number, condition, surfaces, notes, recorded_on
     FROM tooth_records WHERE patient_id = $1
     ORDER BY tooth_number, recorded_on DESC, created_at DESC`,
    [req.params.id]
  );
  res.json(r.rows);
}));

app.post('/api/patients/:id/teeth', auth, wrap(async (req, res) => {
  if (!(await ownsPatient(req, req.params.id))) return res.status(404).json({ error: 'Patient not found' });
  const { tooth_number, condition, surfaces = [], notes } = req.body;
  const r = await pool.query(
    `INSERT INTO tooth_records (clinic_id, patient_id, tooth_number, surfaces, kind, condition, notes, recorded_by)
     VALUES ($1,$2,$3,$4,'condition',$5,$6,$7) RETURNING *`,
    [req.user.clinic_id, req.params.id, tooth_number, surfaces, condition, notes || null, req.user.id]
  );
  res.status(201).json(r.rows[0]);
}));

app.get('/api/dentists', auth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT id, first_name, last_name FROM users
     WHERE clinic_id = $1 AND LOWER(role) = 'dentist' AND is_active
     ORDER BY last_name`,
    [req.user.clinic_id]
  );
  res.json(r.rows);
}));

app.get('/api/procedures', auth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT id, code, name, category, default_price FROM procedures
     WHERE clinic_id = $1 AND is_active ORDER BY category, name`,
    [req.user.clinic_id]
  );
  res.json(r.rows);
}));

app.get('/api/appointments', auth, wrap(async (req, res) => {
  const from = req.query.from || req.query.date || null;
  const to = req.query.to || from;
  const today = "(now() AT TIME ZONE 'Asia/Manila')::date";
  const r = await pool.query(
    `SELECT a.id, a.patient_id, a.dentist_id, a.starts_at, a.ends_at,
            to_char(a.starts_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS appointment_date,
            to_char(a.starts_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS appointment_time,
            a.status, a.reason, a.notes,
            p.first_name || ' ' || p.last_name AS patient_name, p.patient_no,
            u.first_name || ' ' || u.last_name AS dentist_name,
            ar.reference_no
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = a.dentist_id
     LEFT JOIN appointment_requests ar ON ar.appointment_id = a.id
     WHERE a.clinic_id = $1
       AND (a.starts_at AT TIME ZONE 'Asia/Manila')::date
           BETWEEN COALESCE($2::date, ${today}) AND COALESCE($3::date, $2::date, ${today})
     ORDER BY a.starts_at`,
    [req.user.clinic_id, from, to]
  );
  res.json(r.rows);
}));

app.post('/api/appointments', auth, wrap(async (req, res) => {
  const { patient_id, dentist_id, starts_at, duration_min = 30, reason, notes } = req.body;
  const start = new Date(starts_at);
  if (!patient_id || !dentist_id || isNaN(start)) return res.status(400).json({ error: 'Patient, dentist and time are required' });
  if (!(await ownsPatient(req, patient_id))) return res.status(404).json({ error: 'Patient not found' });
  const d = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1 AND clinic_id = $2', [dentist_id, req.user.clinic_id]);
  if (!d.rowCount) return res.status(404).json({ error: 'Dentist not found' });
  const end = new Date(start.getTime() + Number(duration_min) * 60000);
  const r = await pool.query(
    `INSERT INTO appointments (clinic_id, patient_id, dentist_id, starts_at, ends_at, reason, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *,
       to_char(starts_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS appt_date,
       to_char(starts_at AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') AS appt_time`,
    [req.user.clinic_id, patient_id, dentist_id, start.toISOString(), end.toISOString(), reason || null, notes || null, req.user.id]
  );

  const patRes = await pool.query('SELECT first_name, middle_name, last_name FROM patients WHERE id = $1', [patient_id]);
  const pat = patRes.rows[0] || {};
  const patFormatted = pat.last_name
    ? `${toTitleCase(pat.last_name)}, ${[toTitleCase(pat.first_name || ''), toTitleCase(pat.middle_name || '')].filter(Boolean).join(' ')}`
    : 'Patient';

  await logActivity(
    req.user.id,
    'Book Appointment',
    r.rows[0].id,
    `Booked appointment (${reason || 'Consultation'}) for ${patFormatted} on ${r.rows[0].appt_date} at ${r.rows[0].appt_time}`,
    patient_id
  );

  res.status(201).json(r.rows[0]);
}));

app.patch('/api/appointments/:id/status', auth, wrap(async (req, res) => {
  const r = await pool.query(
    'UPDATE appointments SET status = $1 WHERE id = $2 AND clinic_id = $3 RETURNING id, status',
    [req.body.status, req.params.id, req.user.clinic_id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'Appointment not found' });
  res.json(r.rows[0]);
}));

app.get('/api/call-list', auth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT c.id, c.note, c.created_at, c.patient_id, p.phone,
            p.first_name || ' ' || p.last_name AS patient_name
     FROM call_list c JOIN patients p ON p.id = c.patient_id
     WHERE c.clinic_id = $1 ORDER BY c.created_at`,
    [req.user.clinic_id]
  );
  res.json(r.rows);
}));

app.post('/api/call-list', auth, wrap(async (req, res) => {
  if (!req.body.patient_id || !(await ownsPatient(req, req.body.patient_id))) return res.status(404).json({ error: 'Select a patient' });
  const r = await pool.query(
    'INSERT INTO call_list (clinic_id, patient_id, note, created_by) VALUES ($1,$2,$3,$4) RETURNING id',
    [req.user.clinic_id, req.body.patient_id, val(req.body.note), req.user.id]
  );
  res.status(201).json(r.rows[0]);
}));

app.delete('/api/call-list/:id', auth, wrap(async (req, res) => {
  await pool.query('DELETE FROM call_list WHERE id = $1 AND clinic_id = $2', [req.params.id, req.user.clinic_id]);
  res.json({ ok: true });
}));

// ============================================================================
// FINANCE: OUTSTANDING BALANCES LIST
// ============================================================================
app.get(
  ['/api/finance/outstanding', '/api/staff/finance/outstanding'],
  auth,
  authorizeRoles('Admin', 'Receptionist'),
  wrap(async (req, res) => {
    const clinicId = req.user.clinic_id;

    const r = await pool.query(
      `SELECT
         p.id AS patient_id,
         p.patient_no,
         p.first_name,
         p.middle_name,
         p.last_name,
         p.phone,
         ROUND(
           SUM(
             CASE
               WHEN l.type = 'Charge' THEN l.amount
               ELSE -(l.amount + COALESCE(l.discount_amount, 0))
             END
           )::numeric, 2
         )::float AS total_outstanding_amount
       FROM patients p
       JOIN patient_ledger l ON l.patient_id = p.id
       WHERE p.clinic_id = $1 AND p.is_active = true
       GROUP BY p.id, p.patient_no, p.first_name, p.middle_name, p.last_name, p.phone
       HAVING SUM(
         CASE
           WHEN l.type = 'Charge' THEN l.amount
           ELSE -(l.amount + COALESCE(l.discount_amount, 0))
         END
       ) > 0.009
       ORDER BY total_outstanding_amount DESC, p.last_name ASC`,
      [clinicId]
    );

    const formatted = r.rows.map((row) => ({
      patient_id: row.patient_id,
      patient_no: row.patient_no,
      patient_name: [
        row.last_name ? `${toTitleCase(row.last_name)},` : '',
        toTitleCase(row.first_name || ''),
        toTitleCase(row.middle_name || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .trim(),
      phone: row.phone || null,
      total_outstanding_amount: row.total_outstanding_amount,
    }));

    res.json(formatted);
  })
);

// ============================================================================
// RBAC-PROTECTED CHART, LEDGER, FINANCE & SYSTEM RESET
// ============================================================================
function chartAndLedgerReadByRole(...allowedStaffRoles) {
  const normalizedAllowed = allowedStaffRoles.map((r) => normalizeRole(r));

  return async (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Please log in' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }

    const targetPatientId = String(req.params.id || '').trim();
    if (!UUID_REGEX.test(targetPatientId)) {
      return res.status(400).json({ error: 'Invalid patient ID format' });
    }

    try {
      if (decoded.type === 'patient') {
        if (String(decoded.patient_id) !== targetPatientId) {
          return res.status(403).json({
            error: "Forbidden: You are not authorized to access another patient's records.",
          });
        }
        req.patient = decoded;
        return next();
      }

      const staffRole = normalizeRole(decoded.role);
      if (!normalizedAllowed.includes(staffRole)) {
        return res.status(403).json({
          error: `Forbidden: Access restricted to ${allowedStaffRoles.join(', ')} (your role: ${staffRole}).`,
        });
      }

      req.user = { ...decoded, role: staffRole };
      if (!(await ownsPatient(req, targetPatientId))) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      return next();
    } catch (err) {
      console.error('Authorization check failed:', err.message);
      return res.status(500).json({ error: 'Failed to verify access permissions' });
    }
  };
}

// 1. Chart Routes
app.get(
  ['/api/staff/patients/:id/chart', '/api/patient/patients/:id/chart'],
  chartAndLedgerReadByRole('Admin', 'Dentist'),
  async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, patient_id, tooth_number, procedure_name, surface, status,
                price::float AS price, created_at,
                to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS created_date
         FROM patient_treatments
         WHERE patient_id = $1
         ORDER BY tooth_number ASC, created_at ASC`,
        [req.params.id]
      );
      return res.json(r.rows);
    } catch (err) {
      console.error('Error fetching patient chart:', err.message);
      return res.status(500).json({ error: 'Failed to load dental chart' });
    }
  }
);

app.post(
  '/api/staff/patients/:id/treatments',
  auth,
  authorizeRoles('Admin', 'Dentist'),
  async (req, res) => {
    const patientId = req.params.id;
    if (!UUID_REGEX.test(patientId) || !(await ownsPatient(req, patientId))) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const items = Array.isArray(req.body.treatments) ? req.body.treatments : [req.body];

    for (const item of items) {
      if (!item || (!item.tooth_number && !req.body.sync_chart)) {
        return res.status(400).json({ error: 'Tooth number and procedure name are required' });
      }
      if (item.price !== undefined && item.price !== null && item.price !== '') {
        const numPrice = Number(item.price);
        if (isNaN(numPrice) || numPrice < 0) {
          return res.status(400).json({ error: 'Treatment price cannot be negative' });
        }
      }
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      if (req.body.sync_chart) {
        await client.query(
          `DELETE FROM patient_treatments
           WHERE patient_id = $1 AND status IN ('Planned', 'Existing')`,
          [patientId]
        );
      }

      const savedRows = [];
      for (const item of items) {
        if (!item.tooth_number || !item.procedure_name) continue;
        const statusVal = ['Planned', 'Done', 'Existing'].includes(item.status)
          ? item.status
          : 'Planned';
        const priceVal = Math.max(0, Number(item.price) || 0);
        const surfaceVal = val(item.surface);

        const ins = await client.query(
          `INSERT INTO patient_treatments (patient_id, tooth_number, procedure_name, surface, status, price)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, patient_id, tooth_number, procedure_name, surface, status, price::float AS price, created_at`,
          [patientId, Number(item.tooth_number), val(item.procedure_name), surfaceVal, statusVal, priceVal]
        );
        savedRows.push(ins.rows[0]);
      }

      await client.query('COMMIT');

      if (req.body.sync_chart) {
        const patRes = await pool.query('SELECT first_name, middle_name, last_name FROM patients WHERE id = $1', [patientId]);
        const pat = patRes.rows[0] || {};
        const patFormatted = pat.last_name
          ? `${toTitleCase(pat.last_name)}, ${[toTitleCase(pat.first_name || ''), toTitleCase(pat.middle_name || '')].filter(Boolean).join(' ')}`
          : 'Patient';
        await logActivity(
          req.user.id,
          'Edit Chart',
          patientId,
          `Saved dental chart and treatment plan (${savedRows.length} items) for ${patFormatted}`,
          patientId
        );
      }

      return res.status(201).json({ ok: true, treatments: savedRows });
    } catch (err) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch {}
      }
      console.error('Error saving treatment:', err.message);
      return res.status(500).json({ error: 'Failed to save treatment' });
    } finally {
      if (client) client.release();
    }
  }
);

app.put(
  '/api/staff/patients/:id/treatments/:treatmentId/done',
  auth,
  authorizeRoles('Admin', 'Dentist'),
  async (req, res) => {
    const patientId = req.params.id;
    const treatmentId = String(req.params.treatmentId || '').trim();

    if (!UUID_REGEX.test(patientId) || !UUID_REGEX.test(treatmentId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    if (!(await ownsPatient(req, patientId))) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    let overridePrice = null;
    if (req.body.price !== undefined && req.body.price !== null && req.body.price !== '') {
      overridePrice = Number(req.body.price);
      if (isNaN(overridePrice) || overridePrice < 0) {
        return res.status(400).json({ error: 'Treatment price cannot be negative' });
      }
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const tRes = await client.query(
        `SELECT * FROM patient_treatments
         WHERE id = $1 AND patient_id = $2
         FOR UPDATE`,
        [treatmentId, patientId]
      );
      if (!tRes.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Treatment record not found' });
      }

      const current = tRes.rows[0];
      const finalPrice = overridePrice !== null ? overridePrice : Math.max(0, Number(current.price) || 0);

      const updatedTreatment = await client.query(
        `UPDATE patient_treatments
         SET status = 'Done', price = $1
         WHERE id = $2
         RETURNING id, patient_id, tooth_number, procedure_name, surface, status, price::float AS price, created_at`,
        [finalPrice, treatmentId]
      );

      const surfSuffix = current.surface ? ` (${current.surface})` : '';
      const desc = `${current.procedure_name} - Tooth ${current.tooth_number}${surfSuffix}`;

      const existingCharge = await client.query(
        `SELECT id FROM patient_ledger WHERE treatment_id = $1 AND type = 'Charge'`,
        [treatmentId]
      );

      let ledgerRow;
      if (existingCharge.rowCount > 0) {
        const updCharge = await client.query(
          `UPDATE patient_ledger
           SET amount = $1, description = $2
           WHERE id = $3
           RETURNING id, patient_id, treatment_id, type, amount::float AS amount, payment_method, description, created_at,
                     to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS date`,
          [finalPrice, desc, existingCharge.rows[0].id]
        );
        ledgerRow = updCharge.rows[0];
      } else {
        const insCharge = await client.query(
          `INSERT INTO patient_ledger (patient_id, treatment_id, type, amount, description)
           VALUES ($1, $2, 'Charge', $3, $4)
           RETURNING id, patient_id, treatment_id, type, amount::float AS amount, payment_method, description, created_at,
                     to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS date`,
          [patientId, treatmentId, finalPrice, desc]
        );
        ledgerRow = insCharge.rows[0];
      }

      await client.query('COMMIT');

      const patRes = await pool.query('SELECT first_name, middle_name, last_name FROM patients WHERE id = $1', [patientId]);
      const pat = patRes.rows[0] || {};
      const patFormatted = pat.last_name
        ? `${toTitleCase(pat.last_name)}, ${[toTitleCase(pat.first_name || ''), toTitleCase(pat.middle_name || '')].filter(Boolean).join(' ')}`
        : 'Patient';

      await logActivity(
        req.user.id,
        'Edit Chart',
        patientId,
        `Marked ${current.procedure_name} on Tooth ${current.tooth_number} as Done (₱${finalPrice.toFixed(2)}) for ${patFormatted}`,
        patientId
      );

      return res.json({
        ok: true,
        treatment: updatedTreatment.rows[0],
        ledger_charge: ledgerRow,
      });
    } catch (err) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch {}
      }
      console.error('Error marking treatment as done:', err.message);
      return res.status(500).json({ error: 'Failed to mark treatment as done' });
    } finally {
      if (client) client.release();
    }
  }
);

// 2. Finance & Ledger Routes
app.get(
  ['/api/staff/patients/:id/ledger', '/api/patient/patients/:id/ledger'],
  chartAndLedgerReadByRole('Admin', 'Receptionist'),
  async (req, res) => {
    try {
      const r = await pool.query(
        `WITH ordered_ledger AS (
           SELECT
             id, patient_id, treatment_id, type,
             amount::numeric(12,2) AS amount,
             COALESCE(discount_type, 'None') AS discount_type,
             COALESCE(discount_amount, 0)::numeric(12,2) AS discount_amount,
             payment_method, description, patient_signature, created_at,
             to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS date,
             SUM(
               CASE
                 WHEN type = 'Charge' THEN amount
                 ELSE -(amount + COALESCE(discount_amount, 0))
               END
             ) OVER (PARTITION BY patient_id ORDER BY created_at ASC, id ASC)::float AS running_balance,
             CASE
               WHEN type = 'Payment' THEN
                 'REC-' || LPAD(
                   (SUM(CASE WHEN type = 'Payment' THEN 1 ELSE 0 END)
                     OVER (PARTITION BY patient_id ORDER BY created_at ASC, id ASC))::text,
                   4, '0'
                 )
               ELSE NULL
             END AS receipt_no
           FROM patient_ledger
           WHERE patient_id = $1
         )
         SELECT
           id, patient_id, treatment_id, type,
           amount::float AS amount,
           discount_type,
           discount_amount::float AS discount_amount,
           (amount + discount_amount)::float AS gross_amount,
           payment_method, description, patient_signature,
           created_at, date,
           GREATEST(0, running_balance)::float AS running_balance,
           receipt_no
         FROM ordered_ledger
         ORDER BY created_at DESC, id DESC`,
        [req.params.id]
      );
      return res.json(r.rows);
    } catch (err) {
      console.error('Error fetching patient ledger:', err.message);
      return res.status(500).json({ error: 'Failed to load patient ledger' });
    }
  }
);

app.get(
  ['/api/staff/patients/:id/ledger/:transactionId/receipt', '/api/patient/patients/:id/ledger/:transactionId/receipt'],
  chartAndLedgerReadByRole('Admin', 'Receptionist'),
  async (req, res) => {
    const patientId = req.params.id;
    const transactionId = String(req.params.transactionId || '').trim();

    if (!UUID_REGEX.test(transactionId)) {
      return res.status(400).json({ error: 'Invalid transaction ID format' });
    }

    try {
      const txRes = await pool.query(
        `WITH ordered_ledger AS (
           SELECT
             l.id, l.patient_id, l.treatment_id, l.type,
             l.amount::float AS amount,
             COALESCE(l.discount_type, 'None') AS discount_type,
             COALESCE(l.discount_amount, 0)::float AS discount_amount,
             l.payment_method, l.description, l.patient_signature, l.created_at,
             to_char(l.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS date,
             to_char(l.created_at AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') AS time_formatted,
             SUM(
               CASE
                 WHEN l.type = 'Charge' THEN l.amount
                 ELSE -(l.amount + COALESCE(l.discount_amount, 0))
               END
             ) OVER (PARTITION BY l.patient_id ORDER BY l.created_at ASC, id ASC)::float AS running_balance,
             CASE
               WHEN l.type = 'Payment' THEN
                 'REC-' || LPAD(
                   (SUM(CASE WHEN l.type = 'Payment' THEN 1 ELSE 0 END)
                     OVER (PARTITION BY l.patient_id ORDER BY l.created_at ASC, id ASC))::text,
                   4, '0'
                 )
               ELSE NULL
             END AS receipt_no
           FROM patient_ledger l
           WHERE l.patient_id = $1
         )
         SELECT * FROM ordered_ledger WHERE id = $2`,
        [patientId, transactionId]
      );

      if (!txRes.rowCount) {
        return res.status(404).json({ error: 'Receipt transaction not found' });
      }

      const tx = txRes.rows[0];
      if (tx.type !== 'Payment') {
        return res.status(400).json({ error: 'Receipts can only be generated for Payment transactions' });
      }

      const patRes = await pool.query(
        `SELECT patient_no, first_name, middle_name, last_name FROM patients WHERE id = $1`,
        [patientId]
      );
      const pat = patRes.rows[0] || {};
      const patientName = [
        pat.last_name ? `${toTitleCase(pat.last_name)},` : '',
        toTitleCase(pat.first_name || ''),
        toTitleCase(pat.middle_name || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      const chargeRes = await pool.query(
        `SELECT description FROM patient_ledger
         WHERE patient_id = $1 AND type = 'Charge' AND created_at <= $2
         ORDER BY created_at DESC LIMIT 1`,
        [patientId, tx.created_at]
      );

      const latestChargeDesc = chargeRes.rows[0]?.description || null;
      let lineDescription = tx.description || 'Dental Treatment Payment';
      if (latestChargeDesc && (!tx.description || /^Payment\s*\(/i.test(tx.description))) {
        lineDescription = `Payment for ${latestChargeDesc}`;
      }

      let staffName = 'Authorized Clinic Staff';
      if (req.user?.id) {
        const uRes = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [req.user.id]);
        if (uRes.rowCount > 0) {
          staffName = `${toTitleCase(uRes.rows[0].first_name)} ${toTitleCase(uRes.rows[0].last_name)}`;
        }
      }

      return res.json({
        receipt_no: tx.receipt_no || 'REC-0001',
        transaction_id: tx.id,
        date: tx.date,
        time: tx.time_formatted,
        created_at: tx.created_at,
        clinic: {
          name: CLINIC_CONFIG.name,
          address: CLINIC_CONFIG.address,
          phone: CLINIC_CONFIG.phone,
          email: CLINIC_CONFIG.email,
        },
        patient: {
          id: patientId,
          name: patientName || 'Patient',
          patient_no: pat.patient_no || 'N/A',
        },
        line_item: {
          description: lineDescription,
          gross_amount: Number((tx.amount + (tx.discount_amount || 0)).toFixed(2)),
          discount_type: tx.discount_type || 'None',
          discount_amount: tx.discount_amount || 0,
          amount_paid: tx.amount,
          payment_method: tx.payment_method || 'Cash',
          remaining_balance: Math.max(0, Number(tx.running_balance) || 0),
        },
        patient_signature: tx.patient_signature || null,
        received_by: staffName,
      });
    } catch (err) {
      console.error('Error fetching receipt details:', err.message);
      return res.status(500).json({ error: 'Failed to load official receipt' });
    }
  }
);

app.post(
  '/api/staff/patients/:id/ledger/payments',
  auth,
  authorizeRoles('Admin', 'Receptionist'),
  async (req, res) => {
    const patientId = req.params.id;
    if (!UUID_REGEX.test(patientId) || !(await ownsPatient(req, patientId))) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const rawGrossAmount = req.body.amount;
    const grossAmount = Number(rawGrossAmount);
    const paymentMethod = val(req.body.payment_method) || 'Cash';
    const customDate = val(req.body.date);
    const patientSignature = val(req.body.patient_signature);

    const rawDiscountOption = val(req.body.discount_type) || 'None';
    const customPercent = Number(req.body.custom_discount_percent || 0);

    if (rawGrossAmount === undefined || rawGrossAmount === null || rawGrossAmount === '' || isNaN(grossAmount)) {
      return res.status(400).json({ error: 'Please enter a valid numeric payment amount' });
    }
    if (grossAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than ₱0 and cannot be negative' });
    }
    if (!patientSignature || !patientSignature.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Patient signature is required before submitting a payment.' });
    }

    let discountPercent = 0;
    let savedDiscountType = 'None';

    if (rawDiscountOption === 'Senior Citizen / PWD (20%)' || rawDiscountOption === 'SC_PWD') {
      discountPercent = 20;
      savedDiscountType = 'Senior Citizen / PWD (20%)';
    } else if (rawDiscountOption === 'Custom %' || rawDiscountOption.startsWith('Custom')) {
      if (isNaN(customPercent) || customPercent <= 0 || customPercent >= 100) {
        return res.status(400).json({
          error: 'Custom discount percentage must be greater than 0% and less than 100%.',
        });
      }
      discountPercent = customPercent;
      savedDiscountType = `Custom (${customPercent}%)`;
    }

    const discountAmount = Number(((grossAmount * discountPercent) / 100).toFixed(2));
    const finalAmountDue = Number((grossAmount - discountAmount).toFixed(2));

    if (finalAmountDue <= 0) {
      return res.status(400).json({ error: 'Final amount due after discount must be greater than ₱0.' });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const balRes = await client.query(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'Charge' THEN amount ELSE 0 END), 0)::numeric(12,2) AS total_charges,
           COALESCE(SUM(CASE WHEN type = 'Payment' THEN (amount + COALESCE(discount_amount, 0)) ELSE 0 END), 0)::numeric(12,2) AS total_settled
         FROM patient_ledger
         WHERE patient_id = $1`,
        [patientId]
      );

      const totalCharges = Number(balRes.rows[0].total_charges) || 0;
      const totalSettled = Number(balRes.rows[0].total_settled) || 0;
      const remainingBalance = Number((totalCharges - totalSettled).toFixed(2));

      if (remainingBalance <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Cannot record payment: This patient has no remaining balance owed (₱0.00).',
        });
      }

      if (grossAmount > remainingBalance) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Payment amount (₱${grossAmount.toFixed(2)}) cannot exceed the remaining balance of ₱${remainingBalance.toFixed(2)}.`,
        });
      }

      const discountNote =
        discountAmount > 0 ? ` [${savedDiscountType}: -₱${discountAmount.toFixed(2)}]` : '';
      const baseDescription = val(req.body.description) || `Payment (${paymentMethod})`;
      const description = `${baseDescription}${discountNote}`;

      const { dateStr: todayStr, timeSecStr: nowTimeSec } = getManilaNow();
      const customTime = val(req.body.time);

      let createdAt;
      if (customDate) {
        if (customDate === todayStr && !customTime) {
          createdAt = new Date().toISOString();
        } else {
          const timeToUse = customTime 
            ? (customTime.length === 5 ? `${customTime}:00` : customTime)
            : nowTimeSec;
          createdAt = new Date(`${customDate}T${timeToUse}+08:00`).toISOString();
        }
      } else {
        createdAt = new Date().toISOString();
      }

      const ins = await client.query(
        `INSERT INTO patient_ledger (
           patient_id, type, amount, discount_type, discount_amount,
           payment_method, description, patient_signature, created_at
         )
         VALUES ($1, 'Payment', $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, patient_id, treatment_id, type,
                   amount::float AS amount,
                   discount_type,
                   discount_amount::float AS discount_amount,
                   payment_method, description, patient_signature, created_at,
                   to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS date`,
        [
          patientId,
          finalAmountDue,
          savedDiscountType,
          discountAmount,
          paymentMethod,
          description,
          patientSignature,
          createdAt,
        ]
      );

      await client.query('COMMIT');

      const patRes = await pool.query('SELECT first_name, middle_name, last_name FROM patients WHERE id = $1', [patientId]);
      const pat = patRes.rows[0] || {};
      const patFormatted = pat.last_name
        ? `${toTitleCase(pat.last_name)}, ${[toTitleCase(pat.first_name || ''), toTitleCase(pat.middle_name || '')].filter(Boolean).join(' ')}`
        : 'Patient';

      await logActivity(
        req.user.id,
        'Record Payment',
        ins.rows[0].id,
        `Recorded ₱${finalAmountDue.toFixed(2)} payment${
          discountAmount > 0 ? ` (${savedDiscountType} discount of ₱${discountAmount.toFixed(2)})` : ''
        } via ${paymentMethod} for ${patFormatted}`,
        patientId
      );

      return res.status(201).json(ins.rows[0]);
    } catch (err) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch {}
      }
      console.error('Error recording payment:', err.message);
      return res.status(500).json({ error: 'Failed to record payment' });
    } finally {
      if (client) client.release();
    }
  }
);

// 3. Finance Summary & Transactions
app.get(
  '/api/staff/finance/summary',
  auth,
  authorizeRoles('Admin', 'Receptionist'),
  async (req, res) => {
    try {
      const clinicId = req.user.clinic_id;

      const revRes = await pool.query(
        `SELECT
           COALESCE(SUM(
             CASE
               WHEN l.type = 'Payment'
                AND (l.created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
               THEN l.amount
               ELSE 0
             END
           ), 0)::float AS revenue_today,
           COALESCE(SUM(
             CASE
               WHEN l.type = 'Payment'
                AND date_trunc('month', l.created_at AT TIME ZONE 'Asia/Manila') =
                    date_trunc('month', now() AT TIME ZONE 'Asia/Manila')
               THEN l.amount
               ELSE 0
             END
           ), 0)::float AS revenue_month
         FROM patient_ledger l
         JOIN patients p ON p.id = l.patient_id
         WHERE p.clinic_id = $1`,
        [clinicId]
      );

      const balRes = await pool.query(
        `SELECT
           COALESCE(SUM(GREATEST(0, pat_bal.balance)), 0)::float AS total_outstanding_balance,
           COUNT(*) FILTER (WHERE pat_bal.balance > 0)::int AS patients_with_balance
         FROM (
           SELECT
             l.patient_id,
             SUM(CASE WHEN l.type = 'Charge' THEN l.amount ELSE -l.amount END) AS balance
           FROM patient_ledger l
           JOIN patients p ON p.id = l.patient_id
           WHERE p.clinic_id = $1
           GROUP BY l.patient_id
         ) pat_bal`,
        [clinicId]
      );

      return res.json({
        revenue_today: revRes.rows[0]?.revenue_today || 0,
        revenue_month: revRes.rows[0]?.revenue_month || 0,
        total_outstanding_balance: balRes.rows[0]?.total_outstanding_balance || 0,
        patients_with_balance: balRes.rows[0]?.patients_with_balance || 0,
      });
    } catch (err) {
      console.error('Error loading finance summary:', err.message);
      return res.status(500).json({ error: 'Failed to load finance summary' });
    }
  }
);

app.get(
  '/api/staff/finance/transactions',
  auth,
  authorizeRoles('Admin', 'Receptionist'),
  async (req, res) => {
    try {
      const clinicId = req.user.clinic_id;
      const search = (val(req.query.q) || '').toLowerCase();
      const period = (val(req.query.period) || 'all').toLowerCase();

      const params = [clinicId];
      const conditions = [`p.clinic_id = $1`, `l.type = 'Payment'`];

      if (period === 'today') {
        conditions.push(
          `(l.created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date`
        );
      } else if (period === 'week') {
        conditions.push(
          `date_trunc('week', l.created_at AT TIME ZONE 'Asia/Manila') = date_trunc('week', now() AT TIME ZONE 'Asia/Manila')`
        );
      } else if (period === 'month') {
        conditions.push(
          `date_trunc('month', l.created_at AT TIME ZONE 'Asia/Manila') = date_trunc('month', now() AT TIME ZONE 'Asia/Manila')`
        );
      }

      if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        conditions.push(
          `(
            LOWER(p.first_name || ' ' || p.last_name) LIKE $${idx}
            OR LOWER(p.last_name || ', ' || p.first_name) LIKE $${idx}
            OR LOWER(COALESCE(p.patient_no, '')) LIKE $${idx}
          )`
        );
      }

      const r = await pool.query(
        `SELECT
           l.id,
           l.patient_id,
           p.patient_no,
           p.first_name,
           p.middle_name,
           p.last_name,
           l.amount::float AS amount,
           COALESCE(l.payment_method, 'Cash') AS payment_method,
           l.description,
           l.created_at,
           to_char(l.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS date,
           to_char(l.created_at AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') AS time,
           COALESCE(
             al_staff.staff_name,
             'Clinic Staff'
           ) AS received_by
         FROM patient_ledger l
         JOIN patients p ON p.id = l.patient_id
         LEFT JOIN LATERAL (
           SELECT u.first_name || ' ' || u.last_name AS staff_name
           FROM activity_logs al
           JOIN users u ON u.id = al.staff_id
           WHERE al.action_type = 'Record Payment'
             AND al.target_id = l.patient_id
             AND ABS(EXTRACT(EPOCH FROM (al.created_at - l.created_at))) < 120
           ORDER BY ABS(EXTRACT(EPOCH FROM (al.created_at - l.created_at))) ASC
           LIMIT 1
         ) al_staff ON true
         WHERE ${conditions.join(' AND ')}
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 500`,
        params
      );

      const formatted = r.rows.map((row) => ({
        ...row,
        patient_name: `${toTitleCase(row.last_name || '')}, ${[
          toTitleCase(row.first_name || ''),
          toTitleCase(row.middle_name || ''),
        ]
          .filter(Boolean)
          .join(' ')}`.trim(),
      }));

      return res.json(formatted);
    } catch (err) {
      console.error('Error loading clinic finance transactions:', err.message);
      return res.status(500).json({ error: 'Failed to load finance transactions' });
    }
  }
);

// 4. Activity Logs (Audit Trail with Filters, Patient Relational Join & Search)
app.get(
  '/api/staff/activity-logs',
  auth,
  authorizeRoles('Admin'),
  wrap(async (req, res) => {
    const rawAction = val(req.query.action_type);
    const search = val(req.query.search)?.toLowerCase();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (rawAction && rawAction !== 'All Actions' && rawAction !== 'ALL') {
      if (rawAction === 'Payment') {
        conditions.push(`al.action_type = 'Record Payment'`);
      } else if (rawAction === 'Chart Update') {
        conditions.push(`al.action_type = 'Edit Chart'`);
      } else if (rawAction === 'Add Patient') {
        conditions.push(`al.action_type IN ('Add Patient', 'Create Patient')`);
      } else if (rawAction === 'Booking') {
        conditions.push(`al.action_type IN ('Booking', 'Book Appointment')`);
      } else {
        params.push(rawAction);
        conditions.push(`al.action_type = $${params.length}`);
      }
    }

    if (search) {
      params.push(`%${search}%`);
      const sIdx = params.length;
      conditions.push(`(
        LOWER(COALESCE(p.first_name || ' ' || p.last_name, '')) LIKE $${sIdx} OR
        LOWER(COALESCE(p.last_name || ', ' || p.first_name, '')) LIKE $${sIdx} OR
        LOWER(COALESCE(p.patient_no, '')) LIKE $${sIdx} OR
        LOWER(COALESCE(u.first_name || ' ' || u.last_name, '')) LIKE $${sIdx} OR
        LOWER(al.description) LIKE $${sIdx}
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT count(*)::int AS total
       FROM activity_logs al
       LEFT JOIN patients p ON p.id = al.patient_id
       LEFT JOIN users u ON u.id = al.staff_id
       ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const logsRes = await pool.query(
      `SELECT
         al.id,
         al.staff_id,
         al.patient_id,
         al.action_type,
         al.target_id,
         al.description,
         al.created_at,
         to_char(al.created_at AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY') AS log_date,
         to_char(al.created_at AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') AS log_time,
         COALESCE(u.first_name || ' ' || u.last_name, NULL) AS staff_name,
         u.role AS staff_role,
         p.first_name || ' ' || p.last_name AS patient_name,
         p.patient_no
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.staff_id
       LEFT JOIN patients p ON p.id = al.patient_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      dataParams
    );

    res.json({
      logs: logsRes.rows,
      total,
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    });
  })
);

app.get(
  '/api/staff/users',
  auth,
  authorizeRoles('Admin'),
  wrap(async (req, res) => {
    const r = await pool.query(
      `SELECT id, email, first_name, last_name, role, is_active, is_verified, created_at,
              to_char(last_login_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM') AS last_login
       FROM users
       WHERE clinic_id = $1 AND is_active = true
       ORDER BY created_at ASC`,
      [req.user.clinic_id]
    );

    const formatted = r.rows.map((u) => ({
      ...u,
      role: normalizeRole(u.role),
      full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
    }));
    res.json(formatted);
  })
);

app.post(
  '/api/staff/users',
  auth,
  authorizeRoles('Admin'),
  wrap(async (req, res) => {
    const { name, first_name, last_name, email, password, role } = req.body;
    const cleanEmail = val(email)?.toLowerCase();
    const rawPassword = val(password);
    const cleanRole = normalizeRole(role);

    let fName = val(first_name);
    let lName = val(last_name);
    if (!fName && val(name)) {
      const parts = String(name).trim().split(/\s+/);
      fName = toTitleCase(parts[0] || '');
      lName = parts.length > 1 ? toTitleCase(parts.slice(1).join(' ')) : 'Staff';
    } else {
      if (fName) fName = toTitleCase(fName);
      if (lName) lName = toTitleCase(lName);
    }

    if (!fName) {
      return res.status(400).json({ error: 'Staff member name is required.' });
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!rawPassword || rawPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (!['Admin', 'Dentist', 'Receptionist'].includes(cleanRole)) {
      return res.status(400).json({ error: 'Role must be Admin, Dentist, or Receptionist.' });
    }

    const exists = await pool.query('SELECT id, is_active FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (exists.rowCount > 0 && exists.rows[0].is_active) {
      return res.status(409).json({ error: 'An active staff account with that email already exists.' });
    }

    const passHash = await bcrypt.hash(rawPassword, 10);
    const otpCode = generateCode();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    try {
      const htmlContent = buildOtpHtml({
        title: 'Staff Portal Email Verification',
        subtitle: `Hello ${fName} ${lName || ''}, an Admin has created your ${cleanRole} account at Smile Avenue Dental Clinic. Use this 6-digit OTP on your first login to verify your email:`,
        code: otpCode,
        footerNote: `Assigned Role: ${cleanRole}`,
      });
      await sendEmail(cleanEmail, 'Staff Account OTP Verification - Smile Avenue Dental Clinic', htmlContent);
    } catch (emailErr) {
      console.error('Nodemailer error (Staff Creation):', emailErr.message);
      return res.status(500).json({ error: 'Failed to send email. Please try again.' });
    }

    const adminRes = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [req.user.id]);
    const adminName = adminRes.rows[0] ? `${adminRes.rows[0].first_name} ${adminRes.rows[0].last_name}`.trim() : 'Admin';

    if (exists.rowCount > 0) {
      const reactivated = await pool.query(
        `UPDATE users
         SET password_hash = $1, first_name = $2, last_name = $3, role = $4,
             is_active = true, is_verified = false, otp_code = $5, otp_expiry = $6
         WHERE id = $7 AND clinic_id = $8
         RETURNING id, email, first_name, last_name, role, is_active, is_verified, created_at`,
        [passHash, fName, lName || 'Staff', cleanRole, otpCode, otpExpiry, exists.rows[0].id, req.user.clinic_id]
      );
      const u = reactivated.rows[0];

      await logActivity(
        req.user.id,
        'Staff Account Created',
        u.id,
        `Admin ${adminName} created ${cleanEmail} as ${cleanRole}.`
      );

      return res.status(201).json({
        ok: true,
        staff: { ...u, full_name: `${u.first_name} ${u.last_name}`.trim() },
        message: `Reactivated ${u.first_name} ${u.last_name} (${cleanRole}). Verification OTP sent to ${cleanEmail}.`,
      });
    }

    const ins = await pool.query(
      `INSERT INTO users (
         clinic_id, email, password_hash, first_name, last_name, role,
         is_active, is_verified, otp_code, otp_expiry
       )
       VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, $8)
       RETURNING id, email, first_name, last_name, role, is_active, is_verified, created_at`,
      [req.user.clinic_id, cleanEmail, passHash, fName, lName || 'Staff', cleanRole, otpCode, otpExpiry]
    );

    const created = ins.rows[0];

    await logActivity(
      req.user.id,
      'Staff Account Created',
      created.id,
      `Admin ${adminName} created ${cleanEmail} as ${cleanRole}.`
    );

    res.status(201).json({
      ok: true,
      staff: {
        ...created,
        full_name: `${created.first_name} ${created.last_name}`.trim(),
      },
      message: `Added ${created.first_name} ${created.last_name} as ${cleanRole}. Verification OTP sent to ${cleanEmail}.`,
    });
  })
);

app.put(
  '/api/staff/users/:id/role',
  auth,
  authorizeRoles('Admin'),
  wrap(async (req, res) => {
    const targetId = String(req.params.id || '').trim();
    const cleanRole = normalizeRole(req.body.role);

    if (!UUID_REGEX.test(targetId)) {
      return res.status(400).json({ error: 'Invalid staff ID format.' });
    }
    if (!['Admin', 'Dentist', 'Receptionist'].includes(cleanRole)) {
      return res.status(400).json({ error: 'Role must be Admin, Dentist, or Receptionist.' });
    }
    if (String(req.user.id) === targetId && cleanRole !== 'Admin') {
      return res.status(400).json({
        error: 'You cannot remove Admin privileges from your own currently logged-in account.',
      });
    }

    const targetRes = await pool.query(
      'SELECT email, role FROM users WHERE id = $1 AND clinic_id = $2 AND is_active = true',
      [targetId, req.user.clinic_id]
    );
    if (!targetRes.rowCount) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }
    const oldRole = normalizeRole(targetRes.rows[0].role);
    const targetEmail = targetRes.rows[0].email;

    const r = await pool.query(
      `UPDATE users
       SET role = $1
       WHERE id = $2 AND clinic_id = $3 AND is_active = true
       RETURNING id, email, first_name, last_name, role`,
      [cleanRole, targetId, req.user.clinic_id]
    );

    const updated = r.rows[0];

    const adminRes = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [req.user.id]);
    const adminName = adminRes.rows[0] ? `${adminRes.rows[0].first_name} ${adminRes.rows[0].last_name}`.trim() : 'Admin';

    await logActivity(
      req.user.id,
      'Staff Role Changed',
      targetId,
      `Admin ${adminName} changed ${targetEmail} from ${oldRole} to ${cleanRole}.`
    );

    res.json({
      ok: true,
      staff: {
        ...updated,
        role: normalizeRole(updated.role),
        full_name: `${updated.first_name} ${updated.last_name}`.trim(),
      },
      message: `Updated ${updated.first_name} ${updated.last_name}'s role to ${cleanRole}.`,
    });
  })
);

app.put(
  '/api/staff/users/:id/password',
  auth,
  authorizeRoles('Admin'),
  wrap(async (req, res) => {
    const targetId = String(req.params.id || '').trim();
    const newPassword = val(req.body.new_password || req.body.password);

    if (!UUID_REGEX.test(targetId)) {
      return res.status(400).json({ error: 'Invalid staff ID format.' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const passHash = await bcrypt.hash(newPassword, 10);
    const r = await pool.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2 AND clinic_id = $3 AND is_active = true
       RETURNING id, first_name, last_name, email`,
      [passHash, targetId, req.user.clinic_id]
    );

    if (!r.rowCount) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    const u = r.rows[0];
    res.json({
      ok: true,
      message: `Password reset successfully for ${u.first_name} ${u.last_name} (${u.email}).`,
    });
  })
);

app.delete(
  '/api/staff/users/:id',
  auth,
  authorizeRoles('Admin'),
  wrap(async (req, res) => {
    const targetId = String(req.params.id || '').trim();

    if (!UUID_REGEX.test(targetId)) {
      return res.status(400).json({ error: 'Invalid staff ID format.' });
    }
    if (String(req.user.id) === targetId) {
      return res.status(400).json({
        error: 'You cannot delete your own account while logged in.',
      });
    }

    const targetRes = await pool.query(
      'SELECT email FROM users WHERE id = $1 AND clinic_id = $2 AND is_active = true',
      [targetId, req.user.clinic_id]
    );
    if (!targetRes.rowCount) {
      return res.status(404).json({ error: 'Staff account not found.' });
    }
    const targetEmail = targetRes.rows[0].email;

    const r = await pool.query(
      `UPDATE users
       SET is_active = false
       WHERE id = $1 AND clinic_id = $2 AND is_active = true
       RETURNING id, first_name, last_name, email`,
      [targetId, req.user.clinic_id]
    );

    const u = r.rows[0];

    const adminRes = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [req.user.id]);
    const adminName = adminRes.rows[0] ? `${adminRes.rows[0].first_name} ${adminRes.rows[0].last_name}`.trim() : 'Admin';

    await logActivity(
      req.user.id,
      'Staff Account Deleted',
      targetId,
      `Admin ${adminName} deleted ${targetEmail}.`
    );

    res.json({
      ok: true,
      message: `Deleted staff account for ${u.first_name} ${u.last_name} (${u.email}).`,
    });
  })
);

// ============================================================================
// ADMIN PURGE SYSTEM DATA (LEAF-TO-ROOT TRANSACTIONAL RESET)
// ============================================================================
app.post(
  '/api/admin/reset-system',
  auth,
  authorizeRoles('Admin'),
  wrap(async (req, res) => {
    const clinicId = req.user.clinic_id;
    const currentAdminId = req.user.id;

    const adminRes = await pool.query('SELECT first_name, last_name, email FROM users WHERE id = $1', [currentAdminId]);
    const admin = adminRes.rows[0] || {};
    const adminName = `${admin.first_name || 'Admin'} ${admin.last_name || ''}`.trim();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Activity & Audit Logs
      await client.query(
        'DELETE FROM activity_logs WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = $1) OR staff_id IN (SELECT id FROM users WHERE clinic_id = $1)',
        [clinicId]
      );
      await client.query('DELETE FROM audit_logs WHERE clinic_id = $1', [clinicId]);

      // 2. Financial Ledger, Treatments & Tooth Records
      await client.query(
        'DELETE FROM patient_ledger WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = $1)',
        [clinicId]
      );
      await client.query(
        'DELETE FROM patient_treatments WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = $1)',
        [clinicId]
      );
      await client.query('DELETE FROM tooth_records WHERE clinic_id = $1', [clinicId]);

      // 3. Appointments & Requests
      await client.query('DELETE FROM appointments WHERE clinic_id = $1', [clinicId]);
      await client.query('DELETE FROM appointment_requests WHERE clinic_id = $1', [clinicId]);

      // 4. Clinical & Patient Identity Data
      await client.query(
        'DELETE FROM reviews WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = $1)',
        [clinicId]
      );
      await client.query('DELETE FROM inquiries WHERE clinic_id = $1', [clinicId]);
      await client.query(
        'DELETE FROM medical_histories WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = $1)',
        [clinicId]
      );
      await client.query(
        'DELETE FROM consents WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = $1)',
        [clinicId]
      );
      await client.query(
        'DELETE FROM identity_correction_requests WHERE clinic_id = $1',
        [clinicId]
      );
      await client.query('DELETE FROM call_list WHERE clinic_id = $1', [clinicId]);
      await client.query('DELETE FROM verification_codes');

      // 5. Patient Accounts & Patient Records
      await client.query('DELETE FROM patient_accounts WHERE clinic_id = $1', [clinicId]);
      await client.query('DELETE FROM patients WHERE clinic_id = $1', [clinicId]);

      // 6. Delete all Staff accounts EXCEPT the currently logged-in Admin
      await client.query('DELETE FROM users WHERE clinic_id = $1 AND id != $2', [clinicId, currentAdminId]);

      await client.query('COMMIT');

      res.json({
        ok: true,
        message: 'System reset successful. All patients, charts, appointments, and ledger records have been purged.',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('System reset transaction failed:', err.message);
      res.status(500).json({ error: 'Failed to reset system: ' + err.message });
    } finally {
      client.release();
    }
  })
);

// ============================================================================
// ERROR HANDLING & SERVER START
// ============================================================================
app.use((err, req, res, next) => {
  if (err.code === '23505' && err.constraint === 'idx_unique_pending_identity_correction') {
    return res.status(409).json({
      error: 'You already have a pending correction request for this field. Please wait for clinic staff review.',
    });
  }
  if (err.code === '23P01') return res.status(409).json({ error: 'That dentist already has an appointment at this time' });
  if (['22P02', '23514', '23503', '23502'].includes(err.code)) return res.status(400).json({ error: 'Invalid data: ' + err.message });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 5000;
pool.query('SELECT 1')
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT} (database connected)`)))
  .catch((e) => { console.error('Cannot connect to the database:', e.message); process.exit(1); });