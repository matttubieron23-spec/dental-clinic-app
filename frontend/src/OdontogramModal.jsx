import { useEffect, useState } from 'react';
import { api } from './api';

const CONDITIONS = {
  healthy: ['Healthy', 'bg-white border-slate-300 text-slate-700'],
  caries: ['Cavity', 'bg-red-100 border-red-400 text-red-800'],
  filled: ['Filled', 'bg-sky-100 border-sky-400 text-sky-800'],
  crown: ['Crown', 'bg-amber-100 border-amber-400 text-amber-800'],
  bridge: ['Bridge', 'bg-orange-100 border-orange-400 text-orange-800'],
  root_canal: ['Root canal', 'bg-purple-100 border-purple-400 text-purple-800'],
  implant: ['Implant', 'bg-teal-100 border-teal-500 text-teal-800'],
  missing: ['Missing', 'bg-slate-200 border-slate-400 text-slate-500'],
  extracted: ['Extracted', 'bg-slate-300 border-slate-500 text-slate-600'],
  impacted: ['Impacted', 'bg-pink-100 border-pink-400 text-pink-800'],
  fractured: ['Fractured', 'bg-rose-100 border-rose-500 text-rose-800'],
  other: ['Other', 'bg-indigo-100 border-indigo-400 text-indigo-800'],
};
const SURFACES = ['M', 'D', 'O', 'B', 'L', 'I'];
const range = (a, b) => (a < b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : Array.from({ length: a - b + 1 }, (_, i) => a - i));

const UPPER = [range(18, 11), range(21, 28)];
const LOWER = [range(48, 41), range(31, 38)];

export default function OdontogramModal({ patient, onClose }) {
  const [teeth, setTeeth] = useState({});
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ condition: 'healthy', surfaces: [], notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () =>
    api(`/patients/${patient.id}/teeth`)
      .then((rows) => setTeeth(Object.fromEntries(rows.map((r) => [r.tooth_number, r]))))
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, [patient.id]);

  const pick = (n) => {
    const t = teeth[n];
    setSelected(n);
    setForm({ condition: t?.condition || 'healthy', surfaces: t?.surfaces || [], notes: t?.notes || '' });
  };

  const toggleSurface = (s) =>
    setForm((f) => ({ ...f, surfaces: f.surfaces.includes(s) ? f.surfaces.filter((x) => x !== s) : [...f.surfaces, s] }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api(`/patients/${patient.id}/teeth`, { method: 'POST', body: { tooth_number: selected, ...form } });
      await load();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const Tooth = ({ n }) => {
    const cond = teeth[n]?.condition || 'healthy';
    return (
      <button
        onClick={() => pick(n)}
        className={`h-11 w-8 rounded-md border text-xs font-medium sm:w-9 ${CONDITIONS[cond][1]} ${
          selected === n ? 'ring-2 ring-blue-600 ring-offset-1' : ''
        }`}
        aria-label={`Tooth ${n}, ${CONDITIONS[cond][0]}`}
      >
        {n}
      </button>
    );
  };

  const Row = ({ halves }) => (
    <div className="flex justify-center gap-3">
      {halves.map((h, i) => (
        <div key={i} className="flex gap-1">
          {h.map((n) => <Tooth key={n} n={n} />)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Dental chart</h2>
            <p className="text-sm text-slate-500">{patient.first_name} {patient.last_name} ({patient.patient_no})</p>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100">Close</button>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[640px] space-y-2">
            <p className="text-center text-xs text-slate-400">Upper jaw (patient's right to left)</p>
            <Row halves={UPPER} />
            <div className="border-t border-dashed border-slate-300" />
            <Row halves={LOWER} />
            <p className="text-center text-xs text-slate-400">Lower jaw</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(CONDITIONS).map(([k, [label, cls]]) => (
            <span key={k} className={`rounded border px-2 py-0.5 text-xs ${cls}`}>{label}</span>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          {selected ? (
            <div className="space-y-3">
              <h3 className="font-medium">Tooth {selected}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {Object.entries(CONDITIONS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <div className="flex gap-1" role="group" aria-label="Surfaces">
                  {SURFACES.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSurface(s)}
                      className={`h-9 w-9 rounded-md border text-sm ${
                        form.surfaces.includes(s) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes for this tooth"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save tooth'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a tooth to record its condition and surfaces (M mesial, D distal, O occlusal, B buccal, L lingual, I incisal).</p>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
