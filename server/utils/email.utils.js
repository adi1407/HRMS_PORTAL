const nodemailer = require('nodemailer');

// ── Transporter ───────────────────────────────────────────────────────────────
// Set EMAIL_USER and EMAIL_PASS in your .env / Render environment variables.
// For Gmail: use an App Password (Google account → Security → App Passwords).
// If vars are missing, emails are silently skipped (no crash).

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  // Use explicit host + port instead of service:'gmail' to force IPv4 on Render
  transporter = nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   465,
    secure: true,          // SSL on port 465
    family: 4,             // force IPv4 — fixes ENETUNREACH on Render free tier
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return transporter;
}

async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.warn('[EMAIL] Skipped — EMAIL_USER or EMAIL_PASS not set in environment.');
    return;
  }
  if (!to) {
    console.warn('[EMAIL] Skipped — recipient email is empty.');
    return;
  }
  try {
    console.log(`[EMAIL] Sending to ${to} | Subject: ${subject}`);
    await t.sendMail({ from: `"Sangi HRMS" <${process.env.EMAIL_USER}>`, to, subject, html });
    console.log(`[EMAIL] Sent successfully to ${to}`);
  } catch (err) {
    console.error('[EMAIL] Failed to send to', to, '—', err.message);
  }
}

// ── Shared layout ─────────────────────────────────────────────────────────────
function wrap(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;color:#111827}
  .outer{max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .header{background:#1e3a5f;padding:28px 32px;display:flex;align-items:center;gap:12px}
  .header h1{margin:0;color:#fff;font-size:1.3rem;font-weight:700}
  .header .sub{color:#93c5fd;font-size:.8rem;margin:4px 0 0}
  .body{padding:28px 32px}
  .greeting{font-size:1rem;margin:0 0 18px}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px 20px;margin:16px 0}
  .row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:.88rem}
  .row:last-child{border-bottom:none}
  .label{color:#6b7280;font-weight:500}
  .value{color:#111827;font-weight:600;text-align:right}
  .badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:.78rem;font-weight:700}
  .badge-approved{background:#dcfce7;color:#15803d}
  .badge-rejected{background:#fee2e2;color:#b91c1c}
  .badge-info{background:#dbeafe;color:#2563eb}
  .cta{display:inline-block;margin-top:22px;padding:11px 28px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:8px;font-size:.9rem;font-weight:600}
  .footer{padding:18px 32px;background:#f8fafc;font-size:.78rem;color:#9ca3af;border-top:1px solid #f1f5f9}
</style></head>
<body>
<div class="outer">
  <div class="header">
    <div>
      <h1>Sangi HRMS</h1>
      <div class="sub">Human Resource Management System</div>
    </div>
  </div>
  <div class="body">${content}</div>
  <div class="footer">This is an automated message from Sangi HRMS. Please do not reply to this email.</div>
</div>
</body></html>`;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Leave notification ────────────────────────────────────────────────────────
async function sendLeaveStatusEmail({ employee, leave, reviewerName }) {
  const approved  = leave.status === 'APPROVED';
  const badgeClass = approved ? 'badge-approved' : 'badge-rejected';
  const statusText = approved ? 'Approved' : 'Rejected';
  const from = new Date(leave.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const to   = new Date(leave.toDate).toLocaleDateString('en-IN',   { day: 'numeric', month: 'short', year: 'numeric' });

  const html = wrap(`
    <p class="greeting">Hi <strong>${employee.name}</strong>,</p>
    <p>Your leave application has been reviewed. Here are the details:</p>
    <div class="card">
      <div class="row"><span class="label">Status</span><span class="value"><span class="badge ${badgeClass}">${statusText}</span></span></div>
      <div class="row"><span class="label">Leave Type</span><span class="value">${leave.type.replace(/_/g,' ')}</span></div>
      <div class="row"><span class="label">From</span><span class="value">${from}</span></div>
      <div class="row"><span class="label">To</span><span class="value">${to}</span></div>
      <div class="row"><span class="label">Total Days</span><span class="value">${leave.totalDays}</span></div>
      ${leave.isPaid !== undefined ? `<div class="row"><span class="label">Pay Type</span><span class="value">${leave.isPaid ? 'Paid Leave' : 'Unpaid Leave'}</span></div>` : ''}
      ${leave.reviewNotes ? `<div class="row"><span class="label">Note from HR</span><span class="value">${leave.reviewNotes}</span></div>` : ''}
      <div class="row"><span class="label">Reviewed By</span><span class="value">${reviewerName}</span></div>
    </div>
    ${approved
      ? `<p style="color:#15803d;font-size:.9rem">Your leave has been approved. Enjoy your time off!</p>`
      : `<p style="color:#b91c1c;font-size:.9rem">Your leave request was not approved. Please contact HR for more details.</p>`
    }
    <a class="cta" href="${process.env.CLIENT_URL?.split(',')[0] || '#'}/leave">View My Leaves</a>
  `);

  await sendMail({
    to:      employee.email,
    subject: `Leave ${statusText}: ${leave.type.replace(/_/g,' ')} (${from} – ${to})`,
    html,
  });
}

// ── Salary finalized notification ─────────────────────────────────────────────
async function sendSalaryFinalizedEmail({ employee, salary }) {
  const monthName = MONTHS[salary.month - 1];

  const html = wrap(`
    <p class="greeting">Hi <strong>${employee.name}</strong>,</p>
    <p>Your salary slip for <strong>${monthName} ${salary.year}</strong> has been finalized. Here's a summary:</p>
    <div class="card">
      <div class="row"><span class="label">Employee ID</span><span class="value">${employee.employeeId}</span></div>
      <div class="row"><span class="label">Month</span><span class="value">${monthName} ${salary.year}</span></div>
      <div class="row"><span class="label">Gross Salary</span><span class="value">₹${salary.grossSalary?.toLocaleString('en-IN')}</span></div>
      ${salary.deductionAmount > 0 ? `<div class="row"><span class="label">Deductions</span><span class="value" style="color:#b91c1c">— ₹${salary.deductionAmount?.toLocaleString('en-IN')}</span></div>` : ''}
      ${salary.reimbursementTotal > 0 ? `<div class="row"><span class="label">Expense Reimbursement</span><span class="value" style="color:#15803d">+ ₹${salary.reimbursementTotal?.toLocaleString('en-IN')}</span></div>` : ''}
      ${salary.manualAdjustment ? `<div class="row"><span class="label">Manual Adjustment</span><span class="value" style="color:${salary.manualAdjustment > 0 ? '#15803d' : '#b91c1c'}">${salary.manualAdjustment > 0 ? '+' : ''}₹${salary.manualAdjustment?.toLocaleString('en-IN')}</span></div>` : ''}
      <div class="row" style="margin-top:8px;padding-top:12px;border-top:2px solid #e2e8f0">
        <span class="label" style="font-size:1rem;font-weight:700">Net Salary</span>
        <span class="value" style="font-size:1.1rem;color:#1e3a5f">₹${salary.netSalary?.toLocaleString('en-IN')}</span>
      </div>
    </div>
    <p style="font-size:.88rem;color:#6b7280">You can download your full salary slip PDF from the portal.</p>
    <a class="cta" href="${process.env.CLIENT_URL?.split(',')[0] || '#'}/salary">View Salary Slip</a>
  `);

  await sendMail({
    to:      employee.email,
    subject: `Salary Slip Ready: ${monthName} ${salary.year} — ₹${salary.netSalary?.toLocaleString('en-IN')}`,
    html,
  });
}

// ── Expense claim notification ────────────────────────────────────────────────
async function sendExpenseClaimEmail({ employee, claim, reviewerName }) {
  const approved   = claim.status === 'APPROVED';
  const badgeClass = approved ? 'badge-approved' : 'badge-rejected';
  const statusText = approved ? 'Approved' : 'Rejected';
  const date = new Date(claim.expenseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const html = wrap(`
    <p class="greeting">Hi <strong>${employee.name}</strong>,</p>
    <p>Your expense claim has been reviewed. Here are the details:</p>
    <div class="card">
      <div class="row"><span class="label">Status</span><span class="value"><span class="badge ${badgeClass}">${statusText}</span></span></div>
      <div class="row"><span class="label">Amount</span><span class="value">₹${claim.amount?.toLocaleString('en-IN')}</span></div>
      <div class="row"><span class="label">Category</span><span class="value">${claim.category.replace(/_/g,' ')}</span></div>
      <div class="row"><span class="label">Expense Date</span><span class="value">${date}</span></div>
      <div class="row"><span class="label">Description</span><span class="value">${claim.description}</span></div>
      ${approved && claim.reimbursementType ? `<div class="row"><span class="label">Reimbursement</span><span class="value">${claim.reimbursementType === 'CASH' ? 'Cash payment' : 'Added to next salary'}</span></div>` : ''}
      ${claim.reviewNote ? `<div class="row"><span class="label">Note</span><span class="value">${claim.reviewNote}</span></div>` : ''}
      <div class="row"><span class="label">Reviewed By</span><span class="value">${reviewerName}</span></div>
    </div>
    ${approved
      ? `<p style="color:#15803d;font-size:.9rem">Your reimbursement will be processed via <strong>${claim.reimbursementType === 'CASH' ? 'cash' : 'your next salary'}</strong>.</p>`
      : `<p style="color:#b91c1c;font-size:.9rem">Your expense claim was not approved. Please contact the Accounts team for more information.</p>`
    }
    <a class="cta" href="${process.env.CLIENT_URL?.split(',')[0] || '#'}/expense-claims">View My Claims</a>
  `);

  await sendMail({
    to:      employee.email,
    subject: `Expense Claim ${statusText}: ₹${claim.amount?.toLocaleString('en-IN')} — ${claim.category.replace(/_/g,' ')}`,
    html,
  });
}

module.exports = { sendLeaveStatusEmail, sendSalaryFinalizedEmail, sendExpenseClaimEmail };
