import { useEffect, useState } from 'react';
import { api } from './api';
import { Badge, Button, Card, EmptyState, Icon } from './ui';

const formatPeso = (num) =>
  '₱' +
  Number(num || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function formatTimeAgo(isoDate) {
  if (!isoDate) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'min' : 'mins'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? 'hr' : 'hrs'} ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
}

function formatActionSummary(log) {
  const staff = log.staff_name || 'Admin';
  switch (log.action_type) {
    case 'Record Payment':
      return `${staff} recorded a payment`;
    case 'Create Patient':
      return `${staff} created a patient`;
    case 'Book Appointment':
      return `${staff} booked an appointment`;
    case 'Edit Chart':
      return `${staff} updated a dental chart`;
    case 'Login':
      return `${staff} logged in`;
    default:
      return `${staff} performed ${log.action_type || 'an action'}`;
  }
}

function formatStatusLabel(status = '') {
  const s = String(status || 'unconfirmed').toLowerCase();
  if (s === 'in_chair') return 'In Chair';
  if (s === 'no_show') return 'No-Show';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Overview({
  user,
  onGoOnlineRequests,
  onGoAppointments,
}) {
  const [data, setData] = useState({
    metrics: {
      todays_appointments: 0,
      total_patients: 0,
      todays_revenue: 0,
      pending_requests: 0,
    },
    todays_schedule: [],
    recent_activity: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('api/staff/overview');
      if (res) {
        setData({
          metrics: res.metrics || {
            todays_appointments: 0,
            total_patients: 0,
            todays_revenue: 0,
            pending_requests: 0,
          },
          todays_schedule: Array.isArray(res.todays_schedule) ? res.todays_schedule : [],
          recent_activity: Array.isArray(res.recent_activity) ? res.recent_activity : [],
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load clinic overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const { metrics, todays_schedule, recent_activity } = data;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Overview {user?.first_name ? `· Welcome, ${user.first_name}` : ''}
          </h1>
          <p className="mt-0.5 text-sm font-medium text-slate-500">
            Daily snapshot of your clinic schedule, patient volume, revenue, and recent staff activity.
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={loadOverview}>
          ↻ Refresh
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700"
        >
          {error}
        </div>
      )}

      {/* 1. TOP METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card noPadding className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Today&apos;s Appointments
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon name="calendar" className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold tabular-nums text-slate-900">
            {loading ? '—' : metrics.todays_appointments}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            Scheduled for today
          </span>
        </Card>

        <Card noPadding className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Patients
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Icon name="user" className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold tabular-nums text-slate-900">
            {loading ? '—' : metrics.total_patients}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            Active registered patients
          </span>
        </Card>

        <Card noPadding className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Today&apos;s Revenue
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Icon name="finance" className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold tabular-nums text-emerald-600">
            {loading ? '—' : formatPeso(metrics.todays_revenue)}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            Payments collected today
          </span>
        </Card>

        <Card
          noPadding
          onClick={onGoOnlineRequests}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onGoOnlineRequests?.();
            }
          }}
          className={`group p-6 transition-all cursor-pointer ${
            metrics.pending_requests > 0
              ? 'border-amber-200 hover:border-amber-300 hover:bg-amber-50/20'
              : 'hover:border-blue-300 hover:bg-blue-50/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                metrics.pending_requests > 0 ? 'text-amber-800' : 'text-slate-400'
              }`}
            >
              Pending Requests
            </span>
            <Badge status={metrics.pending_requests > 0 ? 'pending' : 'confirmed'}>
              Review →
            </Badge>
          </div>
          <p
            className={`mt-3 text-3xl font-extrabold tabular-nums ${
              metrics.pending_requests > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {loading ? '—' : metrics.pending_requests}
          </p>
          <span className="mt-1 block text-xs font-semibold text-blue-600 group-hover:underline">
            Click to open Online Requests
          </span>
        </Card>
      </div>

      {/* 2. TODAY'S SCHEDULE */}
      <Card noPadding className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Today&apos;s Schedule</h2>
            <p className="text-xs font-medium text-slate-500">
              Appointments scheduled for today, ordered chronologically by time.
            </p>
          </div>
          {onGoAppointments && (
            <Button type="button" variant="secondary" onClick={onGoAppointments}>
              Open Full Calendar →
            </Button>
          )}
        </div>

        {loading ? (
          <p className="p-10 text-center text-xs font-medium text-slate-500">
            Loading today&apos;s schedule...
          </p>
        ) : todays_schedule.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No appointments scheduled for today."
              description="When appointments are booked for today, they will appear here in chronological order."
            />
          </div>
        ) : (
          <div>
            <div className="hidden grid-cols-[1fr_1.6fr_1.4fr_1fr] items-center gap-4 border-b border-slate-100 bg-slate-50/40 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 sm:grid">
              <span>Time</span>
              <span>Patient Name</span>
              <span>Dentist Name</span>
              <span className="text-right">Status</span>
            </div>

            <div className="divide-y divide-slate-100">
              {todays_schedule.map((appt) => (
                <div
                  key={appt.id}
                  className="flex flex-col gap-2 px-6 py-3.5 hover:bg-slate-50/80 transition-colors sm:grid sm:grid-cols-[1fr_1.6fr_1.4fr_1fr] sm:items-center sm:gap-4"
                >
                  <div className="text-xs font-bold tabular-nums text-blue-600">
                    {appt.appointment_time}
                  </div>

                  <div className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {appt.patient_name}
                    </span>
                    <span className="block truncate text-xs font-medium text-slate-500">
                      {appt.patient_no} · {appt.reason || 'Consultation'}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-700">
                    {appt.dentist_name ? `Dr. ${appt.dentist_name}` : 'Unassigned'}
                  </div>

                  <div className="flex sm:justify-end">
                    <Badge status={appt.status}>
                      {formatStatusLabel(appt.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 3. RECENT ACTIVITY FEED */}
      <Card noPadding className="overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">Recent Activity</h2>
          <p className="text-xs font-medium text-slate-500">
            Latest actions recorded across the clinic staff portal.
          </p>
        </div>

        {loading ? (
          <p className="p-10 text-center text-xs font-medium text-slate-500">
            Loading recent activity...
          </p>
        ) : recent_activity.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No recent staff activity recorded yet"
              description="Staff logins, patient registrations, bookings, and payments will appear here."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent_activity.map((log) => (
              <div
                key={log.id}
                className="flex flex-col justify-between gap-2 px-6 py-3.5 hover:bg-slate-50/80 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    <span>{formatActionSummary(log)}</span>
                    <span className="mx-1.5 text-slate-300">-</span>
                    <span className="text-xs font-bold text-blue-600">
                      {formatTimeAgo(log.created_at)}
                    </span>
                  </p>
                  {log.description && (
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                      {log.description}
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  <Badge tone="neutral">{log.action_type}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}