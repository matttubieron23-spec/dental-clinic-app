import { useEffect, useState } from 'react';
import { patientApi } from './api';
import {
  CLINIC_SETTINGS,
  formatFriendlyDate,
  formatTime12,
  todayManila,
} from './config';
import { BrandLogo, CLINIC_INFO } from './PublicSite';
import { Badge, Button, Card, Icon, InputField, tokens } from './ui';

const BOOKING_SERVICES = [
  'Consultation & Dental Checkup',
  'Oral Prophylaxis (Cleaning)',
  'Tooth-Colored Filling (Pasta)',
  'Tooth Extraction (Bunot)',
  'Wisdom Tooth Consultation',
  'Orthodontic Braces / Adjustment',
  'Crowns, Bridges or Dentures',
  'Teeth Whitening / Cosmetic',
  'Toothache / Dental Emergency',
];

const REFERRAL_SOURCES = [
  'Walk-in / Passed by Landco Business Park',
  'Facebook / Social Media',
  'Google Search / Google Maps',
  'Referred by Family or Friend',
  'Existing Patient',
];

export default function BookAppointment({
  patientUser,
  onBackToPublic,
  onGoDashboard,
}) {
  const todayStr = todayManila();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState([
    'Consultation & Dental Checkup',
  ]);
  const [preferredDate, setPreferredDate] = useState(todayStr);
  const [preferredTime, setPreferredTime] = useState('');
  const [referralSource, setReferralSource] = useState(REFERRAL_SOURCES[0]);
  const [remarks, setRemarks] = useState('');

  const [availableSlots, setAvailableSlots] = useState([]);
  const [isClosedSunday, setIsClosedSunday] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedRequest, setSubmittedRequest] = useState(null);

  useEffect(() => {
    if (!preferredDate) {
      setAvailableSlots([]);
      setPreferredTime('');
      setIsClosedSunday(false);
      return;
    }

    const [y, m, d] = preferredDate.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    if (dt.getDay() === 0) {
      setIsClosedSunday(true);
      setAvailableSlots([]);
      setPreferredTime('');
      return;
    }

    let active = true;
    setLoadingSlots(true);
    setIsClosedSunday(false);
    setPreferredTime('');

    patientApi(`/patient/appointments/available-slots?date=${preferredDate}`)
      .then((res) => {
        if (!active) return;
        const closed = Boolean(res?.is_closed);
        const slots = Array.isArray(res?.available_slots) ? res.available_slots : [];
        setIsClosedSunday(closed);
        setAvailableSlots(slots);
        if (slots.length > 0) {
          setPreferredTime(slots[0]);
        }
      })
      .catch((err) => {
        if (active) setError(err.message || 'Failed to check available time slots.');
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [preferredDate]);

  const toggleService = (serviceName) => {
    setError('');
    setSelectedServices((prev) =>
      prev.includes(serviceName)
        ? prev.filter((s) => s !== serviceName)
        : [...prev, serviceName]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (selectedServices.length === 0) {
      setError('Please select at least one dental service or reason for visit.');
      return;
    }
    if (!preferredDate) {
      setError('Please select a preferred appointment date.');
      return;
    }
    if (isClosedSunday) {
      setError('Smile Avenue Dental Clinic is closed on Sundays. Please pick Monday through Saturday.');
      return;
    }
    if (!preferredTime) {
      setError('Please select an available 30-minute time slot.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await patientApi('/patient/appointments/request', {
        method: 'POST',
        body: {
          services: selectedServices,
          preferred_date: preferredDate,
          preferred_time: preferredTime,
          referral_source: referralSource,
          remarks: remarks.trim() || null,
        },
      });
      setSubmittedRequest(res.request);
    } catch (err) {
      setError(err.message || 'Failed to submit appointment request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900">
      {/* Top Bar with Mobile Hamburger Menu */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onBackToPublic}
            className="flex min-w-0 items-center gap-3 cursor-pointer"
          >
            <BrandLogo />
            <div className="min-w-0 text-left">
              <span className="block truncate font-bold tracking-tight text-slate-900">
                {CLINIC_INFO.name}
              </span>
              <span className="block truncate text-xs font-medium text-blue-600">
                Online Appointment Booking
              </span>
            </div>
          </button>

          {/* Desktop Buttons (Soft Secondary Fill instead of Dark Outlines) */}
          <div className="hidden items-center gap-2.5 sm:flex">
            <Button
              type="button"
              variant="secondary"
              onClick={onBackToPublic}
            >
              ← Public Site
            </Button>
            {patientUser && (
              <Button
                type="button"
                variant="secondary"
                onClick={onGoDashboard}
              >
                My Portal
              </Button>
            )}
          </div>

          {/* Mobile Hamburger Trigger */}
          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 sm:hidden cursor-pointer"
            aria-label="Toggle booking navigation"
          >
            <Icon name={mobileNavOpen ? 'close' : 'menu'} className="h-5 w-5" />
          </button>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 shadow-lg sm:hidden">
            <div className="flex flex-col gap-2">
              {patientUser && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setMobileNavOpen(false);
                    onGoDashboard?.();
                  }}
                  className="w-full"
                >
                  Open My Portal
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMobileNavOpen(false);
                  onBackToPublic?.();
                }}
                className="w-full"
              >
                ← Back to Public Website
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        {submittedRequest ? (
          <Card className="p-7 sm:p-10 space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white shadow-sm shadow-emerald-600/25">
              ✓
            </div>

            <div className="space-y-2">
              <Badge status="pending">Pending Clinic Confirmation</Badge>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Appointment Request Received!
              </h1>
              <p className="mx-auto max-w-md text-sm font-medium text-slate-500">
                Our front desk team will review your requested slot and assign an available dentist.
              </p>
            </div>

            <div className="mx-auto max-w-md rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 text-left text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                <span className="font-semibold text-slate-500">Reference No.</span>
                <span className="font-mono text-sm font-bold text-blue-600">
                  {submittedRequest.reference_no}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Requested Date:</span>
                <span className="font-bold text-slate-900">
                  {formatFriendlyDate(submittedRequest.preferred_date, true)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Requested Time:</span>
                <span className="font-bold text-slate-900">
                  {formatTime12(submittedRequest.preferred_time)}
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-500 block">Selected Services:</span>
                <span className="mt-0.5 block font-bold text-slate-900">
                  {(submittedRequest.services || []).join(', ')}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSubmittedRequest(null);
                  setRemarks('');
                }}
              >
                Book Another Slot
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={onGoDashboard}
              >
                Go to My Patient Portal →
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 sm:p-9">
            <div className="border-b border-slate-100 pb-5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Request a Dental Appointment
              </h1>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Clinic Hours: {CLINIC_SETTINGS.hours} (Lunch break 12:00 PM – 1:00 PM). Closed on Sundays.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-8">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
                >
                  {error}
                </div>
              )}

              {/* =========================================================== */}
              {/* STEP 1: SELECT DENTAL SERVICES (Clean Tactile Pills) */}
              {/* =========================================================== */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    1
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">
                    Select Reason for Visit / Dental Services <span className="text-red-500">*</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {BOOKING_SERVICES.map((svc) => {
                    const checked = selectedServices.includes(svc);
                    return (
                      <button
                        key={svc}
                        type="button"
                        onClick={() => toggleService(svc)}
                        className={`flex min-h-[46px] items-center justify-between rounded-xl border px-4 py-2.5 text-left text-xs font-semibold transition-all cursor-pointer ${
                          checked
                            ? 'border-blue-600 bg-blue-50/70 text-blue-950 shadow-2xs ring-2 ring-blue-500/15'
                            : 'border-slate-200/90 bg-slate-50/60 text-slate-700 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <span>{svc}</span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                            checked
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-300 bg-white text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* =========================================================== */}
              {/* STEP 2: PREFERRED DATE & 30-MINUTE TIME SLOT */}
              {/* =========================================================== */}
              <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 sm:p-6">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    2
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">
                    Choose Your Preferred Date &amp; Time Slot
                  </h2>
                </div>

                <InputField
                  label="Preferred Date (Monday – Saturday)"
                  type="date"
                  required
                  min={todayStr}
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  error={
                    isClosedSunday
                      ? 'Smile Avenue Dental Clinic is closed on Sundays. Please choose Monday to Saturday.'
                      : undefined
                  }
                />

                <div>
                  <label className={tokens.label}>
                    Available 30-Minute Time Slots <span className="text-red-500">*</span>
                  </label>

                  {loadingSlots ? (
                    <p className="py-4 text-xs font-medium text-slate-500">
                      Checking dentist availability...
                    </p>
                  ) : isClosedSunday ? (
                    <p className="py-2 text-xs font-semibold text-red-600">
                      No slots available on Sundays.
                    </p>
                  ) : availableSlots.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs font-medium text-amber-900">
                      All slots for this date are currently booked or have passed. Please select another date above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                      {availableSlots.map((slot) => {
                        const active = preferredTime === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setPreferredTime(slot)}
                            className={`h-[42px] rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                              active
                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                                : 'border-slate-200/90 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                            }`}
                          >
                            {formatTime12(slot)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* =========================================================== */}
              {/* STEP 3: ADDITIONAL NOTES */}
              {/* =========================================================== */}
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    3
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">
                    Additional Details
                  </h2>
                </div>

                <InputField
                  label="How did you hear about Smile Avenue?"
                  as="select"
                  value={referralSource}
                  onChange={(e) => setReferralSource(e.target.value)}
                >
                  {REFERRAL_SOURCES.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </InputField>

                <InputField
                  label="Additional Remarks / Dental Concerns (Optional)"
                  as="textarea"
                  rows={3}
                  placeholder="Let our dentist know if you have tooth pain, sensitivity, or specific requests..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onBackToPublic}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting || isClosedSunday || !preferredTime}
                >
                  {submitting ? 'Submitting Request...' : 'Submit Appointment Request'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </main>
    </div>
  );
}