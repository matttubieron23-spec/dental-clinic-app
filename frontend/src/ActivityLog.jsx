import { useEffect, useState } from 'react';
import { api } from './api';
import { Button, Card, EmptyState, InputField } from './ui';

const ACTION_FILTERS = [
  { value: 'All Actions', label: 'All Action Types' },
  { value: 'Patient Login', label: 'Patient Login' },
  { value: 'Staff Login', label: 'Staff Login' },
  { value: 'Failed Staff Login', label: 'Failed Staff Login' },
  { value: 'Failed Login', label: 'Failed Login (All)' },
  { value: 'Treatment Completed', label: 'Treatment Completed' },
  { value: 'Chart Update', label: 'Chart Update' },
  { value: 'Payment', label: 'Payment' },
  { value: 'Booking', label: 'Booking' },
  { value: 'Appointment Cancelled', label: 'Appointment Cancelled' },
  { value: 'Request Declined', label: 'Request Declined' },
  { value: 'Add Patient', label: 'Add Patient' },
  { value: 'Patient Deactivated', label: 'Patient Deactivated' },
  { value: 'Patient Reactivated', label: 'Patient Reactivated' },
  { value: 'Inquiry', label: 'Inquiry' },
  { value: 'Staff Account Created', label: 'Staff Account Created' },
  { value: 'Staff Role Changed', label: 'Staff Role Changed' },
  { value: 'Staff Password Reset', label: 'Staff Password Reset' },
  { value: 'Staff Account Deleted', label: 'Staff Account Deleted' },
];

