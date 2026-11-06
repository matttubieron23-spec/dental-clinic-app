import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import {
  Button,
  Card,
  EmptyState,
  InputField,
  Modal,
} from './ui';

const formatPeso = (num) =>
  '₱' +
  Number(num || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Finance({ onNavigateToPatient }) {
  const [summary, setSummary] = useState({
    revenue_today: 0,
    revenue_month: 0,
    total_outstanding_balance: 0,
    patients_with_balance: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');

  // Outstanding Balances Modal State
  const [outstandingModalOpen, setOutstandingModalOpen] = useState(false);
  const [outstandingList, setOutstandingList] = useState([]);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);
  const [outstandingSearch, setOutstandingSearch] = useState('');
  const [outstandingError, setOutstandingError] = useState('');

  // 1. Load Revenue & Balance Summary
  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await api('api/staff/finance/summary');
      setSummary(data || {});
    } catch (err) {
      setError(err.message || 'Failed to load financial overview.');
    } finally {
      setLoadingSummary(false);
    }
  };

  // 2. Load Payment Transactions
  const loadTransactions = async () => {
    setLoadingTx(true);
    try {
      const q = encodeURIComponent(searchQuery.trim());
      const data = await api(`api/staff/finance/transactions?q=${q}&period=${periodFilter}`);
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load transaction history.');
    } finally {
      setLoadingTx(false);
    }
  };

  // 3. Load Outstanding Balance Accounts
  const loadOutstandingPatients = async () => {
    setLoadingOutstanding(true);
    setOutstandingError('');
    try {
      const data = await api('api/finance/outstanding');
      setOutstandingList(Array.isArray(data) ? data : []);
    } catch (err) {
      setOutstandingError(err.message || 'Failed to load outstanding balance accounts.');
    } finally {
      setLoadingOutstanding(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTransactions();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, periodFilter]);

  const handleOpenOutstandingModal = () => {
    setOutstandingSearch('');
    setOutstandingModalOpen(true);
    loadOutstandingPatients();
  };

  const handlePatientClick = (patientId) => {
    setOutstandingModalOpen(false);
    sessionStorage.setItem('selected_patient_id', patientId);
    if (typeof onNavigateToPatient === 'function') {
      onNavigateToPatient(patientId);
    } else {
      window.location.href = '/staff?tab=patients';
    }
  };

  // Filter patients inside the modal by name or chart number
  const filteredOutstanding = useMemo(() => {
    const q = outstandingSearch.trim().toLowerCase();
    if (!q) return outstandingList;
    return outstandingList.filter(
      (p) =>
        (p.patient_name || '').toLowerCase().includes(q) ||
        (p.patient_no || '').toLowerCase().includes(q)
    );
  }, [outstandingList, outstandingSearch]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Clinic Finance &amp; Revenue
        </h1>
        <p className="mt-0.5 text-sm font-medium text-slate-500">
          Track daily collections, monthly revenue, outstanding balances, and clinic-wide payment history.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700"
        >
          {error}
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* Card 1: Today's Revenue */}
        <Card className="p-6">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Revenue Today
          </span>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {loadingSummary ? '...' : formatPeso(summary.revenue_today)}
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Sum of all payments collected today
          </p>
        </Card>

        {/* Card 2: Monthly Revenue */}
        <Card className="p-6">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Revenue This Month
          </span>
          <div className="mt-2 text-2xl font-extrabold text-blue-700 sm:text-3xl">
            {loadingSummary ? '...' : formatPeso(summary.revenue_month)}
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Cumulative clinic collections this month
          </p>
        </Card>

        {/* Card 3: Total Outstanding Balance (Clickable) */}
        <Card
          onClick={handleOpenOutstandingModal}
          className="group relative cursor-pointer border-slate-200 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md active:translate-y-0"
        >
          <div className="flex items-center justify-between">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Outstanding Balance
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 opacity-90 transition-opacity group-hover:opacity-100">
              View Details →
            </span>
          </div>

          <div className="mt-2 text-2xl font-extrabold text-red-600 sm:text-3xl">
            {loadingSummary ? '...' : formatPeso(summary.total_outstanding_balance)}
          </div>

          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>
              {loadingSummary
                ? '...'
                : `${summary.patients_with_balance || 0} patient${
                    summary.patients_with_balance === 1 ? '' : 's'
                  } with unpaid balance`}
            </span>
            <span className="text-[11px] font-semibold text-blue-600 underline underline-offset-2 opacity-0 transition-opacity group-hover:opacity-100">
              Click to view accounts
            </span>
          </div>
        </Card>
      </div>

      {/* Transaction History Section */}
      <Card noPadding className="p-6">
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_200px_auto]">
          <InputField
            label="Search Payment History"
            type="text"
            placeholder="Search payments by patient name or chart no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <InputField
            label="Filter Period"
            as="select"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
          >
            <option value="all">All Transactions</option>
            <option value="today">Today Only</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </InputField>

          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              loadSummary();
              loadTransactions();
            }}
          >
            ↻ Refresh
          </Button>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card noPadding className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4 text-xs font-semibold text-slate-500">
          <span>
            Showing <strong>{transactions.length}</strong> payment transaction
            {transactions.length === 1 ? '' : 's'}
          </span>
          <span>Official receipts recorded in Manila Time</span>
        </div>

        <div className="hidden grid-cols-[1.2fr_1.8fr_1fr_1.8fr_1fr] items-center gap-4 border-b border-slate-100 bg-slate-50/40 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid">
          <span>Date &amp; Time</span>
          <span>Patient Name</span>
          <span>Method</span>
          <span>Description</span>
          <span className="text-right">Amount Paid</span>
        </div>

        {loadingTx ? (
          <p className="p-12 text-center text-xs font-medium text-slate-500">
            Loading clinic payment records...
          </p>
        ) : transactions.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No payment records found"
              description="Payments recorded from patient dental charts and ledger checkouts will appear here."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-slate-50/60 md:grid md:grid-cols-[1.2fr_1.8fr_1fr_1.8fr_1fr] md:items-center md:gap-4"
              >
                <div>
                  <span className="block text-xs font-bold text-slate-900">
                    {tx.date}
                  </span>
                  <span className="block text-[11px] font-medium text-slate-500">
                    {tx.time}
                  </span>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handlePatientClick(tx.patient_id)}
                    className="text-left text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    {tx.patient_name}
                  </button>
                  <span className="block font-mono text-[11px] text-slate-400">
                    #{tx.patient_no || 'P-000000'}
                  </span>
                </div>

                <div>
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {tx.payment_method || 'Cash'}
                  </span>
                </div>

                <div className="truncate text-xs text-slate-600">
                  {tx.description || 'Payment settlement'}
                </div>

                <div className="text-sm font-extrabold text-emerald-600 md:text-right">
                  +{formatPeso(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* =================================================================== */}
      {/* MODAL: PATIENTS WITH OUTSTANDING BALANCES */}
      {/* =================================================================== */}
      {outstandingModalOpen && (
        <Modal
          title="Patients with Outstanding Balances"
          subtitle="Active clinic charts with remaining unpaid treatment charges"
          maxWidth="max-w-3xl"
          onClose={() => setOutstandingModalOpen(false)}
        >
          <div className="space-y-4">
            {outstandingError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
              >
                {outstandingError}
              </div>
            )}

            {/* Search filter in modal */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <InputField
                  placeholder="Search patient by name or chart number..."
                  value={outstandingSearch}
                  onChange={(e) => setOutstandingSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={loadOutstandingPatients}
                disabled={loadingOutstanding}
              >
                ↻ Refresh
              </Button>
            </div>

            {/* Patients with Balance Table */}
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200">
              {loadingOutstanding ? (
                <p className="p-10 text-center text-xs font-medium text-slate-500">
                  Scanning ledger records for unpaid accounts...
                </p>
              ) : filteredOutstanding.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    title="All patients are fully paid up!"
                    description={
                      outstandingSearch
                        ? `No outstanding balance records match "${outstandingSearch}".`
                        : 'Every active clinic patient currently has a zero or settled ledger balance.'
                    }
                  />
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Chart No.</th>
                      <th className="px-4 py-3">Patient Name</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3 text-right">Outstanding Balance</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredOutstanding.map((p) => (
                      <tr
                        key={p.patient_id}
                        className="transition-colors hover:bg-red-50/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 font-mono font-bold text-blue-600">
                          {p.patient_no}
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => handlePatientClick(p.patient_id)}
                            className="text-left font-bold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer"
                          >
                            {p.patient_name}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {p.phone || '-'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-extrabold text-red-600">
                          {formatPeso(p.total_outstanding_amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handlePatientClick(p.patient_id)}
                            className="!h-7 !min-h-0 !px-2.5 !py-0.5 !text-[11px] font-bold"
                          >
                            Open Ledger →
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs font-medium text-slate-500">
                Found <strong>{filteredOutstanding.length}</strong> patient
                {filteredOutstanding.length === 1 ? '' : 's'} with unpaid balances
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOutstandingModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}