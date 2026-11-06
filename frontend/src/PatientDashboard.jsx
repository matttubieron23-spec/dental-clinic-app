import { useEffect, useRef, useState } from 'react';
import { patientApi, getPatientUser, setPatientSession, getPatientToken } from './api';
import {
  CLINIC_SETTINGS,
  todayManila,
  formatFriendlyDate,
  formatTime12,
  capitalize,
  formatCleanAddress,
} from './config';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InputField,
  Modal,
  Tabs,
  tokens,
} from './ui';

const QUESTIONS = [
  { id: 'good_health', label: 'Are you in good health?' },
  { id: 'medical_treatment', label: 'Are you currently undergoing medical treatment?' },
  { id: 'serious_illness', label: 'Have you ever had a serious illness or surgical operation?' },
  { id: 'hospitalized', label: 'Have you ever been hospitalized?' },
  { id: 'taking_medication', label: 'Are you taking any prescription or non-prescription medication?' },
  { id: 'tobacco', label: 'Do you use tobacco products?' },
  { id: 'alcohol', label: 'Do you drink alcoholic beverages?' },
  { id: 'dangerous_drugs', label: 'Have you ever used recreational or dangerous drugs?' },
  { id: 'allergies_exist', label: 'Are you allergic to anything (food, drugs, latex, penicillin)?' },
];

const COMMON_CONDITIONS = [
  'High Blood Pressure',
  'Low Blood Pressure',
  'Diabetes',
  'Heart Disease',
  'Heart Murmur',
  'Asthma',
  'Bleeding Problems',
  'Hepatitis / Liver Disease',
  'Kidney Disease',
  'Thyroid Problem',
  'Epilepsy / Seizures',
  'Rheumatic Fever',
];

const CORRECTION_FIELDS = [
  { id: 'first_name', label: 'First Name' },
  { id: 'middle_name', label: 'Middle Name' },
  { id: 'last_name', label: 'Last Name' },
  { id: 'birth_date', label: 'Date of Birth' },
  { id: 'sex', label: 'Gender' },
];

const toTitleCase = (str = '') =>
  String(str)
    .trim()
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

const isPhilippinePhone = (p = '') =>
  /^(09\d{9}|\+639\d{9}|639\d{9})$/.test(String(p).replace(/[\s\-()]/g, ''));

function formatCorrectionValue(field, value) {
  if (!value) return 'None';
  if (field === 'birth_date') return formatFriendlyDate(value, false);
  if (field === 'sex') return capitalize(value);
  return value;
}

// ============================================================================
// LEAVE A REVIEW SECTION COMPONENT
// ============================================================================
function PatientReviewSection() {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    patientApi('/patient/reviews/me')
      .then((res) => {
        if (!active) return;
        if (res?.review) {
          setExistingReview(res.review);
          setSubmitted(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!rating || rating < 1 || rating > 5) {
      setError('Please select a star rating between 1 and 5.');
      return;
    }
    if (!reviewText.trim() || reviewText.trim().length < 5) {
      setError('Please write a short review (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await patientApi('/patient/reviews', {
        method: 'POST',
        body: {
          rating,
          review_text: reviewText.trim(),
        },
      });
      setExistingReview(res.review);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="p-6 sm:p-8 space-y-5">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-base font-bold text-slate-900">Leave a Clinic Review</h2>
        <p className="mt-1 text-xs font-medium text-slate-500">
          Share your experience at Smile Avenue Dental Clinic. For your privacy, your name is automatically masked on our public website (e.g., &ldquo;J**e&rdquo;).
        </p>
      </div>

      {submitted ? (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center"
        >
          <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 font-bold text-white shadow-xs">
            ✓
          </div>
          <p className="text-base font-bold text-emerald-950">
            Thank you for your review!
          </p>
          {existingReview && (
            <div className="mt-2 space-y-1">
              <div className="flex justify-center gap-1 text-lg text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star}>
                    {star <= existingReview.rating ? '★' : '☆'}
                  </span>
                ))}
              </div>
              <p className="text-xs font-medium italic text-emerald-900">
                &ldquo;{existingReview.review_text}&rdquo;
              </p>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label className={tokens.label}>
              Your Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`Rate ${star} out of 5 stars`}
                    className={`cursor-pointer text-2xl transition-transform hover:scale-110 focus:outline-none ${
                      active ? 'text-amber-400' : 'text-slate-300'
                    }`}
                  >
                    ★
                  </button>
                );
              })}
              <span className="ml-2 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {rating} / 5 Stars
              </span>
            </div>
          </div>

          <InputField
            label="Your Review"
            as="textarea"
            rows={3}
            maxLength={600}
            required
            placeholder="Tell us about your dental visit at Smile Avenue..."
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
          />

          <div className="flex justify-end pt-1">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

