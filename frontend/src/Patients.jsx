import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import {
  CLINIC_SETTINGS,
  capitalize,
  formatCleanAddress,
  formatFriendlyDate,
  formatTime12,
  todayManila,
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
import PatientChart from './PatientChart';
import PatientLedger from './PatientLedger';
import DentalChartTab from './DentalChartTab';
import DuplicatesModal from './DuplicatesModal';

const QUESTIONS = [
  { id: 'good_health', label: '1. Are you in good health?' },
  { id: 'medical_treatment', label: '2. Are you currently undergoing medical treatment?' },
  { id: 'serious_illness', label: '3. Have you ever had a serious illness or surgical operation?' },
  { id: 'hospitalized', label: '4. Have you ever been hospitalized?' },
  { id: 'taking_medication', label: '5. Are you taking any prescription or non-prescription medication?' },
  { id: 'tobacco', label: '6. Do you use tobacco products?' },
  { id: 'alcohol', label: '7. Do you drink alcoholic beverages?' },
  { id: 'dangerous_drugs', label: '8. Have you ever used recreational or dangerous drugs?' },
  { id: 'allergies_exist', label: '9. Are you allergic to anything (food, drugs, latex, penicillin)?' },
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

const formatPeso = (num) =>
  '₱' +
  Number(num || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const isPhilippinePhone = (p = '') =>
  /^(09\d{9}|\+639\d{9}|639\d{9})$/.test(String(p).replace(/[\s\-()]/g, ''));

function calculateAge(bdate) {
  if (!bdate) return null;
  const [y, m, d] = String(bdate).slice(0, 10).split('-').map(Number);
  if (!y) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const mo = now.getMonth() + 1 - (m || 1);
  if (mo < 0 || (mo === 0 && now.getDate() < (d || 1))) age--;
  return age;
}

export default function Patients() {
  const todayStr = todayManila();

  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedPatientId, setSelectedPatientId] = useState(() => {
    const saved = sessionStorage.getItem('selected_patient_id');
    if (saved) {
      sessionStorage.removeItem('selected_patient_id');
      return saved;
    }
    return null;
  });
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState('profile');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [duplicatesModalOpen, setDuplicatesModalOpen] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [newFormErrors, setNewFormErrors] = useState({});
  const [newForm, setNewForm] = useState({
    patient_no: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    birth_date: '',
    sex: 'female',
    civil_status: 'Single',
    occupation: '',
    phone: '',
    email: '',
    address: '',
    barangay: '',
    city: 'Legazpi City',
    province: 'Albay',
    guardian_name: '',
    guardian_phone: '',
    notes: '',
    allergies: '',
    medications: '',
    medical_notes: '',
    terms_accepted: true,
    privacy_accepted: true,
  });

  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [editingMedical, setEditingMedical] = useState(false);
  const [medForm, setMedForm] = useState({
    allergies: '',
    medications: '',
    is_pregnant: false,
    answers: {},
    selected_conditions: [],
  });
  const [savingMed, setSavingMed] = useState(false);

  const loadPatients = async (q = searchQuery) => {
    setLoadingList(true);
    setError('');
    try {
      const rows = await api(`api/patients?q=${encodeURIComponent(q.trim())}`);
      setPatients(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Failed to load patients directory.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      loadPatients(searchQuery);
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadPatientDetail = async (id) => {
    if (!id) return;
    setLoadingDetail(true);
    setError('');
    try {
      const res = await api(`api/staff/patients/${id}`);
      setDetailData(res);
      setEditingProfile(false);
      setEditingMedical(false);
    } catch (err) {
      setError(err.message || 'Failed to load patient record.');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      loadPatientDetail(selectedPatientId);
    } else {
      setDetailData(null);
    }
  }, [selectedPatientId]);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (statusFilter === 'active') return p.is_active !== false;
      if (statusFilter === 'archived') return p.is_active === false;
      return true;
    });
  }, [patients, statusFilter]);

  const handleOpenAddModal = async () => {
    setNewFormErrors({});
    setError('');
    let nextNo = '';
    try {
      const res = await api('api/patients/next-no');
      nextNo = res?.patient_no || '';
    } catch {}

    setNewForm({
      patient_no: nextNo,
      first_name: '',
      middle_name: '',
      last_name: '',
      birth_date: '',
      sex: 'female',
      civil_status: 'Single',
      occupation: '',
      phone: '',
      email: '',
      address: '',
      barangay: '',
      city: 'Legazpi City',
      province: 'Albay',
      guardian_name: '',
      guardian_phone: '',
      notes: '',
      allergies: '',
      medications: '',
      medical_notes: '',
      terms_accepted: true,
      privacy_accepted: true,
    });
    setAddModalOpen(true);
  };

  const isNewPatientMinor =
    calculateAge(newForm.birth_date) !== null && calculateAge(newForm.birth_date) < 18;

  const handleCreatePatientSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!newForm.first_name.trim()) errs.first_name = 'First name is required.';
    if (!newForm.last_name.trim()) errs.last_name = 'Last name is required.';
    if (!newForm.birth_date) errs.birth_date = 'Date of birth is required.';
    if (!newForm.phone.trim() || !isPhilippinePhone(newForm.phone)) {
      errs.phone = 'Enter a valid Philippine mobile number (e.g. 0917 123 4567).';
    }
    if (isNewPatientMinor) {
      if (!newForm.guardian_name.trim()) {
        errs.guardian_name = 'Guardian name is required for minors.';
      }
      if (!newForm.guardian_phone.trim() || !isPhilippinePhone(newForm.guardian_phone)) {
        errs.guardian_phone = 'Valid guardian Philippine mobile number is required.';
      }
    }
    if (!newForm.terms_accepted || !newForm.privacy_accepted) {
      errs.consent = 'Both Terms and Data Privacy (RA 10173) consents are required.';
    }

    if (Object.keys(errs).length > 0) {
      setNewFormErrors(errs);
      return;
    }

    setSavingNew(true);
    setNewFormErrors({});
    try {
      const created = await api('api/patients', {
        method: 'POST',
        body: newForm,
      });
      setAddModalOpen(false);
      setSuccess(`Created patient record for ${created.first_name} ${created.last_name} (${created.patient_no}).`);
      await loadPatients();
      setSelectedPatientId(created.id);
      setDetailTab('profile');
    } catch (err) {
      setNewFormErrors({ form: err.message || 'Failed to create patient.' });
    } finally {
      setSavingNew(false);
    }
  };

  const startEditProfile = () => {
    const p = detailData?.patient;
    if (!p) return;
    setEditForm({
      first_name: p.first_name || '',
      middle_name: p.middle_name || '',
      last_name: p.last_name || '',
      birth_date: p.birth_date || '',
      sex: p.sex || 'female',
      civil_status: p.civil_status || 'Single',
      occupation: p.occupation || '',
      phone: p.phone || '',
      email: p.email || '',
      address: p.address || '',
      barangay: p.barangay || '',
      city: p.city || '',
      province: p.province || '',
      guardian_name: p.guardian_name || '',
      guardian_phone: p.guardian_phone || '',
    });
    setEditingProfile(true);
  };

  const handleSaveEditProfile = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    setError('');
    setSuccess('');
    try {
      await api(`api/staff/patients/${selectedPatientId}`, {
        method: 'PUT',
        body: editForm,
      });
      setSuccess('Patient profile updated.');
      setEditingProfile(false);
      await Promise.all([loadPatientDetail(selectedPatientId), loadPatients()]);
    } catch (err) {
      setError(err.message || 'Failed to update patient profile.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleArchive = async () => {
    const p = detailData?.patient;
    if (!p) return;
    const nextActive = p.is_active === false;
    try {
      await api(`api/staff/patients/${p.id}/archive`, {
        method: 'PATCH',
        body: { is_active: nextActive },
      });
      setSuccess(nextActive ? 'Patient record restored.' : 'Patient record archived.');
      await Promise.all([loadPatientDetail(p.id), loadPatients()]);
    } catch (err) {
      setError(err.message || 'Failed to update archive status.');
    }
  };

  const handleRecordConsent = async () => {
    const p = detailData?.patient;
    if (!p) return;
    try {
      await api(`api/staff/patients/${p.id}/consent`, {
        method: 'POST',
        body: { terms_accepted: true, privacy_accepted: true },
      });
      setSuccess('RA 10173 Data Privacy consent recorded.');
      await loadPatientDetail(p.id);
    } catch (err) {
      setError(err.message || 'Failed to record consent.');
    }
  };

  const startEditMedical = () => {
    const mh = detailData?.medical_history || {};
    setMedForm({
      allergies: mh.allergies || '',
      medications: mh.medications || '',
      is_pregnant: Boolean(mh.is_pregnant),
      answers: mh.answers || {},
      selected_conditions: mh.answers?.selected_conditions || [],
    });
    setEditingMedical(true);
  };

  const handleSaveMedical = async (e) => {
    e.preventDefault();
    setSavingMed(true);
    setError('');
    setSuccess('');
    try {
      await api(`api/staff/patients/${selectedPatientId}/medical-history`, {
        method: 'POST',
        body: {
          ...medForm,
          answers: {
            ...medForm.answers,
            selected_conditions: medForm.selected_conditions,
          },
        },
      });
      setSuccess('Medical history updated.');
      setEditingMedical(false);
      await loadPatientDetail(selectedPatientId);
    } catch (err) {
      setError(err.message || 'Failed to save medical history.');
    } finally {
      setSavingMed(false);
    }
  };

  // ===========================================================================
  // VIEW A: SELECTED PATIENT WORKSPACE
  // ===========================================================================
  if (selectedPatientId) {
    const pat = detailData?.patient;
    const mh = detailData?.medical_history;
    const appts = detailData?.appointments || [];
    const patAge = calculateAge(pat?.birth_date);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSelectedPatientId(null);
              setError('');
              setSuccess('');
            }}
          >
            ← Back to Patients Directory
          </Button>

          {pat && (
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant={pat.is_active === false ? 'primary' : 'secondary'}
                onClick={handleToggleArchive}
              >
                {pat.is_active === false ? 'Restore Patient' : 'Archive Patient'}
              </Button>
            </div>
          )}
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

        {loadingDetail || !pat ? (
          <Card className="p-12 text-center text-xs font-medium text-slate-500">
            Loading patient clinical record...
          </Card>
        ) : (
          <>
            <Card className="p-7 sm:p-8">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-sm shadow-blue-600/20">
                    {(pat.first_name?.[0] || 'P').toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
                        {pat.last_name}, {pat.first_name} {pat.middle_name || ''}
                      </h1>
                      <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-mono text-xs font-bold text-blue-700">
                        {pat.patient_no}
                      </span>
                      {pat.email && (
                        pat.is_claimed ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                            Portal Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                            Portal Unclaimed
                          </span>
                        )
                      )}
                      <Badge status={pat.has_consent ? 'approved' : 'pending'}>
                        {pat.has_consent ? 'RA 10173 Consent On File' : 'Consent Pending'}
                      </Badge>
                      {pat.is_active === false && (
                        <Badge status="cancelled">Archived</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {pat.phone || 'No mobile'} · {pat.email || 'No email'} ·{' '}
                      {patAge !== null ? `${patAge} yrs old` : 'Age N/A'} ({capitalize(pat.sex)})
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card noPadding className="overflow-hidden">
              <div className="bg-slate-50/50 px-6 pt-2">
                <Tabs
                  activeTab={detailTab}
                  onChange={(id) => {
                    setError('');
                    setSuccess('');
                    setDetailTab(id);
                  }}
                  tabs={[
                    { id: 'profile', label: 'Profile & Consent' },
                    { id: 'chart', label: 'Dental Chart (Odontogram)' },
                    { id: 'ledger', label: 'Financial Ledger & Receipts' },
                    { id: 'medical', label: 'Medical History' },
                    { id: 'appointments', label: `Appointments (${appts.length})` },
                  ]}
                />
              </div>

              <div className="p-6 sm:p-8">
                {detailTab === 'profile' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h2 className="text-base font-bold text-slate-900">
                        Demographics &amp; Contact Information
                      </h2>
                      {!editingProfile && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={startEditProfile}
                        >
                          Edit Patient Info
                        </Button>
                      )}
                    </div>

                    {editingProfile ? (
                      <form onSubmit={handleSaveEditProfile} className="space-y-5">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <InputField
                            label="First Name"
                            required
                            value={editForm.first_name}
                            onChange={(e) =>
                              setEditForm({ ...editForm, first_name: e.target.value })
                            }
                          />
                          <InputField
                            label="Middle Name"
                            value={editForm.middle_name}
                            onChange={(e) =>
                              setEditForm({ ...editForm, middle_name: e.target.value })
                            }
                          />
                          <InputField
                            label="Last Name"
                            required
                            value={editForm.last_name}
                            onChange={(e) =>
                              setEditForm({ ...editForm, last_name: e.target.value })
                            }
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <InputField
                            label="Date of Birth"
                            type="date"
                            max={todayStr}
                            value={editForm.birth_date}
                            onChange={(e) =>
                              setEditForm({ ...editForm, birth_date: e.target.value })
                            }
                          />
                          <InputField
                            label="Gender / Sex"
                            as="select"
                            value={editForm.sex}
                            onChange={(e) =>
                              setEditForm({ ...editForm, sex: e.target.value })
                            }
                          >
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                            <option value="other">Other</option>
                          </InputField>
                          <InputField
                            label="Civil Status"
                            as="select"
                            value={editForm.civil_status}
                            onChange={(e) =>
                              setEditForm({ ...editForm, civil_status: e.target.value })
                            }
                          >
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Widowed">Widowed</option>
                            <option value="Separated">Separated</option>
                          </InputField>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <InputField
                            label="Mobile Number (PH)"
                            type="tel"
                            required
                            value={editForm.phone}
                            onChange={(e) =>
                              setEditForm({ ...editForm, phone: e.target.value })
                            }
                          />
                          <InputField
                            label="Email Address"
                            type="email"
                            value={editForm.email}
                            onChange={(e) =>
                              setEditForm({ ...editForm, email: e.target.value })
                            }
                          />
                          <InputField
                            label="Occupation"
                            value={editForm.occupation}
                            onChange={(e) =>
                              setEditForm({ ...editForm, occupation: e.target.value })
                            }
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                          <div className="sm:col-span-2">
                            <InputField
                              label="Street Address"
                              value={editForm.address}
                              onChange={(e) =>
                                setEditForm({ ...editForm, address: e.target.value })
                              }
                            />
                          </div>
                          <InputField
                            label="Barangay"
                            value={editForm.barangay}
                            onChange={(e) =>
                              setEditForm({ ...editForm, barangay: e.target.value })
                            }
                          />
                          <InputField
                            label="City"
                            value={editForm.city}
                            onChange={(e) =>
                              setEditForm({ ...editForm, city: e.target.value })
                            }
                          />
                        </div>

                        <div className="flex justify-end gap-2.5 pt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEditingProfile(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" variant="primary" disabled={savingEdit}>
                            {savingEdit ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                          <span className="block text-xs font-bold uppercase text-slate-400">
                            Date of Birth
                          </span>
                          <strong className="mt-1 block font-bold text-slate-900">
                            {pat.birth_date ? formatFriendlyDate(pat.birth_date, false) : '-'}
                          </strong>
                        </div>
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                          <span className="block text-xs font-bold uppercase text-slate-400">
                            Civil Status &amp; Occupation
                          </span>
                          <strong className="mt-1 block font-bold text-slate-900">
                            {pat.civil_status || '-'} · {pat.occupation || 'Not specified'}
                          </strong>
                        </div>
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                          <span className="block text-xs font-bold uppercase text-slate-400">
                            Address
                          </span>
                          <strong className="mt-1 block font-bold text-slate-900">
                            {formatCleanAddress(pat)}
                          </strong>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Data Privacy Consent (RA 10173)
                        </h3>
                        <p className="mt-0.5 text-xs font-medium text-slate-500">
                          {pat.has_consent
                            ? `Signed (${pat.consent_version || 'v1.0'}) on ${
                                pat.consent_date
                                  ? formatFriendlyDate(pat.consent_date, false)
                                  : 'File'
                              }`
                            : 'No signed consent on file yet.'}
                        </p>
                      </div>
                      {!pat.has_consent && (
                        <Button
                          type="button"
                          variant="primary"
                          onClick={handleRecordConsent}
                        >
                          Record Signed Consent
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {detailTab === 'chart' && (
                  <DentalChartTab
                    patientId={pat.id}
                    patient={pat}
                    onUpdate={() => loadPatientDetail(pat.id)}
                  />
                )}

                {detailTab === 'ledger' && (
                  <PatientLedger patientId={pat.id} patient={pat} />
                )}

                {detailTab === 'medical' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Medical History Questionnaire
                        </h2>
                        <p className="text-xs font-medium text-slate-500">
                          Last updated:{' '}
                          {mh?.recorded_date
                            ? formatFriendlyDate(mh.recorded_date, false)
                            : 'Not recorded'}
                        </p>
                      </div>
                      {!editingMedical && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={startEditMedical}
                        >
                          Update Medical History
                        </Button>
                      )}
                    </div>

                    {editingMedical ? (
                      <form onSubmit={handleSaveMedical} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <InputField
                            label="Known Allergies"
                            placeholder="e.g. Penicillin, Latex, None"
                            value={medForm.allergies}
                            onChange={(e) =>
                              setMedForm({ ...medForm, allergies: e.target.value })
                            }
                          />
                          <InputField
                            label="Current Medications"
                            placeholder="e.g. Amlodipine, None"
                            value={medForm.medications}
                            onChange={(e) =>
                              setMedForm({ ...medForm, medications: e.target.value })
                            }
                          />
                        </div>

                        {QUESTIONS.map((q) => {
                          const ans = medForm.answers?.[q.id] || {
                            choice: 'no',
                            details: '',
                          };
                          return (
                            <div
                              key={q.id}
                              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-2.5 text-xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-slate-800">{q.label}</span>
                                <div className="flex gap-4 font-semibold text-slate-700">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
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
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      checked={ans.choice === 'no'}
                                      onChange={() =>
                                        setMedForm({
                                          ...medForm,
                                          answers: {
                                            ...medForm.answers,
                                            [q.id]: { choice: 'no', details: '' },
                                          },
                                        })
                                      }
                                      className="h-4 w-4 accent-blue-600"
                                    />
                                    No
                                  </label>
                                </div>
                              </div>
                              {ans.choice === 'yes' && (
                                <InputField
                                  label="Required Details"
                                  required
                                  placeholder="Please specify details..."
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
                                />
                              )}
                            </div>
                          );
                        })}

                        <div className="flex justify-end gap-2.5 pt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEditingMedical(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" variant="primary" disabled={savingMed}>
                            {savingMed ? 'Saving...' : 'Save Medical History'}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                          <span className="block text-xs font-bold uppercase text-slate-400">
                            Allergies
                          </span>
                          <strong className="mt-1 block font-bold text-slate-900">
                            {mh?.allergies || 'None reported'}
                          </strong>
                        </div>
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                          <span className="block text-xs font-bold uppercase text-slate-400">
                            Medications
                          </span>
                          <strong className="mt-1 block font-bold text-slate-900">
                            {mh?.medications || 'None reported'}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'appointments' && (
                  <div className="space-y-4">
                    {appts.length === 0 ? (
                      <EmptyState
                        title="No appointments recorded for this patient"
                        description="Appointments booked on the clinic schedule will appear here."
                      />
                    ) : (
                      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
                        {appts.map((a) => (
                          <div
                            key={a.id}
                            className="flex flex-wrap items-center justify-between gap-4 p-4"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                {formatFriendlyDate(a.appointment_date, true)} at{' '}
                                {formatTime12(a.appointment_time)}
                              </p>
                              <p className="text-xs font-medium text-slate-500">
                                {a.reason || 'Consultation'}{' '}
                                {a.dentist_name ? `· Dr. ${a.dentist_name}` : ''}
                              </p>
                            </div>
                            <Badge status={a.status}>
                              {capitalize(a.status.replace('_', ' '))}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    );
  }

  // ===========================================================================
  // VIEW B: MAIN PATIENTS DIRECTORY
  // ===========================================================================
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Patients Directory</h1>
          <p className="mt-0.5 text-sm font-medium text-slate-500">
            Search, register, and manage patient dental records, odontograms, and billing ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDuplicatesModalOpen(true)}
          >
            🔍 Find Duplicates
          </Button>

          <Button type="button" variant="primary" onClick={handleOpenAddModal}>
            + New Patient
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

      {/* Search Bar & Filters */}
      <Card noPadding className="p-6">
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_220px_auto]">
          <InputField
            label="Search Patient Directory"
            type="text"
            placeholder="Search by patient name, chart no. (P-000001), or mobile number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <InputField
            label="Record Status"
            as="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="active">Active Patients</option>
            <option value="archived">Archived</option>
            <option value="all">All Records</option>
          </InputField>

          <Button
            type="button"
            variant="secondary"
            onClick={() => loadPatients(searchQuery)}
          >
            ↻ Refresh
          </Button>
        </div>
      </Card>

      {/* Patients Directory Table */}
      <Card noPadding className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4 text-xs font-semibold text-slate-500">
          <span>
            Showing <strong>{filteredPatients.length}</strong> patient{' '}
            {filteredPatients.length === 1 ? 'record' : 'records'}
          </span>
          <span>Click any row to open Chart &amp; Ledger</span>
        </div>

        <div className="hidden grid-cols-[1fr_1.8fr_1.2fr_1fr_1fr_0.9fr] items-center gap-4 border-b border-slate-100 bg-slate-50/40 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid">
          <span>Chart No.</span>
          <span>Patient Name</span>
          <span>Mobile Number</span>
          <span>Consent</span>
          <span className="text-right">Balance</span>
          <span className="text-right">Action</span>
        </div>

        {loadingList ? (
          <p className="p-12 text-center text-xs font-medium text-slate-500">
            Loading patients directory...
          </p>
        ) : filteredPatients.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No matching patient records"
              description="Try clearing your search filter or click '+ New Patient' to register a walk-in patient."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPatients.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedPatientId(p.id);
                  setDetailTab('profile');
                }}
                className="flex flex-col gap-2 px-6 py-3.5 hover:bg-blue-50/20 transition-colors cursor-pointer md:grid md:grid-cols-[1fr_1.8fr_1.2fr_1fr_1fr_0.9fr] md:items-center md:gap-4"
              >
                <div className="font-mono text-xs font-bold text-blue-600">
                  {p.patient_no}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {p.last_name}, {p.first_name} {p.middle_name || ''}
                    </span>
                    {p.email && (
                      p.is_claimed ? (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                          Unclaimed
                        </span>
                      )
                    )}
                  </div>
                  <span className="block truncate text-xs font-medium text-slate-500">
                    {p.sex ? capitalize(p.sex) : ''}{' '}
                    {p.birth_date ? `· Born ${formatFriendlyDate(p.birth_date, false)}` : ''}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-700">
                  {p.phone || '-'}
                </div>

                <div>
                  <Badge status={p.has_consent ? 'approved' : 'pending'}>
                    {p.has_consent ? 'Signed' : 'Pending'}
                  </Badge>
                </div>

                <div className="text-sm font-extrabold tabular-nums text-slate-900 md:text-right">
                  {formatPeso(p.balance || 0)}
                </div>

                <div className="flex md:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    className="!h-8 !min-h-0 !px-3 !py-1 !text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPatientId(p.id);
                      setDetailTab('profile');
                    }}
                  >
                    Open →
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* =================================================================== */}
      {/* MODAL: DUPLICATE PATIENTS SCANNER */}
      {/* =================================================================== */}
      <DuplicatesModal
        isOpen={duplicatesModalOpen}
        onClose={() => setDuplicatesModalOpen(false)}
        onSelectPatient={(id) => {
          setSelectedPatientId(id);
          setDetailTab('profile');
        }}
      />

      {/* =================================================================== */}
      {/* MODAL: + NEW PATIENT (WITH MEDICAL INTAKE & CONSENT) */}
      {/* =================================================================== */}
      {addModalOpen && (
        <Modal
          title="Register New Patient"
          subtitle="Create a new clinical chart, record medical intake, and register RA 10173 Data Privacy consent."
          maxWidth="max-w-2xl"
          onClose={() => setAddModalOpen(false)}
        >
          <form onSubmit={handleCreatePatientSubmit} noValidate className="space-y-6">
            {newFormErrors.form && (
              <div
                role="alert"
                className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-xs font-bold text-red-800 shadow-xs"
              >
                ⚠️ {newFormErrors.form}
              </div>
            )}

            {/* Section 1: Demographics */}
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600">
                1. Patient Identity
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <InputField
                  label="First Name"
                  required
                  placeholder="e.g. Maria"
                  value={newForm.first_name}
                  onChange={(e) =>
                    setNewForm({ ...newForm, first_name: e.target.value })
                  }
                  error={newFormErrors.first_name}
                />
                <InputField
                  label="Middle Name"
                  placeholder="Optional"
                  value={newForm.middle_name}
                  onChange={(e) =>
                    setNewForm({ ...newForm, middle_name: e.target.value })
                  }
                />
                <InputField
                  label="Last Name"
                  required
                  placeholder="e.g. Santos"
                  value={newForm.last_name}
                  onChange={(e) =>
                    setNewForm({ ...newForm, last_name: e.target.value })
                  }
                  error={newFormErrors.last_name}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <InputField
                  label="Date of Birth"
                  type="date"
                  required
                  max={todayStr}
                  value={newForm.birth_date}
                  onChange={(e) =>
                    setNewForm({ ...newForm, birth_date: e.target.value })
                  }
                  error={newFormErrors.birth_date}
                />
                <InputField
                  label="Gender / Sex"
                  as="select"
                  value={newForm.sex}
                  onChange={(e) => setNewForm({ ...newForm, sex: e.target.value })}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </InputField>
                <InputField
                  label="Civil Status"
                  as="select"
                  value={newForm.civil_status}
                  onChange={(e) =>
                    setNewForm({ ...newForm, civil_status: e.target.value })
                  }
                >
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                </InputField>
              </div>
            </div>

            {/* Section 2: Contact & Address */}
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600">
                2. Contact &amp; Address
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField
                  label="Mobile Number (PH)"
                  type="tel"
                  required
                  placeholder="0917 123 4567"
                  value={newForm.phone}
                  onChange={(e) =>
                    setNewForm({ ...newForm, phone: e.target.value })
                  }
                  error={newFormErrors.phone}
                />
                <InputField
                  label="Email Address"
                  type="email"
                  placeholder="patient@example.com (for portal access)"
                  value={newForm.email}
                  onChange={(e) =>
                    setNewForm({ ...newForm, email: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <InputField
                  label="Street Address"
                  placeholder="House No. & Street"
                  value={newForm.address}
                  onChange={(e) =>
                    setNewForm({ ...newForm, address: e.target.value })
                  }
                />
                <InputField
                  label="Barangay"
                  placeholder="e.g. Bitano"
                  value={newForm.barangay}
                  onChange={(e) =>
                    setNewForm({ ...newForm, barangay: e.target.value })
                  }
                />
                <InputField
                  label="City"
                  placeholder="Legazpi City"
                  value={newForm.city}
                  onChange={(e) =>
                    setNewForm({ ...newForm, city: e.target.value })
                  }
                />
              </div>

              {isNewPatientMinor && (
                <div className="grid grid-cols-1 gap-4 border-t border-amber-200 pt-4 sm:grid-cols-2">
                  <InputField
                    label="Parent / Guardian Name"
                    required
                    placeholder="Required for patients under 18"
                    value={newForm.guardian_name}
                    onChange={(e) =>
                      setNewForm({ ...newForm, guardian_name: e.target.value })
                    }
                    error={newFormErrors.guardian_name}
                  />
                  <InputField
                    label="Guardian Mobile (PH)"
                    type="tel"
                    required
                    placeholder="0917 123 4567"
                    value={newForm.guardian_phone}
                    onChange={(e) =>
                      setNewForm({ ...newForm, guardian_phone: e.target.value })
                    }
                    error={newFormErrors.guardian_phone}
                  />
                </div>
              )}
            </div>

            {/* Section 3: Medical History & Intake Alerts */}
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  3. Medical History &amp; Alerts (Optional at Intake)
                </h3>
                <span className="text-[11px] font-semibold text-slate-400">Can also be updated in chart</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField
                  label="Known Allergies"
                  placeholder="e.g. Penicillin, Latex, None"
                  value={newForm.allergies}
                  onChange={(e) =>
                    setNewForm({ ...newForm, allergies: e.target.value })
                  }
                />
                <InputField
                  label="Current Medications"
                  placeholder="e.g. Amlodipine, Maintenance meds"
                  value={newForm.medications}
                  onChange={(e) =>
                    setNewForm({ ...newForm, medications: e.target.value })
                  }
                />
              </div>

              <InputField
                label="Medical & Health Notes"
                placeholder="Cardiac conditions, hypertension, diabetes, bleeding issues, etc."
                value={newForm.medical_notes}
                onChange={(e) =>
                  setNewForm({ ...newForm, medical_notes: e.target.value })
                }
              />
            </div>

            {/* Section 4: Terms & Privacy Consent */}
            <div className="space-y-2.5 rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 text-xs">
              <label className="flex items-center gap-2.5 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newForm.terms_accepted && newForm.privacy_accepted}
                  onChange={(e) =>
                    setNewForm({
                      ...newForm,
                      terms_accepted: e.target.checked,
                      privacy_accepted: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded accent-blue-600"
                />
                <span>
                  Patient has signed the Clinic Terms &amp; Conditions and RA 10173 Data Privacy Consent.{' '}
                  <span className="text-red-500">*</span>
                </span>
              </label>
              {newFormErrors.consent && (
                <p className={tokens.error}>{newFormErrors.consent}</p>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingNew}>
                {savingNew ? 'Saving Patient...' : 'Create Patient Record'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}