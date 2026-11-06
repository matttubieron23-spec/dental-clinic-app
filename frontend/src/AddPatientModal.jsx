import { useEffect, useRef, useState } from 'react';
import { api } from './api';

const PSGC = 'https://psgc.gitlab.io/api';
const getJson = (path) => fetch(PSGC + path).then((r) => { if (!r.ok) throw new Error('geo'); return r.json(); });
const byName = (a, b) => a.name.localeCompare(b.name);

const EMPTY = {
  first_name: '', middle_name: '', last_name: '', d: '', m: '', y: '', sex: '', patient_no: '',
  phone: '', email: '', address: '', unit: '', province: '', city: '', barangay: '', postal_code: '',
  occupation: '', civil_status: '', religion: '', guardian_name: '', guardian_phone: '',
  notes: '', reminders: true, consent: false,
};

const digits = (v) => v.replace(/\D/g, '').replace(/^0+/, '').replace(/^63/, '');
const phoneOut = (v) => (digits(v) ? '+63' + digits(v) : '');

const base = 'w-full rounded-xl border bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 sm:text-sm';
const ok = ' border-slate-200 focus:border-blue-600 focus:ring-blue-600/20';
const bad = ' border-red-400 focus:border-red-500 focus:ring-red-500/20';
const inp = (err) => base + (err ? bad : ok);

function AlertIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.01" />
    </svg>
  );
}
function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Section({ title, first, children }) {
  return (
    <section className={first ? '' : 'border-t border-slate-100 pt-6'}>
      <h3 className="mb-4 text-base font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, required, hint, error, className = '', children }) {
  return (
    <div className={'text-sm ' + className}>
      <span className="mb-1.5 block font-medium text-slate-900">{label}{required && <span className="text-red-600"> *</span>}</span>
      {children}
      {error
        ? <span className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600"><AlertIcon className="mt-px h-3.5 w-3.5 shrink-0" />{error}</span>
        : hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

function Phone({ value, onChange }) {
  return (
    <div className="flex items-center rounded-xl border border-slate-200 bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20">
      <span className="border-r border-slate-200 px-4 text-base text-slate-700 sm:text-sm">+63</span>
      <input className="w-full rounded-xl bg-transparent px-4 py-3 text-base outline-none placeholder:text-slate-400 sm:text-sm" inputMode="numeric" placeholder="917 123 4567" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Select({ value, onChange, options, placeholder, disabled, valueKey = 'code' }) {
  return (
    <div className="relative">
      <select
        className={inp(false) + ' appearance-none pr-10 ' + (disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : value ? '' : 'text-slate-400')}
        value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o[valueKey]} value={o[valueKey]} className="text-slate-900">{o.name}</option>)}
      </select>
      <Chevron />
    </div>
  );
}

export default function AddPatientModal({ onClose, onSaved }) {
  const [f, setF] = useState(EMPTY);
  const [tags, setTags] = useState([]);
  const [tagText, setTagText] = useState('');
  const [suggested, setSuggested] = useState('');
  const [geoFail, setGeoFail] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [codes, setCodes] = useState({ province: '', city: '', barangay: '' });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);

  const set = (k) => (e) => {
    setF({ ...f, [k]: e.target.value });
    setErrors((x) => ({ ...x, [k]: undefined, ...(['d', 'm', 'y'].includes(k) ? { dob: undefined } : {}) }));
  };

  useEffect(() => {
    api('/patients/next-no').then((r) => setSuggested(r.patient_no)).catch(() => {});
    getJson('/provinces/')
      .then((p) => setProvinces([{ code: 'NCR', name: 'Metro Manila (NCR)' }, ...p.sort(byName)]))
      .catch(() => setGeoFail(true));
  }, []);

  // Lock page scroll and close on Escape while the dialog is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const pickProvince = async (code) => {
    const p = provinces.find((x) => x.code === code);
    setF((s) => ({ ...s, province: p?.name || '', city: '', barangay: '' }));
    setCodes({ province: code, city: '', barangay: '' });
    setCities([]); setBarangays([]);
    if (!code) return;
    try {
      const path = code === 'NCR' ? '/regions/130000000/cities-municipalities/' : `/provinces/${code}/cities-municipalities/`;
      setCities((await getJson(path)).sort(byName));
    } catch { setGeoFail(true); }
  };

  const pickCity = async (code) => {
    const c = cities.find((x) => x.code === code);
    setF((s) => ({ ...s, city: c?.name || '', barangay: '' }));
    setCodes((s) => ({ ...s, city: code, barangay: '' }));
    setBarangays([]);
    if (!code) return;
    try { setBarangays((await getJson(`/cities-municipalities/${code}/barangays/`)).sort(byName)); }
    catch { setGeoFail(true); }
  };

  const pickBarangay = (code) => {
    const b = barangays.find((x) => x.code === code);
    setF((s) => ({ ...s, barangay: b?.name || '' }));
    setCodes((s) => ({ ...s, barangay: code }));
  };

  const addTag = () => {
    const t = tagText.trim().replace(/,$/, '');
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) setTags([...tags, t]);
    setTagText('');
  };

  const fail = (errs, message = 'Please fix the highlighted fields below.') => {
    setErrors(errs);
    setBanner(message);
    setToast(message);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBanner('');
    const errs = {};
    if (!f.first_name.trim()) errs.first_name = 'First name is required.';
    if (!f.last_name.trim()) errs.last_name = 'Last name is required.';

    let birth_date = '';
    if (!f.d || !f.m || !f.y) {
      errs.dob = 'Date of birth is required.';
    } else {
      const [d, m, y] = [Number(f.d), Number(f.m), Number(f.y)];
      const dt = new Date(y, m - 1, d);
      if (f.y.length !== 4 || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d || dt > new Date()) {
        errs.dob = 'Please enter a valid date of birth (not in the future).';
      } else {
        birth_date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    if (!f.consent) errs.consent = 'Confirm the data-privacy consent before saving.';
    if (Object.keys(errs).length) return fail(errs);

    setSaving(true);
    try {
      const { d, m, y, reminders, consent, ...rest } = f;
      await api('/patients', {
        method: 'POST',
        body: {
          ...rest,
          birth_date,
          phone: phoneOut(f.phone),
          guardian_phone: phoneOut(f.guardian_phone),
          reminders_enabled: reminders,
          tags,
          consent,
        },
      });
      onSaved();
    } catch (err) {
      setSaving(false);
      // If patient chart no conflict
      if (/chart no/i.test(err.message)) {
        return fail({ patient_no: err.message }, err.message);
      }
      // If exact duplicate conflict (HTTP 409)
      if (/already exists/i.test(err.message) || err.status === 409) {
        return fail(
          { first_name: 'Matches existing patient', last_name: 'Matches existing patient', dob: 'Matches existing patient' },
          err.message || 'A patient with this name and birthday already exists.'
        );
      }
      fail({}, err.message || 'Failed to save patient.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      {toast && (
        <div role="alert" className="fixed right-4 top-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span className="flex-1">{toast}</span>
          <button type="button" onClick={() => setToast('')} className="text-red-400 hover:text-red-700" aria-label="Dismiss">✕</button>
        </div>
      )}

      <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="add-patient-title" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-[92vw] max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="px-5 pb-3 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id="add-patient-title" className="text-lg font-semibold text-slate-900">Add a patient</h2>
            <button type="button" onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-500">Record a new patient. Data-privacy consent is required before saving (RA 10173).</p>
        </div>

        <div ref={bodyRef} className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-2 sm:px-6">
          {banner && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border-2 border-red-400 bg-red-50 p-4 text-sm font-bold text-red-800 shadow-xs">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div className="flex-1 leading-relaxed">{banner}</div>
            </div>
          )}

          <Section title="Personal details" first>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="First name" required error={errors.first_name}><input className={inp(errors.first_name)} value={f.first_name} onChange={set('first_name')} autoComplete="given-name" /></Field>
              <Field label="Middle name"><input className={inp(false)} value={f.middle_name} onChange={set('middle_name')} /></Field>
              <Field label="Last name" required error={errors.last_name}><input className={inp(errors.last_name)} value={f.last_name} onChange={set('last_name')} autoComplete="family-name" /></Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1.5fr_1fr_1fr]">
              <Field label="Date of birth" required error={errors.dob}>
                <span className="mb-2 block text-xs text-slate-500">For example, 27 3 1990</span>
                <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                  {[['d', 'Day', 2], ['m', 'Month', 2], ['y', 'Year', 4]].map(([k, label, max]) => (
                    <label key={k} className="block">
                      <span className="mb-1 block text-xs text-slate-500">{label}</span>
                      <input className={inp(errors.dob) + ' px-3 text-center'} inputMode="numeric" maxLength={max} value={f[k]} onChange={set(k)} />
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Gender">
                <Select value={f.sex} onChange={(v) => setF({ ...f, sex: v })} placeholder="Select..." valueKey="value"
                  options={[{ value: 'male', name: 'Male' }, { value: 'female', name: 'Female' }, { value: 'other', name: 'Other' }]} />
              </Field>
              <Field label="Chart no." error={errors.patient_no} hint={suggested ? `Optional. Suggested: ${suggested}` : 'Optional'}>
                <input className={inp(errors.patient_no)} value={f.patient_no} onChange={set('patient_no')} placeholder={suggested} />
              </Field>
            </div>
          </Section>

          <Section title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact number" hint="Optional"><Phone value={f.phone} onChange={(v) => setF({ ...f, phone: v })} /></Field>
              <Field label="Email" hint="Optional"><input className={inp(false)} type="email" value={f.email} onChange={set('email')} autoComplete="email" /></Field>
            </div>
          </Section>

          <Section title="Address">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Street address" className="sm:col-span-2"><input className={inp(false)} value={f.address} onChange={set('address')} /></Field>
              <Field label="Unit / building (optional)" className="sm:col-span-2"><input className={inp(false)} value={f.unit} onChange={set('unit')} /></Field>
              {geoFail ? (
                <>
                  <Field label="Province" className="sm:col-span-2"><input className={inp(false)} value={f.province} onChange={set('province')} /></Field>
                  <Field label="City / municipality"><input className={inp(false)} value={f.city} onChange={set('city')} /></Field>
                  <Field label="Barangay"><input className={inp(false)} value={f.barangay} onChange={set('barangay')} /></Field>
                </>
              ) : (
                <>
                  <Field label="Province" className="sm:col-span-2"><Select value={codes.province} onChange={pickProvince} options={provinces} placeholder="Select a province" /></Field>
                  <Field label="City / municipality"><Select value={codes.city} onChange={pickCity} options={cities} disabled={!codes.province} placeholder={codes.province ? 'Select a city' : 'Select a province first'} /></Field>
                  <Field label="Barangay"><Select value={codes.barangay} onChange={pickBarangay} options={barangays} disabled={!codes.city} placeholder={codes.city ? 'Select a barangay' : 'Select a city first'} /></Field>
                </>
              )}
              <Field label="Postal code"><input className={inp(false)} inputMode="numeric" maxLength={4} value={f.postal_code} onChange={set('postal_code')} /></Field>
            </div>
            {geoFail && <p className="mt-2 text-xs text-amber-700">Could not load the province list, so type the address instead.</p>}
          </Section>

          <Section title="Additional details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Occupation" hint="Optional"><input className={inp(false)} value={f.occupation} onChange={set('occupation')} /></Field>
              <Field label="Civil status" hint="Optional">
                <Select value={f.civil_status} onChange={(v) => setF({ ...f, civil_status: v })} placeholder="Select..." valueKey="name"
                  options={['Single', 'Married', 'Widowed', 'Separated', 'Divorced'].map((s) => ({ name: s }))} />
              </Field>
              <Field label="Religion" hint="Optional"><input className={inp(false)} value={f.religion} onChange={set('religion')} /></Field>
            </div>
          </Section>

          <Section title="Guardian / emergency contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" hint="Optional. For minors or assisted patients"><input className={inp(false)} value={f.guardian_name} onChange={set('guardian_name')} /></Field>
              <Field label="Contact number" hint="Optional"><Phone value={f.guardian_phone} onChange={(v) => setF({ ...f, guardian_phone: v })} /></Field>
            </div>
          </Section>

          <Section title="Remarks">
            <Field label="Remarks" hint="Optional. General notes about this patient">
              <textarea className={inp(false)} rows={4} value={f.notes} onChange={set('notes')} />
            </Field>
          </Section>

          <Section title="Preferences">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <span><b className="font-medium text-slate-900">Appointment reminders</b> <span className="text-slate-500">email this patient reminders about their appointments</span></span>
              <button type="button" role="switch" aria-checked={f.reminders} aria-label="Appointment reminders" onClick={() => setF({ ...f, reminders: !f.reminders })}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer ${f.reminders ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${f.reminders ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          </Section>

          <Section title="Tags">
            <p className="mb-2 text-xs text-slate-500">Label the patient for filtering, for example senior, VIP, HMO. Type and press Enter to add.</p>
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-2 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {t}<button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="cursor-pointer">x</button>
                </span>
              ))}
              <input className="min-w-[10rem] flex-1 bg-transparent px-2 py-2 text-base outline-none placeholder:text-slate-400 sm:text-sm" placeholder="Add tags... (e.g. senior, VIP)" value={tagText}
                onChange={(e) => setTagText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                onBlur={addTag} />
            </div>
          </Section>

          <Section title="Data-privacy consent">
            <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm ${errors.consent ? 'border-red-400 bg-red-50/40' : 'border-slate-200'}`}>
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 rounded-md accent-blue-600 cursor-pointer" checked={f.consent}
                onChange={(e) => { setF({ ...f, consent: e.target.checked }); setErrors((x) => ({ ...x, consent: undefined })); }} />
              <span className="text-slate-900">
                I confirm the patient, or their parent or legal guardian if the patient is a minor or cannot consent, has given consent to process their personal data, including clinical records (medical history, dental chart, treatment notes), billing records, and stored photos, x-rays, files and signed documents.
                <span className="mt-2 block text-xs text-slate-500">Required under the Philippine Data Privacy Act (RA 10173). Recorded with today's date on save.</span>
              </span>
            </label>
            {errors.consent && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600"><AlertIcon className="h-3.5 w-3.5" />{errors.consent}</p>}
          </Section>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium hover:bg-slate-50 cursor-pointer">Cancel</button>
          <button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {saving ? 'Checking & Saving...' : 'Add patient'}
          </button>
        </div>
      </form>
    </div>
  );
}