// ============================================================================
// MAIN PATIENT DASHBOARD COMPONENT
// ============================================================================
export default function PatientDashboard({ patientUser, onGoBook }) {
  const [tab, setTab] = useState(() => {
    const saved = sessionStorage.getItem('portal_tab');
    if (saved) {
      sessionStorage.removeItem('portal_tab');
      return saved;
    }
    return 'upcoming';
  });

  const [appts, setAppts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [profile, setProfile] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // My History State
  const [historySubTab, setHistorySubTab] = useState('clinical'); // 'clinical' | 'financial'
  const [clinicalHistory, setClinicalHistory] = useState([]);
  const [financialHistory, setFinancialHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const editorRef = useRef(null);

  // Profile & Medical History Edit States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingMedical, setIsEditingMedical] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [medicalForm, setMedicalForm] = useState({ answers: {}, selected_conditions: [] });

  // Identity Correction Request Modal State
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [corrForm, setCorrForm] = useState({
    field_name: 'first_name',
    new_value: '',
    reason: '',
  });
  const [corrErrors, setCorrErrors] = useState({});

  // Cancel & Reschedule Modals
  const [cancelModal, setCancelModal] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [rDate, setRDate] = useState('');
  const [rTime, setRTime] = useState('');
  const [rSlots, setRSlots] = useState([]);
  const [rClosed, setRClosed] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const loadAll = async () => {
    setLoadingInitial(true);
    try {
      const [aData, rData, pData, cData] = await Promise.all([
        patientApi('/patient/appointments'),
        patientApi('/patient/appointments/requests'),
        patientApi('/patient/me'),
        patientApi('/patient/identity-corrections'),
      ]);
      setAppts(aData || []);
      setRequests(rData || []);
      setProfile(pData || null);
      setCorrections(cData || []);

      const storedUser = getPatientUser();
      const token = getPatientToken();
      if (
        pData &&
        storedUser &&
        token &&
        (storedUser.first_name !== pData.first_name || storedUser.last_name !== pData.last_name)
      ) {
        setPatientSession(token, {
          ...storedUser,
          first_name: pData.first_name,
          middle_name: pData.middle_name,
          last_name: pData.last_name,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingInitial(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await patientApi('/patient/me/history');
      setClinicalHistory(Array.isArray(res?.clinical) ? res.clinical : []);
      setFinancialHistory(Array.isArray(res?.financial) ? res.financial : []);
    } catch (err) {
      setError(err.message || 'Failed to load your history records.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (tab === 'records') {
      loadHistory();
    }
  }, [tab]);

  useEffect(() => {
    if (!rDate) {
      setRSlots([]);
      setRTime('');
      setRClosed(false);
      return;
    }
    const [y, m, d] = rDate.split('-').map(Number);
    if (new Date(y, m - 1, d).getDay() === 0) {
      setRClosed(true);
      setRSlots([]);
      setRTime('');
      return;
    }
    setLoadingAction(true);
    setRClosed(false);
    setRTime('');
    patientApi(`/patient/appointments/available-slots?date=${rDate}`)
      .then((res) => {
        setRClosed(Boolean(res.is_closed));
        setRSlots(res.available_slots || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingAction(false));
  }, [rDate]);

  const now = new Date();
  const upcomingAppts = appts.filter(
    (a) => new Date(a.starts_at) >= now && !['cancelled', 'completed', 'no_show'].includes(a.status)
  );
  const pastAppts = appts.filter(
    (a) => new Date(a.starts_at) < now || ['cancelled', 'completed', 'no_show'].includes(a.status)
  );
  const pendingReqs = requests.filter((r) => r.status === 'pending');
  const historyReqs = requests.filter((r) => ['declined', 'cancelled'].includes(r.status));

  const checkMoreThan24Hours = (startsAt) =>
    new Date(startsAt).getTime() - Date.now() > 24 * 60 * 60 * 1000;

  const calculateAge = (bdate) => {
    if (!bdate) return null;
    const [y, m, d] = String(bdate).slice(0, 10).split('-').map(Number);
    const birth = new Date(y, m - 1, d);
    let age = now.getFullYear() - birth.getFullYear();
    const mo = now.getMonth() - birth.getMonth();
    if (mo < 0 || (mo === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };
  const isMinor = profile?.birth_date ? calculateAge(profile.birth_date) < 18 : false;

  const pendingByField = corrections.reduce((acc, c) => {
    if (c.status === 'pending') acc[c.field_name] = c;
    return acc;
  }, {});

  const hasPendingNameCorrection = Boolean(
    pendingByField.first_name || pendingByField.middle_name || pendingByField.last_name
  );

  const scrollToFirstError = () => {
    setTimeout(() => {
      const el = editorRef.current?.querySelector('[data-error="true"]');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.querySelector('input, select, textarea')?.focus();
      }
    }, 50);
  };

  // View Receipt Modal Handler (Viewing Only)
  const handleViewReceipt = async (transactionId) => {
    setLoadingReceiptId(transactionId);
    setError('');
    try {
      const res = await patientApi(`/patient/me/receipt/${transactionId}`);
      setSelectedReceipt(res);
    } catch (err) {
      setError(err.message || 'Failed to load official receipt.');
    } finally {
      setLoadingReceiptId(null);
    }
  };

  // Cancel Request or Appointment
  const handleConfirmCancel = async () => {
    if (!cancelModal) return;
    setError('');
    setSuccess('');
    setLoadingAction(true);
    try {
      const endpoint =
        cancelModal.type === 'req'
          ? `/patient/appointments/requests/${cancelModal.id}/cancel`
          : `/patient/appointments/${cancelModal.id}/cancel`;
      const res = await patientApi(endpoint, { method: 'PUT' });
      setSuccess(res.message);
      setCancelModal(null);
      loadAll();
    } catch (err) {
      setError(err.message);
      setCancelModal(null);
    } finally {
      setLoadingAction(false);
    }
  };

  // Submit Reschedule Request
  const handleConfirmReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleModal || !rDate || !rTime) {
      setError('Please select a new date and an available time slot.');
      return;
    }
    setError('');
    setSuccess('');
    setLoadingAction(true);
    try {
      const res = await patientApi(`/patient/appointments/${rescheduleModal.id}/reschedule`, {
        method: 'POST',
        body: {
          preferred_date: rDate,
          preferred_time: rTime,
          remarks: 'Reschedule requested via Patient Portal',
        },
      });
      setSuccess(res.message);
      setRescheduleModal(null);
      setTab('pending');
      loadAll();
    } catch (err) {
      setError(err.message);
      setRescheduleModal(null);
    } finally {
      setLoadingAction(false);
    }
  };

  // Profile Edit Handlers
  const startProfileEdit = () => {
    setFormErrors({});
    setError('');
    setSuccess('');
    setProfileForm({
      phone: profile.phone || '',
      address: profile.address || '',
      barangay: profile.barangay || '',
      city: profile.city || '',
      province: profile.province || '',
      civil_status: profile.civil_status || 'Single',
      occupation: profile.occupation || '',
      guardian_name: profile.guardian_name || '',
      guardian_phone: profile.guardian_phone || '',
    });
    setIsEditingProfile(true);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!profileForm.phone?.trim()) {
      errs.phone = 'Mobile number is required.';
    } else if (!isPhilippinePhone(profileForm.phone)) {
      errs.phone = 'Enter a valid Philippine mobile number (e.g. 0917 123 4567).';
    }
    if (isMinor) {
      if (!profileForm.guardian_name?.trim()) {
        errs.guardian_name = 'Parent or guardian name is required for minors.';
      }
      if (!profileForm.guardian_phone?.trim()) {
        errs.guardian_phone = 'Guardian contact number is required.';
      } else if (!isPhilippinePhone(profileForm.guardian_phone)) {
        errs.guardian_phone = 'Enter a valid Philippine mobile number for the guardian.';
      }
    }
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      scrollToFirstError();
      return;
    }

    setFormErrors({});
    setLoadingAction(true);
    try {
      const res = await patientApi('/patient/me/profile', {
        method: 'PUT',
        body: profileForm,
      });
      setSuccess(res.message);
      setIsEditingProfile(false);
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // Identity Correction Modal Handlers
  const openCorrectionModal = (defaultField = 'first_name') => {
    setError('');
    setSuccess('');
    setCorrErrors({});
    const firstAvailable =
      CORRECTION_FIELDS.find((f) => !pendingByField[f.id])?.id || defaultField;
    setCorrForm({
      field_name: firstAvailable,
      new_value: '',
      reason: '',
    });
    setCorrectionModalOpen(true);
  };

  const currentFieldValue = (field) => {
    if (!profile) return '';
    return profile[field] || '';
  };

  const submitCorrectionRequest = async (e) => {
    e.preventDefault();
    const errs = {};
    const { field_name, new_value, reason } = corrForm;

    if (pendingByField[field_name]) {
      errs.field_name = 'A correction request for this field is already pending review.';
    }

    let formattedValue = String(new_value || '').trim();

    if (['first_name', 'middle_name', 'last_name'].includes(field_name)) {
      if (!formattedValue) {
        errs.new_value = 'Please enter the corrected name.';
      } else {
        formattedValue = toTitleCase(formattedValue);
      }
    } else if (field_name === 'birth_date') {
      if (!formattedValue) {
        errs.new_value = 'Please select the corrected date of birth.';
      } else {
        const parts = formattedValue.split('-');
        const year = Number(parts[0]);
        const todayStr = todayManila();
        if (parts.length !== 3 || String(parts[0]).length !== 4 || isNaN(year) || year < 1900) {
          errs.new_value = 'Enter a valid date with a 4-digit year (1900 or later).';
        } else if (formattedValue > todayStr) {
          errs.new_value = 'Date of birth cannot be in the future.';
        }
      }
    } else if (field_name === 'sex') {
      formattedValue = formattedValue.toLowerCase();
      if (!['male', 'female', 'other'].includes(formattedValue)) {
        errs.new_value = 'Please select a valid gender.';
      }
    }

    if (
      !errs.new_value &&
      String(currentFieldValue(field_name) || '').toLowerCase() === formattedValue.toLowerCase()
    ) {
      errs.new_value = 'The new value must be different from your current record.';
    }

    if (!reason || !reason.trim()) {
      errs.reason = 'Please provide a short reason for this correction request.';
    }

    if (Object.keys(errs).length > 0) {
      setCorrErrors(errs);
      return;
    }

    setCorrErrors({});
    setLoadingAction(true);
    try {
      const res = await patientApi('/patient/identity-corrections', {
        method: 'POST',
        body: {
          field_name,
          new_value: formattedValue,
          reason: reason.trim(),
        },
      });
      setSuccess(res.message || 'Correction request submitted for clinic staff review.');
      setCorrectionModalOpen(false);
      loadAll();
    } catch (err) {
      setCorrErrors({ form: err.message });
    } finally {
      setLoadingAction(false);
    }
  };

  // Medical History Edit Handlers
  const startMedicalEdit = () => {
    setFormErrors({});
    setError('');
    setSuccess('');
    const mh = profile?.medical_history || {};
    setMedicalForm({
      allergies: mh.allergies || '',
      medications: mh.medications || '',
      is_pregnant: Boolean(mh.is_pregnant),
      has_bleeding_issue: Boolean(mh.has_bleeding_issue),
      other_notes: mh.other_notes || '',
      answers: mh.answers || {},
      selected_conditions: mh.answers?.selected_conditions || [],
    });
    setIsEditingMedical(true);
  };

  const saveMedical = async (e) => {
    e.preventDefault();
    const errs = {};
    QUESTIONS.forEach((q) => {
      const ans = medicalForm.answers[q.id];
      if (ans?.choice === 'yes' && (!ans.details || !ans.details.trim())) {
        errs[q.id] = 'Please provide details for this "Yes" answer.';
      }
    });
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      scrollToFirstError();
      return;
    }

    setFormErrors({});
    setLoadingAction(true);
    try {
      const mergedAnswers = {
        ...medicalForm.answers,
        selected_conditions: medicalForm.selected_conditions,
      };
      const res = await patientApi('/patient/me/medical-history', {
        method: 'POST',
        body: { ...medicalForm, answers: mergedAnswers },
      });
      setSuccess(res.message);
      setIsEditingMedical(false);
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const fullName = profile
    ? [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ')
    : [patientUser?.first_name, patientUser?.middle_name, patientUser?.last_name]
        .filter(Boolean)
        .join(' ');

  const affirmativeMedicalAnswers = QUESTIONS.map((q) => {
    const ans = profile?.medical_history?.answers?.[q.id];
    if (ans?.choice === 'yes') {
      return { id: q.id, label: q.label, details: ans.details };
    }
    return null;
  }).filter(Boolean);

  const recordedConditions = profile?.medical_history?.answers?.selected_conditions || [];

  return (
    <div className="space-y-6">
      {/* Profile Summary Card */}
      <Card className="p-6 sm:p-8 bg-gradient-to-r from-blue-50/50 via-white to-white">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-sm shadow-blue-600/20">
              {(profile?.first_name?.[0] || patientUser?.first_name?.[0] || 'P').toUpperCase()}
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Patient Portal
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {fullName}
              </h1>
              <p className="text-xs font-medium text-slate-500">
                Chart No:{' '}
                <strong className="font-mono font-bold text-slate-800">
                  {profile?.patient_no || patientUser?.patient_no}
                </strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-xs sm:border-t-0 sm:pt-0">
            <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
              <span className="block font-medium text-slate-400">Registered</span>
              <strong className="mt-0.5 block font-bold text-slate-800">
                {profile?.registered_date ? formatFriendlyDate(profile.registered_date, false) : '-'}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
              <span className="block font-medium text-slate-400">Birthday</span>
              <strong className="mt-0.5 block font-bold text-slate-800">
                {profile?.birth_date ? formatFriendlyDate(profile.birth_date, false) : '-'}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
              <span className="block font-medium text-slate-400">Gender</span>
              <strong className="mt-0.5 block font-bold text-slate-800">
                {capitalize(profile?.sex)}
              </strong>
            </div>
          </div>
        </div>
      </Card>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800"
        >
          {success}
        </div>
      )}

      {/* Main Tabs Container */}
      <Card noPadding className="overflow-hidden">
        <div className="bg-slate-50/50 px-6 pt-2">
          <Tabs
            activeTab={tab}
            onChange={(id) => {
              setError('');
              setSuccess('');
              setTab(id);
            }}
            tabs={[
              { id: 'upcoming', label: `Upcoming (${upcomingAppts.length})` },
              { id: 'pending', label: `Pending Requests (${pendingReqs.length})` },
              { id: 'history', label: `Past Visits (${pastAppts.length + historyReqs.length})` },
              { id: 'records', label: 'My History' },
              { id: 'profile', label: 'My Profile' },
            ]}
          />
        </div>

        <div className="p-6 sm:p-8">
          {loadingInitial ? (
            <p className="py-10 text-center text-sm font-medium text-slate-500">
              Loading your appointments and records...
            </p>
          ) : (
            <>
              {/* TAB 1: UPCOMING APPOINTMENTS */}
              {tab === 'upcoming' && (
                <div className="space-y-4">
                  {upcomingAppts.map((a) => {
                    const canModifyOnline = checkMoreThan24Hours(a.starts_at);
                    const reasonsText =
                      Array.isArray(a.services) && a.services.length
                        ? a.services.join(', ')
                        : a.reason || 'General Consultation';

                    return (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs transition-all hover:border-slate-300"
                      >
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge status={a.status}>
                                {capitalize(a.status.replace('_', ' '))}
                              </Badge>
                              {a.reference_no && (
                                <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
                                  Ref: {a.reference_no}
                                </span>
                              )}
                            </div>

                            <h3 className="text-lg font-bold text-slate-900">
                              {formatFriendlyDate(a.appointment_date, true)}
                            </h3>
                            <p className="text-sm font-semibold text-blue-600">
                              {formatTime12(a.appointment_time)}
                              {a.dentist_name ? ` · Dr. ${a.dentist_name}` : ''}
                            </p>

                            <div className="pt-1 text-xs text-slate-600">
                              <span className="font-semibold text-slate-800">Reason for Visit: </span>
                              <span>{reasonsText}</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 sm:items-end">
                            {canModifyOnline ? (
                              <div className="flex flex-wrap gap-2.5">
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setRDate('');
                                    setRTime('');
                                    setRescheduleModal(a);
                                  }}
                                >
                                  Reschedule
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() =>
                                    setCancelModal({
                                      type: 'appt',
                                      id: a.id,
                                      msg: `Cancel your confirmed appointment on ${formatFriendlyDate(
                                        a.appointment_date,
                                        false
                                      )} at ${formatTime12(a.appointment_time)}?`,
                                    })
                                  }
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs font-medium text-amber-900 sm:max-w-xs sm:text-right">
                                Within 24 hours of appointment. Please call the clinic at{' '}
                                <strong className="font-bold">{CLINIC_SETTINGS.phone}</strong> to cancel or reschedule.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!upcomingAppts.length && (
                    <EmptyState
                      title="No upcoming confirmed appointments"
                      description="Schedule your next dental visit online in just a few clicks."
                      action={
                        onGoBook && (
                          <Button variant="primary" onClick={onGoBook}>
                            Book an Appointment
                          </Button>
                        )
                      }
                    />
                  )}
                </div>
              )}

              {/* TAB 2: PENDING REQUESTS */}
              {tab === 'pending' && (
                <div className="space-y-4">
                  {pendingReqs.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 sm:p-6"
                    >
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge status="pending">Pending</Badge>
                            {r.reschedule_for_appointment_id && (
                              <Badge status="scheduled">Reschedule Request</Badge>
                            )}
                            <span className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-0.5 font-mono text-xs font-bold text-blue-600">
                              Ref: {r.reference_no}
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-slate-900">
                            {formatFriendlyDate(r.preferred_date, true)}
                          </h3>
                          <p className="text-sm font-semibold text-blue-600">
                            {formatTime12(r.preferred_time)} · Dentist assigned upon confirmation
                          </p>

                          <div className="space-y-1 text-xs text-slate-600">
                            <p>
                              <strong className="text-slate-800">Reason for Visit: </strong>
                              {(r.services || []).join(', ')}
                            </p>
                            {r.remarks && (
                              <p>
                                <strong className="text-slate-800">Remarks: </strong>
                                {r.remarks}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex sm:justify-end">
                          <Button
                            variant="danger"
                            onClick={() =>
                              setCancelModal({
                                type: 'req',
                                id: r.id,
                                msg: `Cancel pending request ${r.reference_no} for ${formatFriendlyDate(
                                  r.preferred_date,
                                  false
                                )}?`,
                              })
                            }
                          >
                            Cancel Request
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!pendingReqs.length && (
                    <EmptyState
                      title="No pending appointment requests"
                      description="You do not have any requests waiting for clinic confirmation."
                      action={
                        onGoBook && (
                          <Button variant="primary" onClick={onGoBook}>
                            Book an Appointment
                          </Button>
                        )
                      }
                    />
                  )}
                </div>
              )}

              {/* TAB 3: PAST VISITS & PAST REQUESTS */}
              {tab === 'history' && (
                <div className="space-y-4">
                  {pastAppts.map((a) => {
                    const reasonsText =
                      Array.isArray(a.services) && a.services.length
                        ? a.services.join(', ')
                        : a.reason || 'Dental Visit';

                    return (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 space-y-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge status={a.status}>
                            {capitalize(a.status.replace('_', ' '))}
                          </Badge>
                          {a.reference_no && (
                            <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-slate-600">
                              Ref: {a.reference_no}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                          {formatFriendlyDate(a.appointment_date, true)} ·{' '}
                          {formatTime12(a.appointment_time)}
                        </h3>
                        {a.dentist_name && (
                          <p className="text-xs font-semibold text-slate-600">
                            Dentist: Dr. {a.dentist_name}
                          </p>
                        )}
                        <p className="text-xs text-slate-600">
                          <strong className="text-slate-800">Reason for Visit: </strong>
                          {reasonsText}
                        </p>
                      </div>
                    );
                  })}

                  {historyReqs.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 sm:p-6 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge status={r.status}>{capitalize(r.status)}</Badge>
                        <span className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-0.5 font-mono text-xs font-semibold text-slate-600">
                          Ref: {r.reference_no}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900">
                        {formatFriendlyDate(r.preferred_date, true)} ·{' '}
                        {formatTime12(r.preferred_time)}
                      </h3>
                      <p className="text-xs text-slate-600">
                        <strong className="text-slate-800">Reason for Visit: </strong>
                        {(r.services || []).join(', ')}
                      </p>
                      {r.status === 'declined' && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
                          Clinic reason: {r.declined_reason || 'Schedule unavailable'}
                        </div>
                      )}
                    </div>
                  ))}

                  {!pastAppts.length && !historyReqs.length && (
                    <EmptyState
                      title="No past appointments or history yet"
                      description="Your completed visits and past booking requests will appear here."
                    />
                  )}
                </div>
              )}

              {/* TAB 4: MY HISTORY (CLINICAL & FINANCIAL RECORDS) */}
              {tab === 'records' && (
                <div className="space-y-6">
                  {/* Sub-section Switcher */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="inline-flex rounded-xl bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setHistorySubTab('clinical')}
                        className={`rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                          historySubTab === 'clinical'
                            ? 'bg-white text-blue-600 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        🦷 Clinical History
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistorySubTab('financial')}
                        className={`rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                          historySubTab === 'financial'
                            ? 'bg-white text-blue-600 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        💳 Financial History
                      </button>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={loadHistory}
                      className="!h-8 !min-h-0 !px-3 !py-1 !text-xs font-bold"
                    >
                      ↻ Refresh Records
                    </Button>
                  </div>

                  {/* CLINICAL HISTORY SUB-SECTION */}
                  {historySubTab === 'clinical' && (
                    <div className="space-y-4">
                      <div className="border-b border-slate-100 pb-2">
                        <h3 className="text-sm font-bold text-slate-900">Completed Dental Procedures</h3>
                        <p className="text-xs text-slate-500">
                          Record of all completed dental treatments and chart procedures performed by your attending dentist.
                        </p>
                      </div>

                      {loadingHistory ? (
                        <p className="py-8 text-center text-xs font-medium text-slate-500">
                          Loading your clinical records...
                        </p>
                      ) : clinicalHistory.length === 0 ? (
                        <EmptyState
                          title="No completed treatments on file"
                          description="When procedures are performed and marked completed in your dental chart, they will appear here."
                        />
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                              <tr>
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Tooth</th>
                                <th className="py-3 px-4">Procedure</th>
                                <th className="py-3 px-4">Dentist</th>
                                <th className="py-3 px-4 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {clinicalHistory.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">
                                    {item.treatment_date}
                                    <span className="block text-[11px] font-normal text-slate-400">
                                      {item.treatment_time}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200/60">
                                      Tooth #{item.tooth_number}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-bold text-slate-900">
                                    {item.procedure_name}
                                    {item.surface && (
                                      <span className="ml-1 text-[11px] font-normal text-slate-500">
                                        ({item.surface})
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-slate-700 font-medium">
                                    {item.dentist_name ? `Dr. ${item.dentist_name}` : 'Smile Avenue Dentist'}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <Badge status="completed">Done</Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* FINANCIAL HISTORY SUB-SECTION */}
                  {historySubTab === 'financial' && (
                    <div className="space-y-4">
                      <div className="border-b border-slate-100 pb-2">
                        <h3 className="text-sm font-bold text-slate-900">Billing &amp; Payment History</h3>
                        <p className="text-xs text-slate-500">
                          Complete record of clinic charges, payments made, and official receipts.
                        </p>
                      </div>

                      {loadingHistory ? (
                        <p className="py-8 text-center text-xs font-medium text-slate-500">
                          Loading financial transactions...
                        </p>
                      ) : financialHistory.length === 0 ? (
                        <EmptyState
                          title="No financial records found"
                          description="Treatment charges and payments recorded at the front desk will appear here."
                        />
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                              <tr>
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Description</th>
                                <th className="py-3 px-4">Amount</th>
                                <th className="py-3 px-4">Method</th>
                                <th className="py-3 px-4">Remaining Balance</th>
                                <th className="py-3 px-4 text-right">Receipt</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {financialHistory.map((item) => {
                                const isPayment = item.type === 'Payment';
                                return (
                                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">
                                      {item.date}
                                      <span className="block text-[11px] font-normal text-slate-400">
                                        {item.time}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="font-bold text-slate-900 block">
                                        {item.description || (isPayment ? 'Payment Received' : 'Treatment Charge')}
                                      </span>
                                      {item.discount_amount > 0 && (
                                        <span className="text-[11px] font-medium text-orange-600 block">
                                          Discount applied: -₱{Number(item.discount_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </td>
                                    <td className={`py-3 px-4 font-bold tabular-nums ${isPayment ? 'text-emerald-600' : 'text-slate-900'}`}>
                                      {isPayment ? '-' : ''}₱{Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-3 px-4 text-slate-600 font-medium">
                                      {isPayment ? (item.payment_method || 'Cash') : '—'}
                                    </td>
                                    <td className="py-3 px-4 font-bold tabular-nums text-slate-800">
                                      ₱{Number(item.running_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      {isPayment ? (
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          onClick={() => handleViewReceipt(item.id)}
                                          disabled={loadingReceiptId === item.id}
                                          className="!h-7 !min-h-0 !px-2.5 !py-0.5 !text-[11px] !font-bold"
                                        >
                                          {loadingReceiptId === item.id ? 'Loading...' : '📄 View Receipt'}
                                        </Button>
                                      ) : (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: MY PROFILE & MEDICAL HISTORY */}
              {tab === 'profile' && profile && (
                <div ref={editorRef} className="grid gap-6 md:grid-cols-2">
                  {/* Personal & Contact Details Region */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h2 className="text-base font-bold text-slate-900">
                        Personal &amp; Contact Info
                      </h2>
                      {!isEditingProfile && (
                        <Button
                          variant="secondary"
                          onClick={startProfileEdit}
                          className="!h-8 !min-h-0 !px-3 !py-1 !text-xs"
                        >
                          Edit Contact Info
                        </Button>
                      )}
                    </div>

                    {/* Read-Only Identity Section with "Request a correction" Link */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Identity Details (Read-Only)
                        </span>
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => openCorrectionModal('first_name')}
                        >
                          Request a correction
                        </Button>
                      </div>

                      <dl className="space-y-3 text-sm">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <dt className="text-xs font-medium text-slate-500">Full Name</dt>
                            {hasPendingNameCorrection && (
                              <Badge status="pending" className="!px-2 !py-0.5 !text-[10px]">
                                Correction pending
                              </Badge>
                            )}
                          </div>
                          <dd className="font-bold text-slate-900">{fullName}</dd>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <dt className="text-xs font-medium text-slate-500">Birthday</dt>
                              {pendingByField.birth_date && (
                                <Badge status="pending" className="!px-2 !py-0.5 !text-[10px]">
                                  Correction pending
                                </Badge>
                              )}
                            </div>
                            <dd className="font-semibold text-slate-800">
                              {formatFriendlyDate(profile.birth_date, false)}
                            </dd>
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <dt className="text-xs font-medium text-slate-500">Gender</dt>
                              {pendingByField.sex && (
                                <Badge status="pending" className="!px-2 !py-0.5 !text-[10px]">
                                  Correction pending
                                </Badge>
                              )}
                            </div>
                            <dd className="font-semibold text-slate-800">
                              {capitalize(profile.sex)}
                            </dd>
                          </div>
                        </div>
                      </dl>
                    </div>

                    {/* Editable Contact Info Form or Read View */}
                    {isEditingProfile ? (
                      <form onSubmit={saveProfile} noValidate className="space-y-4">
                        <InputField
                          label="Mobile Number (PH)"
                          type="tel"
                          required
                          placeholder="0917 123 4567"
                          value={profileForm.phone}
                          onChange={(e) => {
                            setProfileForm({ ...profileForm, phone: e.target.value });
                            setFormErrors({ ...formErrors, phone: undefined });
                          }}
                          error={formErrors.phone}
                        />

                        <InputField
                          label="Street / House No."
                          placeholder="e.g. 123 Rizal St."
                          value={profileForm.address}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, address: e.target.value })
                          }
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <InputField
                            label="Barangay"
                            placeholder="e.g. Bitano"
                            value={profileForm.barangay}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, barangay: e.target.value })
                            }
                          />
                          <InputField
                            label="City"
                            placeholder="e.g. Legazpi City"
                            value={profileForm.city}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, city: e.target.value })
                            }
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <InputField
                            label="Province"
                            placeholder="e.g. Albay"
                            value={profileForm.province}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, province: e.target.value })
                            }
                          />
                          <InputField
                            label="Civil Status"
                            as="select"
                            value={profileForm.civil_status}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, civil_status: e.target.value })
                            }
                          >
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Widowed">Widowed</option>
                            <option value="Separated">Separated</option>
                          </InputField>
                        </div>

                        <InputField
                          label="Occupation"
                          placeholder="e.g. Teacher, Engineer"
                          value={profileForm.occupation}
                          onChange={(e) =>
                            setProfileForm({ ...profileForm, occupation: e.target.value })
                          }
                        />

                        {isMinor && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                              Parent / Legal Guardian (Required for under 18)
                            </p>
                            <InputField
                              label="Guardian Name"
                              required
                              placeholder="Parent or guardian full name"
                              value={profileForm.guardian_name}
                              onChange={(e) =>
                                setProfileForm({ ...profileForm, guardian_name: e.target.value })
                              }
                              error={formErrors.guardian_name}
                            />
                            <InputField
                              label="Guardian Mobile (PH)"
                              type="tel"
                              required
                              placeholder="0917 123 4567"
                              value={profileForm.guardian_phone}
                              onChange={(e) =>
                                setProfileForm({ ...profileForm, guardian_phone: e.target.value })
                              }
                              error={formErrors.guardian_phone}
                            />
                          </div>
                        )}

                        <div className="flex justify-end gap-2.5 pt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsEditingProfile(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" variant="primary" disabled={loadingAction}>
                            {loadingAction ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <dl className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <dt className="text-xs font-medium text-slate-500">Mobile Number</dt>
                            <dd className="font-semibold text-slate-800">{profile.phone || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-slate-500">Email</dt>
                            <dd className="truncate font-semibold text-slate-800">
                              {profile.email || '-'}
                            </dd>
                          </div>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-slate-500">Address</dt>
                          <dd className="font-semibold text-slate-800">
                            {formatCleanAddress(profile)}
                          </dd>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <dt className="text-xs font-medium text-slate-500">Civil Status</dt>
                            <dd className="font-semibold text-slate-800">
                              {profile.civil_status || 'Not specified'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-slate-500">Occupation</dt>
                            <dd className="font-semibold text-slate-800">
                              {profile.occupation || 'Not specified'}
                            </dd>
                          </div>
                        </div>
                        {isMinor && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                            <strong>Guardian:</strong> {profile.guardian_name || '-'} (
                            {profile.guardian_phone || '-'})
                          </div>
                        )}
                      </dl>
                    )}

                    {/* Identity Correction Requests Status List */}
                    {corrections.length > 0 && (
                      <div className="border-t border-slate-100 pt-4 space-y-2.5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Identity Correction Requests
                        </h3>
                        <div className="space-y-2">
                          {corrections.map((c) => {
                            const fLabel =
                              CORRECTION_FIELDS.find((f) => f.id === c.field_name)?.label ||
                              c.field_name;
                            return (
                              <div
                                key={c.id}
                                className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs space-y-1"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <strong className="font-bold text-slate-900">
                                    {fLabel} → {formatCorrectionValue(c.field_name, c.new_value)}
                                  </strong>
                                  <Badge status={c.status}>
                                    {c.status === 'pending'
                                      ? 'Correction pending'
                                      : capitalize(c.status)}
                                  </Badge>
                                </div>
                                <p className="text-slate-500">
                                  Requested on{' '}
                                  {c.created_date
                                    ? formatFriendlyDate(c.created_date, false)
                                    : new Date(c.created_at).toLocaleDateString('en-US')}
                                </p>
                                {c.status === 'declined' && c.staff_reason && (
                                  <p className="font-semibold text-red-600">
                                    Declined reason: {c.staff_reason}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Medical History Region */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Medical History</h2>
                        <p className="text-xs font-medium text-slate-500">
                          Last updated:{' '}
                          {profile.medical_history?.recorded_date
                            ? formatFriendlyDate(profile.medical_history.recorded_date, false)
                            : 'Not recorded'}
                        </p>
                      </div>
                      {!isEditingMedical && (
                        <Button
                          variant="secondary"
                          onClick={startMedicalEdit}
                          className="!h-8 !min-h-0 !px-3 !py-1 !text-xs"
                        >
                          Update
                        </Button>
                      )}
                    </div>

                    {isEditingMedical ? (
                      <form onSubmit={saveMedical} noValidate className="space-y-4">
                        {QUESTIONS.map((q) => {
                          const ans = medicalForm.answers[q.id] || { choice: 'no', details: '' };
                          const hasErr = Boolean(formErrors[q.id]);
                          return (
                            <div
                              key={q.id}
                              data-error={hasErr}
                              className={`rounded-xl border p-3.5 text-xs space-y-2.5 ${
                                hasErr
                                  ? 'border-red-400 bg-red-50/40'
                                  : 'border-slate-200/80 bg-slate-50/70'
                              }`}
                            >
                              <p className="font-semibold text-slate-900">{q.label}</p>
                              <div className="flex gap-4">
                                <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-slate-700">
                                  <input
                                    type="radio"
                                    checked={ans.choice === 'yes'}
                                    onChange={() =>
                                      setMedicalForm({
                                        ...medicalForm,
                                        answers: {
                                          ...medicalForm.answers,
                                          [q.id]: { ...ans, choice: 'yes' },
                                        },
                                      })
                                    }
                                    className="h-4 w-4 accent-blue-600"
                                  />
                                  Yes
                                </label>
                                <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-slate-700">
                                  <input
                                    type="radio"
                                    checked={ans.choice === 'no'}
                                    onChange={() => {
                                      setMedicalForm({
                                        ...medicalForm,
                                        answers: {
                                          ...medicalForm.answers,
                                          [q.id]: { choice: 'no', details: '' },
                                        },
                                      });
                                      setFormErrors({ ...formErrors, [q.id]: undefined });
                                    }}
                                    className="h-4 w-4 accent-blue-600"
                                  />
                                  No
                                </label>
                              </div>

                              {ans.choice === 'yes' && (
                                <InputField
                                  label="Required Details"
                                  required
                                  placeholder="Please specify details..."
                                  value={ans.details || ''}
                                  onChange={(e) =>
                                    setMedicalForm({
                                      ...medicalForm,
                                      answers: {
                                        ...medicalForm.answers,
                                        [q.id]: { ...ans, details: e.target.value },
                                      },
                                    })
                                  }
                                  error={formErrors[q.id]}
                                />
                              )}
                            </div>
                          );
                        })}

                        {profile.sex === 'female' && (
                          <div className="rounded-xl border border-pink-200 bg-pink-50/60 p-3.5 text-xs">
                            <p className="mb-2 font-bold text-pink-950">
                              Are you currently pregnant or nursing?
                            </p>
                            <div className="flex gap-4">
                              <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                                <input
                                  type="radio"
                                  checked={medicalForm.is_pregnant === true}
                                  onChange={() =>
                                    setMedicalForm({ ...medicalForm, is_pregnant: true })
                                  }
                                  className="h-4 w-4 accent-pink-600"
                                />
                                Yes
                              </label>
                              <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                                <input
                                  type="radio"
                                  checked={medicalForm.is_pregnant === false}
                                  onChange={() =>
                                    setMedicalForm({ ...medicalForm, is_pregnant: false })
                                  }
                                  className="h-4 w-4 accent-pink-600"
                                />
                                No
                              </label>
                            </div>
                          </div>
                        )}

                        <div className="rounded-xl border border-slate-200/80 p-3.5 text-xs">
                          <p className="mb-2.5 font-bold uppercase tracking-wider text-slate-600">
                            Conditions
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {COMMON_CONDITIONS.map((cond) => (
                              <label key={cond} className="flex cursor-pointer items-center gap-2 font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={medicalForm.selected_conditions.includes(cond)}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...medicalForm.selected_conditions, cond]
                                      : medicalForm.selected_conditions.filter((x) => x !== cond);
                                    setMedicalForm({ ...medicalForm, selected_conditions: next });
                                  }}
                                  className="h-4 w-4 rounded accent-blue-600"
                                />
                                {cond}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsEditingMedical(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" variant="primary" disabled={loadingAction}>
                            {loadingAction ? 'Saving...' : 'Save Medical History'}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-4 text-sm">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Conditions
                          </h3>
                          <p className="mt-1 font-semibold text-slate-800">
                            {recordedConditions.length > 0
                              ? recordedConditions.join(', ')
                              : 'None reported'}
                          </p>
                        </div>

                        {profile.sex === 'female' && (
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Pregnancy / Nursing
                            </h3>
                            <p className="mt-1 font-semibold text-slate-800">
                              {profile.medical_history?.is_pregnant ? 'Yes' : 'No'}
                            </p>
                          </div>
                        )}

                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Reported Medical Details
                          </h3>
                          {affirmativeMedicalAnswers.length > 0 ? (
                            <ul className="mt-2 space-y-2">
                              {affirmativeMedicalAnswers.map((item) => (
                                <li
                                  key={item.id}
                                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs"
                                >
                                  <span className="block font-medium text-slate-700">
                                    {item.label}
                                  </span>
                                  <span className="mt-0.5 block font-bold text-blue-700">
                                    Yes — {item.details}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 font-semibold text-slate-800">None reported</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Leave a Review Section */}
      <PatientReviewSection />

      {/* View-Only Receipt Details Modal */}
      {selectedReceipt && (
        <Modal
          title={`Official Receipt · ${selectedReceipt.receipt_no || 'REC-0001'}`}
          subtitle="Official clinic payment acknowledgment"
          onClose={() => setSelectedReceipt(null)}
        >
          <div className="space-y-4">
            {/* Clinic Details */}
            <div className="text-center border-b border-dashed border-slate-200 pb-3">
              <h4 className="text-base font-extrabold text-slate-900">
                {selectedReceipt.clinic?.name || 'Smile Avenue Dental Clinic'}
              </h4>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                {selectedReceipt.clinic?.address || 'G/F Yankit Building, Landco Business Park, Legazpi, Philippines, 4500'}
              </p>
              <p className="text-[11px] text-slate-500">
                Tel: {selectedReceipt.clinic?.phone || '0969 059 1928'} · {selectedReceipt.clinic?.email || 'smileavdental@gmail.com'}
              </p>
            </div>

            {/* Metadata Box */}
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50/80 p-3 text-xs">
              <div>
                <span className="block font-medium text-slate-400 text-[10px] uppercase tracking-wider">
                  Patient Name
                </span>
                <span className="font-bold text-slate-900">
                  {selectedReceipt.patient?.name || fullName}
                </span>
                <span className="block text-[11px] text-slate-500">
                  Chart #{selectedReceipt.patient?.patient_no || profile?.patient_no || 'N/A'}
                </span>
              </div>
              <div className="text-right">
                <span className="block font-medium text-slate-400 text-[10px] uppercase tracking-wider">
                  Receipt No. &amp; Date
                </span>
                <span className="font-bold text-blue-600">
                  {selectedReceipt.receipt_no || 'REC-0001'}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {selectedReceipt.date} {selectedReceipt.time}
                </span>
              </div>
            </div>

            {/* Financial Details */}
            <div className="rounded-lg border border-slate-200/80 p-3.5 text-xs space-y-2">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500">Description:</span>
                <span className="font-bold text-slate-900 text-right">
                  {selectedReceipt.line_item?.description || 'Dental Treatment Payment'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold text-slate-700">
                  {selectedReceipt.line_item?.payment_method || 'Cash'}
                </span>
              </div>

              {Number(selectedReceipt.line_item?.discount_amount) > 0 && (
                <>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Gross Amount:</span>
                    <span>₱{Number(selectedReceipt.line_item?.gross_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-orange-600 font-medium">
                    <span>Discount ({selectedReceipt.line_item?.discount_type || 'Applied'}):</span>
                    <span>-₱{Number(selectedReceipt.line_item?.discount_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}

              <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm">
                <span className="font-bold text-slate-900">Net Amount Paid:</span>
                <span className="font-extrabold text-emerald-600 text-base">
                  ₱{Number(selectedReceipt.line_item?.amount_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-0.5">
                <span>Remaining Balance:</span>
                <span className="font-semibold text-slate-700">
                  ₱{Number(selectedReceipt.line_item?.remaining_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Signatures */}
            <div className="flex items-end justify-between pt-1">
              <div className="max-w-[160px]">
                <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Patient Signature
                </span>
                {selectedReceipt.patient_signature ? (
                  <img
                    src={selectedReceipt.patient_signature}
                    alt="Patient Signature"
                    className="h-10 max-w-full object-contain border-b border-slate-300 pb-1"
                  />
                ) : (
                  <div className="h-8 border-b border-slate-300"></div>
                )}
              </div>

              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-slate-400">
                  Received By
                </span>
                <span className="font-bold text-xs text-slate-900">
                  {selectedReceipt.received_by || 'Clinic Staff'}
                </span>
              </div>
            </div>

            {/* View-Only Action: Only Close Button */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedReceipt(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Identity Correction Modal */}
      {correctionModalOpen && profile && (
        <Modal
          title="Request an Identity Correction"
          subtitle="Changes to name, date of birth, or gender require clinic staff approval."
          onClose={() => setCorrectionModalOpen(false)}
        >
          <form onSubmit={submitCorrectionRequest} noValidate className="space-y-4">
            {corrErrors.form && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
              >
                {corrErrors.form}
              </div>
            )}

            <InputField
              label="Field to Correct"
              as="select"
              required
              value={corrForm.field_name}
              onChange={(e) => {
                setCorrForm({
                  field_name: e.target.value,
                  new_value: '',
                  reason: corrForm.reason,
                });
                setCorrErrors({});
              }}
              error={corrErrors.field_name}
            >
              {CORRECTION_FIELDS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} {pendingByField[f.id] ? '(Correction pending)' : ''}
                </option>
              ))}
            </InputField>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              <span className="font-medium text-slate-500">Current Value on Record: </span>
              <strong className="font-bold text-slate-900">
                {formatCorrectionValue(
                  corrForm.field_name,
                  currentFieldValue(corrForm.field_name)
                )}
              </strong>
            </div>

            {corrForm.field_name === 'birth_date' ? (
              <InputField
                label="New Date of Birth"
                type="date"
                required
                max={todayManila()}
                hint="Select date (4-digit year, not in the future)"
                value={corrForm.new_value}
                onChange={(e) => {
                  setCorrForm({ ...corrForm, new_value: e.target.value });
                  setCorrErrors({ ...corrErrors, new_value: undefined });
                }}
                error={corrErrors.new_value}
              />
            ) : corrForm.field_name === 'sex' ? (
              <InputField
                label="New Gender"
                as="select"
                required
                value={corrForm.new_value}
                onChange={(e) => {
                  setCorrForm({ ...corrForm, new_value: e.target.value });
                  setCorrErrors({ ...corrErrors, new_value: undefined });
                }}
                error={corrErrors.new_value}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </InputField>
            ) : (
              <InputField
                label={`New ${
                  CORRECTION_FIELDS.find((f) => f.id === corrForm.field_name)?.label || 'Value'
                }`}
                type="text"
                required
                placeholder="Enter corrected name"
                value={corrForm.new_value}
                onChange={(e) => {
                  setCorrForm({ ...corrForm, new_value: e.target.value });
                  setCorrErrors({ ...corrErrors, new_value: undefined });
                }}
                error={corrErrors.new_value}
              />
            )}

            <InputField
              label="Reason for Correction"
              as="textarea"
              rows={3}
              required
              placeholder="Briefly explain why this field needs to be corrected (e.g. typo during sign-up)..."
              value={corrForm.reason}
              onChange={(e) => {
                setCorrForm({ ...corrForm, reason: e.target.value });
                setCorrErrors({ ...corrErrors, reason: undefined });
              }}
              error={corrErrors.reason}
            />

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCorrectionModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loadingAction || Boolean(pendingByField[corrForm.field_name])}
              >
                {loadingAction ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModal && (
        <Modal title="Confirm Cancellation" onClose={() => setCancelModal(null)}>
          <div className="space-y-6">
            <p className="text-sm font-medium text-slate-600">{cancelModal.msg}</p>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setCancelModal(null)}>
                Keep Appointment
              </Button>
              <Button
                variant="danger"
                disabled={loadingAction}
                onClick={handleConfirmCancel}
              >
                {loadingAction ? 'Cancelling...' : 'Yes, Cancel'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reschedule Request Modal */}
      {rescheduleModal && (
        <Modal title="Request Reschedule" onClose={() => setRescheduleModal(null)}>
          <form onSubmit={handleConfirmReschedule} noValidate className="space-y-5">
            <p className="text-xs font-medium text-slate-500">
              Select a new preferred date and time. Your current appointment stays active until the clinic confirms your new schedule.
            </p>

            <InputField
              label="New Preferred Date"
              type="date"
              required
              min={todayManila()}
              value={rDate}
              onChange={(e) => setRDate(e.target.value)}
              error={
                rClosed
                  ? 'Closed on Sundays. Please pick Monday through Saturday.'
                  : undefined
              }
            />

            <div>
              <label className={tokens.label}>
                Available 30-Minute Time Slots <span className="text-red-500">*</span>
              </label>
              {!rDate ? (
                <p className="text-xs font-medium text-slate-500">
                  Select a date above first.
                </p>
              ) : loadingAction ? (
                <p className="text-xs font-medium text-slate-500">
                  Loading open slots...
                </p>
              ) : !rClosed && rSlots.length === 0 ? (
                <p className="text-xs font-semibold text-red-600">
                  No open slots on this date. Please choose another date.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {rSlots.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setRTime(s)}
                      className={`h-[42px] rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        rTime === s
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                          : 'border-slate-200/90 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                      }`}
                    >
                      {formatTime12(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRescheduleModal(null)}
              >
                Close
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loadingAction || !rTime || rClosed}
              >
                {loadingAction ? 'Sending...' : 'Submit Reschedule Request'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}