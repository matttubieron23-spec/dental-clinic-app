export function printOfficialReceipt(receipt) {
  if (!receipt) return;

  const printWindow = window.open('', '_blank', 'width=750,height=850');
  if (!printWindow) {
    alert('Please allow popups to print the receipt.');
    return;
  }

  const gross = Number(receipt.line_item?.gross_amount || receipt.line_item?.amount_paid || 0);
  const paid = Number(receipt.line_item?.amount_paid || 0);
  const discount = Number(receipt.line_item?.discount_amount || 0);
  const discountType = receipt.line_item?.discount_type && receipt.line_item.discount_type !== 'None'
    ? receipt.line_item.discount_type
    : null;
  const balance = Number(receipt.line_item?.remaining_balance || 0);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title></title>
      <style>
        @page {
          size: portrait;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        html, body {
          height: auto;
          background: #ffffff;
          color: #0f172a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          display: flex;
          justify-content: center;
          padding: 24px 20px 0;
        }
        .receipt-card {
          width: 100%;
          max-width: 540px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 20px 24px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .clinic-header {
          text-align: center;
          border-bottom: 1.5px dashed #cbd5e1;
          padding-bottom: 12px;
          margin-bottom: 14px;
        }
        .clinic-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 2px;
        }
        .clinic-subtitle {
          font-size: 11px;
          color: #64748b;
          line-height: 1.4;
        }
        .meta-grid {
          display: flex;
          justify-content: space-between;
          background-color: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 14px;
        }
        .meta-label {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }
        .meta-value {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
        }
        .meta-value.blue {
          color: #2563eb;
        }
        .meta-sub {
          font-size: 11px;
          color: #64748b;
        }
        .details-box {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 16px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 12px;
        }
        .net-paid-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #cbd5e1;
        }
        .net-paid-label {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
        }
        .net-paid-amount {
          font-size: 16px;
          font-weight: 800;
          color: #16a34a;
        }
        .balance-row {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
        }
        .footer-grid {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-top: 10px;
        }
        .signature-box {
          max-width: 180px;
        }
        .sig-image {
          max-width: 140px;
          max-height: 44px;
          object-fit: contain;
          margin-bottom: 2px;
        }
        .sig-line {
          border-top: 1px solid #94a3b8;
          padding-top: 3px;
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
          text-align: center;
        }
        .received-box {
          text-align: right;
        }
      </style>
    </head>
    <body>
      <div class="receipt-card">
        <div class="clinic-header">
          <div class="clinic-title">${receipt.clinic?.name || 'Smile Avenue Dental Clinic'}</div>
          <div class="clinic-subtitle">
            ${receipt.clinic?.address || 'G/F Yankit Building, Landco Business Park, Legazpi, Philippines, 4500'}<br>
            Tel: ${receipt.clinic?.phone || '0969 059 1928'} · ${receipt.clinic?.email || 'smileavdental@gmail.com'}
          </div>
        </div>

        <div class="meta-grid">
          <div>
            <div class="meta-label">Patient Name</div>
            <div class="meta-value">${receipt.patient?.name || 'Walk-in Patient'}</div>
            <div class="meta-sub">Chart #${receipt.patient?.patient_no || 'N/A'}</div>
          </div>
          <div style="text-align: right;">
            <div class="meta-label">Receipt No. &amp; Date</div>
            <div class="meta-value blue">${receipt.receipt_no || 'REC-0001'}</div>
            <div class="meta-sub">${receipt.date || ''} ${receipt.time || ''}</div>
          </div>
        </div>

        <div class="details-box">
          <div class="detail-row">
            <span style="color: #64748b;">Description:</span>
            <span style="font-weight: 700; text-align: right; max-width: 300px;">
              ${receipt.line_item?.description || 'Dental Procedure Payment'}
            </span>
          </div>
          <div class="detail-row">
            <span style="color: #64748b;">Payment Method:</span>
            <span style="font-weight: 600;">${receipt.line_item?.payment_method || 'Cash'}</span>
          </div>

          ${discount > 0 ? `
            <div class="detail-row">
              <span style="color: #64748b;">Gross Total:</span>
              <span>₱${gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="detail-row" style="color: #ea580c;">
              <span>Discount (${discountType || 'Applied'}):</span>
              <span>-₱${discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          ` : ''}

          <div class="net-paid-row">
            <span class="net-paid-label">Net Amount Paid:</span>
            <span class="net-paid-amount">₱${paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div class="balance-row">
            <span>Remaining Balance:</span>
            <span>₱${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div class="footer-grid">
          <div class="signature-box">
            ${receipt.patient_signature ? `
              <img src="${receipt.patient_signature}" class="sig-image" alt="Patient Signature" />
              <div class="sig-line">Patient Signature</div>
            ` : `
              <div style="height: 32px;"></div>
              <div class="sig-line">Patient Signature</div>
            `}
          </div>

          <div class="received-box">
            <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">Received By</div>
            <div style="font-size: 13px; font-weight: 700; color: #0f172a;">
              ${receipt.received_by || 'Clinic Staff'}
            </div>
          </div>
        </div>
      </div>

      <script>
        window.onload = function() {
          window.focus();
          window.print();
          window.close();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}