export default function ActivityLog({ onNavigatePatient }) {
  const [logs, setLogs] = useState([]);
  const [actionFilter, setActionFilter] = useState('All Actions');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (actionFilter !== 'All Actions') {
        params.append('action_type', actionFilter);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await api(`/api/staff/activity-logs?${params.toString()}`);
      setLogs(Array.isArray(res?.logs) ? res.logs : Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err.message || 'Failed to load system activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLogs();
    }, 250);
    return () => clearTimeout(timer);
  }, [actionFilter, searchQuery]);

  const handlePatientClick = (patientId) => {
    if (!patientId) return;
    if (onNavigatePatient) {
      onNavigatePatient(patientId);
    } else {
      sessionStorage.setItem('selected_patient_id', patientId);
      window.location.href = '/staff#patients';
      window.location.reload();
    }
  };

  const renderActor = (log) => {
    if (log.staff_name) {
      return (
        <div>
          <span className="block font-semibold text-slate-900">{log.staff_name}</span>
          {log.staff_role && (
            <span className="block text-[11px] font-medium text-slate-400">
              Staff · {log.staff_role}
            </span>
          )}
        </div>
      );
    }

    if (
      log.action_type === 'Inquiry' ||
      log.action_type === 'Failed Login' ||
      log.action_type === 'Failed Staff Login'
    ) {
      return (
        <div>
          <span className="block font-semibold text-slate-700">System</span>
          <span className="block text-[11px] font-medium text-slate-400">
            {log.action_type === 'Inquiry' ? 'Web Form' : 'Security / Auth'}
          </span>
        </div>
      );
    }

    if (
      log.action_type === 'Patient Login' ||
      log.action_type === 'Patient Deactivated' ||
      log.action_type === 'Appointment Cancelled' ||
      log.action_type === 'Booking' ||
      log.action_type === 'Add Patient' ||
      log.patient_name
    ) {
      return (
        <div>
          <span className="block font-semibold text-blue-700">Patient Portal</span>
          <span className="block text-[11px] font-medium text-slate-400">Online Action</span>
        </div>
      );
    }

    return (
      <div>
        <span className="block font-semibold text-slate-600">System</span>
        <span className="block text-[11px] font-medium text-slate-400">Automated</span>
      </div>
    );
  };

  const renderBadge = (actionType) => {
    const t = String(actionType || '').trim();

    // Red: Failed Logins, Deletions, Deactivations, Cancellations, Declines
    if (
      t === 'Failed Login' ||
      t === 'Failed Staff Login' ||
      t === 'Staff Account Deleted' ||
      t === 'Patient Deactivated' ||
      t === 'Appointment Cancelled' ||
      t === 'Request Declined'
    ) {
      return (
        <span className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
          {t}
        </span>
      );
    }

    // Green: Logins, Creations, Reactivations, Completed Treatments, Payments
    if (
      t === 'Patient Login' ||
      t === 'Staff Login' ||
      t === 'Login' ||
      t === 'Staff Account Created' ||
      t === 'Add Patient' ||
      t === 'Create Patient' ||
      t === 'Patient Reactivated' ||
      t === 'Treatment Completed' ||
      t === 'Record Payment'
    ) {
      return (
        <span className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          {t}
        </span>
      );
    }

    // Amber: Updates, Inquiries, Bookings, Password Resets
    if (
      t === 'Staff Role Changed' ||
      t === 'Staff Password Reset' ||
      t === 'Inquiry' ||
      t === 'Booking' ||
      t === 'Book Appointment' ||
      t === 'Edit Chart'
    ) {
      return (
        <span className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          {t}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
        {t}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Activity Log
          </h1>
          <p className="mt-0.5 text-sm font-medium text-slate-500">
            Clinic-wide audit trail of patient activities, staff account management, logins, and bookings.
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={loadLogs}>
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

      {/* Filter and Search Bar */}
      <Card noPadding className="p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InputField
            label="Filter by Action Type"
            as="select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            {ACTION_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </InputField>

          <InputField
            label="Search by Patient / Staff / Keyword"
            type="text"
            placeholder="Search patient name, email, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setActionFilter('All Actions');
                setSearchQuery('');
              }}
              className="w-full"
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card noPadding className="overflow-hidden">
        <div className="hidden grid-cols-[1.1fr_1.3fr_1.4fr_1.2fr_2fr] items-center gap-4 border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid">
          <span>Date &amp; Time</span>
          <span>Staff / Actor</span>
          <span>Target / Device</span>
          <span>Action Type</span>
          <span>Description</span>
        </div>

        {loading ? (
          <p className="p-12 text-center text-xs font-medium text-slate-500">
            Loading activity log...
          </p>
        ) : logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No activity records found"
              description="No logs match your selected action type filter or search query."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const isPatientLogin = log.action_type === 'Patient Login';

              return (
                <div
                  key={log.id}
                  className="flex flex-col gap-2 px-6 py-4 hover:bg-slate-50/70 transition-colors md:grid md:grid-cols-[1.1fr_1.3fr_1.4fr_1.2fr_2fr] md:items-center md:gap-4"
                >
                  {/* Date & Time */}
                  <div className="text-xs font-semibold tabular-nums text-slate-700">
                    {log.log_date || ''}
                    <span className="block text-[11px] font-normal text-slate-400">
                      {log.log_time || ''}
                    </span>
                  </div>

                  {/* Staff / Actor */}
                  <div className="text-xs">
                    {renderActor(log)}
                  </div>

                  {/* Target / Device */}
                  <div className="text-xs">
                    {isPatientLogin ? (
                      <span className="text-xs font-medium text-slate-400">
                        {log.device_info || 'Unknown Device'}
                      </span>
                    ) : log.patient_id ? (
                      <button
                        type="button"
                        onClick={() => handlePatientClick(log.patient_id)}
                        className="group flex flex-col text-left cursor-pointer focus:outline-none"
                      >
                        <span className="font-bold text-blue-600 group-hover:text-blue-800 group-hover:underline">
                          {log.patient_name || 'View Profile'}
                        </span>
                        {log.patient_no && (
                          <span className="font-mono text-[11px] text-slate-400">
                            #{log.patient_no}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">
                        {log.device_info || '—'}
                      </span>
                    )}
                  </div>

                  {/* Color-Coded Action Type Badge */}
                  <div>
                    {renderBadge(log.action_type)}
                  </div>

                  {/* Description */}
                  <div className="text-xs leading-relaxed text-slate-700">
                    {log.description}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}