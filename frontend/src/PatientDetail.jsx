import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import {
  CLINIC_SETTINGS,
  formatFriendlyDate,
  formatTime12,
  capitalize,
  todayManila,
} from './config';
import { Badge, Button, Card, EmptyState, Icon, Modal, Tabs, tokens } from './ui';
import DentalChartTab from './DentalChartTab';
import PatientLedgerTab from './PatientLedgerTab';

const MEDICAL_QUESTIONS = [
  { id: 'good_health', title: 'General Health', question: 'Are you in good health?' },
  { id: 'medical_treatment', title: 'Ongoing Medical Treatment', question: 'Are you currently undergoing medical treatment?' },
  { id: 'serious_illness', title: 'Serious Illness or Surgery', question: 'Have you ever had a serious illness or surgical operation?' },
  { id: 'hospitalized', title: 'Past Hospitalization', question: 'Have you ever been hospitalized?' },
  { id: 'taking_medication', title: 'Current Medications', question: 'Are you taking any prescription or non-prescription medication?' },
  { id: 'tobacco', title: 'Tobacco Use', question: 'Do you use tobacco products?' },
  { id: 'alcohol', title: 'Alcohol Consumption', question: 'Do you drink alcoholic beverages?' },
  { id: 'dangerous_drugs', title: 'Recreational / Dangerous Drugs', question: 'Have you ever used recreational or dangerous drugs?' },
  { id: 'allergies_exist', title: 'Allergies', question: 'Are you allergic to anything (food, drugs, latex, penicillin)?' },
];

const COMMON_CONDITIONS = [
  'High Blood Pressure', 'Low Blood Pressure', 'Diabetes', 'Heart Disease',
  'Heart Murmur', 'Asthma', 'Bleeding Problems', 'Hepatitis / Liver Disease',
  'Kidney Disease', 'Thyroid Problem', 'Epilepsy / Seizures', 'Rheumatic Fever',
];

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => String(CURRENT_YEAR - i));

const toTitleCase = (str = '') =>
  String(str)
    .trim()
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

const formatDirectoryName = (p) => {
  if (!p) return '';
  const last = toTitleCase(p.last_name || '');
  const first = toTitleCase(p.first_name || '');
  const middle = toTitleCase(p.middle_name || '');
  const given = [first, middle].filter(Boolean).join(' ');
  if (last && given) return `${last}, ${given}`;
  return last || given || 'Unnamed Patient';
};

const calcAge = (d) => {
  if (!d) return null;
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return null;
  const n = new Date();
  let a = n.getFullYear() - y;
  if (n < new Date(n.getFullYear(), m - 1, day)) a--;
  return a;
};

const getDaysInMonth = (year, month) => {
  const y = Number(year) || 2000;
  const m = Number(month) || 1;
  return new Date(y, m, 0).getDate();
};

const isPhilippinePhone = (p = '') =>
  /^(09\d{9}|\+639\d{9}|639\d{9})$/.test(String(p).replace(/[\s\-()]/g, ''));

function getCleanAddressLines(p = {}) {
  const rawLines = [
    { label: 'Street / House No.', value: p.address },
    { label: 'Barangay', value: p.barangay },
    { label: 'City / Municipality', value: p.city },
    { label: 'Province', value: p.province },
  ];

  const seen = new Set();
  const result = [];

  for (const item of rawLines) {
    if (!item.value) continue;
    const parts = String(item.value)
      .split(',')
      .map((s) => toTitleCase(s))
      .filter(Boolean);
    const uniqueParts = [];
    for (const part of parts) {
      const key = part.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueParts.push(part);
      }
    }
    if (uniqueParts.length > 0) {
      result.push({ label: item.label, value: uniqueParts.join(', ') });
    }
  }

  return result;
}

