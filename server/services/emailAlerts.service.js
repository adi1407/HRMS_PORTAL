const User       = require('../models/User.model');
const Leave      = require('../models/Leave.model');
const Ticket     = require('../models/Ticket.model');
const EmailAlert = require('../models/EmailAlert.model');
const Notification = require('../models/Notification.model');

const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true, family: 4,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return transporter;
}

async function sendAlertEmail({ to, subject, html }) {
  const t = getTransporter();
  if (!t || !to) return false;
  try {
    await t.sendMail({ from: `"Sangi HRMS" <${process.env.EMAIL_USER}>`, to, subject, html });
    return true;
  } catch (err) {
    console.error('[EmailAlert] Failed:', to, err.message);
    return false;
  }
}

function wrap(content) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;color:#111827}.outer{max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}.header{background:#1e3a5f;padding:28px 32px}.header h1{margin:0;color:#fff;font-size:1.3rem;font-weight:700}.header .sub{color:#93c5fd;font-size:.8rem;margin:4px 0 0}.body{padding:28px 32px}.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px 20px;margin:16px 0}.row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:.88rem}.row:last-child{border-bottom:none}.label{color:#6b7280;font-weight:500}.value{color:#111827;font-weight:600;text-align:right}.cta{display:inline-block;margin-top:22px;padding:11px 28px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:8px;font-size:.9rem;font-weight:600}.footer{padding:18px 32px;background:#f8fafc;font-size:.78rem;color:#9ca3af;border-top:1px solid #f1f5f9}</style></head>
<body><div class="outer"><div class="header"><div><h1>Sangi HRMS</h1><div class="sub">Human Resource Management System</div></div></div><div class="body">${content}</div><div class="footer">This is an automated message from Sangi HRMS.</div></div></body></html>`;
}

const CLIENT = () => process.env.CLIENT_URL?.split(',')[0] || '#';

async function log(type, user, subject, status, error, metadata) {
  try {
    await EmailAlert.create({
      type, recipient: user?._id, recipientName: user?.name,
      recipientEmail: user?.email, subject, status, error, metadata,
    });
  } catch {}
}

// ── 1. Birthday Wishes ───────────────────────────────────────
async function sendBirthdayWishes() {
  const today = new Date();
  const m = today.getMonth() + 1;
  const d = today.getDate();

  const users = await User.find({ isActive: true, dateOfBirth: { $exists: true, $ne: null } });
  let sent = 0;

  for (const u of users) {
    const dob = new Date(u.dateOfBirth);
    if (dob.getMonth() + 1 === m && dob.getDate() === d) {
      const age = today.getFullYear() - dob.getFullYear();
      const subject = `🎂 Happy Birthday, ${u.name}!`;
      const html = wrap(`
        <div style="text-align:center;padding:20px 0">
          <div style="font-size:3rem">🎂</div>
          <h2 style="margin:10px 0 4px;color:#1e3a5f">Happy Birthday, ${u.name}!</h2>
          <p style="color:#6b7280;font-size:.92rem">Wishing you a wonderful birthday and a great year ahead!</p>
          <div class="card" style="text-align:left">
            <div class="row"><span class="label">Name</span><span class="value">${u.name}</span></div>
            <div class="row"><span class="label">Employee ID</span><span class="value">${u.employeeId}</span></div>
            <div class="row"><span class="label">Turning</span><span class="value">${age} years</span></div>
          </div>
          <p style="font-size:.9rem;color:#374151">Your team at Sangi wishes you all the best! 🎉</p>
        </div>
      `);
      const ok = await sendAlertEmail({ to: u.email, subject, html });
      await log('BIRTHDAY', u, subject, ok ? 'SENT' : 'FAILED', ok ? undefined : 'Email send failed', { age });
      if (ok) sent++;
    }
  }
  console.log(`[EmailAlerts] Birthday wishes: ${sent} sent`);
  return sent;
}

// ── 2. Work Anniversary Greetings ────────────────────────────
async function sendAnniversaryGreetings() {
  const today = new Date();
  const m = today.getMonth() + 1;
  const d = today.getDate();

  const users = await User.find({ isActive: true, joiningDate: { $exists: true, $ne: null } });
  let sent = 0;

  for (const u of users) {
    const jd = new Date(u.joiningDate);
    if (jd.getMonth() + 1 === m && jd.getDate() === d && jd.getFullYear() !== today.getFullYear()) {
      const years = today.getFullYear() - jd.getFullYear();
      if (years <= 0) continue;
      const subject = `🎉 Happy ${years}-Year Work Anniversary, ${u.name}!`;
      const html = wrap(`
        <div style="text-align:center;padding:20px 0">
          <div style="font-size:3rem">🏆</div>
          <h2 style="margin:10px 0 4px;color:#1e3a5f">Happy Work Anniversary!</h2>
          <p style="color:#6b7280;font-size:.92rem">Congratulations on completing <strong>${years} year${years > 1 ? 's' : ''}</strong> with us!</p>
          <div class="card" style="text-align:left">
            <div class="row"><span class="label">Name</span><span class="value">${u.name}</span></div>
            <div class="row"><span class="label">Employee ID</span><span class="value">${u.employeeId}</span></div>
            <div class="row"><span class="label">Joined On</span><span class="value">${jd.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
            <div class="row"><span class="label">Years Completed</span><span class="value">${years} year${years > 1 ? 's' : ''}</span></div>
          </div>
          <p style="font-size:.9rem;color:#374151">Thank you for your dedication and hard work! Here's to many more years. 🌟</p>
        </div>
      `);
      const ok = await sendAlertEmail({ to: u.email, subject, html });
      await log('WORK_ANNIVERSARY', u, subject, ok ? 'SENT' : 'FAILED', ok ? undefined : 'Email send failed', { years });
      if (ok) sent++;
    }
  }
  console.log(`[EmailAlerts] Anniversary greetings: ${sent} sent`);
  return sent;
}

// ── 3. Probation Completion Reminders (15 days before) ───────
async function sendProbationReminders() {
  const now = new Date();
  const in15days = new Date(now); in15days.setDate(in15days.getDate() + 15);
  const in15Start = new Date(in15days); in15Start.setHours(0, 0, 0, 0);
  const in15End   = new Date(in15days); in15End.setHours(23, 59, 59, 999);

  const users = await User.find({ isActive: true });
  let sent = 0;

  for (const u of users) {
    let probEnd = u.probationEndDate;
    if (!probEnd && u.joiningDate) {
      probEnd = new Date(u.joiningDate);
      probEnd.setMonth(probEnd.getMonth() + (u.probationMonths || 6));
    }
    if (!probEnd) continue;
    if (probEnd >= in15Start && probEnd <= in15End) {
      const endStr = probEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

      const hrUsers = await User.find({ role: { $in: ['HR', 'DIRECTOR', 'SUPER_ADMIN'] }, isActive: true }).select('_id email name');

      for (const hr of hrUsers) {
        const subject = `⏰ Probation Ending: ${u.name} (${u.employeeId}) — ${endStr}`;
        const html = wrap(`
          <p>Hi <strong>${hr.name}</strong>,</p>
          <p>This is a reminder that the probation period for the following employee ends in <strong>15 days</strong>:</p>
          <div class="card">
            <div class="row"><span class="label">Employee</span><span class="value">${u.name}</span></div>
            <div class="row"><span class="label">Employee ID</span><span class="value">${u.employeeId}</span></div>
            <div class="row"><span class="label">Designation</span><span class="value">${u.designation || '—'}</span></div>
            <div class="row"><span class="label">Joined</span><span class="value">${new Date(u.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
            <div class="row"><span class="label">Probation Ends</span><span class="value" style="color:#b91c1c;font-weight:700">${endStr}</span></div>
          </div>
          <p style="font-size:.9rem;color:#374151">Please review and take appropriate action (confirmation / extension / termination).</p>
          <a class="cta" href="${CLIENT()}/employees">View Employees</a>
        `);
        const ok = await sendAlertEmail({ to: hr.email, subject, html });
        await log('PROBATION_REMINDER', u, subject, ok ? 'SENT' : 'FAILED', ok ? undefined : 'Email send failed', { probEndDate: endStr, notifiedHR: hr.name });
        if (ok) sent++;
      }

      await Notification.create({
        recipient: u._id,
        type: 'GENERAL',
        title: 'Probation Period Ending Soon',
        message: `Your probation period ends on ${endStr}. Contact HR for confirmation details.`,
        link: '/dashboard',
      });
    }
  }
  console.log(`[EmailAlerts] Probation reminders: ${sent} sent`);
  return sent;
}

// ── 4. Leave Balance Alerts (when balance < 3 paid leaves) ───
async function sendLeaveBalanceAlerts() {
  const year = new Date().getFullYear();
  const ANNUAL_PAID = 18;
  const LOW_THRESHOLD = 3;

  const users = await User.find({ isActive: true, role: { $in: ['EMPLOYEE', 'HR', 'ACCOUNTS'] } });
  let sent = 0;

  for (const u of users) {
    const usedLeaves = await Leave.aggregate([
      { $match: { employee: u._id, status: 'APPROVED', isPaid: true, fromDate: { $gte: new Date(year, 0, 1) } } },
      { $group: { _id: null, total: { $sum: '$totalDays' } } },
    ]);
    const used = usedLeaves[0]?.total || 0;
    const remaining = ANNUAL_PAID - used;

    if (remaining <= LOW_THRESHOLD && remaining >= 0) {
      const subject = `⚠️ Low Leave Balance Alert: ${remaining} paid leave${remaining !== 1 ? 's' : ''} remaining`;
      const html = wrap(`
        <p>Hi <strong>${u.name}</strong>,</p>
        <p>This is a friendly reminder that your paid leave balance is running low.</p>
        <div class="card">
          <div class="row"><span class="label">Annual Paid Leaves</span><span class="value">${ANNUAL_PAID}</span></div>
          <div class="row"><span class="label">Used This Year</span><span class="value">${used}</span></div>
          <div class="row"><span class="label">Remaining</span><span class="value" style="color:${remaining <= 1 ? '#b91c1c' : '#b45309'};font-weight:700">${remaining}</span></div>
        </div>
        <p style="font-size:.9rem;color:#6b7280">Please plan your leaves accordingly. Any additional leaves will be marked as unpaid.</p>
        <a class="cta" href="${CLIENT()}/leave">View My Leaves</a>
      `);
      const ok = await sendAlertEmail({ to: u.email, subject, html });
      await log('LEAVE_BALANCE', u, subject, ok ? 'SENT' : 'FAILED', ok ? undefined : 'Email send failed', { used, remaining });
      if (ok) sent++;
    }
  }
  console.log(`[EmailAlerts] Leave balance alerts: ${sent} sent`);
  return sent;
}

// ── 5. SLA Breach Warnings ───────────────────────────────────
async function sendSLABreachWarnings() {
  const now = new Date();
  await Ticket.updateMany(
    { status: { $in: ['OPEN', 'IN_PROGRESS'] }, slaDueAt: { $lt: now }, slaBreached: false },
    { $set: { slaBreached: true } },
  );

  const breached = await Ticket.find({
    slaBreached: true, status: { $in: ['OPEN', 'IN_PROGRESS'] },
  }).populate('employee', 'name employeeId email').populate('assignedTo', 'name email');

  const hrUsers = await User.find({ role: { $in: ['HR', 'DIRECTOR', 'SUPER_ADMIN'] }, isActive: true }).select('_id email name');

  let sent = 0;
  const alreadySent = await EmailAlert.find({
    type: 'SLA_BREACH',
    createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
  }).select('metadata.ticketId');
  const sentTicketIds = new Set(alreadySent.map(a => a.metadata?.ticketId));

  for (const t of breached) {
    if (sentTicketIds.has(t._id.toString())) continue;

    const hoursOverdue = Math.round((now - t.slaDueAt) / (60 * 60 * 1000));
    const recipients = [...hrUsers];
    if (t.assignedTo?.email) recipients.push(t.assignedTo);

    for (const r of recipients) {
      const subject = `🚨 SLA Breached: ${t.ticketId} — ${t.subject}`;
      const html = wrap(`
        <p>Hi <strong>${r.name}</strong>,</p>
        <p>The following help desk ticket has <strong style="color:#b91c1c">breached its SLA</strong>:</p>
        <div class="card">
          <div class="row"><span class="label">Ticket</span><span class="value">${t.ticketId}</span></div>
          <div class="row"><span class="label">Subject</span><span class="value">${t.subject}</span></div>
          <div class="row"><span class="label">Category</span><span class="value">${t.category}</span></div>
          <div class="row"><span class="label">Priority</span><span class="value" style="color:#b91c1c">${t.priority}</span></div>
          <div class="row"><span class="label">Raised By</span><span class="value">${t.employee?.name || '—'}</span></div>
          <div class="row"><span class="label">SLA Due</span><span class="value" style="color:#b91c1c">${t.slaDueAt?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
          <div class="row"><span class="label">Overdue By</span><span class="value" style="color:#b91c1c;font-weight:700">${hoursOverdue} hours</span></div>
        </div>
        <p style="font-size:.9rem;color:#374151">Please resolve this ticket immediately.</p>
        <a class="cta" href="${CLIENT()}/tickets">View Tickets</a>
      `);
      const ok = await sendAlertEmail({ to: r.email, subject, html });
      await log('SLA_BREACH', t.employee, subject, ok ? 'SENT' : 'FAILED', ok ? undefined : 'Email send failed', { ticketId: t._id.toString(), hoursOverdue });
      if (ok) sent++;
    }
  }
  console.log(`[EmailAlerts] SLA breach warnings: ${sent} sent`);
  return sent;
}

// ── Run all alerts ───────────────────────────────────────────
async function runAllAlerts() {
  console.log('[EmailAlerts] Running all automated alerts...');
  const results = {};
  try { results.birthdays = await sendBirthdayWishes(); } catch (e) { results.birthdays = `Error: ${e.message}`; }
  try { results.anniversaries = await sendAnniversaryGreetings(); } catch (e) { results.anniversaries = `Error: ${e.message}`; }
  try { results.probation = await sendProbationReminders(); } catch (e) { results.probation = `Error: ${e.message}`; }
  try { results.leaveBalance = await sendLeaveBalanceAlerts(); } catch (e) { results.leaveBalance = `Error: ${e.message}`; }
  try { results.slaBreach = await sendSLABreachWarnings(); } catch (e) { results.slaBreach = `Error: ${e.message}`; }
  console.log('[EmailAlerts] All alerts complete:', results);
  return results;
}

module.exports = {
  sendBirthdayWishes,
  sendAnniversaryGreetings,
  sendProbationReminders,
  sendLeaveBalanceAlerts,
  sendSLABreachWarnings,
  runAllAlerts,
};
