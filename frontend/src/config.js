// Single source of truth for clinic settings, hours, lunch break, and image slots
export const CLINIC_SETTINGS = {
  name: 'Smile Avenue Dental Clinic',
  tagline: 'Healthy Smile, Happy Life.',
  subtagline: 'Your smile is our priority. Book an appointment with us today!',
  phone: '0969 059 1928',
  email: 'smileavdental@gmail.com',
  address: 'G/F Yankit Building, Landco Business Park, Legazpi, Philippines, 4500',
  hours: 'Monday to Saturday, 8:00 AM to 5:00 PM',
  footerClosedText: 'Closed on Sundays',
  lunchBreak: '12:00 PM to 12:59 PM',
  openHour: 8,   // 8:00 AM
  closeHour: 17, // 5:00 PM
  // 30-minute slots from 8:00 AM to 4:30 PM (12:00 PM and 12:30 PM excluded for lunch break)
  slots: [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  ],
  mapLink: 'https://www.google.com/maps/search/?api=1&query=Landco+Business+Park+Legazpi+City',
  termsVersion: 'v1.0',
  privacyVersion: 'v1.0',
};

export const CLINIC_INFO = CLINIC_SETTINGS;

export const SITE_IMAGES = {
  logo: 'assets/logo.png',
  hero: { path: '', label: 'Add photo: Hero, 1200x800', aspect: 'aspect-[3/2]' },
  about: { path: '', label: 'Add photo: Clinic Interior, 1000x750', aspect: 'aspect-[4/3]' },
  vision: { path: '', label: 'Add photo: Vision, 800x600', aspect: 'aspect-[4/3]' },
  mission: { path: '', label: 'Add photo: Mission, 800x600', aspect: 'aspect-[4/3]' },
  dentists: { path: '', label: 'Add photo: Dental Team, 1200x675', aspect: 'aspect-video' },
  services: { path: '', label: 'Add photo: Dental Equipment & Care, 1200x675', aspect: 'aspect-video' },
  map: { path: '', label: 'Add photo: Clinic Map / Exterior, 1200x600', aspect: 'aspect-[2/1]' },
};

// Check if clinic is currently open in Asia/Manila time
export function isClinicOpenNow() {
  const nowManila = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const day = nowManila.getDay(); // 0 = Sunday, 1..6 = Mon..Sat
  const hour = nowManila.getHours() + nowManila.getMinutes() / 60;
  return day >= 1 && day <= 6 && hour >= CLINIC_SETTINGS.openHour && hour < CLINIC_SETTINGS.closeHour;
}

// Returns today's date in Asia/Manila as 'YYYY-MM-DD'
export function todayManila() {
  const nowManila = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const y = nowManila.getFullYear();
  const m = String(nowManila.getMonth() + 1).padStart(2, '0');
  const d = String(nowManila.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Formats 'YYYY-MM-DD' without any UTC conversion (e.g. "Thursday, October 15, 2026" or "February 6, 2005")
export function formatFriendlyDate(dateStr, includeWeekday = true) {
  if (!dateStr) return '-';
  const clean = String(dateStr).slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return String(dateStr);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', {
    ...(includeWeekday ? { weekday: 'long' } : {}),
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// Formats '08:00' -> '8:00 AM', '16:30' -> '4:30 PM'
export function formatTime12(t24) {
  if (!t24) return '';
  const [h, m] = String(t24).slice(0, 5).split(':').map(Number);
  if (isNaN(h)) return t24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

// Capitalizes first letter (e.g. "female" -> "Female")
export function capitalize(str = '') {
  if (!str) return '-';
  const s = String(str).trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Builds one clean address string from patient fields
export function formatCleanAddress(p = {}) {
  const parts = [p.address, p.unit, p.barangay, p.city, p.province, p.postal_code]
    .map((x) => (x ? String(x).trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(', ') : 'Not provided';
}