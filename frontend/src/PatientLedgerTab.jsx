import { useEffect, useMemo, useRef, useState } from 'react';
import { printOfficialReceipt } from './printReceipt';
import SignatureCanvas from 'react-signature-canvas';
import { api } from './api';
import { formatFriendlyDate, todayManila } from './config';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InputField,
  Modal,
  tokens,
} from './ui';

const formatPeso = (num) =>
  '₱' +
  Number(num || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const DISCOUNT_OPTIONS = [
  { value: 'None', label: 'None (No Discount)' },
  { value: 'Senior Citizen / PWD (20%)', label: 'Senior Citizen / PWD (20%)' },
  { value: 'Custom %', label: 'Custom Percentage (%)' },
];

export default function PatientLedger({ patientId, isPatientView = false }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Record Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    discount_type: 'None',
    custom_discount_percent: '',
    payment_method: 'Cash',
    date: todayManila(),
    description: '',
  });

  // E-Signature State
  const sigCanvasRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);

  // Printable Official Receipt Modal State
  const [receiptData, setReceiptData] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const loadLedger = async () => {
    if (!patientId) return;
    setLoading(true);
    setError('');
    try {
      const endpoint = isPatientView
        ? `/patient/patients/${patientId}/ledger`
        : `/staff/patients/${patientId}/ledger`;
      const rows = await api(endpoint);
      setEntries(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Failed to load patient ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [patientId]);

  const summary = useMemo(() => {
    let totalCharges = 0;
    let totalPayments = 0;
    let totalDiscounts = 0;

    entries.forEach((row) => {
      if (row.type === 'Charge') {
        totalCharges += Number(row.amount) || 0;
      } else if (row.type === 'Payment') {
        totalPayments += Number(row.amount) || 0;
        totalDiscounts += Number(row.discount_amount) || 0;
      }
    });

    const remainingBalance = Math.max(
      0,
      Number((totalCharges - (totalPayments + totalDiscounts)).toFixed(2))
    );

    return {
      totalCharges,
      totalPayments,
      totalDiscounts,
      remainingBalance,
    };
  }, [entries]);

  const livePaymentCalc = useMemo(() => {
    const gross = Math.max(0, Number(paymentForm.amount) || 0);
    let pct = 0;

    if (paymentForm.discount_type === 'Senior Citizen / PWD (20%)') {
      pct = 20;
    } else if (paymentForm.discount_type === 'Custom %') {
      const customVal = Number(paymentForm.custom_discount_percent);
      if (!isNaN(customVal) && customVal > 0 && customVal < 100) {
        pct = customVal;
      }
    }

    const discountAmount = Number(((gross * pct) / 100).toFixed(2));
    const finalAmountDue = Math.max(0, Number((gross - discountAmount).toFixed(2)));

    return {
      gross,
      pct,
      discountAmount,
      finalAmountDue,
    };
  }, [
    paymentForm.amount,
    paymentForm.discount_type,
    paymentForm.custom_discount_percent,
  ]);

  const handleOpenPaymentModal = () => {
    setPaymentError('');
    setHasSignature(false);
    setPaymentForm({
      amount: summary.remainingBalance > 0 ? String(summary.remainingBalance) : '',
      discount_type: 'None',
      custom_discount_percent: '',
      payment_method: 'Cash',
      date: todayManila(),
      description: '',
    });
    setPaymentModalOpen(true);
  };

  const handleClearSignature = () => {
    sigCanvasRef.current?.clear();
    setHasSignature(false);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentError('');

    const grossAmount = Number(paymentForm.amount);
    if (!paymentForm.amount || isNaN(grossAmount) || grossAmount <= 0) {
      setPaymentError('Please enter a payment amount greater than ₱0.');
      return;
    }
    if (grossAmount > summary.remainingBalance) {
      setPaymentError(
        `Payment amount (${formatPeso(grossAmount)}) cannot exceed the remaining balance of ${formatPeso(
          summary.remainingBalance
        )}.`
      );
      return;
    }

    if (paymentForm.discount_type === 'Custom %') {
      const pct = Number(paymentForm.custom_discount_percent);
      if (isNaN(pct) || pct <= 0 || pct >= 100) {
        setPaymentError('Please enter a valid custom discount percentage between 1% and 99%.');
        return;
      }
    }

    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      setPaymentError('Patient signature is required before submitting a payment.');
      return;
    }

    const signatureDataUrl = sigCanvasRef.current.getCanvas().toDataURL('image/png');

    setSavingPayment(true);
    try {
      await api(`/staff/patients/${patientId}/ledger/payments`, {
        method: 'POST',
        body: {
          amount: grossAmount,
          discount_type: paymentForm.discount_type,
          custom_discount_percent:
            paymentForm.discount_type === 'Custom %'
              ? Number(paymentForm.custom_discount_percent)
              : 0,
          payment_method: paymentForm.payment_method,
          date: paymentForm.date,
          description: paymentForm.description.trim() || undefined,
          patient_signature: signatureDataUrl,
        },
      });

      setPaymentModalOpen(false);
      setSuccess(
        `Payment of ${formatPeso(livePaymentCalc.finalAmountDue)} recorded${
          livePaymentCalc.discountAmount > 0
            ? ` (Discount: -${formatPeso(livePaymentCalc.discountAmount)})`
            : ''
        }.`
      );
      await loadLedger();
    } catch (err) {
      setPaymentError(err.message || 'Failed to record payment.');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleOpenReceipt = async (transactionId) => {
    setLoadingReceipt(true);
    setError('');
    try {
      const endpoint = isPatientView
        ? `/patient/patients/${patientId}/ledger/${transactionId}/receipt`
        : `/staff/patients/${patientId}/ledger/${transactionId}/receipt`;
      const res = await api(endpoint);
      setReceiptData(res);
    } catch (err) {
      setError(err.message || 'Failed to load official receipt.');
    } finally {
      setLoadingReceipt(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP SUMMARY CARDS */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card noPadding className="p-5 sm:p-6">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Charges
          </span>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">
            {formatPeso(summary.totalCharges)}
          </p>
        </Card>

        <Card noPadding className="border-emerald-200/80 bg-emerald-50/40 p-5 sm:p-6">
          <span className="block text-xs font-bold uppercase tracking-wider text-emerald-700">
            Total Payments
          </span>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-600">
            {formatPeso(summary.totalPayments)}
          </p>
          {summary.totalDiscounts > 0 && (
            <span className="mt-1 block text-xs font-semibold text-emerald-700">
              + {formatPeso(summary.totalDiscounts)} in discounts applied
            </span>
          )}
        </Card>

        <Card
          noPadding
          className={`p-5 sm:p-6 ${
            summary.remainingBalance > 0
              ? 'border-red-200/80 bg-red-50/40'
              : 'border-emerald-200/80 bg-emerald-50/30'
          }`}
        >
          <span
            className={`block text-xs font-bold uppercase tracking-wider ${
              summary.remainingBalance > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            Remaining Balance
          </span>
          <p
            className={`mt-2 text-2xl font-extrabold tabular-nums ${
              summary.remainingBalance > 0 ? 'text-red-600' : 'text-emerald-600'
            }`}
          >
            {formatPeso(summary.remainingBalance)}
          </p>
        </Card>
      </div>

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

      {/* 2. LEDGER TRANSACTION HISTORY TABLE */}
      <Card noPadding className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Financial Ledger &amp; Billing History
            </h3>
            <p className="text-xs font-medium text-slate-500">
              Chronological record of completed dental charges, discounts, and payments.
            </p>
          </div>

          {!isPatientView && (
            <Button
              type="button"
              variant="primary"
              disabled={summary.remainingBalance <= 0}
              onClick={handleOpenPaymentModal}
            >
              + Record Payment
            </Button>
          )}
        </div>

        <div className="hidden grid-cols-[1fr_2fr_0.9fr_1.1fr_1.1fr_1.1fr] items-center gap-4 border-b border-slate-100 bg-slate-50/40 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid">
          <span>Date</span>
          <span>Description</span>
          <span className="text-center">Type</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Running Balance</span>
          <span className="text-right">Receipt</span>
        </div>

        {loading ? (
          <p className="p-10 text-center text-xs font-medium text-slate-500">
            Loading ledger transactions...
          </p>
        ) : entries.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No ledger transactions yet"
              description="When treatments are marked as Done or payments are recorded, they will appear here."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {entries.map((row) => {
              const isCharge = row.type === 'Charge';
              const hasDiscount = Number(row.discount_amount) > 0;

              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 px-6 py-3.5 hover:bg-slate-50/70 md:grid md:grid-cols-[1fr_2fr_0.9fr_1.1fr_1.1fr_1.1fr] md:items-center md:gap-4"
                >
                  <div className="text-xs font-semibold text-slate-600">
                    {row.date ? formatFriendlyDate(row.date, false) : '-'}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{row.description}</p>
                    {!isCharge && (
                      <p className="text-xs font-medium text-slate-500">
                        Method: <strong className="text-slate-700">{row.payment_method || 'Cash'}</strong>
                        {hasDiscount && (
                          <span className="ml-2 font-semibold text-emerald-600">
                            · Discount ({row.discount_type}): -{formatPeso(row.discount_amount)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex md:justify-center">
                    <Badge status={row.type}>{row.type}</Badge>
                  </div>

                  <div
                    className={`text-sm font-extrabold tabular-nums md:text-right ${
                      isCharge ? 'text-slate-900' : 'text-emerald-600'
                    }`}
                  >
                    {isCharge ? `+${formatPeso(row.amount)}` : `-${formatPeso(row.amount)}`}
                  </div>

                  <div className="text-sm font-bold tabular-nums text-slate-800 md:text-right">
                    {formatPeso(row.running_balance)}
                  </div>

                  <div className="flex md:justify-end">
                    {!isCharge && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={loadingReceipt}
                        onClick={() => handleOpenReceipt(row.id)}
                        className="!h-8 !min-h-0 !px-3 !py-1 !text-xs"
                      >
                        ⎙ Print Receipt
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* =================================================================== */}
      {/* MODAL: RECORD PAYMENT (With Discount Dropdown & E-Signature) */}
      {/* =================================================================== */}
      {paymentModalOpen && (
        <Modal
          title="Record Patient Payment"
          subtitle={`Remaining Balance Owed: ${formatPeso(summary.remainingBalance)}`}
          onClose={() => setPaymentModalOpen(false)}
        >
          <form onSubmit={handlePaymentSubmit} noValidate className="space-y-4">
            {paymentError && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
              >
                {paymentError}
              </div>
            )}

            <InputField
              label="Payment Amount (₱)"
              type="number"
              step="0.01"
              min="1"
              max={summary.remainingBalance}
              required
              placeholder="0.00"
              value={paymentForm.amount}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, amount: e.target.value })
              }
            />

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className={paymentForm.discount_type === 'Custom %' ? '' : 'sm:col-span-2'}>
                <InputField
                  label="Discount"
                  as="select"
                  value={paymentForm.discount_type}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      discount_type: e.target.value,
                    })
                  }
                >
                  {DISCOUNT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </InputField>
              </div>

              {paymentForm.discount_type === 'Custom %' && (
                <InputField
                  label="Custom Discount (%)"
                  type="number"
                  step="0.5"
                  min="1"
                  max="99"
                  required
                  placeholder="e.g. 10"
                  value={paymentForm.custom_discount_percent}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      custom_discount_percent: e.target.value,
                    })
                  }
                />
              )}
            </div>

            {/* Dynamic Live Calculation Box */}
            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium">Gross Amount Applied to Balance:</span>
                <span className="font-bold tabular-nums text-slate-900">
                  {formatPeso(livePaymentCalc.gross)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-emerald-700">
                <span className="font-medium">
                  Discount Amount {livePaymentCalc.pct > 0 ? `(${livePaymentCalc.pct}%)` : ''}:
                </span>
                <span className="font-bold tabular-nums">
                  - {formatPeso(livePaymentCalc.discountAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-blue-200/70 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-950">
                  Final Amount Due:
                </span>
                <span className="text-lg font-extrabold tabular-nums text-blue-600">
                  {formatPeso(livePaymentCalc.finalAmountDue)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <InputField
                label="Payment Method"
                as="select"
                required
                value={paymentForm.payment_method}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, payment_method: e.target.value })
                }
              >
                <option value="Cash">Cash</option>
                <option value="GCash">GCash</option>
                <option value="Maya">Maya</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit / Debit Card">Credit / Debit Card</option>
              </InputField>

              <InputField
                label="Payment Date"
                type="date"
                required
                value={paymentForm.date}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, date: e.target.value })
                }
              />
            </div>

            <InputField
              label="Payment Description / Note (Optional)"
              type="text"
              placeholder="e.g. Senior Citizen ID #12345"
              value={paymentForm.description}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, description: e.target.value })
              }
            />

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className={tokens.label + ' !mb-0'}>
                  Patient Signature <span className="text-red-500">*</span>
                </label>
                <Button
                  type="button"
                  variant="link"
                  onClick={handleClearSignature}
                >
                  Clear Signature
                </Button>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-50/40">
                <SignatureCanvas
                  ref={sigCanvasRef}
                  penColor="#0f172a"
                  onEnd={() => setHasSignature(!sigCanvasRef.current?.isEmpty())}
                  canvasProps={{
                    width: 440,
                    height: 130,
                    className: 'w-full h-[130px] cursor-crosshair bg-white',
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPaymentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={savingPayment || !hasSignature || livePaymentCalc.finalAmountDue <= 0}
              >
                {savingPayment
                  ? 'Recording...'
                  : `Submit Payment (${formatPeso(livePaymentCalc.finalAmountDue)})`}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: PRINTABLE OFFICIAL RECEIPT */}
      {/* =================================================================== */}
      {receiptData && (
        <Modal
          title={`Official Receipt · ${receiptData.receipt_no}`}
          subtitle="Printable clinic payment acknowledgment"
          onClose={() => setReceiptData(null)}
        >
          <div id="printable-receipt" className="space-y-5 text-xs text-slate-800">
            <div className="border-b border-slate-200 pb-4 text-center">
              <h3 className="text-base font-extrabold text-slate-900">
                {receiptData.clinic?.name || 'Smile Avenue Dental Clinic'}
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
                  {receiptData.date ? formatFriendlyDate(receiptData.date, false) : ''}{' '}
                  {receiptData.time || ''}
                </span>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Description:</span>
                <span className="font-bold text-slate-900">
                  {receiptData.line_item?.description}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Payment Method:</span>
                <span className="font-semibold text-slate-800">
                  {receiptData.line_item?.payment_method}
                </span>
              </div>
              {Number(receiptData.line_item?.discount_amount) > 0 && (
                <>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="font-medium text-slate-500">Gross Amount:</span>
                    <span className="font-semibold tabular-nums text-slate-700">
                      {formatPeso(receiptData.line_item?.gross_amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700">
                    <span className="font-medium">
                      Discount ({receiptData.line_item?.discount_type}):
                    </span>
                    <span className="font-bold tabular-nums">
                      - {formatPeso(receiptData.line_item?.discount_amount)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-sm">
                <span className="font-bold text-slate-900">Net Amount Paid:</span>
                <span className="font-extrabold tabular-nums text-emerald-600">
                  {formatPeso(receiptData.line_item?.amount_paid)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Remaining Balance:</span>
                <span className="font-bold tabular-nums text-slate-800">
                  {formatPeso(receiptData.line_item?.remaining_balance)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 items-end gap-4 pt-2">
              <div>
                <span className="block text-[11px] font-medium text-slate-400">
                  Patient Signature
                </span>
                {receiptData.patient_signature ? (
                  <img
                    src={receiptData.patient_signature}
                    alt="Patient Signature"
                    className="mt-1 h-14 w-auto rounded border border-slate-200 bg-white p-1 object-contain"
                  />
                ) : (
                  <span className="mt-2 block italic text-slate-400">Signed on file</span>
                )}
              </div>
              <div className="text-right">
                <span className="block text-[11px] font-medium text-slate-400">
                  Received By
                </span>
                <strong className="mt-1 block font-bold text-slate-900">
                  {receiptData.received_by || 'Authorized Clinic Staff'}
                </strong>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 print:hidden">
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
                ⎙ Print Official Receipt
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}