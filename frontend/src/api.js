const API = 'https://dental-clinic-app-olwy.onrender.com/';

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
  const token = getToken();
  const res = await fetch(API + path, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') {
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
  const token = getPatientToken();
  const res = await fetch(API + path, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/patient/auth/')) {
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
  const res = await fetch(API + path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}