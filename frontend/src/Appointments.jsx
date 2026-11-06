import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import {
  CLINIC_SETTINGS,
  formatFriendlyDate,
  formatTime12,
  todayManila,
} from './config';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  InputField,
  Modal,
  tokens,
} from './ui';

const TIMELINE_SLOTS = [
  '08:00', '08:30',
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00',
];

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DENTIST_PALETTE = [
  { bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb', text: '#1e3a8a', dot: '#2563eb' },
  { bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a', text: '#14532d', dot: '#16a34a' },
  { bg: '#faf5ff', border: '#e9d5ff', accent: '#9333ea', text: '#581c87', dot: '#9333ea' },
  { bg: '#fff7ed', border: '#fed7aa', accent: '#ea580c', text: '#7c2d12', dot: '#ea580c' },
  { bg: '#f0fdfa', border: '#99f6e4', accent: '#0d9488', text: '#134e4a', dot: '#0d9488' },
  { bg: '#fdf2f8', border: '#fbcfe8', accent: '#db2777', text: '#831843', dot: '#db2777' },
];

const APPOINTMENT_STATUS_OPTIONS = [
  { id: 'unconfirmed', label: 'Unconfirmed' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'arrived', label: 'Arrived' },
  { id: 'in_chair', label: 'In Chair' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'no_show', label: 'No-show' },
];

function parseYMD(dateStr) {
  const [y, m, d] = String(dateStr || todayManila()).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, days) {
  const dt = parseYMD(dateStr);
  dt.setDate(dt.getDate() + days);
  return toYMD(dt);
}

function getStartOfWeekSunday(dateStr) {
  const dt = parseYMD(dateStr);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - day);
  return toYMD(dt);
}

function getMonthRange(dateStr) {
  const dt = parseYMD(dateStr);
  const firstDay = new Date(dt.getFullYear(), dt.getMonth(), 1);
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);

  const startGrid = new Date(firstDay);
  startGrid.setDate(firstDay.getDate() - firstDay.getDay());

  const endGrid = new Date(lastDay);
  endGrid.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

  return {
    firstOfMonth: toYMD(firstDay),
    lastOfMonth: toYMD(lastDay),
    startGrid: toYMD(startGrid),
    endGrid: toYMD(endGrid),
    monthIndex: dt.getMonth(),
    year: dt.getFullYear(),
  };
}

