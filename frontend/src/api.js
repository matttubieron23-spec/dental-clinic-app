const API_URL = (import.meta.env.VITE_API_URL || 'https://dental-clinic-app-olwy.onrender.com').replace(/\/+$/, '');

// Automatically ensures every request starts with '/api/' without duplicating it
function normalizeApiPath(path = '') {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (clean === '/api' || clean.startsWith('/api/')) {
    return clean;
  }
  return `/api${clean}`;
}

// ---------------------------------------------------------------------------
// Staff Token & API
// ---------------------------------------------------------------------------
export const getToken = () => localStorage.getItem('token');
export const getStaffUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

export async function api(path, options = {}) {
  const cleanPath = normalizeApiPath(path);
  const token = getToken();
  const res = await fetch(`${API_URL}${cleanPath}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && cleanPath !== '/api/auth/login') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---------------------------------------------------------------------------
// Patient Token & API (Isolated from Staff)
// ---------------------------------------------------------------------------
export const getPatientToken = () => localStorage.getItem('patient_token');

export const getPatientUser = () => {
  try {
    return JSON.parse(localStorage.getItem('patient_user') || 'null');
  } catch {
    return null;
  }
};

export const setPatientSession = (token, patient) => {
  localStorage.setItem('patient_token', token);
  localStorage.setItem('patient_user', JSON.stringify(patient));
};

export const clearPatientSession = () => {
  localStorage.removeItem('patient_token');
  localStorage.removeItem('patient_user');
};

export async function patientApi(path, options = {}) {
  const cleanPath = normalizeApiPath(path);
  const token = getPatientToken();
  const res = await fetch(`${API_URL}${cleanPath}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !cleanPath.startsWith('/api/patient/auth/')) {
    clearPatientSession();
    window.dispatchEvent(new CustomEvent('patient-session-expired'));
  }
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.data = data;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Public API (No tokens required)
// ---------------------------------------------------------------------------
export async function publicApi(path, options = {}) {
  const cleanPath = normalizeApiPath(path);
  const res = await fetch(`${API_URL}${cleanPath}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}