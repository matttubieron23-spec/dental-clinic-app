import { useEffect, useState } from 'react';
import { api } from './api';
import { formatFriendlyDate } from './config';
import { Button, Card, EmptyState, InputField, Modal } from './ui';

const formatPeso = (num) =>
  '₱' +
  Number(num || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Finance({ onOpenPatientProfile }) {
  const [summary, setSummary] = useState({
    revenue_today: 0,
    revenue_month: 0,
    total_outstanding_balance: 0,
    patients_with_balance: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [outstandingList, setOutstandingList] = useState([]);

  // Filter State: 'today' | 'month' | 'all'
  const [period, setPeriod] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [error, setError] = useState('');

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState(null);

  const loadSummaryAndOutstanding = async () => {
    setLoadingSummary(true);
    try {
      const [sumRes, outRes] = await Promise.all([
        api('/api/staff/finance/summary'),
        api('/api/staff/finance/outstanding'),
      ]);
      if (sumRes) setSummary(sumRes);
      setOutstandingList(Array.isArray(outRes) ? outRes : []);
    } catch (err) {
      setError(err.message || 'Failed to load financial summary.');
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadTransactions = async (activePeriod = period, q = searchQuery) => {
    setLoadingTx(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('period', activePeriod);
      if (q.trim()) params.set('q', q.trim());

      const rows = await api(`/api/staff/finance/transactions?${params.toString()}`);
      setTransactions(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Failed to load transactions.');
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    loadSummaryAndOutstanding();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      loadTransactions(period, searchQuery);
    }, 200);
    return () => clearTimeout(t);
  }, [period, searchQuery]);

  const handleOpenReceipt = async (patientId, transactionId) => {
    setLoadingReceiptId(transactionId);
    setError('');
    try {
      const res = await api(
        `/api/staff/patients/${patientId}/ledger/${transactionId}/receipt`
      );
      setReceiptData(res);
    } catch (err) {
      setError(err.message || 'Failed to load official receipt.');
    } finally {
      setLoadingReceiptId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Clinic Finance &amp; Billing
          </h1>
          <p className="mt-0.5 text-sm font-medium text-slate-500">
            Track daily collections, monthly revenue, official receipts, and unpaid patient balances.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            loadSummaryAndOutstanding();
            loadTransactions(period, searchQuery);
          }}
        >
          ↻ Refresh Finance
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

      {/* 1. CLICKABLE SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Clickable Card: Total Revenue Today */}
        <button
          type="button"
          onClick={() => setPeriod('today')}
          className={`group text-left rounded-2xl border p-6 transition-all cursor-pointer focus:outline-none ${
            period === 'today'
              ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20 shadow-sm'
              : 'border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-blue-600">
              Total Revenue Today
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                period === 'today'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700'
              }`}
            >
              {period === 'today' ? 'Active Filter' : 'Click to Filter'}
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900 sm:text-3xl">
            {loadingSummary ? '...' : formatPeso(summary.revenue_today)}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            Payments collected today (Manila time)
          </span>
        </button>

        {/* Clickable Card: Total Revenue This Month */}
        <button
          type="button"
          onClick={() => setPeriod('month')}
          className={`group text-left rounded-2xl border p-6 transition-all cursor-pointer focus:outline-none ${
            period === 'month'
              ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20 shadow-sm'
              : 'border-slate-200/80 bg-white hover:border-blue-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Total Revenue This Month
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                period === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 group-hover:bg-blue-100 group-hover:text-blue-700'
              }`}
            >
              {period === 'month' ? 'Active Filter' : 'Click to Filter'}
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-600 sm:text-3xl">
            {loadingSummary ? '...' : formatPeso(summary.revenue_month)}
          </p>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            Cumulative clinic collections this month
          </span>
        </button>

        {/* Card 3: Total Outstanding Balance */}
        <Card noPadding className="border-amber-200/80 bg-amber-50/40 p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Total Outstanding Balance
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
              {summary.patients_with_balance || 0} Patients
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-amber-700 sm:text-3xl">
            {loadingSummary ? '...' : formatPeso(summary.total_outstanding_balance)}
          </p>
          <span className="mt-1 block text-xs font-medium text-amber-800/80">
            Unsettled balance from completed treatments
          </span>
        </Card>
      </div>

      {/* 2. VISIBLE FILTER BAR & TRANSACTIONS TABLE */}
      <Card noPadding className="overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/60 p-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Payment Transactions History
            </h2>

            {/* Visible Filter UI: "Showing: [Today / This Month / All Time]" */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-bold text-slate-600">Showing:</span>
              <div className="inline-flex rounded-xl border border-slate-200/90 bg-white p-1 shadow-2xs">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'month', label: 'This Month' },
                  { id: 'all', label: 'All Time' },
                ].map((tab) => {
                  const active = period === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPeriod(tab.id)}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-72">
            <InputField
              label=""
              type="text"
              placeholder="Search patient name or chart no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="hidden grid-cols-[1fr_1.6fr_1.8fr_0.9fr_1fr_1fr] items-center gap-4 border-b border-slate-100 bg-slate-50/40 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid">
          <span>Date &amp; Time</span>
          <span>Patient</span>
          <span>Description</span>
          <span>Method</span>
          <span className="text-right">Amount Paid</span>
          <span className="text-right">Receipt</span>
        </div>

        {loadingTx ? (
          <p className="p-12 text-center text-xs font-medium text-slate-500">
            Loading payment transactions...
          </p>
        ) : transactions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={
                period === 'today'
                  ? 'No payments recorded today'
                  : period === 'month'
                  ? 'No payments recorded this month'
                  : 'No payment transactions found'
              }
              description="Try switching the filter to 'All Time' or clearing your search query."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-col gap-2 px-6 py-4 hover:bg-slate-50/70 md:grid md:grid-cols-[1fr_1.6fr_1.8fr_0.9fr_1fr_1fr] md:items-center md:gap-4"
              >
                <div className="text-xs">
                  <span className="block font-bold text-slate-800">
                    {tx.date ? formatFriendlyDate(tx.date, false) : '-'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {tx.time || ''}
                  </span>
                </div>

                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenPatientProfile?.(tx.patient_id)}
                    className="truncate text-left text-sm font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    {tx.patient_name}
                  </button>
                  <span className="block font-mono text-[11px] font-semibold text-slate-400">
                    {tx.patient_no}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">
                    {tx.description || 'Payment'}
                  </p>
                  <span className="block text-[11px] text-slate-400">
                    Received by: {tx.received_by || 'Clinic Staff'}
                  </span>
                </div>

                <div>
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {tx.payment_method || 'Cash'}
                  </span>
                </div>

                <div className="text-sm font-extrabold tabular-nums text-emerald-600 md:text-right">
                  {formatPeso(tx.amount)}
                </div>

                <div className="flex md:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loadingReceiptId === tx.id}
                    onClick={() => handleOpenReceipt(tx.patient_id, tx.id)}
                    className="!h-8 !min-h-0 !px-3 !py-1 !text-xs"
                  >
                    {loadingReceiptId === tx.id ? 'Loading...' : '⎙ Receipt'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 3. PATIENTS WITH OUTSTANDING BALANCES */}
      {outstandingList.length > 0 && (
        <Card noPadding className="overflow-hidden">
          <div className="border-b border-slate-100 bg-amber-50/50 px-6 py-4">
            <h2 className="text-sm font-bold text-slate-900">
              Patients with Outstanding Balances ({outstandingList.length})
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Click any patient below to open their chart and record a payment.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {outstandingList.map((item) => (
              <div
                key={item.patient_id}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 hover:bg-slate-50/70"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => onOpenPatientProfile?.(item.patient_id)}
                    className="text-sm font-bold text-slate-900 hover:text-blue-600 cursor-pointer"
                  >
                    {item.patient_name}
                  </button>
                  <p className="text-xs font-medium text-slate-500">
                    <span className="font-mono font-bold text-blue-600">
                      {item.patient_no}
                    </span>{' '}
                    · {item.phone || 'No phone'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold tabular-nums text-red-600">
                    {formatPeso(item.total_outstanding_amount)}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="!h-8 !min-h-0 !px-3 !py-1 !text-xs"
                    onClick={() => onOpenPatientProfile?.(item.patient_id)}
                  >
                    Open Ledger →
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* OFFICIAL RECEIPT MODAL */}
      {receiptData && (
        <Modal
          title={`Official Receipt · ${receiptData.receipt_no}`}
          subtitle="Printable clinic payment acknowledgment"
          onClose={() => setReceiptData(null)}
        >
          <div className="space-y-4 text-xs text-slate-800">
            <div className="border-b border-slate-200 pb-3 text-center">
              <h3 className="text-base font-extrabold text-slate-900">
                {receiptData.clinic?.name}
              </h3>
              <p className="text-slate-500">{receiptData.clinic?.address}</p>
              <p className="text-slate-500">
                Tel: {receiptData.clinic?.phone} · {receiptData.clinic?.email}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5">
              <div>
                <span className="block font-medium text-slate-400">Patient Name</span>
                <strong className="font-bold text-slate-900">
                  {receiptData.patient?.name}
                </strong>
                <span className="block font-mono text-[11px] text-slate-500">
                  Chart #{receiptData.patient?.patient_no}
                </span>
              </div>
              <div className="text-right">
                <span className="block font-medium text-slate-400">Receipt No. &amp; Date</span>
                <strong className="font-mono font-bold text-blue-600">
                  {receiptData.receipt_no}
                </strong>
                <span className="block text-[11px] text-slate-500">
                  {receiptData.date} {receiptData.time || ''}
                </span>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 p-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Description:</span>
                <span className="font-bold text-slate-900">
                  {receiptData.line_item?.description}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold text-slate-800">
                  {receiptData.line_item?.payment_method}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                <span className="font-bold text-slate-900">Net Amount Paid:</span>
                <span className="font-extrabold text-emerald-600">
                  {formatPeso(receiptData.line_item?.amount_paid)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Remaining Balance:</span>
                <span className="font-bold text-slate-800">
                  {formatPeso(receiptData.line_item?.remaining_balance)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3 print:hidden">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReceiptData(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => window.print()}
              >
                ⎙ Print Receipt
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}