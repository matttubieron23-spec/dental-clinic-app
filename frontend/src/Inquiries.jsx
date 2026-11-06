import { useEffect, useState } from 'react';
import { api } from './api';
import { Badge, Button, Card, EmptyState } from './ui';

export default function Inquiries({ onUnreadCountChange }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadInquiries = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api('/staff/inquiries');
      const list = Array.isArray(rows) ? rows : [];
      setInquiries(list);
      onUnreadCountChange?.(list.filter((r) => !r.is_read).length);
    } catch (err) {
      setError(err.message || 'Failed to load web inquiries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInquiries();
  }, []);

  const handleToggleRead = async (item) => {
    try {
      await api(`/staff/inquiries/${item.id}/read`, {
        method: 'PUT',
        body: { is_read: !item.is_read },
      });
      await loadInquiries();
    } catch (err) {
      setError(err.message || 'Failed to update inquiry status.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Public Website Inquiries
          </h1>
          <p className="mt-0.5 text-sm font-medium text-slate-500">
            Messages submitted by prospective patients through the public Contact Us form.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={loadInquiries}>
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

      <Card noPadding className="overflow-hidden">
        {loading ? (
          <p className="p-10 text-center text-xs font-medium text-slate-500">
            Loading web inquiries...
          </p>
        ) : inquiries.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No web inquiries yet"
              description="Messages sent from the public website contact form will appear here."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {inquiries.map((inq) => (
              <div
                key={inq.id}
                className={`flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center ${
                  !inq.is_read ? 'bg-blue-50/30' : 'bg-white'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge status={inq.is_read ? 'completed' : 'pending'}>
                      {inq.is_read ? 'Read' : 'New Inquiry'}
                    </Badge>
                    <span className="text-sm font-bold text-slate-900">{inq.name}</span>
                    <span className="text-xs font-medium text-slate-500">
                      · {inq.phone} · {inq.email}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">&ldquo;{inq.message}&rdquo;</p>
                </div>

                <div className="shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleToggleRead(inq)}
                    className="!h-9 !min-h-0 !px-3.5 !py-1.5 !text-xs"
                  >
                    {inq.is_read ? 'Mark as Unread' : '✓ Mark as Read'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}