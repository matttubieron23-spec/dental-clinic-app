import { useMemo, useState } from 'react';
import { formatFriendlyDate, todayManila } from './config';
import { Badge, Button, EmptyState, Icon, Modal, tokens } from './ui';

const formatPeso = (num) =>
  '₱' +
  Number(num || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const PAYMENT_METHODS = ['Cash', 'GCash', 'Card', 'HMO'];

export default function PatientFinanceTab({
  patient,
  transactions = [],
  onAddTransaction,
}) {
  // Record Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: '',
    method: 'Cash',
    date: todayManila(),
    remarks: '',
  });
  const [payErrors, setPayErrors] = useState({});

  // Quick Add Completed Procedure Charge (for testing Chart "Mark as Done" -> Charge flow without touching DentalChartTab.jsx)
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState({
    procedure: 'Crown',
    tooth: '18',
    amount: '',
    date: todayManila(),
  });
  const [chargeError, setChargeError] = useState('');

  const [receiptBanner, setReceiptBanner] = useState('');

  // 1. LEDGER SUMMARY MATH (Total Charges, Total Payments, Remaining Balance)
  const { totalCharges, totalPayments, remainingBalance } = useMemo(() => {
    let charges = 0;
    let payments = 0;

    transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'Charge') charges += amt;
      if (t.type === 'Payment') payments += amt;
    });

    return {
      totalCharges: charges,
      totalPayments: payments,
      remainingBalance: Math.max(0, charges - payments),
    };
  }, [transactions]);

  // Compute dynamic Paid / Unpaid status for each Charge row based on cumulative payments
  const computedRows = useMemo(() => {
    let availablePaymentPool = totalPayments;

    // Sort oldest first to apply payments to oldest charges first, then display newest/logical order
    const chronological = [...transactions].sort((a, b) =>
      String(a.date || '').localeCompare(String(b.date || ''))
    );

    return chronological.map((row) => {
      if (row.type === 'Payment') {
        return { ...row, computedStatus: 'Paid' };
      }
      const chargeAmt = Number(row.amount) || 0;
      if (availablePaymentPool >= chargeAmt && chargeAmt > 0) {
        availablePaymentPool -= chargeAmt;
        return { ...row, computedStatus: 'Paid' };
      }
      return { ...row, computedStatus: 'Unpaid' };
    });
  }, [transactions, totalPayments]);

  // Open Record Payment Modal
  const openRecordPayment = () => {
    setPayErrors({});
    setReceiptBanner('');
    setPayForm({
      amount: '',
      method: 'Cash',
      date: todayManila(),
      remarks: '',
    });
    setPaymentModalOpen(true);
  };

  // Submit Payment
  const handleRecordPaymentSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    const numAmt = parseFloat(payForm.amount);

    if (!payForm.amount || isNaN(numAmt) || numAmt <= 0) {
      errs.amount = 'Please enter a valid payment amount greater than ₱0.';
    }
    if (!payForm.method) {
      errs.method = 'Please select a payment method.';
    }
    if (!payForm.date) {
      errs.date = 'Please select a payment date.';
    }

    if (Object.keys(errs).length > 0) {
      setPayErrors(errs);
      return;
    }

    const descParts = [`Payment (${payForm.method})`];
    if (payForm.remarks.trim()) {
      descParts.push(`— ${payForm.remarks.trim()}`);
    }

    const newPayment = {
      id: `pay-${Date.now()}`,
      date: payForm.date,
      description: descParts.join(' '),
      type: 'Payment',
      method: payForm.method,
      remarks: payForm.remarks.trim(),
      amount: numAmt,
      status: 'Paid',
    };

    onAddTransaction(newPayment);
    setPaymentModalOpen(false);
  };

  // Submit Simulated Chart "Done" Charge
  const handleAddChargeSubmit = (e) => {
    e.preventDefault();
    const numAmt = parseFloat(chargeForm.amount);
    if (!chargeForm.procedure.trim() || !chargeForm.tooth.trim()) {
      setChargeError('Procedure name and tooth number are required.');
      return;
    }
    if (!chargeForm.amount || isNaN(numAmt) || numAmt <= 0) {
      setChargeError('Please enter a valid charge amount.');
      return;
    }

    const newCharge = {
      id: `chg-${Date.now()}`,
      date: chargeForm.date || todayManila(),
      description: `${chargeForm.procedure.trim()} - Tooth ${chargeForm.tooth.trim()}`,
      type: 'Charge',
      amount: numAmt,
      status: 'Unpaid',
    };

    onAddTransaction(newCharge);
    setChargeModalOpen(false);
  };

  // Print Receipt -> console.log receipt layout
  const handlePrintReceipt = (paymentRow) => {
    const patientName = patient
      ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim()
      : 'Patient';
    const receiptNo = `OR-${String(paymentRow.id).slice(-6).toUpperCase()}`;

    const receiptLayout = `
============================================================
                SMILE AVENUE DENTAL CLINIC
      G/F Yankit Bldg, Landco Business Park, Legazpi City
                     OFFICIAL RECEIPT
============================================================
Receipt No:      ${receiptNo}
Date:            ${formatFriendlyDate(paymentRow.date, false)}
Patient Name:    ${patientName} (${patient?.patient_no || 'N/A'})
------------------------------------------------------------
Description:     ${paymentRow.description}
Payment Method:  ${paymentRow.method || 'Cash'}
Remarks:         ${paymentRow.remarks || 'None'}
------------------------------------------------------------
AMOUNT PAID:     ${formatPeso(paymentRow.amount)}
------------------------------------------------------------
Total Charges:   ${formatPeso(totalCharges)}
Total Payments:  ${formatPeso(totalPayments)}
Balance Owed:    ${formatPeso(remainingBalance)}
============================================================
          Thank you for trusting Smile Avenue!
============================================================`;

    console.log(receiptLayout);
    setReceiptBanner(
      `Receipt ${receiptNo} for ${formatPeso(paymentRow.amount)} logged to browser console (F12 → Console).`
    );
  };

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* HEADER & RECORD PAYMENT BUTTON (Top Right) */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Patient Ledger & Billing</h2>
          <p className="text-xs text-slate-600">
            Completed treatment plan items appear as Charges. Record payments to update the patient's balance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setChargeError('');
              setChargeForm({
                procedure: 'Crown',
                tooth: '18',
                amount: '',
                date: todayManila(),
              });
              setChargeModalOpen(true);
            }}
          >
            + Add Completed Procedure Charge
          </Button>

          <Button type="button" variant="primary" onClick={openRecordPayment}>
            <Icon name="plus" className="h-4 w-4" /> Record Payment
          </Button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 1. LEDGER SUMMARY CARDS (Top of Tab) */}
      {/* =================================================================== */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Total Charges */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Charges (₱)
          </span>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {formatPeso(totalCharges)}
          </p>
          <span className="mt-1 block text-xs text-slate-500">
            Completed procedures billed
          </span>
        </div>

        {/* Card 2: Total Payments (Styled Green) */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
          <span className="block text-xs font-bold uppercase tracking-wider text-emerald-800">
            Total Payments (₱)
          </span>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700">
            {formatPeso(totalPayments)}
          </p>
          <span className="mt-1 block text-xs font-medium text-emerald-700">
            Payments received
          </span>
        </div>

        {/* Card 3: Remaining Balance (Styled Red when Balance Owed) */}
        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            remainingBalance > 0
              ? 'border-red-300 bg-red-50/70'
              : 'border-slate-200 bg-slate-50/70'
          }`}
        >
          <span
            className={`block text-xs font-bold uppercase tracking-wider ${
              remainingBalance > 0 ? 'text-red-800' : 'text-slate-500'
            }`}
          >
            Remaining Balance (₱)
          </span>
          <p
            className={`mt-2 text-2xl font-extrabold ${
              remainingBalance > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            {formatPeso(remainingBalance)}
          </p>
          <span
            className={`mt-1 block text-xs font-medium ${
              remainingBalance > 0 ? 'text-red-700' : 'text-slate-500'
            }`}
          >
            {remainingBalance > 0 ? 'Balance owed by patient' : 'Account settled in full'}
          </span>
        </div>
      </div>

      {receiptBanner && (
        <div
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"
        >
          {receiptBanner}
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. TRANSACTION TABLE (Middle of Tab) */}
      {/* =================================================================== */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.1fr_2fr_1fr_1.1fr_1fr_1.2fr] items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 md:grid">
          <span>Date</span>
          <span>Description</span>
          <span>Type</span>
          <span>Amount</span>
          <span>Status</span>
          <span className="text-right">Action</span>
        </div>

        {computedRows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No ledger transactions yet"
              description="Completed treatments and recorded payments will appear here."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {computedRows.map((row) => {
              const isPayment = row.type === 'Payment';
              const isPaid = row.computedStatus === 'Paid';

              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-2.5 p-4 hover:bg-slate-50/80 transition-colors md:grid md:grid-cols-[1.1fr_2fr_1fr_1.1fr_1fr_1.2fr] md:items-center md:gap-4 md:px-5 md:py-3.5"
                >
                  {/* Column 1: Date */}
                  <div className="text-xs font-medium text-slate-700">
                    <span className="font-bold text-slate-400 md:hidden">Date: </span>
                    {row.date ? formatFriendlyDate(row.date, false) : '-'}
                  </div>

                  {/* Column 2: Description */}
                  <div className="text-sm font-bold text-slate-900">
                    {row.description}
                  </div>

                  {/* Column 3: Type (Charge or Payment) */}
                  <div>
                    <Badge tone={isPayment ? 'success' : 'warning'}>
                      {row.type}
                    </Badge>
                  </div>

                  {/* Column 4: Amount */}
                  <div
                    className={`text-sm font-extrabold ${
                      isPayment ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    <span className="font-bold text-slate-400 md:hidden">Amount: </span>
                    {isPayment ? `− ${formatPeso(row.amount)}` : formatPeso(row.amount)}
                  </div>

                  {/* Column 5: Status (Paid, Unpaid) */}
                  <div>
                    <Badge tone={isPaid ? 'success' : 'danger'}>
                      {row.computedStatus}
                    </Badge>
                  </div>

                  {/* Column 6: Print Receipt Button (Next to each Payment row) */}
                  <div className="flex md:justify-end">
                    {isPayment ? (
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(row)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors"
                      >
                        ⎙ Print Receipt
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 md:pr-2">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 3. MODAL: RECORD PAYMENT */}
      {/* =================================================================== */}
      {paymentModalOpen && (
        <Modal
          title="Record Payment"
          subtitle={`Remaining Balance: ${formatPeso(remainingBalance)}`}
          onClose={() => setPaymentModalOpen(false)}
        >
          <form onSubmit={handleRecordPaymentSubmit} noValidate className="space-y-4">
            {/* Amount (Required) */}
            <div>
              <label className={tokens.label}>
                Amount (₱) <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                  ₱
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 2000"
                  value={payForm.amount}
                  onChange={(e) => {
                    setPayForm({ ...payForm, amount: e.target.value });
                    setPayErrors({ ...payErrors, amount: undefined });
                  }}
                  className={`${tokens.input} pl-8 ${
                    payErrors.amount ? tokens.inputError : ''
                  }`}
                />
              </div>
              {payErrors.amount && (
                <p role="alert" className={tokens.error}>
                  {payErrors.amount}
                </p>
              )}
            </div>

            {/* Payment Method (Cash, GCash, Card, HMO) & Date */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={tokens.label}>
                  Payment Method <span className="text-red-600">*</span>
                </label>
                <select
                  value={payForm.method}
                  onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                  className={tokens.input}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={tokens.label}>
                  Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={payForm.date}
                  onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
                  className={tokens.input}
                />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className={tokens.label}>Remarks</label>
              <textarea
                rows={2}
                placeholder="Optional reference number or notes (e.g. GCash Ref #123456)..."
                value={payForm.remarks}
                onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })}
                className={tokens.input}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPaymentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD COMPLETED PROCEDURE CHARGE (Simulates Chart "Done" item) */}
      {/* =================================================================== */}
      {chargeModalOpen && (
        <Modal
          title="Add Completed Procedure Charge"
          subtitle="Adds a completed treatment item to the patient's ledger as a Charge."
          onClose={() => setChargeModalOpen(false)}
        >
          <form onSubmit={handleAddChargeSubmit} noValidate className="space-y-4">
            {chargeError && (
              <p role="alert" className={tokens.error}>
                {chargeError}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={tokens.label}>Procedure Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Filling"
                  value={chargeForm.procedure}
                  onChange={(e) =>
                    setChargeForm({ ...chargeForm, procedure: e.target.value })
                  }
                  className={tokens.input}
                />
              </div>

              <div>
                <label className={tokens.label}>Tooth Number *</label>
                <input
                  type="text"
                  placeholder="e.g. 18"
                  value={chargeForm.tooth}
                  onChange={(e) =>
                    setChargeForm({ ...chargeForm, tooth: e.target.value })
                  }
                  className={tokens.input}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={tokens.label}>Charge Amount (₱) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 5000"
                  value={chargeForm.amount}
                  onChange={(e) =>
                    setChargeForm({ ...chargeForm, amount: e.target.value })
                  }
                  className={tokens.input}
                />
              </div>

              <div>
                <label className={tokens.label}>Date *</label>
                <input
                  type="date"
                  value={chargeForm.date}
                  onChange={(e) =>
                    setChargeForm({ ...chargeForm, date: e.target.value })
                  }
                  className={tokens.input}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setChargeModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Add Charge
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}