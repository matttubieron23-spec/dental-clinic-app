import React from 'react';
import { Button } from './ui';
import { printOfficialReceipt } from './printReceipt';

export default function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  const gross = Number(receipt.line_item?.gross_amount || receipt.line_item?.amount_paid || 0);
  const paid = Number(receipt.line_item?.amount_paid || 0);
  const discount = Number(receipt.line_item?.discount_amount || 0);
  const discountType = receipt.line_item?.discount_type && receipt.line_item.discount_type !== 'None'
    ? receipt.line_item.discount_type
    : null;
  const balance = Number(receipt.line_item?.remaining_balance || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Official Receipt · {receipt.receipt_no || 'REC-0001'}
            </h3>
            <p className="text-xs text-slate-500">
              Printable clinic payment acknowledgment
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Printable Card Preview */}
        <div className="mt-5 space-y-4 rounded-xl border border-slate-200/90 bg-white p-5">
          {/* Clinic Branding */}
          <div className="text-center border-b border-dashed border-slate-200 pb-3">
            <h4 className="text-base font-extrabold text-slate-900">
              {receipt.clinic?.name || 'Smile Avenue Dental Clinic'}
            </h4>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              {receipt.clinic?.address || 'G/F Yankit Building, Landco Business Park, Legazpi, Philippines, 4500'}
            </p>
            <p className="text-[11px] text-slate-500">
              Tel: {receipt.clinic?.phone || '0969 059 1928'} · {receipt.clinic?.email || 'smileavdental@gmail.com'}
            </p>
          </div>

          {/* Meta Details */}
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50/80 p-3 text-xs">
            <div>
              <span className="block font-medium text-slate-400 text-[10px] uppercase tracking-wider">
                Patient Name
              </span>
              <span className="font-bold text-slate-900">
                {receipt.patient?.name || 'Patient'}
              </span>
              <span className="block text-[11px] text-slate-500">
                Chart #{receipt.patient?.patient_no || 'N/A'}
              </span>
            </div>
            <div className="text-right">
              <span className="block font-medium text-slate-400 text-[10px] uppercase tracking-wider">
                Receipt No. &amp; Date
              </span>
              <span className="font-bold text-blue-600">
                {receipt.receipt_no || 'REC-0001'}
              </span>
              <span className="block text-[11px] text-slate-500">
                {receipt.date} {receipt.time}
              </span>
            </div>
          </div>

          {/* Amounts Box */}
          <div className="rounded-lg border border-slate-200/80 p-3.5 text-xs space-y-2">
            <div className="flex justify-between items-start gap-2">
              <span className="text-slate-500">Description:</span>
              <span className="font-bold text-slate-900 text-right">
                {receipt.line_item?.description || 'Dental Treatment Payment'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Payment Method:</span>
              <span className="font-semibold text-slate-700">
                {receipt.line_item?.payment_method || 'Cash'}
              </span>
            </div>

            {discount > 0 && (
              <>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Gross Amount:</span>
                  <span>₱{gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-orange-600 font-medium">
                  <span>Discount ({discountType || 'Applied'}):</span>
                  <span>-₱{discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            )}

            <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm">
              <span className="font-bold text-slate-900">Net Amount Paid:</span>
              <span className="font-extrabold text-emerald-600 text-base">
                ₱{paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-500 pt-0.5">
              <span>Remaining Balance:</span>
              <span className="font-semibold text-slate-700">
                ₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Signatures */}
          <div className="flex items-end justify-between pt-1">
            <div className="max-w-[160px]">
              <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Patient Signature
              </span>
              {receipt.patient_signature ? (
                <img
                  src={receipt.patient_signature}
                  alt="Patient Signature"
                  className="h-10 max-w-full object-contain border-b border-slate-300 pb-1"
                />
              ) : (
                <div className="h-8 border-b border-slate-300"></div>
              )}
            </div>

            <div className="text-right">
              <span className="block text-[10px] uppercase font-bold text-slate-400">
                Received By
              </span>
              <span className="font-bold text-xs text-slate-900">
                {receipt.received_by || 'Clinic Staff'}
              </span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => printOfficialReceipt(receipt)}
            >
            🖨️ Print Official Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}