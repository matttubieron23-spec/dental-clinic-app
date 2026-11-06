import { useEffect, useState } from 'react';
import { api } from './api';
import { capitalize, formatFriendlyDate } from './config';
import { Badge, Button, Card, EmptyState, InputField, Modal } from './ui';

const FIELD_LABELS = {
  first_name: 'First Name',
  middle_name: 'Middle Name',
  last_name: 'Last Name',
  birth_date: 'Date of Birth',
  sex: 'Gender / Sex',
};

export default function Corrections({ onPendingCountChange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [declineModal, setDeclineModal] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadCorrections = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('api/staff/identity-corrections');
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      onPendingCountChange?.(list.filter((r) => r.status === 'pending').length);
    } catch (err) {
      setError(err.message || 'Failed to load identity correction requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCorrections();
  }, []);

  const handleApprove = async (item) => {
    setProcessing(true);
    setError('');
    setSuccess('');
    try {
      const res = await api(`api/staff/identity-corrections/${item.id}/approve`, {
        method: 'POST',
      });
      setSuccess(res.message || 'Identity correction approved.');
      await loadCorrections();
    } catch (err) {
      setError(err.message || 'Failed to approve correction.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeclineSubmit = async (e) => {
    e.preventDefault();
    if (!declineModal) return;
    setProcessing(true);
    setError('');
    try {
      const res = await api(`api/staff/identity-corrections/${declineModal.id}/decline`, {
        method: 'POST',
        body: { staff_reason: declineReason },
      });
      setSuccess(res.message || 'Identity correction declined.');
      setDeclineModal(null);
      setDeclineReason('');
      await loadCorrections();
    } catch (err) {
      setError(err.message || 'Failed to decline correction.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Identity Correction Requests
          </h1>
          <p className="mt-0.5 text-sm font-medium text-slate-500">
            Review and approve patient requests to update locked legal identity fields.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={loadCorrections}>
          ↻ Refresh
        </Button>
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

      <Card noPadding className="overflow-hidden">
        {loading ? (
          <p className="p-10 text-center text-xs font-medium text-slate-500">
            Loading correction requests...
          </p>
        ) : rows.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No identity correction requests"
              description="Requests submitted by patients from their portal will appear here."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge status={r.status}>{capitalize(r.status)}</Badge>
                    <span className="font-mono text-xs font-bold text-blue-600">
                      {r.patient_no}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {r.first_name} {r.last_name}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700">
                    <strong>{FIELD_LABELS[r.field_name] || r.field_name}:</strong>{' '}
                    <span className="line-through text-slate-400">
                      {r.old_value || 'Empty'}
                    </span>{' '}
                    → <strong className="text-blue-700">{r.new_value}</strong>
                  </p>

                  <p className="text-xs text-slate-500">
                    <strong>Patient Reason:</strong> {r.reason}
                  </p>
                  {r.created_date && (
                    <p className="text-[11px] text-slate-400">
                      Requested on {formatFriendlyDate(r.created_date, false)}
                    </p>
                  )}
                </div>

                {r.status === 'pending' && (
                  <div className="flex items-center gap-2.5">
                    <Button
                      type="button"
                      variant="primary"
                      disabled={processing}
                      onClick={() => handleApprove(r)}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={processing}
                      onClick={() => {
                        setDeclineReason('');
                        setDeclineModal(r);
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {declineModal && (
        <Modal
          title="Decline Identity Correction"
          subtitle={`${declineModal.first_name} ${declineModal.last_name}`}
          onClose={() => setDeclineModal(null)}
        >
          <form onSubmit={handleDeclineSubmit} className="space-y-4">
            <InputField
              label="Reason for Declining"
              as="textarea"
              rows={3}
              required
              placeholder="Explain why this change could not be approved..."
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
              <Button type="submit" variant="danger" disabled={processing}>
                {processing ? 'Declining...' : 'Decline Request'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}