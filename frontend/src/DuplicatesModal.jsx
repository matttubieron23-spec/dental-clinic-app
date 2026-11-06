import { useEffect, useState } from 'react';
import { api } from './api';
import { Button, EmptyState, Modal } from './ui';

export default function DuplicatesModal({ isOpen, onClose, onSelectPatient }) {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDuplicates = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('api/staff/patients/duplicates');
      setClusters(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err.message || 'Failed to scan for duplicate records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDuplicates();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal
      title="Duplicate Patients Finder"
      subtitle="Patients sharing the exact First Name, Middle Name, Last Name, and Date of Birth"
      onClose={onClose}
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="p-8 text-center text-xs font-medium text-slate-500">
            Scanning clinic records for duplicates...
          </p>
        ) : clusters.length === 0 ? (
          <EmptyState
            title="No Duplicate Patients Found"
            description="All active patient records have unique names and birth dates."
          />
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-medium text-slate-600">
              Found <strong>{clusters.length}</strong> duplicate identity group{clusters.length > 1 ? 's' : ''}:
            </p>

            {clusters.map((cluster, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                  <div className="font-extrabold text-sm text-slate-900">
                    {cluster.patient_name}
                  </div>
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                    DOB: {cluster.birth_date}
                  </span>
                </div>

                <div className="divide-y divide-amber-100 bg-white rounded-lg border border-amber-200/60 overflow-hidden">
                  {cluster.records.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 text-xs flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="font-mono font-bold text-blue-600">
                          #{rec.patient_no}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Registered: {rec.registered_date} · Phone: {rec.phone || 'N/A'}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          onClose();
                          onSelectPatient(rec.id);
                        }}
                        className="!h-7 !min-h-0 !px-2.5 !py-0.5 !text-[11px] font-bold"
                      >
                        View Chart →
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}