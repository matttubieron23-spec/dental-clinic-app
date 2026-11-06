import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { formatFriendlyDate } from './config';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InputField,
  Modal,
  tokens,
} from './ui';

// FDI Adult Permanent Teeth Quadrants
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

const TOOTH_CONDITIONS = [
  { id: 'healthy', label: 'Healthy / Normal', dot: 'bg-emerald-500', ring: 'border-slate-200 bg-white text-slate-800' },
  { id: 'caries', label: 'Caries / Cavity', dot: 'bg-red-500', ring: 'border-red-300 bg-red-50 text-red-900' },
  { id: 'filled', label: 'Filled / Restored', dot: 'bg-blue-500', ring: 'border-blue-300 bg-blue-50 text-blue-900' },
  { id: 'crown', label: 'Crown / Jacket', dot: 'bg-amber-500', ring: 'border-amber-300 bg-amber-50 text-amber-900' },
  { id: 'missing', label: 'Missing / Extracted', dot: 'bg-slate-400', ring: 'border-slate-300 bg-slate-100 text-slate-400 line-through' },
  { id: 'impaction', label: 'Impacted', dot: 'bg-purple-500', ring: 'border-purple-300 bg-purple-50 text-purple-900' },
];

const COMMON_PROCEDURES = [
  { name: 'Oral Prophylaxis (Cleaning)', fee: 800 },
  { name: 'Composite Filling (Pasta)', fee: 1000 },
  { name: 'Simple Tooth Extraction', fee: 1200 },
  { name: 'Wisdom Tooth Odontectomy', fee: 6500 },
  { name: 'Root Canal Therapy', fee: 5500 },
  { name: 'Porcelain Fused to Metal Crown', fee: 6000 },
  { name: 'Zirconia Crown', fee: 15000 },
  { name: 'Teeth Whitening', fee: 4500 },
  { name: 'Orthodontic Braces (Initial)', fee: 10000 },
];

const SURFACES = ['Whole Tooth', 'Mesial (M)', 'Distal (D)', 'Occlusal (O)', 'Buccal (B)', 'Lingual (L)', 'Incisal (I)'];