function formatSlotLabel12(hm) {
  const [hStr, mStr] = String(hm || '08:00').split(':');
  const h = Number(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mStr} ${suffix}`;
}

function formatShortTime(hm) {
  const [hStr, mStr] = String(hm || '09:00').split(':');
  const h = Number(hStr);
  const h12 = h % 12 || 12;
  return `${h12}:${mStr}`;
}

function formatPatientCardName(fullName = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'patient';
  if (parts.length === 1) return parts[0].toLowerCase();
  const last = parts[parts.length - 1].toLowerCase();
  const first = parts.slice(0, -1).join(' ').toLowerCase();
  return `${last}, ${first}`;
}

function normalizeStatusKey(rawStatus = '') {
  const s = String(rawStatus || '').toLowerCase().trim();
  if (s === 'confirmed') return 'confirmed';
  if (s === 'arrived' || s === 'checked_in') return 'arrived';
  if (s === 'in_chair' || s === 'in_progress' || s === 'seated') return 'in_chair';
  if (s === 'completed' || s === 'done') return 'completed';
  if (s === 'cancelled' || s === 'no_show' || s === 'declined') return 'cancelled';
  return 'unconfirmed';
}

function cleanReasonText(reason = '') {
  return (
    String(reason || '')
      .replace(/^Request #REF-[0-9]{8}-[A-Z0-9]{4}( \(Rescheduled\))?:\s*/i, '')
      .trim() || 'Consultation'
  );
}

export default function Appointments({ initialSubTab = 'calendar' }) {
  const todayStr = todayManila();

  const [subTab, setSubTab] = useState(initialSubTab);

  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day');
  const [colourBy, setColourBy] = useState('status');

  const [patients, setPatients] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loadingCal, setLoadingCal] = useState(true);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newApptModalOpen, setNewApptModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [savingNewAppt, setSavingNewAppt] = useState(false);
  const [newApptError, setNewApptError] = useState('');
  const [newApptForm, setNewApptForm] = useState({
    patient_id: '',
    dentist_id: '',
    date: todayStr,
    time: '09:00',
    duration_min: 30,
    reason: 'Consultation',
    notes: '',
  });

  const [selectedAppt, setSelectedAppt] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [confirmModal, setConfirmModal] = useState(null);
  const [selectedDentistId, setSelectedDentistId] = useState('');
  const [declineModal, setDeclineModal] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [reschedModal, setReschedModal] = useState(null);
  const [reschedForm, setReschedForm] = useState({
    dentist_id: '',
    date: todayStr,
    time: '09:00',
    reason: '',
  });
  const [processingReq, setProcessingReq] = useState(false);

  const dateWindow = useMemo(() => {
    if (viewMode === 'day') {
      return { from: selectedDate, to: selectedDate };
    }
    if (viewMode === 'week') {
      const start = getStartOfWeekSunday(selectedDate);
      const end = addDays(start, 6);
      return { from: start, to: end };
    }
    const mRange = getMonthRange(selectedDate);
    return { from: mRange.startGrid, to: mRange.endGrid };
  }, [selectedDate, viewMode]);

  const loadCalendarData = async () => {
    setLoadingCal(true);
    setError('');
    try {
      const [dentistList, patientList, apptList] = await Promise.all([
        api('/dentists'),
        api('/patients'),
        api(`/appointments?from=${dateWindow.from}&to=${dateWindow.to}`),
      ]);
      const dRows = Array.isArray(dentistList) ? dentistList : [];
      const pRows = Array.isArray(patientList)
        ? patientList.filter((p) => p.is_active !== false)
        : [];
      setDentists(dRows);
      setPatients(pRows);
      if (dRows.length > 0 && !selectedDentistId) {
        setSelectedDentistId(dRows[0].id);
      }
      setAppointments(Array.isArray(apptList) ? apptList : []);
    } catch (err) {
      setError(err.message || 'Failed to load appointments calendar.');
    } finally {
      setLoadingCal(false);
    }
  };

  const loadOnlineRequests = async () => {
    setLoadingReqs(true);
    try {
      const rows = await api('/staff/appointment-requests');
      setRequests(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Failed to load online requests.');
    } finally {
      setLoadingReqs(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, [dateWindow.from, dateWindow.to]);

  useEffect(() => {
    loadOnlineRequests();
  }, []);

  const pendingRequestsCount = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests]
  );

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const full = `${p.first_name || ''} ${p.middle_name || ''} ${p.last_name || ''} ${p.patient_no || ''} ${p.phone || ''}`.toLowerCase();
      return full.includes(q);
    });
  }, [patients, patientSearch]);

  const handleOpenNewAppointment = (prefill = {}) => {
    setNewApptError('');
    setPatientSearch('');
    setNewApptForm({
      patient_id: prefill.patient_id || patients[0]?.id || '',
      dentist_id:
        prefill.dentist_id && prefill.dentist_id !== 'default-dentist'
          ? prefill.dentist_id
          : dentists[0]?.id || '',
      date: prefill.date || selectedDate || todayStr,
      time: prefill.time || '09:00',
      duration_min: 30,
      reason: 'Consultation',
      notes: '',
    });
    setNewApptModalOpen(true);
  };

  const handleCreateAppointmentSubmit = async (e) => {
    e.preventDefault();
    setNewApptError('');

    if (!newApptForm.patient_id) {
      setNewApptError('Please select a patient.');
      return;
    }
    if (!newApptForm.dentist_id) {
      setNewApptError('Please select a dentist.');
      return;
    }
    if (!newApptForm.date || !newApptForm.time) {
      setNewApptError('Please select a valid date and time.');
      return;
    }

    const startsAtIso = `${newApptForm.date}T${newApptForm.time}:00+08:00`;

    setSavingNewAppt(true);
    try {
      await api('/appointments', {
        method: 'POST',
        body: {
          patient_id: newApptForm.patient_id,
          dentist_id: newApptForm.dentist_id,
          starts_at: startsAtIso,
          duration_min: Number(newApptForm.duration_min) || 30,
          reason: newApptForm.reason.trim() || 'Consultation',
          notes: newApptForm.notes.trim() || null,
        },
      });
      setNewApptModalOpen(false);
      setSelectedDate(newApptForm.date);
      setSuccess(
        `New appointment scheduled for ${formatFriendlyDate(
          newApptForm.date,
          false
        )} at ${formatTime12(newApptForm.time)}.`
      );
      await loadCalendarData();
    } catch (err) {
      setNewApptError(err.message || 'Failed to schedule appointment.');
    } finally {
      setSavingNewAppt(false);
    }
  };

  const handleUpdateApptStatus = async (statusValue) => {
    if (!selectedAppt) return;
    setUpdatingStatus(true);
    setError('');
    try {
      await api(`/appointments/${selectedAppt.id}/status`, {
        method: 'PATCH',
        body: { status: statusValue },
      });
      setSelectedAppt(null);
      setSuccess(`Appointment status updated to ${statusValue.replace('_', ' ')}.`);
      await loadCalendarData();
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const staffColumns = useMemo(() => {
    if (dentists.length > 0) {
      return dentists.map((d, idx) => ({
        id: d.id,
        name: `Dr. ${d.first_name || ''} ${d.last_name || ''}`.trim(),
        palette: DENTIST_PALETTE[idx % DENTIST_PALETTE.length],
      }));
    }
    return [
      {
        id: 'default-dentist',
        name: 'Dr. Demo Dentist',
        palette: DENTIST_PALETTE[0],
      },
    ];
  }, [dentists]);

  const dentistColorMap = useMemo(() => {
    const map = {};
    staffColumns.forEach((c) => {
      map[c.id] = c.palette;
    });
    return map;
  }, [staffColumns]);

  const handleStepDate = (dir) => {
    if (viewMode === 'day') {
      setSelectedDate((prev) => addDays(prev, dir));
    } else if (viewMode === 'week') {
      setSelectedDate((prev) => addDays(prev, dir * 7));
    } else {
      const dt = parseYMD(selectedDate);
      dt.setMonth(dt.getMonth() + dir);
      setSelectedDate(toYMD(dt));
    }
  };

  const navDateLabel = useMemo(() => {
    const dt = parseYMD(selectedDate);
    const dayName = WEEKDAYS_SHORT[dt.getDay()];
    const monthName = MONTHS_SHORT[dt.getMonth()];
    const dayNum = dt.getDate();
    const yearNum = dt.getFullYear();

    if (viewMode === 'day') {
      const prefix = selectedDate === todayStr ? 'Today · ' : '';
      return `${prefix}${dayName}, ${monthName} ${dayNum}`;
    }
    if (viewMode === 'week') {
      const startDt = parseYMD(dateWindow.from);
      const endDt = parseYMD(dateWindow.to);
      const sMonth = MONTHS_SHORT[startDt.getMonth()];
      const eMonth = MONTHS_SHORT[endDt.getMonth()];
      if (sMonth === eMonth) {
        return `${sMonth} ${startDt.getDate()} – ${endDt.getDate()}, ${endDt.getFullYear()}`;
      }
      return `${sMonth} ${startDt.getDate()} – ${eMonth} ${endDt.getDate()}, ${endDt.getFullYear()}`;
    }
    return `${monthName} ${yearNum}`;
  }, [selectedDate, viewMode, dateWindow, todayStr]);

  const groupedAppointments = useMemo(() => {
    const byDate = {};

    appointments.forEach((appt) => {
      const dStr = appt.appointment_date || String(appt.starts_at || '').slice(0, 10);
      const rawTime = appt.appointment_time || '09:00';
      const [hh, mm] = rawTime.split(':').map(Number);
      const slotMin = mm >= 30 ? '30' : '00';
      const slotKey = `${String(hh).padStart(2, '0')}:${slotMin}`;

      if (!byDate[dStr]) byDate[dStr] = {};
      if (!byDate[dStr][slotKey]) byDate[dStr][slotKey] = [];

      byDate[dStr][slotKey].push({
        ...appt,
        slotKey,
        statusKey: normalizeStatusKey(appt.status),
        displayPatient: formatPatientCardName(appt.patient_name),
        displayReason: cleanReasonText(appt.reason),
        displayShortTime: formatShortTime(rawTime),
      });
    });

    return byDate;
  }, [appointments]);

  const getBlockPresentation = (appt) => {
    const statusKey = appt.statusKey;

    if (colourBy === 'dentist' && statusKey !== 'cancelled') {
      const pal = dentistColorMap[appt.dentist_id] || DENTIST_PALETTE[0];
      return {
        className:
          'rounded-[8px] px-2.5 py-1.5 text-xs shadow-2xs transition-all cursor-pointer hover:brightness-95',
        style: {
          backgroundColor: pal.bg,
          border: `1px solid ${pal.border}`,
          borderLeft: `3.5px solid ${pal.accent}`,
          color: pal.text,
        },
      };
    }

    return {
      className: `appt-block-${statusKey} rounded-[8px] px-2.5 py-1.5 text-xs shadow-2xs transition-all cursor-pointer hover:brightness-95`,
      style: {},
    };
  };

  const weekDays = useMemo(() => {
    const start = getStartOfWeekSunday(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const ymd = addDays(start, i);
      const dt = parseYMD(ymd);
      return {
        ymd,
        dayShort: WEEKDAYS_SHORT[dt.getDay()],
        dayNum: dt.getDate(),
        monthShort: MONTHS_SHORT[dt.getMonth()],
        isToday: ymd === todayStr,
      };
    });
  }, [selectedDate, todayStr]);

  const monthDays = useMemo(() => {
    if (viewMode !== 'month') return [];
    const mInfo = getMonthRange(selectedDate);
    const days = [];
    let curr = mInfo.startGrid;
    while (curr <= mInfo.endGrid && days.length < 42) {
      const dt = parseYMD(curr);
      days.push({
        ymd: curr,
        dayNum: dt.getDate(),
        inMonth: dt.getMonth() === mInfo.monthIndex,
        isToday: curr === todayStr,
      });
      curr = addDays(curr, 1);
    }
    return days;
  }, [selectedDate, viewMode, todayStr]);

  const handleConfirmRequest = async (e) => {
    e.preventDefault();
    if (!confirmModal || !selectedDentistId) return;
    setProcessingReq(true);
    setError('');
    try {
      const res = await api(`/staff/appointment-requests/${confirmModal.id}/confirm`, {
        method: 'POST',
        body: { dentist_id: selectedDentistId },
      });
      setSuccess(res.message || 'Appointment confirmed.');
      setConfirmModal(null);
      await Promise.all([loadOnlineRequests(), loadCalendarData()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingReq(false);
    }
  };

  const handleDeclineRequest = async (e) => {
    e.preventDefault();
    if (!declineModal) return;
    setProcessingReq(true);
    setError('');
    try {
      await api(`/staff/appointment-requests/${declineModal.id}/decline`, {
        method: 'POST',
        body: { reason: declineReason },
      });
      setSuccess('Appointment request declined.');
      setDeclineModal(null);
      setDeclineReason('');
      await loadOnlineRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingReq(false);
    }
  };

  const handleRescheduleRequest = async (e) => {
    e.preventDefault();
    if (!reschedModal) return;
    setProcessingReq(true);
    setError('');
    try {
      const res = await api(`/staff/appointment-requests/${reschedModal.id}/reschedule`, {
        method: 'POST',
        body: reschedForm,
      });
      setSuccess(res.message || 'Appointment rescheduled and confirmed.');
      setReschedModal(null);
      await Promise.all([loadOnlineRequests(), loadCalendarData()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingReq(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* 1. PAGE HEADER */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Appointments</h1>
          <p className="mt-0.5 text-sm font-medium text-slate-500">
            Manage daily doctor schedules and incoming patient booking requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* SubTab Toggle */}
          <div className="inline-flex h-10 items-center rounded-xl border border-slate-200/80 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setSubTab('calendar')}
              className={`inline-flex h-full items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-all cursor-pointer ${
                subTab === 'calendar'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon name="calendar" className="h-3.5 w-3.5" />
              <span>Calendar</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('requests')}
              className={`inline-flex h-full items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-all cursor-pointer ${
                subTab === 'requests'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Online Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={() => handleOpenNewAppointment()}
          >
            + New Appointment
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800"
        >
          {success}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: PROFESSIONAL APPOINTMENTS CALENDAR */}
      {/* =================================================================== */}
      {subTab === 'calendar' && (
        <div className="space-y-4">
          {/* 2. CALENDAR CONTROLS BAR (Clean SaaS Inputs - No Boxy Outlines) */}
          <Card noPadding className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <span className={tokens.label}>Schedule Period</span>
                  <div className="inline-flex h-[44px] items-center rounded-xl border border-slate-300 bg-white shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleStepDate(-1)}
                      className="flex h-full w-10 items-center justify-center rounded-l-xl text-base font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                      aria-label="Previous period"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayStr)}
                      className="h-full border-x border-slate-200 px-4 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
                      title="Click to jump to Today"
                    >
                      {navDateLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepDate(1)}
                      className="flex h-full w-10 items-center justify-center rounded-r-xl text-base font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                      aria-label="Next period"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div>
                  <span className={tokens.label}>Calendar View</span>
                  <div className="inline-flex h-[44px] items-center rounded-xl border border-slate-300 bg-slate-100 p-1 shadow-2xs">
                    {[
                      { id: 'day', label: 'Day' },
                      { id: 'week', label: 'Week' },
                      { id: 'month', label: 'Month' },
                    ].map((v) => {
                      const active = viewMode === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setViewMode(v.id)}
                          className={`h-full rounded-lg px-3.5 text-xs font-semibold transition-all cursor-pointer ${
                            active
                              ? 'bg-white text-blue-600 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="w-40">
                  <InputField
                    label="Colour by"
                    as="select"
                    value={colourBy}
                    onChange={(e) => setColourBy(e.target.value)}
                  >
                    <option value="status">Status</option>
                    <option value="dentist">Dentist</option>
                  </InputField>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="w-44">
                  <InputField
                    label="Jump to Date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={loadCalendarData}
                >
                  ↻ Refresh
                </Button>
              </div>
            </div>
          </Card>

          {/* 3. THE LEGEND ROW */}
          <Card noPadding className="px-6 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Status Legend:
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="h-3 w-3 rounded-xs border border-slate-300 bg-white" />
                  Unconfirmed
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="h-3 w-3 rounded-xs bg-blue-600" />
                  Confirmed
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="h-3 w-3 rounded-xs bg-red-600" />
                  Arrived
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="h-3 w-3 rounded-xs bg-violet-600" />
                  In Chair
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="h-3 w-3 rounded-xs bg-emerald-600" />
                  Completed
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-400 line-through">
                  <span className="h-3 w-3 rounded-xs border border-dashed border-slate-300 bg-slate-100" />
                  Cancelled/No-show
                </span>
              </div>

              {colourBy === 'dentist' && (
                <div className="flex flex-wrap items-center gap-3 border-l border-slate-200 pl-3">
                  {staffColumns.map((col) => (
                    <span
                      key={col.id}
                      className="inline-flex items-center gap-1.5 font-semibold text-slate-700"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: col.palette.dot }}
                      />
                      {col.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* 4. DAY VIEW */}
          {viewMode === 'day' && (
            <Card noPadding className="clinic-cal-scroll overflow-x-auto">
              <div
                style={{
                  minWidth: `${Math.max(600, 88 + staffColumns.length * 240)}px`,
                }}
              >
                <div
                  className="sticky top-0 z-10 grid border-b border-slate-200/80 bg-slate-50"
                  style={{
                    gridTemplateColumns: `88px repeat(${staffColumns.length}, minmax(220px, 1fr))`,
                  }}
                >
                  <div className="flex items-center justify-end border-r border-slate-200/80 px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Time
                  </div>

                  {staffColumns.map((col) => (
                    <div
                      key={col.id}
                      className="flex items-center gap-2 border-r border-slate-200/80 px-4 py-3 last:border-r-0"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: col.palette.dot }}
                      />
                      <span className="truncate text-xs font-bold text-slate-900">
                        {col.name}
                      </span>
                    </div>
                  ))}
                </div>

                {loadingCal ? (
                  <p className="py-16 text-center text-xs font-medium text-slate-500">
                    Loading daily schedule...
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {TIMELINE_SLOTS.map((slot) => {
                      const isHourMark = slot.endsWith(':00');
                      const isLunchSlot = slot === '12:00' || slot === '12:30';
                      const slotAppts = groupedAppointments[selectedDate]?.[slot] || [];

                      return (
                        <div
                          key={slot}
                          className={`grid min-h-[56px] transition-colors ${
                            isLunchSlot ? 'bg-slate-50/70' : 'bg-[#FFFFFF]'
                          }`}
                          style={{
                            gridTemplateColumns: `88px repeat(${staffColumns.length}, minmax(220px, 1fr))`,
                          }}
                        >
                          <div className="flex items-start justify-end border-r border-slate-200/80 px-3 pt-2 select-none">
                            <span
                              className={`tabular-nums text-[11px] ${
                                isHourMark
                                  ? 'font-bold text-slate-700'
                                  : 'font-medium text-slate-400'
                              }`}
                            >
                              {formatSlotLabel12(slot)}
                            </span>
                          </div>

                          {staffColumns.map((col, colIdx) => {
                            const cellAppts = slotAppts.filter((a) => {
                              if (staffColumns.length === 1) return true;
                              if (a.dentist_id === col.id) return true;
                              if (!a.dentist_id && colIdx === 0) return true;
                              return false;
                            });

                            return (
                              <div
                                key={col.id}
                                onClick={() => {
                                  if (cellAppts.length === 0 && !isLunchSlot && slot !== '17:00') {
                                    handleOpenNewAppointment({
                                      date: selectedDate,
                                      time: slot,
                                      dentist_id: col.id,
                                    });
                                  }
                                }}
                                className="relative border-r border-slate-100 p-1.5 last:border-r-0 hover:bg-blue-50/20"
                              >
                                <div className="space-y-1.5">
                                  {cellAppts.map((appt) => {
                                    const pres = getBlockPresentation(appt);
                                    return (
                                      <div
                                        key={appt.id}
                                        style={pres.style}
                                        className={pres.className}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAppt(appt);
                                        }}
                                      >
                                        <p className="truncate font-bold leading-tight">
                                          {appt.displayPatient}
                                        </p>
                                        <p className="mt-0.5 truncate text-[11px] font-medium leading-tight opacity-90">
                                          {appt.displayReason} - {appt.displayShortTime}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* 5. WEEK VIEW */}
          {viewMode === 'week' && (
            <Card noPadding className="clinic-cal-scroll overflow-x-auto">
              <div className="min-w-[960px]">
                <div
                  className="sticky top-0 z-10 grid border-b border-slate-200/80 bg-slate-50"
                  style={{
                    gridTemplateColumns: '88px repeat(7, minmax(120px, 1fr))',
                  }}
                >
                  <div className="flex items-center justify-end border-r border-slate-200/80 px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Time
                  </div>

                  {weekDays.map((d) => (
                    <button
                      key={d.ymd}
                      type="button"
                      onClick={() => {
                        setSelectedDate(d.ymd);
                        setViewMode('day');
                      }}
                      className={`flex flex-col items-center justify-center border-r border-slate-200/80 px-2 py-2.5 last:border-r-0 transition-colors hover:bg-blue-50/40 cursor-pointer ${
                        d.isToday ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider ${
                          d.isToday ? 'text-blue-600' : 'text-slate-500'
                        }`}
                      >
                        {d.dayShort}
                      </span>
                      <span
                        className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          d.isToday
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                            : 'text-slate-800'
                        }`}
                      >
                        {d.dayNum}
                      </span>
                    </button>
                  ))}
                </div>

                {loadingCal ? (
                  <p className="py-16 text-center text-xs font-medium text-slate-500">
                    Loading weekly schedule...
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {TIMELINE_SLOTS.map((slot) => {
                      const isHourMark = slot.endsWith(':00');
                      const isLunchSlot = slot === '12:00' || slot === '12:30';

                      return (
                        <div
                          key={slot}
                          className={`grid min-h-[52px] ${
                            isLunchSlot ? 'bg-slate-50/70' : 'bg-[#FFFFFF]'
                          }`}
                          style={{
                            gridTemplateColumns: '88px repeat(7, minmax(120px, 1fr))',
                          }}
                        >
                          <div className="flex items-start justify-end border-r border-slate-200/80 px-3 pt-2 select-none">
                            <span
                              className={`tabular-nums text-[11px] ${
                                isHourMark
                                  ? 'font-bold text-slate-700'
                                  : 'font-medium text-slate-400'
                              }`}
                            >
                              {formatSlotLabel12(slot)}
                            </span>
                          </div>

                          {weekDays.map((d) => {
                            const daySlotAppts =
                              groupedAppointments[d.ymd]?.[slot] || [];

                            return (
                              <div
                                key={d.ymd}
                                className={`border-r border-slate-100 p-1 last:border-r-0 ${
                                  d.isToday ? 'bg-blue-50/10' : ''
                                }`}
                              >
                                <div className="space-y-1">
                                  {daySlotAppts.map((appt) => {
                                    const pres = getBlockPresentation(appt);
                                    return (
                                      <div
                                        key={appt.id}
                                        style={pres.style}
                                        className={pres.className}
                                        onClick={() => setSelectedAppt(appt)}
                                      >
                                        <p className="truncate font-bold leading-tight">
                                          {appt.displayPatient}
                                        </p>
                                        <p className="mt-0.5 truncate text-[10px] leading-tight opacity-90">
                                          {appt.displayReason} - {appt.displayShortTime}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* 6. MONTH VIEW */}
          {viewMode === 'month' && (
            <Card noPadding className="overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-50 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {WEEKDAYS_SHORT.map((w) => (
                  <div
                    key={w}
                    className="border-r border-slate-200/80 py-3 last:border-r-0"
                  >
                    {w}
                  </div>
                ))}
              </div>

              {loadingCal ? (
                <p className="py-16 text-center text-xs font-medium text-slate-500">
                  Loading monthly schedule...
                </p>
              ) : (
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                  {monthDays.map((cell) => {
                    const dayMap = groupedAppointments[cell.ymd] || {};
                    const allDayAppts = Object.values(dayMap).flat();

                    return (
                      <div
                        key={cell.ymd}
                        onClick={() => {
                          setSelectedDate(cell.ymd);
                          setViewMode('day');
                        }}
                        className={`min-h-[112px] p-2.5 transition-colors cursor-pointer hover:bg-blue-50/20 ${
                          cell.inMonth ? 'bg-[#FFFFFF]' : 'bg-slate-50/50 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              cell.isToday
                                ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/20'
                                : cell.inMonth
                                ? 'text-slate-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {cell.dayNum}
                          </span>

                          {allDayAppts.length > 0 && (
                            <Badge status="confirmed" className="!px-2 !py-0.2 !text-[10px]">
                              {allDayAppts.length}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-1.5 space-y-1">
                          {allDayAppts.slice(0, 3).map((appt) => {
                            const pres = getBlockPresentation(appt);
                            return (
                              <div
                                key={appt.id}
                                style={pres.style}
                                className={`${pres.className} !px-1.5 !py-0.5 !text-[10px]`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppt(appt);
                                }}
                              >
                                <p className="truncate font-semibold">
                                  {appt.displayShortTime} · {appt.displayPatient}
                                </p>
                              </div>
                            );
                          })}
                          {allDayAppts.length > 3 && (
                            <p className="pl-1 text-[10px] font-bold text-blue-600">
                              +{allDayAppts.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: ONLINE REQUESTS VIEW */}
      {/* =================================================================== */}
      {subTab === 'requests' && (
        <Card noPadding className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Incoming Patient Booking Requests
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Confirm, reschedule, or decline appointment requests submitted from the patient portal.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={loadOnlineRequests}>
              ↻ Refresh
            </Button>
          </div>

          {loadingReqs ? (
            <p className="p-10 text-center text-xs font-medium text-slate-500">
              Loading online booking requests...
            </p>
          ) : requests.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No online booking requests"
                description="When patients request appointments from the public portal, they will appear here."
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map((req) => {
                const isPending = req.status === 'pending';
                return (
                  <div
                    key={req.id}
                    className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge status={req.status}>
                          {req.status.toUpperCase()}
                        </Badge>
                        <span className="rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
                          {req.reference_no}
                        </span>
                      </div>
                      <p className="text-base font-bold text-slate-900">
                        {req.first_name} {req.last_name} ({req.patient_no})
                      </p>
                      <p className="text-xs font-semibold text-blue-600">
                        Requested Slot: {formatFriendlyDate(req.preferred_date, false)} at{' '}
                        {formatTime12(req.preferred_time)}
                      </p>
                      <p className="text-xs text-slate-600">
                        <strong>Services:</strong>{' '}
                        {Array.isArray(req.services)
                          ? req.services.join(', ')
                          : req.services}
                      </p>
                      {req.remarks && (
                        <p className="text-xs italic text-slate-500">&ldquo;{req.remarks}&rdquo;</p>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => {
                            setSelectedDentistId(dentists[0]?.id || '');
                            setConfirmModal(req);
                          }}
                        >
                          Confirm
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setReschedForm({
                              dentist_id: dentists[0]?.id || '',
                              date: req.preferred_date || todayStr,
                              time: req.preferred_time || '09:00',
                              reason: '',
                            });
                            setReschedModal(req);
                          }}
                        >
                          Reschedule
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => {
                            setDeclineReason('');
                            setDeclineModal(req);
                          }}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* =================================================================== */}
      {/* MODAL: + NEW APPOINTMENT */}
      {/* =================================================================== */}
      {newApptModalOpen && (
        <Modal
          title="New Appointment"
          subtitle="Schedule a patient appointment on the clinic calendar."
          onClose={() => setNewApptModalOpen(false)}
        >
          <form onSubmit={handleCreateAppointmentSubmit} noValidate className="space-y-5">
            {newApptError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
              >
                {newApptError}
              </div>
            )}

            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
              <InputField
                label="Filter Patient Directory"
                type="text"
                placeholder="Type patient name, chart no., or mobile..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />

              <InputField
                label={`Select Patient (${filteredPatients.length})`}
                as="select"
                required
                value={newApptForm.patient_id}
                onChange={(e) =>
                  setNewApptForm({ ...newApptForm, patient_id: e.target.value })
                }
              >
                <option value="">Choose a patient...</option>
                {filteredPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.last_name}, {p.first_name} ({p.patient_no})
                  </option>
                ))}
              </InputField>
            </div>

            <InputField
              label="Assigned Dentist"
              as="select"
              required
              value={newApptForm.dentist_id}
              onChange={(e) =>
                setNewApptForm({ ...newApptForm, dentist_id: e.target.value })
              }
            >
              <option value="">Select Dentist...</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}
                </option>
              ))}
            </InputField>

            <div className="grid gap-4 sm:grid-cols-3">
              <InputField
                label="Date"
                type="date"
                required
                value={newApptForm.date}
                onChange={(e) =>
                  setNewApptForm({ ...newApptForm, date: e.target.value })
                }
              />

              <InputField
                label="Time Slot"
                as="select"
                required
                value={newApptForm.time}
                onChange={(e) =>
                  setNewApptForm({ ...newApptForm, time: e.target.value })
                }
              >
                {CLINIC_SETTINGS.slots.map((s) => (
                  <option key={s} value={s}>
                    {formatTime12(s)}
                  </option>
                ))}
              </InputField>

              <InputField
                label="Duration"
                as="select"
                value={newApptForm.duration_min}
                onChange={(e) =>
                  setNewApptForm({
                    ...newApptForm,
                    duration_min: Number(e.target.value),
                  })
                }
              >
                <option value={30}>30 mins</option>
                <option value={60}>1 hour</option>
                <option value={90}>1 hr 30 mins</option>
                <option value={120}>2 hours</option>
              </InputField>
            </div>

            <InputField
              label="Reason / Procedure"
              type="text"
              required
              placeholder="e.g. Consultation, Oral Prophylaxis, Tooth Extraction"
              value={newApptForm.reason}
              onChange={(e) =>
                setNewApptForm({ ...newApptForm, reason: e.target.value })
              }
            />

            <InputField
              label="Clinical / Front Desk Notes (Optional)"
              as="textarea"
              rows={2}
              placeholder="Add any preparation or reminder notes..."
              value={newApptForm.notes}
              onChange={(e) =>
                setNewApptForm({ ...newApptForm, notes: e.target.value })
              }
            />

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setNewApptModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingNewAppt}>
                {savingNewAppt ? 'Scheduling...' : 'Save Appointment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: APPOINTMENT DETAILS & QUICK STATUS UPDATE */}
      {/* =================================================================== */}
      {selectedAppt && (
        <Modal
          title={selectedAppt.patient_name || 'Appointment Details'}
          subtitle={`${formatFriendlyDate(selectedAppt.appointment_date, true)} · ${formatTime12(
            selectedAppt.appointment_time
          )}`}
          onClose={() => setSelectedAppt(null)}
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Current Status:</span>
                <Badge status={selectedAppt.status}>{selectedAppt.status}</Badge>
              </div>
              <p>
                <strong className="text-slate-500">Dentist:</strong>{' '}
                <span className="font-bold text-slate-900">
                  Dr. {selectedAppt.dentist_name || 'Assigned Dentist'}
                </span>
              </p>
              <p>
                <strong className="text-slate-500">Reason:</strong>{' '}
                <span className="font-bold text-slate-900">
                  {selectedAppt.displayReason}
                </span>
              </p>
              {selectedAppt.notes && (
                <p>
                  <strong className="text-slate-500">Notes:</strong>{' '}
                  <span className="text-slate-800">{selectedAppt.notes}</span>
                </p>
              )}
            </div>

            <div>
              <span className={tokens.label}>Update Appointment Status</span>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {APPOINTMENT_STATUS_OPTIONS.map((st) => {
                  const isCurrent =
                    String(selectedAppt.status || '').toLowerCase() === st.id;
                  return (
                    <Button
                      key={st.id}
                      type="button"
                      variant={isCurrent ? 'primary' : 'secondary'}
                      disabled={updatingStatus}
                      onClick={() => handleUpdateApptStatus(st.id)}
                    >
                      {st.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedAppt(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* ONLINE REQUEST MODALS */}
      {/* =================================================================== */}
      {confirmModal && (
        <Modal
          title="Confirm Appointment Request"
          subtitle={`${confirmModal.first_name} ${confirmModal.last_name} · ${confirmModal.reference_no}`}
          onClose={() => setConfirmModal(null)}
        >
          <form onSubmit={handleConfirmRequest} className="space-y-5">
            <InputField
              label="Assign Dentist"
              as="select"
              required
              value={selectedDentistId}
              onChange={(e) => setSelectedDentistId(e.target.value)}
            >
              <option value="">Select Dentist</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}
                </option>
              ))}
            </InputField>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={processingReq}>
                {processingReq ? 'Confirming...' : 'Confirm Appointment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {reschedModal && (
        <Modal
          title="Reschedule & Confirm Request"
          subtitle={`${reschedModal.first_name} ${reschedModal.last_name} · ${reschedModal.reference_no}`}
          onClose={() => setReschedModal(null)}
        >
          <form onSubmit={handleRescheduleRequest} className="space-y-4">
            <InputField
              label="Assign Dentist"
              as="select"
              required
              value={reschedForm.dentist_id}
              onChange={(e) =>
                setReschedForm({ ...reschedForm, dentist_id: e.target.value })
              }
            >
              <option value="">Select Dentist</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}
                </option>
              ))}
            </InputField>

            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="New Date"
                type="date"
                required
                value={reschedForm.date}
                onChange={(e) =>
                  setReschedForm({ ...reschedForm, date: e.target.value })
                }
              />

              <InputField
                label="New Time"
                as="select"
                required
                value={reschedForm.time}
                onChange={(e) =>
                  setReschedForm({ ...reschedForm, time: e.target.value })
                }
              >
                {CLINIC_SETTINGS.slots.map((s) => (
                  <option key={s} value={s}>
                    {formatTime12(s)}
                  </option>
                ))}
              </InputField>
            </div>

            <InputField
              label="Note to Patient (Optional)"
              type="text"
              placeholder="Reason for rescheduling..."
              value={reschedForm.reason}
              onChange={(e) =>
                setReschedForm({ ...reschedForm, reason: e.target.value })
              }
            />

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReschedModal(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={processingReq}>
                {processingReq ? 'Saving...' : 'Reschedule & Confirm'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {declineModal && (
        <Modal
          title="Decline Appointment Request"
          subtitle={`${declineModal.first_name} ${declineModal.last_name} · ${declineModal.reference_no}`}
          onClose={() => setDeclineModal(null)}
        >
          <form onSubmit={handleDeclineRequest} className="space-y-4">
            <InputField
              label="Reason for Declining"
              as="textarea"
              rows={3}
              required
              placeholder="Explain why this slot cannot be accommodated..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
            />

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeclineModal(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={processingReq}
              >
                {processingReq ? 'Declining...' : 'Decline Request'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}