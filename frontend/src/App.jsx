import { useEffect, useState } from 'react';
import { api, getToken, getPatientUser, clearPatientSession } from './api';
import { Badge, Button, Card, Icon, InputField } from './ui';
import Overview from './Overview';
import Patients from './Patients';
import Appointments from './Appointments';
import Inquiries from './Inquiries';
import Corrections from './Corrections';
import ActivityLog from './ActivityLog';
import StaffManagement from './StaffManagement';
import VerifyStaffEmail from './VerifyStaffEmail';
import Finance from './Finance';
import PublicSite, { BrandLogo, CLINIC_INFO } from './PublicSite';
import PatientAuthModal from './PatientAuthModal';
import BookAppointment from './BookAppointment';
import PatientDashboard from './PatientDashboard';
import ErrorBoundary from './ErrorBoundary';

function normalizeStaffRole(rawRole = '') {
  const r = String(rawRole || '').trim().toLowerCase();
  if (r === 'admin' || r === 'owner') return 'Admin';
  if (r === 'dentist') return 'Dentist';
  if (r === 'receptionist' || r === 'staff') return 'Receptionist';
  return 'Receptionist';
}

function getInitialVerifyEmail() {
  const params = new URLSearchParams(window.location.search);
  return params.get('email') || '';
}

// ============================================================================
// STAFF LOGIN COMPONENT
// ============================================================================
function StaffLogin({ onLogin, onNeedsVerification, onBackToPublic }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: { email: cleanEmail, password },
      });

      if (res?.requiresVerification || res?.is_verified === false) {
        window.history.pushState({}, '', `/staff/verify?email=${encodeURIComponent(cleanEmail)}`);
        onNeedsVerification(cleanEmail);
        return;
      }

      const normalizedUser = { ...res.user, role: normalizeStaffRole(res.user?.role) };
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      onLogin(normalizedUser);
    } catch (err) {
      const errMsg = String(err.message || '').toLowerCase();
      const needsVerify =
        err.requiresVerification === true ||
        errMsg.includes('verify your email') ||
        errMsg.includes('not verified') ||
        errMsg.includes('verification required') ||
        errMsg.includes('please verify');

      if (needsVerify) {
        window.history.pushState({}, '', `/staff/verify?email=${encodeURIComponent(cleanEmail)}`);
        onNeedsVerification(cleanEmail);
        return;
      }

      setError(
        err.message === 'Failed to fetch'
          ? 'Cannot reach the server. Is the backend running on port 5000?'
          : err.message || 'Invalid email or password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6F9] p-4 sm:p-6">
      <Card className="w-full max-w-md p-7 sm:p-8">
        <form onSubmit={submit} noValidate className="space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <BrandLogo />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  {CLINIC_INFO.shortName}
                </h1>
                <p className="text-xs font-medium text-slate-500">
                  Clinic Staff &amp; Dentist Portal
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onBackToPublic}
              className="!h-9 !min-h-0 !px-3 !py-1.5 !text-xs shrink-0"
            >
              ← Public Site
            </Button>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          <div className="space-y-4">
            <InputField
              label="Staff Email Address"
              type="email"
              required
              placeholder="name@clinic.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <InputField
              label="Password"
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-3 pt-1">
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="w-full"
            >
              {submitting ? 'Signing in...' : 'Log In to Staff Portal'}
            </Button>
            <p className="text-center text-xs font-medium text-slate-400">
              Restricted to authorized Smile Avenue clinic personnel only.
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'grid', roles: ['Admin', 'Dentist', 'Receptionist'] },
  { group: 'Workspace' },
  { id: 'patients', label: 'Patients', icon: 'user', roles: ['Admin', 'Dentist', 'Receptionist'] },
  { id: 'appointments', label: 'Appointments', icon: 'calendar', roles: ['Admin', 'Dentist', 'Receptionist'] },
  { id: 'corrections', label: 'Corrections', icon: 'shield', roles: ['Admin', 'Dentist', 'Receptionist'] },
  { id: 'inquiries', label: 'Web Inquiries', icon: 'activity', roles: ['Admin', 'Dentist', 'Receptionist'] },
  { id: 'finance', label: 'Finance', icon: 'finance', roles: ['Admin', 'Receptionist'] },
  { id: 'activity', label: 'Activity Log', icon: 'activity', roles: ['Admin'] },
];

const NAV_BOTTOM = [
  { id: 'settings', label: 'Settings', icon: 'settings', roles: ['Admin'] },
];