export default function PatientDetail({
  patientId,
  locations = {},
  onBack,
  onPatientUpdated,
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'medical' | 'appointments' | 'chart' | 'ledger'
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);
  const [patient, setPatient] = useState(null);
  const [medHistory, setMedHistory] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fallback React state if PatientLedgerTab is tested in local-state mode
  const [ledgerTransactions, setLedgerTransactions] = useState(() => [
    {
      id: 'chg-initial-18',
      date: todayManila(),
      description: 'Crown - Tooth 18',
      type: 'Charge',
      amount: 5000,
    },
  ]);

  const handleAddLedgerTransaction = (tx) => {
    setLedgerTransactions((prev) => [...prev, tx]);
  };

  // Edit Profile Modal state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [profileErrors, setProfileErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const profileFormRef = useRef(null);

  // Record / Withdraw Consent Modals
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [consentForm, setConsentForm] = useState({ terms_accepted: false, privacy_accepted: false });
  const [consentError, setConsentError] = useState('');
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  // Edit Medical History Modal state
  const [editingMed, setEditingMed] = useState(false);
  const [medForm, setMedForm] = useState({
    allergies: '',
    medications: '',
    is_pregnant: false,
    has_bleeding_issue: false,
    other_notes: '',
    answers: {},
    selected_conditions: [],
  });
  const [medErrors, setMedErrors] = useState({});
  const [savingMed, setSavingMed] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`api/staff/patients/${patientId}`);
      setPatient(data.patient);
      setMedHistory(data.medical_history || null);
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [patientId]);

  if (loading) {
    return (
      <Card className="p-10 text-center text-sm font-medium text-slate-600">
        Loading patient profile and clinical records...
      </Card>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={onBack}>
          ← Back to Patients List
        </Button>
        <Card className="p-8 text-center text-sm font-semibold text-red-700">
          {error || 'Patient record not found.'}
        </Card>
      </div>
    );
  }

  const patientAge = calcAge(patient.birth_date);
  const isMinor = patientAge !== null && patientAge < 18;
  const displayName = formatDirectoryName(patient);
  const initials =
    ((patient.first_name?.[0] || '') + (patient.last_name?.[0] || '')).toUpperCase() || 'PT';
  const addressLines = getCleanAddressLines(patient);

  const buildCleanMedicalList = () => {
    if (!medHistory) return [];
    const items = [];

    const selectedConds = medHistory.answers?.selected_conditions || [];
    if (selectedConds.length > 0) {
      items.push({
        title: 'Medical Conditions',
        detail: selectedConds.join(', '),
      });
    }

    for (const q of MEDICAL_QUESTIONS) {
      const ans = medHistory.answers?.[q.id];
      if (ans?.choice === 'yes') {
        if (q.id === 'good_health' && (!ans.details || !ans.details.trim())) continue;
        items.push({
          title: q.title,
          detail: ans.details?.trim() || 'Yes',
        });
      }
    }

    if (medHistory.allergies && !items.some((i) => i.title === 'Allergies')) {
      items.push({ title: 'Allergies', detail: medHistory.allergies });
    }
    if (medHistory.medications && !items.some((i) => i.title === 'Current Medications')) {
      items.push({ title: 'Current Medications', detail: medHistory.medications });
    }
    if (medHistory.has_bleeding_issue && !selectedConds.includes('Bleeding Problems')) {
      items.push({ title: 'Bleeding Disorder / Tendency', detail: 'Reported bleeding issue' });
    }
    if (patient.sex === 'female' && medHistory.is_pregnant) {
      items.push({ title: 'Pregnancy / Nursing', detail: 'Currently pregnant or nursing' });
    }
    if (medHistory.other_notes) {
      items.push({ title: 'Additional Clinical Notes', detail: medHistory.other_notes });
    }

    return items;
  };

  const cleanMedicalItems = buildCleanMedicalList();

  const handleToggleArchive = async () => {
    setError('');
    setSuccess('');
    const nextActive = patient.is_active === false;
    try {
      const res = await api(`api/staff/patients/${patient.id}/archive`, {
        method: 'PATCH',
        body: { is_active: nextActive },
      });
      setPatient((prev) => ({ ...prev, is_active: res.is_active }));
      setSuccess(
        res.is_active
          ? `${displayName} has been restored to Active status.`
          : `${displayName} has been archived.`
      );
      onPatientUpdated?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const openEditProfile = () => {
    const bParts = (patient.birth_date || '').slice(0, 10).split('-');
    const prov = patient.province || 'Albay';
    const city = patient.city || (locations[prov] ? Object.keys(locations[prov])[0] : '');
    setProfileErrors({});
    setProfileForm({
      first_name: toTitleCase(patient.first_name || ''),
      middle_name: toTitleCase(patient.middle_name || ''),
      last_name: toTitleCase(patient.last_name || ''),
      dob_year: bParts[0] || '',
      dob_month: bParts[1] || '',
      dob_day: bParts[2] || '',
      sex: patient.sex || '',
      civil_status: patient.civil_status || 'Single',
      occupation: toTitleCase(patient.occupation || ''),
      phone: patient.phone || '',
      email: patient.email || '',
      address: toTitleCase(patient.address || ''),
      province: prov,
      city: city,
      barangay: patient.barangay || '',
      guardian_name: toTitleCase(patient.guardian_name || ''),
      guardian_phone: patient.guardian_phone || '',
    });
    setEditingProfile(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!profileForm.first_name?.trim()) errs.first_name = 'First name is required.';
    if (!profileForm.last_name?.trim()) errs.last_name = 'Last name is required.';

    if (!profileForm.dob_month || !profileForm.dob_day || !profileForm.dob_year) {
      errs.birth_date = 'Please select Month, Day, and 4-digit Year.';
    } else {
      const maxD = getDaysInMonth(profileForm.dob_year, profileForm.dob_month);
      if (Number(profileForm.dob_day) > maxD) {
        errs.birth_date = 'Invalid day for the selected month.';
      } else {
        const dt = new Date(
          Number(profileForm.dob_year),
          Number(profileForm.dob_month) - 1,
          Number(profileForm.dob_day)
        );
        if (dt > new Date()) errs.birth_date = 'Date of birth cannot be in the future.';
      }
    }

    if (!profileForm.sex) errs.sex = 'Gender is required.';
    if (!profileForm.phone?.trim()) {
      errs.phone = 'Mobile number is required.';
    } else if (!isPhilippinePhone(profileForm.phone)) {
      errs.phone = 'Enter a valid Philippine mobile number (e.g. 0917 123 4567).';
    }
    if (profileForm.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email.trim())) {
      errs.email = 'Enter a valid email address.';
    }
    if (!profileForm.province) errs.province = 'Province is required.';
    if (!profileForm.city) errs.city = 'City is required.';
    if (!profileForm.barangay) errs.barangay = 'Barangay is required.';

    const composedDob =
      profileForm.dob_year && profileForm.dob_month && profileForm.dob_day
        ? `${profileForm.dob_year}-${profileForm.dob_month}-${String(profileForm.dob_day).padStart(2, '0')}`
        : '';
    const formAge = calcAge(composedDob);
    const formIsMinor = formAge !== null && formAge < 18;

    if (formIsMinor) {
      if (!profileForm.guardian_name?.trim()) {
        errs.guardian_name = 'Guardian name is required for patients under 18.';
      }
      if (!profileForm.guardian_phone?.trim()) {
        errs.guardian_phone = 'Guardian phone is required for patients under 18.';
      } else if (!isPhilippinePhone(profileForm.guardian_phone)) {
        errs.guardian_phone = 'Enter a valid Philippine mobile number for the guardian.';
      }
    }

    if (Object.keys(errs).length > 0) {
      setProfileErrors(errs);
      return;
    }

    setSavingProfile(true);
    try {
      await api(`api/staff/patients/${patient.id}`, {
        method: 'PUT',
        body: {
          first_name: toTitleCase(profileForm.first_name),
          middle_name: profileForm.middle_name?.trim() ? toTitleCase(profileForm.middle_name) : null,
          last_name: toTitleCase(profileForm.last_name),
          birth_date: composedDob,
          sex: profileForm.sex,
          civil_status: profileForm.civil_status,
          occupation: profileForm.occupation?.trim() ? toTitleCase(profileForm.occupation) : null,
          phone: profileForm.phone.trim(),
          email: profileForm.email?.trim() || null,
          address: profileForm.address?.trim() ? toTitleCase(profileForm.address) : null,
          province: profileForm.province,
          city: profileForm.city,
          barangay: profileForm.barangay,
          guardian_name: profileForm.guardian_name?.trim()
            ? toTitleCase(profileForm.guardian_name)
            : null,
          guardian_phone: profileForm.guardian_phone?.trim() || null,
        },
      });
      setEditingProfile(false);
      setSuccess('Patient profile updated.');
      await loadDetail();
      onPatientUpdated?.();
    } catch (err) {
      setProfileErrors({ form: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRecordConsent = async (e) => {
    e.preventDefault();
    setConsentError('');
    if (!consentForm.terms_accepted || !consentForm.privacy_accepted) {
      setConsentError('Please tick both Terms and Conditions and Privacy Policy.');
      return;
    }
    setSavingConsent(true);
    try {
      await api(`api/staff/patients/${patient.id}/consent`, {
        method: 'POST',
        body: { terms_accepted: true, privacy_accepted: true },
      });
      setConsentModalOpen(false);
      setSuccess('Data privacy consent recorded.');
      await loadDetail();
      onPatientUpdated?.();
    } catch (err) {
      setConsentError(err.message);
    } finally {
      setSavingConsent(false);
    }
  };

  const handleWithdrawConsent = async () => {
    setSavingConsent(true);
    setError('');
    try {
      await api(`api/staff/patients/${patient.id}/consent`, { method: 'DELETE' });
      setWithdrawModalOpen(false);
      setSuccess('Patient consent has been withdrawn.');
      await loadDetail();
      onPatientUpdated?.();
    } catch (err) {
      setError(err.message);
      setWithdrawModalOpen(false);
    } finally {
      setSavingConsent(false);
    }
  };

  const openEditMedHistory = () => {
    setMedErrors({});
    const mh = medHistory || {};
    setMedForm({
      allergies: mh.allergies || '',
      medications: mh.medications || '',
      is_pregnant: Boolean(mh.is_pregnant),
      has_bleeding_issue: Boolean(mh.has_bleeding_issue),
      other_notes: mh.other_notes || '',
      answers: mh.answers || {},
      selected_conditions: mh.answers?.selected_conditions || [],
    });
    setEditingMed(true);
  };

  const handleSaveMedHistory = async (e) => {
    e.preventDefault();
    const errs = {};
    MEDICAL_QUESTIONS.forEach((q) => {
      if (q.id === 'good_health') return;
      const ans = medForm.answers[q.id];
      if (ans?.choice === 'yes' && (!ans.details || !ans.details.trim())) {
        errs[q.id] = `Please enter details for ${q.title}.`;
      }
    });
    if (Object.keys(errs).length > 0) {
      setMedErrors(errs);
      return;
    }

    setSavingMed(true);
    try {
      const mergedAnswers = {
        ...medForm.answers,
        selected_conditions: medForm.selected_conditions,
      };
      await api(`api/staff/patients/${patient.id}/medical-history`, {
        method: 'POST',
        body: {
          ...medForm,
          allergies: medForm.answers?.allergies_exist?.details || medForm.allergies,
          medications: medForm.answers?.taking_medication?.details || medForm.medications,
          answers: mergedAnswers,
        },
      });
      setEditingMed(false);
      setSuccess('Medical history updated and saved as a new dated record.');
      await loadDetail();
    } catch (err) {
      setMedErrors({ form: err.message });
    } finally {
      setSavingMed(false);
    }
  };

  const provinceList = Object.keys(locations);
  const cityList =
    profileForm.province && locations[profileForm.province]
      ? Object.keys(locations[profileForm.province])
      : [];
  const barangayList =
    profileForm.province &&
    profileForm.city &&
    locations[profileForm.province]?.[profileForm.city]
      ? locations[profileForm.province][profileForm.city]
      : [];
  const editDaysCount = getDaysInMonth(profileForm.dob_year, profileForm.dob_month);
  const editDayOptions = Array.from({ length: editDaysCount }, (_, i) =>
    String(i + 1).padStart(2, '0')
  );

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb / Back Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-white hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <Icon name="left" className="h-4 w-4" /> Back to Patients List
        </button>
        <span className="font-mono text-xs font-bold text-slate-600">
          Chart No: {patient.patient_no}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"
        >
          {success}
        </div>
      )}

      {/* =================================================================== */}
      {/* MAIN LAYOUT: LEFT SIDEBAR + RIGHT CONTENT AREA */}
      {/* =================================================================== */}
      <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
        {/* LEFT SIDEBAR: PROFILE CARD */}
        <Card className="space-y-5">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-extrabold text-blue-800 shadow-inner">
              {initials}
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-slate-900">{displayName}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {[
                patientAge !== null ? `${patientAge} yrs old` : null,
                patient.sex ? capitalize(patient.sex) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-0.5 font-mono text-xs font-bold text-slate-500">
              {patient.patient_no}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 border-y border-slate-100 py-3.5">
            {patient.is_active !== false ? (
              <Badge tone="info">Active</Badge>
            ) : (
              <Badge tone="neutral">Archived</Badge>
            )}

            {patient.has_consent ? (
              <Badge tone="success">Consent Complete</Badge>
            ) : (
              <Badge tone="danger">Consent Missing</Badge>
            )}
          </div>

          <div className="space-y-2.5">
            <Button variant="primary" onClick={openEditProfile} className="w-full">
              Edit Profile
            </Button>
            <Button
              variant="secondary"
              onClick={handleToggleArchive}
              className={`w-full ${
                patient.is_active !== false
                  ? 'border-red-300 text-red-700 hover:bg-red-50'
                  : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {patient.is_active !== false ? 'Archive' : 'Restore Patient'}
            </Button>
          </div>
        </Card>

        {/* RIGHT CONTENT AREA: TABS + TAB PANELS */}
        <div className="space-y-5 min-w-0">
          <Card className="p-0 overflow-hidden">
            <div className="px-4 pt-2 sm:px-6">
              <Tabs
                activeTab={activeTab}
                onChange={setActiveTab}
                tabs={[
                  { id: 'overview', label: 'Overview' },
                  { id: 'medical', label: 'Medical History' },
                  { id: 'appointments', label: `Appointments (${appointments.length})` },
                  { id: 'chart', label: 'Chart' },
                  { id: 'ledger', label: 'Ledger' },
                ]}
              />
            </div>

            <div className="p-4 sm:p-6">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="grid gap-5 md:grid-cols-2">
                  {/* Personal Details */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700 border-b border-slate-100 pb-2">
                      Personal Details
                    </h2>
                    <dl className="space-y-2.5 text-sm">
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">Full Name</dt>
                        <dd className="font-bold text-slate-900">{displayName}</dd>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <dt className="text-xs font-semibold text-slate-500">Date of Birth</dt>
                          <dd className="font-medium text-slate-900">
                            {patient.birth_date
                              ? formatFriendlyDate(patient.birth_date, false)
                              : 'Not provided'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-slate-500">Age & Gender</dt>
                          <dd className="font-medium text-slate-900">
                            {[
                              patientAge !== null ? `${patientAge} yrs` : null,
                              patient.sex ? capitalize(patient.sex) : null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Not provided'}
                          </dd>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <dt className="text-xs font-semibold text-slate-500">Civil Status</dt>
                          <dd className="font-medium text-slate-900">
                            {patient.civil_status ? toTitleCase(patient.civil_status) : 'Single'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-slate-500">Occupation</dt>
                          <dd className="font-medium text-slate-900">
                            {patient.occupation ? toTitleCase(patient.occupation) : 'Not specified'}
                          </dd>
                        </div>
                      </div>
                    </dl>
                  </div>

                  {/* Contact Info */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700 border-b border-slate-100 pb-2">
                      Contact Info
                    </h2>
                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">Mobile Number</dt>
                        <dd className="font-bold text-slate-900">
                          {patient.phone || 'Not provided'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">Email Address</dt>
                        <dd className="font-medium text-slate-900 break-all">
                          {patient.email || 'Not provided'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">Registered On</dt>
                        <dd className="font-medium text-slate-900">
                          {patient.registered_date
                            ? formatFriendlyDate(patient.registered_date, false)
                            : 'On file'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Address */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700 border-b border-slate-100 pb-2">
                      Address
                    </h2>
                    {addressLines.length > 0 ? (
                      <dl className="space-y-2 text-sm">
                        {addressLines.map((line) => (
                          <div key={line.label} className="flex justify-between gap-3">
                            <dt className="text-xs font-semibold text-slate-500">{line.label}</dt>
                            <dd className="text-right font-medium text-slate-900">{line.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-sm text-slate-500">No address recorded.</p>
                    )}
                  </div>

                  {/* Guardian Details (<18) OR Emergency Contact (>=18) */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">
                        {isMinor ? 'Guardian Details' : 'Emergency Contact'}
                      </h2>
                      {isMinor && <Badge tone="warning">Minor (Under 18)</Badge>}
                    </div>

                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">
                          {isMinor ? 'Parent / Legal Guardian Name' : 'Emergency Contact Name'}
                        </dt>
                        <dd className="font-bold text-slate-900">
                          {patient.guardian_name
                            ? toTitleCase(patient.guardian_name)
                            : 'Not recorded'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-slate-500">
                          {isMinor ? 'Guardian Contact Number' : 'Emergency Contact Number'}
                        </dt>
                        <dd className="font-medium text-slate-900">
                          {patient.guardian_phone || 'Not recorded'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Data Privacy / Consent Card */}
                  <div
                    className={`md:col-span-2 rounded-2xl border p-5 ${
                      patient.has_consent
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-red-300 bg-red-50/60'
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-bold text-slate-900">
                            Data Privacy & Terms Consent (RA 10173)
                          </h2>
                          {patient.has_consent ? (
                            <Badge tone="success">Complete</Badge>
                          ) : (
                            <Badge tone="danger">Missing</Badge>
                          )}
                        </div>

                        {patient.has_consent ? (
                          <p className="text-xs font-medium text-slate-700">
                            Recorded on{' '}
                            <strong>
                              {patient.consent_date
                                ? formatFriendlyDate(patient.consent_date, false)
                                : 'file'}
                            </strong>{' '}
                            · Policy Version:{' '}
                            <strong>{patient.consent_version || CLINIC_SETTINGS.termsVersion}</strong>
                            {patient.consent_recorded_by_name
                              ? ` · Recorded by ${toTitleCase(patient.consent_recorded_by_name)}`
                              : ''}
                          </p>
                        ) : (
                          <p className="text-xs font-semibold text-red-700">
                            Warning: This patient does not have an active Terms and Data Privacy consent record on file.
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        {patient.has_consent ? (
                          <Button
                            variant="secondary"
                            className="border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => setWithdrawModalOpen(true)}
                          >
                            Withdraw Consent
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() => {
                              setConsentError('');
                              setConsentForm({ terms_accepted: false, privacy_accepted: false });
                              setConsentModalOpen(true);
                            }}
                          >
                            Record Consent
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MEDICAL HISTORY */}
              {activeTab === 'medical' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Medical History</h2>
                      <p className="mt-0.5 text-xs font-semibold text-slate-600">
                        Last updated:{' '}
                        {medHistory?.recorded_date
                          ? formatFriendlyDate(medHistory.recorded_date, false)
                          : 'Never recorded'}
                      </p>
                    </div>
                    <Button variant="primary" onClick={openEditMedHistory}>
                      Edit Medical History
                    </Button>
                  </div>

                  {cleanMedicalItems.length > 0 ? (
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {cleanMedicalItems.map((item) => (
                        <li
                          key={item.title}
                          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                        >
                          <span className="block text-xs font-bold uppercase tracking-wider text-blue-800">
                            {item.title}
                          </span>
                          <span className="mt-1 block text-sm font-semibold text-slate-900">
                            {item.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
                      <p className="text-base font-bold text-slate-800">None reported</p>
                      <p className="mt-1 text-xs text-slate-600">
                        The patient has not reported any affirmative medical conditions, allergies, or medications.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: APPOINTMENTS */}
              {activeTab === 'appointments' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <h2 className="text-lg font-bold text-slate-900">Appointment History</h2>
                    <p className="text-xs text-slate-600">
                      Scheduled, completed, and past appointments for {displayName}.
                    </p>
                  </div>

                  {appointments.length === 0 ? (
                    <EmptyState
                      title="No appointments recorded"
                      description="This patient does not have any scheduled or past appointments yet."
                    />
                  ) : (
                    <div className="space-y-3">
                      {appointments.map((a) => (
                        <div
                          key={a.id}
                          className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                tone={
                                  a.status === 'confirmed' || a.status === 'completed'
                                    ? 'success'
                                    : a.status === 'cancelled' || a.status === 'no_show'
                                    ? 'danger'
                                    : 'info'
                                }
                              >
                                {capitalize(a.status?.replace('_', ' '))}
                              </Badge>
                              {a.reference_no && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                                  {a.reference_no}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-slate-900">
                              {formatFriendlyDate(a.appointment_date, true)} ·{' '}
                              {formatTime12(a.appointment_time)}
                            </p>
                            <p className="text-xs text-slate-700">
                              <strong>Dentist:</strong> Dr. {toTitleCase(a.dentist_name || 'Assigned Dentist')} ·{' '}
                              <strong>Reason:</strong> {a.reason || 'Consultation'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: CHART (ODONTOGRAM) */}
              {activeTab === 'chart' && (
                <DentalChartTab
                  patientId={patient.id}
                  onLedgerUpdated={() => setLedgerRefreshKey((k) => k + 1)}
                  onAddCharge={handleAddLedgerTransaction}
                />
              )}

              {/* TAB 5: INDIVIDUAL PATIENT LEDGER */}
              {activeTab === 'ledger' && (
                <PatientLedgerTab
                  patientId={patient.id}
                  refreshKey={ledgerRefreshKey}
                  transactions={ledgerTransactions}
                  onAddTransaction={handleAddLedgerTransaction}
                />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL: EDIT PROFILE */}
      {/* =================================================================== */}
      {editingProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm"
          onClick={() => setEditingProfile(false)}
        >
          <form
            ref={profileFormRef}
            onSubmit={handleSaveProfile}
            noValidate
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Patient Profile</h2>
                <p className="text-xs text-slate-600">{displayName} ({patient.patient_no})</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {profileErrors.form && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {profileErrors.form}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Personal Details
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className={tokens.label}>First Name *</label>
                    <input
                      type="text"
                      value={profileForm.first_name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, first_name: e.target.value })
                      }
                      className={`${tokens.input} ${
                        profileErrors.first_name ? tokens.inputError : ''
                      }`}
                    />
                    {profileErrors.first_name && (
                      <p className={tokens.error}>{profileErrors.first_name}</p>
                    )}
                  </div>
                  <div>
                    <label className={tokens.label}>Middle Name</label>
                    <input
                      type="text"
                      value={profileForm.middle_name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, middle_name: e.target.value })
                      }
                      className={tokens.input}
                    />
                  </div>
                  <div>
                    <label className={tokens.label}>Last Name *</label>
                    <input
                      type="text"
                      value={profileForm.last_name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, last_name: e.target.value })
                      }
                      className={`${tokens.input} ${
                        profileErrors.last_name ? tokens.inputError : ''
                      }`}
                    />
                    {profileErrors.last_name && (
                      <p className={tokens.error}>{profileErrors.last_name}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className={tokens.label}>Date of Birth *</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <select
                      value={profileForm.dob_month}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, dob_month: e.target.value })
                      }
                      className={tokens.input}
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={profileForm.dob_day}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, dob_day: e.target.value })
                      }
                      className={tokens.input}
                    >
                      <option value="">Day</option>
                      {editDayOptions.map((d) => (
                        <option key={d} value={d}>
                          {Number(d)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={profileForm.dob_year}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, dob_year: e.target.value })
                      }
                      className={tokens.input}
                    >
                      <option value="">Year (YYYY)</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  {profileErrors.birth_date && (
                    <p className={tokens.error}>{profileErrors.birth_date}</p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className={tokens.label}>Gender *</label>
                    <select
                      value={profileForm.sex}
                      onChange={(e) => setProfileForm({ ...profileForm, sex: e.target.value })}
                      className={tokens.input}
                    >
                      <option value="">Select</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                    {profileErrors.sex && <p className={tokens.error}>{profileErrors.sex}</p>}
                  </div>
                  <div>
                    <label className={tokens.label}>Civil Status</label>
                    <select
                      value={profileForm.civil_status}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, civil_status: e.target.value })
                      }
                      className={tokens.input}
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                    </select>
                  </div>
                  <div>
                    <label className={tokens.label}>Occupation</label>
                    <input
                      type="text"
                      value={profileForm.occupation}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, occupation: e.target.value })
                      }
                      className={tokens.input}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Contact & Address
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={tokens.label}>Mobile Number *</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className={`${tokens.input} ${profileErrors.phone ? tokens.inputError : ''}`}
                    />
                    {profileErrors.phone && <p className={tokens.error}>{profileErrors.phone}</p>}
                  </div>
                  <div>
                    <label className={tokens.label}>Email Address</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      className={tokens.input}
                    />
                    {profileErrors.email && <p className={tokens.error}>{profileErrors.email}</p>}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className={tokens.label}>Province *</label>
                    <select
                      value={profileForm.province}
                      onChange={(e) => {
                        const nextProv = e.target.value;
                        const firstCity =
                          nextProv && locations[nextProv]
                            ? Object.keys(locations[nextProv])[0] || ''
                            : '';
                        setProfileForm({
                          ...profileForm,
                          province: nextProv,
                          city: firstCity,
                          barangay: '',
                        });
                      }}
                      className={tokens.input}
                    >
                      <option value="">Select Province</option>
                      {provinceList.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={tokens.label}>City / Municipality *</label>
                    <select
                      value={profileForm.city}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, city: e.target.value, barangay: '' })
                      }
                      className={tokens.input}
                    >
                      <option value="">Select City</option>
                      {cityList.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={tokens.label}>Barangay *</label>
                    <select
                      value={profileForm.barangay}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, barangay: e.target.value })
                      }
                      className={tokens.input}
                    >
                      <option value="">Select Barangay</option>
                      {barangayList.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    {profileErrors.barangay && (
                      <p className={tokens.error}>{profileErrors.barangay}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className={tokens.label}>Street / House No.</label>
                  <input
                    type="text"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className={tokens.input}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  {isMinor ? 'Guardian Details (Required for Under 18)' : 'Emergency Contact'}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={tokens.label}>
                      {isMinor ? 'Guardian Full Name *' : 'Emergency Contact Name'}
                    </label>
                    <input
                      type="text"
                      value={profileForm.guardian_name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, guardian_name: e.target.value })
                      }
                      className={tokens.input}
                    />
                    {profileErrors.guardian_name && (
                      <p className={tokens.error}>{profileErrors.guardian_name}</p>
                    )}
                  </div>
                  <div>
                    <label className={tokens.label}>
                      {isMinor ? 'Guardian Contact Number *' : 'Emergency Contact Number'}
                    </label>
                    <input
                      type="tel"
                      value={profileForm.guardian_phone}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, guardian_phone: e.target.value })
                      }
                      className={tokens.input}
                    />
                    {profileErrors.guardian_phone && (
                      <p className={tokens.error}>{profileErrors.guardian_phone}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2.5 border-t border-slate-200 bg-white px-6 py-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingProfile(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: EDIT MEDICAL HISTORY */}
      {/* =================================================================== */}
      {editingMed && (
        <Modal
          title="Edit Medical History"
          subtitle={`${displayName} · Saves as a new dated record`}
          maxWidth="max-w-xl"
          onClose={() => setEditingMed(false)}
        >
          <form onSubmit={handleSaveMedHistory} noValidate className="space-y-4">
            {medErrors.form && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700">
                {medErrors.form}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
                Medical Conditions (Tick all that apply)
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-800">
                {COMMON_CONDITIONS.map((cond) => (
                  <label key={cond} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={medForm.selected_conditions.includes(cond)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...medForm.selected_conditions, cond]
                          : medForm.selected_conditions.filter((x) => x !== cond);
                        setMedForm({ ...medForm, selected_conditions: next });
                      }}
                      className="h-4 w-4 rounded accent-blue-600"
                    />
                    {cond}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {MEDICAL_QUESTIONS.filter((q) => q.id !== 'good_health').map((q) => {
                const ans = medForm.answers[q.id] || { choice: 'no', details: '' };
                const hasErr = Boolean(medErrors[q.id]);
                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border p-3.5 text-xs ${
                      hasErr ? 'border-red-400 bg-red-50/50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{q.title}</span>
                      <div className="flex items-center gap-4">
                        <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                          <input
                            type="radio"
                            checked={ans.choice === 'yes'}
                            onChange={() =>
                              setMedForm({
                                ...medForm,
                                answers: {
                                  ...medForm.answers,
                                  [q.id]: { ...ans, choice: 'yes' },
                                },
                              })
                            }
                            className="h-4 w-4 accent-blue-600"
                          />
                          Yes
                        </label>
                        <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                          <input
                            type="radio"
                            checked={ans.choice === 'no'}
                            onChange={() => {
                              setMedForm({
                                ...medForm,
                                answers: {
                                  ...medForm.answers,
                                  [q.id]: { choice: 'no', details: '' },
                                },
                              });
                              setMedErrors({ ...medErrors, [q.id]: undefined });
                            }}
                            className="h-4 w-4 accent-blue-600"
                          />
                          No
                        </label>
                      </div>
                    </div>
                    <p className="mt-0.5 text-slate-600">{q.question}</p>

                    {ans.choice === 'yes' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder={`Specify ${q.title.toLowerCase()} details *`}
                          value={ans.details || ''}
                          onChange={(e) =>
                            setMedForm({
                              ...medForm,
                              answers: {
                                ...medForm.answers,
                                [q.id]: { ...ans, details: e.target.value },
                              },
                            })
                          }
                          className={`${tokens.input} ${hasErr ? tokens.inputError : ''}`}
                        />
                        {hasErr && <p className={tokens.error}>{medErrors[q.id]}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {patient.sex === 'female' && (
              <div className="rounded-2xl border border-pink-300 bg-pink-50/60 p-3.5 text-xs">
                <span className="block font-bold text-pink-950">
                  Currently Pregnant or Nursing?
                </span>
                <div className="mt-2 flex gap-5">
                  <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                    <input
                      type="radio"
                      checked={medForm.is_pregnant === true}
                      onChange={() => setMedForm({ ...medForm, is_pregnant: true })}
                      className="h-4 w-4 accent-pink-600"
                    />
                    Yes
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                    <input
                      type="radio"
                      checked={medForm.is_pregnant === false}
                      onChange={() => setMedForm({ ...medForm, is_pregnant: false })}
                      className="h-4 w-4 accent-pink-600"
                    />
                    No
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditingMed(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingMed}>
                {savingMed ? 'Saving...' : 'Save Medical History'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: RECORD CONSENT */}
      {/* =================================================================== */}
      {consentModalOpen && (
        <Modal
          title="Record Patient Consent"
          subtitle={`${displayName} (${patient.patient_no})`}
          onClose={() => setConsentModalOpen(false)}
        >
          <form onSubmit={handleRecordConsent} className="space-y-4">
            <p className="text-xs leading-relaxed text-slate-700">
              Confirm that the patient (or legal guardian if under 18) has signed the clinic's Terms and Conditions and Data Privacy consent forms.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-800">
                <input
                  type="checkbox"
                  checked={consentForm.terms_accepted}
                  onChange={(e) =>
                    setConsentForm({ ...consentForm, terms_accepted: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-blue-600"
                />
                <span>
                  Patient accepted <strong>Terms and Conditions ({CLINIC_SETTINGS.termsVersion})</strong>. *
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-800">
                <input
                  type="checkbox"
                  checked={consentForm.privacy_accepted}
                  onChange={(e) =>
                    setConsentForm({ ...consentForm, privacy_accepted: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-blue-600"
                />
                <span>
                  Patient accepted <strong>Privacy Policy ({CLINIC_SETTINGS.privacyVersion}, RA 10173)</strong>. *
                </span>
              </label>
            </div>
            {consentError && <p className={tokens.error}>{consentError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setConsentModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  savingConsent || !consentForm.terms_accepted || !consentForm.privacy_accepted
                }
              >
                {savingConsent ? 'Saving...' : 'Save Consent'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: WITHDRAW CONSENT CONFIRMATION */}
      {/* =================================================================== */}
      {withdrawModalOpen && (
        <Modal
          title="Withdraw Data Privacy Consent"
          subtitle={`${displayName} (${patient.patient_no})`}
          onClose={() => setWithdrawModalOpen(false)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to withdraw this patient's Data Privacy and Terms consent? The patient's status will be marked as <strong>Consent Missing</strong> and the withdrawal will be logged.
            </p>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setWithdrawModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
                disabled={savingConsent}
                onClick={handleWithdrawConsent}
              >
                {savingConsent ? 'Withdrawing...' : 'Confirm Withdraw Consent'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}