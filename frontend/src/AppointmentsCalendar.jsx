import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { todayManila } from './config';

// Half-hour timeline slots from 8:00 AM to 5:00 PM
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

// Dentist Color Palette (Used when "Colour by: Dentist" is active)
const DENTIST_PALETTE = [
  { bg: '#eff6ff', border: '#93c5fd', accent: '#2563eb', text: '#1e3a8a', dot: '#2563eb' }, // Blue
  { bg: '#f0fdf4', border: '#86efac', accent: '#16a34a', text: '#14532d', dot: '#16a34a' }, // Green
  { bg: '#faf5ff', border: '#d8b4fe', accent: '#9333ea', text: '#581c87', dot: '#9333ea' }, // Purple
  { bg: '#fff7ed', border: '#fdba74', accent: '#ea580c', text: '#7c2d12', dot: '#ea580c' }, // Orange
  { bg: '#f0fdfa', border: '#5eead4', accent: '#0d9488', text: '#134e4a', dot: '#0d9488' }, // Teal
  { bg: '#fdf2f8', border: '#f9a8d4', accent: '#db2777', text: '#831843', dot: '#db2777' }, // Pink
];

// Date Helpers (Pure YYYY-MM-DD math so timezone offsets never shift dates)
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
  const day = dt.getDay(); // 0 = Sun .. 6 = Sat
  dt.setDate(dt.getDate() - day);
  return toYMD(dt);
}

function getMonthRange(dateStr) {
  const dt = parseYMD(dateStr);
  const firstDay = new Date(dt.getFullYear(), dt.getMonth(), 1);
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);

  // Pad to Sunday start and Saturday end for 6-week calendar grid
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

// Formats "Juan Dela Cruz" -> "dela cruz, juan" (matching reference screenshot style "al, kean")
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
  const cleaned = String(reason || '')
    .replace(/^Request #REF-[0-9]{8}-[A-Z0-9]{4}( \(Rescheduled\))?:\s*/i, '')
    .trim();
  return cleaned || 'Consultation';
}

