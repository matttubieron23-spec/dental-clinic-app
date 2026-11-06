const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends an HTML email via Gmail SMTP.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} htmlContent - HTML body content
 */
async function sendEmail(to, subject, htmlContent) {
  const mailOptions = {
    from: `"Smile Avenue Dental Clinic" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlContent,
  };

  return await transporter.sendMail(mailOptions);
}

/**
 * Generates a clean, responsive HTML email template for 6-digit OTPs.
 */
function buildOtpHtml({ title, subtitle, code, footerNote }) {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #2563eb; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Smile Avenue Dental Clinic</h1>
        <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">G/F Yankit Building, Landco Business Park, Legazpi City</p>
      </div>
      <div style="padding: 32px 24px; color: #1e293b; text-align: center;">
        <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #0f172a;">${title}</h2>
        <p style="margin: 0 0 24px; font-size: 14px; color: #475569; line-height: 1.5;">${subtitle}</p>
        <div style="display: inline-block; background-color: #eff6ff; border: 2px dashed #93c5fd; border-radius: 12px; padding: 16px 32px; margin-bottom: 24px;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8;">${code}</span>
        </div>
        <p style="margin: 0; font-size: 12px; color: #64748b;">This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
        ${footerNote ? `<p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">${footerNote}</p>` : ''}
      </div>
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
        &copy; ${new Date().getFullYear()} Smile Avenue Dental Clinic &middot; 0969 059 1928
      </div>
    </div>
  `;
}

module.exports = { sendEmail, buildOtpHtml };