const formatPeso = (num) =>
  '₱' +
  Number(num || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function PatientChart({ patientId, isPatientView = false }) {
  const [teethMap, setTeethMap] = useState({});
  const [treatments, setTreatments] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected tooth on Odontogram
  const [selectedTooth, setSelectedTooth] = useState(18);
  const [toothNotes, setToothNotes] = useState('');
  const [toothCondition, setToothCondition] = useState('healthy');
  const [savingTooth, setSavingTooth] = useState(false);

  // Add Planned / Completed Treatment Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [savingTreatment, setSavingTreatment] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [treatmentForm, setTreatmentForm] = useState({
    tooth_number: '18',
    surface: 'Whole Tooth',
    procedure_name: COMMON_PROCEDURES[0].name,
    dentist_id: '',
    fee: String(COMMON_PROCEDURES[0].fee),
    status: 'Planned',
    notes: '',
  });

  const loadChart = async () => {
    if (!patientId) return;
    setLoading(true);
    setError('');
    try {
      const endpoint = isPatientView
        ? `/patient/patients/${patientId}/chart`
        : `/staff/patients/${patientId}/chart`;

      const [chartRes, dentistList] = await Promise.all([
        api(endpoint),
        isPatientView ? Promise.resolve([]) : api('/dentists').catch(() => []),
      ]);

      const rawTeeth = chartRes?.teeth || chartRes?.odontogram || {};
      const parsedTeeth = {};
      if (Array.isArray(rawTeeth)) {
        rawTeeth.forEach((t) => {
          parsedTeeth[t.tooth_number] = t;
        });
      } else if (rawTeeth && typeof rawTeeth === 'object') {
        Object.entries(rawTeeth).forEach(([k, v]) => {
          parsedTeeth[k] = typeof v === 'object' ? v : { condition: v };
        });
      }

      setTeethMap(parsedTeeth);
      const tList = Array.isArray(chartRes?.treatments)
        ? chartRes.treatments
        : Array.isArray(chartRes)
        ? chartRes
        : [];
      setTreatments(tList);

      const dRows = Array.isArray(dentistList) ? dentistList : [];
      setDentists(dRows);
      if (dRows.length > 0 && !treatmentForm.dentist_id) {
        setTreatmentForm((prev) => ({ ...prev, dentist_id: dRows[0].id }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load dental chart.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChart();
  }, [patientId]);

  useEffect(() => {
    const info = teethMap[selectedTooth] || {};
    setToothCondition(info.condition || info.status || 'healthy');
    setToothNotes(info.notes || '');
  }, [selectedTooth, teethMap]);

  const handleSaveToothCondition = async (e) => {
    e.preventDefault();
    if (isPatientView) return;
    setSavingTooth(true);
    setError('');
    setSuccess('');
    try {
      const nextMap = {
        ...teethMap,
        [selectedTooth]: {
          tooth_number: selectedTooth,
          condition: toothCondition,
          notes: toothNotes.trim(),
        },
      };
      setTeethMap(nextMap);

      await api(`/staff/patients/${patientId}/chart`, {
        method: 'PUT',
        body: {
          tooth_number: selectedTooth,
          condition: toothCondition,
          notes: toothNotes.trim(),
          teeth: nextMap,
        },
      });
      setSuccess(`Updated Tooth #${selectedTooth} condition.`);
    } catch (err) {
      setError(err.message || 'Failed to save tooth condition.');
    } finally {
      setSavingTooth(false);
    }
  };

  const handleOpenAddTreatment = (defaultTooth = selectedTooth) => {
    setError('');
    setTreatmentForm({
      tooth_number: String(defaultTooth || '18'),
      surface: 'Whole Tooth',
      procedure_name: COMMON_PROCEDURES[0].name,
      dentist_id: dentists[0]?.id || '',
      fee: String(COMMON_PROCEDURES[0].fee),
      status: 'Planned',
      notes: '',
    });
    setAddModalOpen(true);
  };

  const handleAddTreatmentSubmit = async (e) => {
    e.preventDefault();
    setSavingTreatment(true);
    setError('');
    setSuccess('');
    try {
      await api(`/staff/patients/${patientId}/treatments`, {
        method: 'POST',
        body: {
          tooth_number: treatmentForm.tooth_number,
          surface: treatmentForm.surface,
          procedure_name: treatmentForm.procedure_name.trim(),
          dentist_id: treatmentForm.dentist_id || null,
          fee: Number(treatmentForm.fee) || 0,
          cost: Number(treatmentForm.fee) || 0,
          status: treatmentForm.status,
          notes: treatmentForm.notes.trim() || null,
        },
      });
      setAddModalOpen(false);
      setSuccess(
        treatmentForm.status === 'Done'
          ? 'Treatment recorded as Done and charged to patient ledger.'
          : 'Planned treatment added to dental chart.'
      );
      await loadChart();
    } catch (err) {
      setError(err.message || 'Failed to save treatment.');
    } finally {
      setSavingTreatment(false);
    }
  };

  const handleMarkAsDone = async (tx) => {
    setMarkingId(tx.id);
    setError('');
    setSuccess('');
    try {
      await api(`/staff/patients/${patientId}/treatments/${tx.id}/status`, {
        method: 'PATCH',
        body: { status: 'Done' },
      });
      setSuccess(
        `Marked "${tx.procedure_name || tx.procedure}" as Done and posted ${formatPeso(
          tx.fee ?? tx.cost ?? 0
        )} charge to the patient ledger.`
      );
      await loadChart();
    } catch (err) {
      setError(err.message || 'Failed to mark treatment as Done.');
    } finally {
      setMarkingId(null);
    }
  };

  const getToothStyle = (num) => {
    const condId = teethMap[num]?.condition || teethMap[num]?.status || 'healthy';
    const found = TOOTH_CONDITIONS.find((c) => c.id === condId) || TOOTH_CONDITIONS[0];
    return found;
  };

  const renderToothButton = (num) => {
    const cond = getToothStyle(num);
    const isSelected = Number(selectedTooth) === Number(num);
    const hasTreatment = treatments.some(
      (t) => String(t.tooth_number) === String(num)
    );

    return (
      <button
        key={num}
        type="button"
        onClick={() => setSelectedTooth(num)}
        className={`relative flex h-14 w-10 flex-col items-center justify-center rounded-xl border text-xs font-bold transition-all cursor-pointer sm:w-11 ${
          cond.ring
        } ${
          isSelected
            ? 'ring-2 ring-blue-600 border-blue-600 shadow-sm scale-105 z-10'
            : 'hover:border-slate-400'
        }`}
      >
        <span className="text-[11px] font-extrabold">{num}</span>
        <span className={`mt-1 h-2 w-2 rounded-full ${cond.dot}`} />
        {hasTreatment && (
          <span
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-blue-600"
            title="Has recorded treatment"
          />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800"
        >
          {success}
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. INTERACTIVE ODONTOGRAM CARD */}
      {/* =================================================================== */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Interactive Dental Chart (FDI Odontogram)
            </h3>
            <p className="text-xs font-medium text-slate-500">
              Select any tooth number to inspect or update its clinical status and treatment plan.
            </p>
          </div>

          {!isPatientView && (
            <Button
              type="button"
              variant="primary"
              onClick={() => handleOpenAddTreatment(selectedTooth)}
            >
              + Add Treatment (Tooth #{selectedTooth})
            </Button>
          )}
        </div>

        {/* Condition Legend */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 px-4 py-2.5 text-xs">
          <span className="font-bold uppercase tracking-wider text-slate-400">
            Legend:
          </span>
          {TOOTH_CONDITIONS.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
              {c.label}
            </span>
          ))}
        </div>

        {/* Upper & Lower Arch Grids */}
        <div className="space-y-6 overflow-x-auto py-2">
          {/* Upper Arch */}
          <div className="min-w-[680px] space-y-2">
            <div className="flex justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Upper Right (Q1)</span>
              <span>Upper Left (Q2)</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="flex gap-1.5">{UPPER_RIGHT.map(renderToothButton)}</div>
              <div className="h-10 w-px bg-slate-300" />
              <div className="flex gap-1.5">{UPPER_LEFT.map(renderToothButton)}</div>
            </div>
          </div>

          {/* Lower Arch */}
          <div className="min-w-[680px] space-y-2 border-t border-dashed border-slate-200 pt-4">
            <div className="flex items-center justify-center gap-3">
              <div className="flex gap-1.5">{LOWER_RIGHT.map(renderToothButton)}</div>
              <div className="h-10 w-px bg-slate-300" />
              <div className="flex gap-1.5">{LOWER_LEFT.map(renderToothButton)}</div>
            </div>
            <div className="flex justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Lower Right (Q4)</span>
              <span>Lower Left (Q3)</span>
            </div>
          </div>
        </div>

        {/* Selected Tooth Inspector Bar */}
        {!isPatientView && (
          <form
            onSubmit={handleSaveToothCondition}
            className="grid grid-cols-1 items-end gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:grid-cols-[140px_220px_1fr_auto]"
          >
            <div>
              <span className={tokens.label}>Selected Tooth</span>
              <div className="flex h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 font-mono text-sm font-extrabold text-blue-600">
                Tooth #{selectedTooth}
              </div>
            </div>

            <InputField
              label="Tooth Condition"
              as="select"
              value={toothCondition}
              onChange={(e) => setToothCondition(e.target.value)}
            >
              {TOOTH_CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </InputField>

            <InputField
              label="Clinical Note for Tooth"
              type="text"
              placeholder="e.g. Deep occlusal caries, sensitive to cold..."
              value={toothNotes}
              onChange={(e) => setToothNotes(e.target.value)}
            />

            <Button type="submit" variant="secondary" disabled={savingTooth}>
              {savingTooth ? 'Saving...' : 'Save Tooth'}
            </Button>
          </form>
        )}
      </Card>

      {/* =================================================================== */}
      {/* 2. TREATMENT PLAN & CLINICAL PROCEDURES TABLE */}
      {/* =================================================================== */}
      <Card noPadding className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Treatment Plan &amp; Clinical Procedures
            </h3>
            <p className="text-xs font-medium text-slate-500">
              Marking a planned procedure as &ldquo;Done&rdquo; automatically posts the fee to the patient&apos;s billing ledger.
            </p>
          </div>
        </div>

        <div className="hidden grid-cols-[0.8fr_0.9fr_1.8fr_1.2fr_1fr_1fr_1.1fr] items-center gap-4 border-b border-slate-100 bg-slate-50/40 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid">
          <span>Date</span>
          <span>Tooth / Surf</span>
          <span>Procedure</span>
          <span>Dentist</span>
          <span className="text-center">Status</span>
          <span className="text-right">Fee</span>
          <span className="text-right">Action</span>
        </div>

        {loading ? (
          <p className="p-10 text-center text-xs font-medium text-slate-500">
            Loading treatment records...
          </p>
        ) : treatments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No dental procedures recorded yet"
              description="Click '+ Add Treatment' above to plan or record a dental procedure."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {treatments.map((tx) => {
              const statusStr = String(tx.status || 'Planned');
              const isDone =
                statusStr.toLowerCase() === 'done' ||
                statusStr.toLowerCase() === 'completed';
              const feeAmount = tx.fee ?? tx.cost ?? tx.amount ?? 0;

              return (
                <div
                  key={tx.id}
                  className="flex flex-col gap-2 px-6 py-3.5 hover:bg-slate-50/70 md:grid md:grid-cols-[0.8fr_0.9fr_1.8fr_1.2fr_1fr_1fr_1.1fr] md:items-center md:gap-4"
                >
                  <div className="text-xs font-semibold text-slate-600">
                    {tx.date || tx.created_date
                      ? formatFriendlyDate(tx.date || tx.created_date, false)
                      : 'Recorded'}
                  </div>

                  <div className="font-mono text-xs font-bold text-blue-600">
                    #{tx.tooth_number || 'All'}{' '}
                    <span className="font-sans font-normal text-slate-400">
                      ({tx.surface || 'Whole'})
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      {tx.procedure_name || tx.procedure || 'Dental Procedure'}
                    </p>
                    {tx.notes && (
                      <p className="truncate text-xs text-slate-500">{tx.notes}</p>
                    )}
                  </div>

                  <div className="text-xs font-medium text-slate-700">
                    {tx.dentist_name ? `Dr. ${tx.dentist_name}` : 'Clinic Dentist'}
                  </div>

                  <div className="flex md:justify-center">
                    <Badge status={isDone ? 'done' : statusStr.toLowerCase()}>
                      {isDone ? 'Done' : statusStr}
                    </Badge>
                  </div>

                  <div className="text-sm font-extrabold tabular-nums text-slate-900 md:text-right">
                    {formatPeso(feeAmount)}
                  </div>

                  <div className="flex md:justify-end">
                    {!isPatientView && !isDone ? (
                      <Button
                        type="button"
                        variant="primary"
                        disabled={markingId === tx.id}
                        onClick={() => handleMarkAsDone(tx)}
                        className="!h-8 !min-h-0 !px-3 !py-1 !text-xs"
                      >
                        {markingId === tx.id ? 'Updating...' : '✓ Mark as Done'}
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600">
                        {isDone ? 'Charged to Ledger' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* =================================================================== */}
      {/* MODAL: ADD PLANNED OR COMPLETED TREATMENT */}
      {/* =================================================================== */}
      {addModalOpen && (
        <Modal
          title="Add Dental Procedure"
          subtitle={`Recording procedure for Tooth #${treatmentForm.tooth_number}`}
          onClose={() => setAddModalOpen(false)}
        >
          <form onSubmit={handleAddTreatmentSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-2 gap-3.5">
              <InputField
                label="Tooth Number"
                type="text"
                required
                value={treatmentForm.tooth_number}
                onChange={(e) =>
                  setTreatmentForm({ ...treatmentForm, tooth_number: e.target.value })
                }
              />

              <InputField
                label="Tooth Surface"
                as="select"
                value={treatmentForm.surface}
                onChange={(e) =>
                  setTreatmentForm({ ...treatmentForm, surface: e.target.value })
                }
              >
                {SURFACES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </InputField>
            </div>

            <InputField
              label="Quick Select Common Procedure"
              as="select"
              value={
                COMMON_PROCEDURES.some((p) => p.name === treatmentForm.procedure_name)
                  ? treatmentForm.procedure_name
                  : 'custom'
              }
              onChange={(e) => {
                const found = COMMON_PROCEDURES.find((p) => p.name === e.target.value);
                if (found) {
                  setTreatmentForm({
                    ...treatmentForm,
                    procedure_name: found.name,
                    fee: String(found.fee),
                  });
                }
              }}
            >
              {COMMON_PROCEDURES.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} ({formatPeso(p.fee)})
                </option>
              ))}
              <option value="custom">Custom Procedure...</option>
            </InputField>

            <InputField
              label="Procedure Name"
              type="text"
              required
              placeholder="Enter procedure description..."
              value={treatmentForm.procedure_name}
              onChange={(e) =>
                setTreatmentForm({ ...treatmentForm, procedure_name: e.target.value })
              }
            />

            <div className="grid grid-cols-2 gap-3.5">
              <InputField
                label="Procedure Fee (₱)"
                type="number"
                step="0.01"
                min="0"
                required
                value={treatmentForm.fee}
                onChange={(e) =>
                  setTreatmentForm({ ...treatmentForm, fee: e.target.value })
                }
              />

              <InputField
                label="Initial Status"
                as="select"
                value={treatmentForm.status}
                onChange={(e) =>
                  setTreatmentForm({ ...treatmentForm, status: e.target.value })
                }
              >
                <option value="Planned">Planned (Estimate)</option>
                <option value="Done">Done (Auto-Charge Ledger)</option>
              </InputField>
            </div>

            {dentists.length > 0 && (
              <InputField
                label="Attending Dentist"
                as="select"
                value={treatmentForm.dentist_id}
                onChange={(e) =>
                  setTreatmentForm({ ...treatmentForm, dentist_id: e.target.value })
                }
              >
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name}
                  </option>
                ))}
              </InputField>
            )}

            <InputField
              label="Clinical Notes (Optional)"
              as="textarea"
              rows={2}
              placeholder="Anesthesia used, shade, or post-op instructions..."
              value={treatmentForm.notes}
              onChange={(e) =>
                setTreatmentForm({ ...treatmentForm, notes: e.target.value })
              }
            />

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingTreatment}>
                {savingTreatment ? 'Saving...' : 'Save Procedure'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}