// ============================================================================
// MAIN APPLICATION ROOT
// ============================================================================
export default function App() {
  const [user, setUser] = useState(() => {
    if (!getToken()) return null;
    const raw = JSON.parse(localStorage.getItem('user') || 'null');
    return raw ? { ...raw, role: normalizeStaffRole(raw.role) } : null;
  });

  const [unverifiedStaffEmail, setUnverifiedStaffEmail] = useState(getInitialVerifyEmail);
  const [patientUser, setPatientUser] = useState(() => getPatientUser());
  const [mode, setMode] = useState(() => {
    const path = window.location.pathname;
    if (path === '/staff/verify' || path.startsWith('/staff') || getToken()) return 'staff';
    return 'public';
  });

  const [page, setPage] = useState('overview');
  const [appointmentsSubTab, setAppointmentsSubTab] = useState('calendar');

  const [menu, setMenu] = useState(false);
  const [staffMobileNavOpen, setStaffMobileNavOpen] = useState(false);
  const [patientMobileNavOpen, setPatientMobileNavOpen] = useState(false);

  const [unreadInquiries, setUnreadInquiries] = useState(0);
  const [pendingCorrections, setPendingCorrections] = useState(0);
  const [authModal, setAuthModal] = useState({
    open: false,
    initialView: 'login',
    intended: '/dashboard',
  });

  useEffect(() => {
    if (mode === 'staff' && user) {
      api('/api/staff/inquiries')
        .then((rows) => {
          setUnreadInquiries((rows || []).filter((r) => !r.is_read).length);
        })
        .catch(() => {});
      api('/api/staff/identity-corrections')
        .then((rows) => {
          setPendingCorrections((rows || []).filter((r) => r.status === 'pending').length);
        })
        .catch(() => {});
    }
  }, [mode, user, page]);

  useEffect(() => {
    const handleExpired = () => {
      clearPatientSession();
      setPatientUser(null);
      setPatientMobileNavOpen(false);
      setMode('public');
      setAuthModal({ open: true, initialView: 'login', intended: '/dashboard' });
    };
    window.addEventListener('patient-session-expired', handleExpired);
    return () => window.removeEventListener('patient-session-expired', handleExpired);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');

      if (path === '/staff/verify') {
        setUnverifiedStaffEmail(emailParam || '');
        setMode('staff');
      } else if (path.startsWith('/staff') || window.location.hash === '#staff') {
        setMode('staff');
      } else {
        setMode('public');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const staffLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setUnverifiedStaffEmail('');
    setStaffMobileNavOpen(false);
    setMenu(false);
    setPage('overview');
    setMode('public');
    window.history.pushState({}, '', '/');
  };

  const patientLogout = () => {
    clearPatientSession();
    setPatientUser(null);
    setPatientMobileNavOpen(false);
    setMode('public');
  };

  const openAuth = (view = 'login', intended = '/dashboard') => {
    setAuthModal({ open: true, initialView: view, intended });
  };

  const handleAuthSuccess = (patient) => {
    setPatientUser(patient);
    const destination = authModal.intended;
    setAuthModal({ open: false, initialView: 'login', intended: '/dashboard' });
    setMode(destination === '/book' ? 'patient-book' : 'patient-dashboard');
  };

  if (mode === 'patient-book') {
    return (
      <BookAppointment
        patientUser={patientUser}
        onBackToPublic={() => setMode('public')}
        onGoDashboard={() => setMode('patient-dashboard')}
      />
    );
  }

  // ===========================================================================
  // 1. PATIENT DASHBOARD SHELL
  // ===========================================================================
  if (mode === 'patient-dashboard') {
    return (
      <div className="min-h-screen bg-[#F4F6F9] text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
            <button
              type="button"
              onClick={() => setMode('public')}
              className="flex min-w-0 items-center gap-3 cursor-pointer"
            >
              <BrandLogo />
              <div className="min-w-0 text-left">
                <span className="block truncate font-bold tracking-tight text-slate-900">
                  {CLINIC_INFO.shortName}
                </span>
                <span className="block truncate text-[11px] font-semibold text-blue-600">
                  Patient Portal
                </span>
              </div>
            </button>

            <div className="hidden items-center gap-2.5 sm:flex">
              <span className="mr-1 text-xs font-semibold text-slate-600">
                Hi, <strong className="text-slate-900">{patientUser?.first_name}</strong>
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode('public')}
              >
                Public Site
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => setMode('patient-book')}
              >
                + Book Appointment
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={patientLogout}
              >
                Log Out
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setPatientMobileNavOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:hidden cursor-pointer"
              aria-label="Toggle patient menu"
              aria-expanded={patientMobileNavOpen}
            >
              <Icon name={patientMobileNavOpen ? 'close' : 'menu'} className="h-5 w-5" />
            </button>
          </div>

          {patientMobileNavOpen && (
            <div className="border-t border-slate-100 bg-white px-4 pt-3 pb-5 shadow-lg sm:hidden">
              <div className="mb-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
                <p className="text-xs font-bold text-slate-900">
                  {patientUser?.first_name} {patientUser?.last_name}
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  Chart #{patientUser?.patient_no || 'Patient'}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setPatientMobileNavOpen(false);
                    setMode('patient-book');
                  }}
                  className="w-full"
                >
                  + Book Appointment
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPatientMobileNavOpen(false);
                    setMode('public');
                  }}
                  className="w-full"
                >
                  ← Visit Public Website
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={patientLogout}
                  className="w-full"
                >
                  Log Out
                </Button>
              </div>
            </div>
          )}
        </header>

        <main className="mx-auto max-w-4xl p-4 sm:p-8">
          <ErrorBoundary>
            <PatientDashboard
              patientUser={patientUser}
              onGoBook={() => setMode('patient-book')}
            />
          </ErrorBoundary>
        </main>
      </div>
    );
  }

  // ===========================================================================
  // 2. PUBLIC SITE SHELL
  // ===========================================================================
  if (mode === 'public') {
    return (
      <>
        <PublicSite
          patientUser={patientUser}
          onOpenAuth={openAuth}
          onGoBook={() => setMode('patient-book')}
          onGoDashboard={() => setMode('patient-dashboard')}
          onGoStaff={() => {
            setMode('staff');
            window.history.pushState({}, '', '/staff');
          }}
        />
        {authModal.open && (
          <PatientAuthModal
            initialView={authModal.initialView}
            onClose={() => setAuthModal({ ...authModal, open: false })}
            onSuccess={handleAuthSuccess}
          />
        )}
      </>
    );
  }

  // ===========================================================================
  // 3. STAFF AUTH & VERIFICATION SHELL
  // ===========================================================================
  if (!user) {
    if (unverifiedStaffEmail || window.location.pathname === '/staff/verify') {
      return (
        <VerifyStaffEmail
          email={unverifiedStaffEmail}
          onVerified={(verifiedUser) => {
            const normalizedUser = {
              ...verifiedUser,
              role: normalizeStaffRole(verifiedUser.role),
            };
            setUnverifiedStaffEmail('');
            setUser(normalizedUser);
            setPage('overview');
            window.history.pushState({}, '', '/staff');
          }}
          onBackToLogin={() => {
            setUnverifiedStaffEmail('');
            window.history.pushState({}, '', '/staff');
          }}
        />
      );
    }

    return (
      <StaffLogin
        onLogin={(loggedInUser) => {
          setUser(loggedInUser);
          setPage('overview');
          window.history.pushState({}, '', '/staff');
        }}
        onNeedsVerification={(staffEmail) => {
          setUnverifiedStaffEmail(staffEmail);
        }}
        onBackToPublic={() => {
          setMode('public');
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  // ===========================================================================
  // 4. STAFF DASHBOARD WORKSPACE (Sidebar + Header + Mobile Drawer)
  // ===========================================================================
  const userRole = normalizeStaffRole(user.role);

  const visibleNav = NAV.filter((n) => n.group || (n.roles && n.roles.includes(userRole)));
  const visibleBottomNav = NAV_BOTTOM.filter((n) => n.roles && n.roles.includes(userRole));

  const badgeCountFor = (id) => {
    if (id === 'inquiries') return unreadInquiries;
    if (id === 'corrections') return pendingCorrections;
    return 0;
  };

  const handleNavClick = (id) => {
    if (id === 'appointments') {
      setAppointmentsSubTab('calendar');
    }
    setPage(id);
    setStaffMobileNavOpen(false);
  };

  const renderNavItem = (n) => {
    const count = badgeCountFor(n.id);
    const active = page === n.id;
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => handleNavClick(n.id)}
        className={`flex min-h-[42px] w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm transition-all cursor-pointer ${
          active
            ? 'bg-blue-600 font-semibold text-white shadow-xs shadow-blue-600/20'
            : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <span className="flex items-center gap-3">
          <Icon name={n.icon} className="h-4 w-4" />
          <span>{n.label}</span>
        </span>
        {count > 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              active ? 'bg-white text-blue-700' : 'bg-amber-500 text-white'
            }`}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  const initials = ((user.first_name?.[0] || 'S') + (user.last_name?.[0] || 'T')).toUpperCase();
  const activeNavLabel =
    [...visibleNav, ...visibleBottomNav].find((n) => n.id === page)?.label || 'Overview';

  return (
    <div className="flex min-h-screen bg-[#F4F6F9] text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-3 px-2 pt-1">
          <BrandLogo />
          <div className="min-w-0">
            <span className="block truncate font-bold leading-tight text-slate-900">
              Smile Avenue
            </span>
            <span className="block text-xs font-medium text-slate-500">
              Staff Portal · {userRole}
            </span>
          </div>
        </div>

        <nav className="space-y-1">
          {visibleNav.map((n) =>
            n.group ? (
              <p
                key={n.group}
                className="px-3.5 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-wider text-slate-400"
              >
                {n.group}
              </p>
            ) : (
              renderNavItem(n)
            )
          )}
        </nav>

        <div className="mt-auto space-y-1 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => {
              setMode('public');
              window.history.pushState({}, '', '/');
            }}
            className="flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            ← View Public Site
          </button>
          {visibleBottomNav.map(renderNavItem)}
        </div>
      </aside>

      {/* Mobile Drawer (md:hidden) */}
      {staffMobileNavOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs"
            onClick={() => setStaffMobileNavOpen(false)}
          />

          <aside className="relative z-10 flex h-full w-72 max-w-[82vw] flex-col bg-white p-4 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <BrandLogo />
                <div>
                  <span className="block font-bold leading-tight text-slate-900">
                    Smile Avenue
                  </span>
                  <span className="block text-xs font-medium text-slate-500">
                    {userRole} Portal
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStaffMobileNavOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Close navigation menu"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto">
              {visibleNav.map((n) =>
                n.group ? (
                  <p
                    key={n.group}
                    className="px-3.5 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400"
                  >
                    {n.group}
                  </p>
                ) : (
                  renderNavItem(n)
                )
              )}
              {visibleBottomNav.map(renderNavItem)}
            </nav>

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStaffMobileNavOpen(false);
                  setMode('public');
                  window.history.pushState({}, '', '/');
                }}
                className="w-full"
              >
                ← View Public Site
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={staffLogout}
                className="w-full"
              >
                Log Out
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-md md:justify-end md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <button
              type="button"
              onClick={() => setStaffMobileNavOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-900">
                {activeNavLabel}
              </span>
              <span className="block truncate text-[11px] font-medium text-slate-500">
                Smile Avenue · {userRole}
              </span>
            </div>
          </div>

          <div className="relative flex shrink-0 items-center gap-3">
            <Badge status={userRole}>{userRole}</Badge>
            <span className="hidden text-sm font-semibold text-slate-700 sm:inline">
              {user.first_name}
            </span>
            <button
              type="button"
              onClick={() => setMenu(!menu)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 ring-2 ring-white transition-transform hover:scale-105 cursor-pointer"
              aria-label="Account menu"
            >
              {initials}
            </button>

            {menu && (
              <div className="absolute right-0 top-11 z-30 w-52 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="text-xs font-bold text-slate-900">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="truncate text-[11px] font-medium text-slate-500">
                    {user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setMode('public');
                    window.history.pushState({}, '', '/');
                  }}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  View Public Site
                </button>
                <button
                  type="button"
                  onClick={staffLogout}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">
          {page === 'overview' && (
            <Overview
              user={user}
              onGoOnlineRequests={() => {
                setAppointmentsSubTab('requests');
                setPage('appointments');
              }}
              onGoAppointments={() => {
                setAppointmentsSubTab('calendar');
                setPage('appointments');
              }}
              onGoPatients={() => setPage('patients')}
              onGoFinance={() => setPage('finance')}
            />
          )}
          {page === 'patients' && <Patients />}
          {page === 'appointments' && (
            <Appointments initialSubTab={appointmentsSubTab} />
          )}
          {page === 'corrections' && (
            <Corrections onPendingCountChange={setPendingCorrections} />
          )}
          {page === 'inquiries' && <Inquiries onUnreadCountChange={setUnreadInquiries} />}
          {page === 'finance' && userRole !== 'Dentist' && (
            <Finance
              onOpenPatientProfile={(patientId) => {
                sessionStorage.setItem('selected_patient_id', patientId);
                setPage('patients');
              }}
            />
          )}
          {page === 'activity' && userRole === 'Admin' && (
            <ActivityLog
              onNavigatePatient={(patientId) => {
                sessionStorage.setItem('selected_patient_id', patientId);
                setPage('patients');
              }}
            />
          )}
          {page === 'settings' && userRole === 'Admin' && <StaffManagement />}
        </main>
      </div>
    </div>
  );
}