export default function AppointmentsCalendar({ onSelectAppointment }) {
  const todayStr = todayManila();

  // 1. HEADER CONTROLS STATE
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week' | 'month'
  const [colourBy, setColourBy] = useState('status'); // 'status' | 'dentist'

  // Data State
  const [dentists, setDentists] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Compute query date window based on active viewMode
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

  // Fetch Dentists & Appointments from existing backend routes
  const loadCalendarData = async () => {
    setLoading(true);
    setError('');
    try {
      const [dentistList, apptList] = await Promise.all([
        api('/dentists'),
        api(`/appointments?from=${dateWindow.from}&to=${dateWindow.to}`),
      ]);
      setDentists(Array.isArray(dentistList) ? dentistList : []);
      setAppointments(Array.isArray(apptList) ? apptList : []);
    } catch (err) {
      setError(err.message || 'Failed to load appointments calendar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, [dateWindow.from, dateWindow.to]);

  // Ensure at least one dentist column is rendered in Day View
  const staffColumns = useMemo(() => {
    if (dentists.length > 0) {
      return dentists.map((d, idx) => ({
        id: d.id,
        name: `Dr. ${d.first_name || ''} ${d.last_name || ''}`.trim(),
        initials:
          ((d.first_name?.[0] || '') + (d.last_name?.[0] || '')).toUpperCase() || 'DR',
        palette: DENTIST_PALETTE[idx % DENTIST_PALETTE.length],
      }));
    }
    return [
      {
        id: 'default-dentist',
        name: 'Dr. Demo Dentist',
        initials: 'DD',
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

  // Step Date (< or >)
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

  // Format Header Navigation Label (e.g. "Today · Sun, Oct 25")
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

  // Group appointments by Date -> Time Slot (rounded to nearest 30m slot) -> Dentist ID
  const groupedAppointments = useMemo(() => {
    const byDate = {};

    appointments.forEach((appt) => {
      const dStr = appt.appointment_date || String(appt.starts_at || '').slice(0, 10);
      const rawTime = appt.appointment_time || '09:00';
      const [hh, mm] = rawTime.split(':').map(Number);
      const slotMin = mm >= 30 ? '30' : '00';
      const slotKey = `${String(hh).padStart(2, '0')}:${slotMin}`;

      // Compute duration in 30-min blocks so 60-min appointments span 2 rows cleanly
      let durationSlots = 1;
      if (appt.starts_at && appt.ends_at) {
        const diffMins = Math.round(
          (new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000
        );
        if (diffMins >= 45) durationSlots = Math.min(4, Math.round(diffMins / 30));
      }

      if (!byDate[dStr]) byDate[dStr] = {};
      if (!byDate[dStr][slotKey]) byDate[dStr][slotKey] = [];

      byDate[dStr][slotKey].push({
        ...appt,
        slotKey,
        durationSlots,
        statusKey: normalizeStatusKey(appt.status),
        displayPatient: formatPatientCardName(appt.patient_name),
        displayReason: cleanReasonText(appt.reason),
        displayShortTime: formatShortTime(rawTime),
      });
    });

    return byDate;
  }, [appointments]);

  // Helper to get block inline style & class based on "Colour by: Status" vs "Colour by: Dentist"
  const getBlockPresentation = (appt) => {
    const statusKey = appt.statusKey;

    if (colourBy === 'dentist' && statusKey !== 'cancelled') {
      const pal = dentistColorMap[appt.dentist_id] || DENTIST_PALETTE[0];
      return {
        className: 'rounded-lg px-2.5 py-1.5 text-xs shadow-2xs transition-all cursor-pointer hover:brightness-95',
        style: {
          backgroundColor: pal.bg,
          border: `1px solid ${pal.border}`,
          borderLeft: `4px solid ${pal.accent}`,
          color: pal.text,
        },
      };
    }

    return {
      className: `appt-block-${statusKey} rounded-lg px-2.5 py-1.5 text-xs shadow-2xs transition-all cursor-pointer hover:brightness-95`,
      style: {},
    };
  };

  // Week View 7 Days Array (Sun to Sat)
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

  // Month View 42 Days Grid
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

  return (
    <div className="space-y-4">
      {/* Embedded CSS for Timeline Grid & Colored Status Blocks */}
      <style>{`
        .clinic-cal-scroll::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        .clinic-cal-scroll::-webkit-scrollbar-track {
          background: #f8fafc;
        }
        .clinic-cal-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .appt-block-unconfirmed {
          background-color: #ffffff;
          border: 1.5px solid #94a3b8;
          border-left: 4px solid #64748b;
          color: #334155;
        }
        .appt-block-confirmed {
          background-color: #eff6ff;
          border: 1px solid #93c5fd;
          border-left: 4px solid #2563eb;
          color: #1e3a8a;
        }
        .appt-block-arrived {
          background-color: #fef2f2;
          border: 1px solid #fca5a5;
          border-left: 4px solid #dc2626;
          color: #7f1d1d;
        }
        .appt-block-in_chair {
          background-color: #f5f3ff;
          border: 1px solid #c4b5fd;
          border-left: 4px solid #7c3aed;
          color: #4c1d95;
        }
        .appt-block-completed {
          background-color: #ecfdf5;
          border: 1px solid #6ee7b7;
          border-left: 4px solid #10b981;
          color: #064e3b;
        }
        .appt-block-cancelled {
          background-color: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-left: 4px solid #94a3b8;
          color: #94a3b8;
          text-decoration: line-through;
        }
      `}</style>

      {/* =================================================================== */}
      {/* 1. HEADER CONTROLS BAR */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Top Left: Date Navigation ("< Today · Sun, Oct 25 >") */}
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white shadow-2xs">
            <button
              type="button"
              onClick={() => handleStepDate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-l-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
              aria-label="Previous period"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className="border-x border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
              title="Click to jump to Today"
            >
              {navDateLabel}
            </button>
            <button
              type="button"
              onClick={() => handleStepDate(1)}
              className="flex h-9 w-9 items-center justify-center rounded-r-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
              aria-label="Next period"
            >
              ›
            </button>
          </div>

          {/* Next to it: View Toggles ("Day", "Week", "Month") */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
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
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          {/* Next to it: "Colour by" Dropdown (Dentist or Status) */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
            <span className="text-xs font-semibold text-slate-500">Colour by</span>
            <select
              value={colourBy}
              onChange={(e) => setColourBy(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="status">Status</option>
              <option value="dentist">Dentist</option>
            </select>
          </div>
        </div>

        {/* Right Side: Quick Date Picker & Refresh */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-blue-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={loadCalendarData}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. THE LEGEND ROW */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Status
          </span>

          {/* Unconfirmed (White/Grey outline) */}
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <span className="h-3 w-3 rounded-xs border-2 border-slate-400 bg-white" />
            Unconfirmed
          </span>

          {/* Confirmed (Blue) */}
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <span className="h-3 w-3 rounded-xs bg-blue-600" />
            Confirmed
          </span>

          {/* Arrived (Red) */}
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <span className="h-3 w-3 rounded-xs bg-red-600" />
            Arrived
          </span>

          {/* In Chair (Purple) */}
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <span className="h-3 w-3 rounded-xs bg-violet-600" />
            In Chair
          </span>

          {/* Completed (Green) */}
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <span className="h-3 w-3 rounded-xs bg-emerald-500" />
            Completed
          </span>

          {/* Cancelled/No-show (Grey text) */}
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-400 line-through">
            <span className="h-3 w-3 rounded-xs border border-dashed border-slate-300 bg-slate-100" />
            Cancelled/No-show
          </span>
        </div>

        {/* Dentist Key when "Colour by: Dentist" is selected */}
        {colourBy === 'dentist' && (
          <div className="flex flex-wrap items-center gap-3 border-l border-slate-200 pl-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Dentists
            </span>
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

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700"
        >
          {error}
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. DAY VIEW (Vertical Timeline + Split Staff Columns) */}
      {/* =================================================================== */}
      {viewMode === 'day' && (
        <div className="clinic-cal-scroll overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div
            style={{
              minWidth: `${Math.max(640, 88 + staffColumns.length * 240)}px`,
            }}
          >
            {/* Top Staff Column Headers */}
            <div
              className="grid border-b border-slate-200 bg-slate-50/90 sticky top-0 z-10"
              style={{
                gridTemplateColumns: `88px repeat(${staffColumns.length}, minmax(220px, 1fr))`,
              }}
            >
              <div className="flex items-center justify-center border-r border-slate-200 px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Time
              </div>

              {staffColumns.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between border-r border-slate-200 px-4 py-3 last:border-r-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      style={{
                        backgroundColor: col.palette.bg,
                        color: col.palette.text,
                        borderColor: col.palette.border,
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold"
                    >
                      {col.initials}
                    </span>
                    <span className="truncate text-xs font-extrabold text-slate-900">
                      {col.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Vertical Timeline Rows (8:00 AM to 5:00 PM every 30 mins) */}
            {loading ? (
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
                        isLunchSlot ? 'bg-slate-50/70' : 'bg-white'
                      }`}
                      style={{
                        gridTemplateColumns: `88px repeat(${staffColumns.length}, minmax(220px, 1fr))`,
                      }}
                    >
                      {/* Left Column: Time Label */}
                      <div className="flex items-start justify-end border-r border-slate-200 px-3 pt-2 select-none">
                        <span
                          className={`text-[11px] ${
                            isHourMark
                              ? 'font-bold text-slate-700'
                              : 'font-medium text-slate-400'
                          }`}
                        >
                          {formatSlotLabel12(slot)}
                        </span>
                      </div>

                      {/* Right Columns: 1 Column Per Dentist */}
                      {staffColumns.map((col, colIdx) => {
                        const cellAppts = slotAppts.filter((a) => {
                          if (staffColumns.length === 1) return true;
                          if (a.dentist_id === col.id) return true;
                          // Fallback for unassigned appointments: place in first column
                          if (!a.dentist_id && colIdx === 0) return true;
                          return false;
                        });

                        return (
                          <div
                            key={col.id}
                            className="relative border-r border-slate-100 p-1.5 last:border-r-0 hover:bg-blue-50/20"
                          >
                            {isLunchSlot && cellAppts.length === 0 && (
                              <span className="pointer-events-none block pt-2 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-300">
                                Lunch Break
                              </span>
                            )}

                            <div className="space-y-1.5">
                              {cellAppts.map((appt) => {
                                const pres = getBlockPresentation(appt);
                                return (
                                  <div
                                    key={appt.id}
                                    style={pres.style}
                                    className={pres.className}
                                    onClick={() => onSelectAppointment?.(appt)}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-extrabold truncate">
                                        {appt.displayPatient}
                                      </span>
                                      {appt.reference_no && (
                                        <span className="shrink-0 rounded bg-white/70 px-1 py-0.2 font-mono text-[9px] font-bold">
                                          {appt.reference_no}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 truncate text-[11px] opacity-90 font-medium">
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
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. WEEK VIEW (7 Horizontal Columns: Sun to Sat) */}
      {/* =================================================================== */}
      {viewMode === 'week' && (
        <div className="clinic-cal-scroll overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="min-w-[980px]">
            {/* Top Row: Time Header + 7 Day Headers (Sun to Sat) */}
            <div
              className="grid border-b border-slate-200 bg-slate-50/90 sticky top-0 z-10"
              style={{
                gridTemplateColumns: '84px repeat(7, minmax(125px, 1fr))',
              }}
            >
              <div className="flex items-center justify-center border-r border-slate-200 px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
                  className={`flex flex-col items-center justify-center border-r border-slate-200 px-2 py-2.5 last:border-r-0 transition-colors hover:bg-blue-50/40 ${
                    d.isToday ? 'bg-blue-50/60' : ''
                  }`}
                  title={`Open Day view for ${d.dayShort}, ${d.monthShort} ${d.dayNum}`}
                >
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      d.isToday ? 'text-blue-600' : 'text-slate-500'
                    }`}
                  >
                    {d.dayShort}
                  </span>
                  <span
                    className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${
                      d.isToday
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-900'
                    }`}
                  >
                    {d.dayNum}
                  </span>
                </button>
              ))}
            </div>

            {/* Week Timeline Rows */}
            {loading ? (
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
                        isLunchSlot ? 'bg-slate-50/70' : 'bg-white'
                      }`}
                      style={{
                        gridTemplateColumns: '84px repeat(7, minmax(125px, 1fr))',
                      }}
                    >
                      {/* Time Column */}
                      <div className="flex items-start justify-end border-r border-slate-200 px-2.5 pt-2 select-none">
                        <span
                          className={`text-[11px] ${
                            isHourMark
                              ? 'font-bold text-slate-700'
                              : 'font-medium text-slate-400'
                          }`}
                        >
                          {formatSlotLabel12(slot)}
                        </span>
                      </div>

                      {/* 7 Day Cells */}
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
                                    onClick={() => onSelectAppointment?.(appt)}
                                  >
                                    <p className="font-extrabold truncate leading-tight">
                                      {appt.displayPatient}
                                    </p>
                                    <p className="truncate text-[10px] opacity-90 leading-tight mt-0.5">
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
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. MONTH VIEW */}
      {/* =================================================================== */}
      {viewMode === 'month' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {WEEKDAYS_SHORT.map((w) => (
              <div key={w} className="border-r border-slate-200 py-2.5 last:border-r-0">
                {w}
              </div>
            ))}
          </div>

          {loading ? (
            <p className="py-16 text-center text-xs font-medium text-slate-500">
              Loading monthly schedule...
            </p>
          ) : (
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
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
                    className={`min-h-[110px] p-2 transition-colors cursor-pointer hover:bg-blue-50/30 ${
                      cell.inMonth ? 'bg-white' : 'bg-slate-50/60 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          cell.isToday
                            ? 'bg-blue-600 text-white'
                            : cell.inMonth
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {allDayAppts.length > 0 && (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                          {allDayAppts.length}
                        </span>
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
                          >
                            <p className="truncate font-bold">
                              {appt.displayShortTime} · {appt.displayPatient}
                            </p>
                          </div>
                        );
                      })}
                      {allDayAppts.length > 3 && (
                        <p className="text-[10px] font-bold text-blue-600 pl-1">
                          +{allDayAppts.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}