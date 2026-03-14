const cron = require('node-cron');
const User        = require('../models/User.model');
const Attendance  = require('../models/Attendance.model');
const Holiday     = require('../models/Holiday.model');
const Resignation = require('../models/Resignation.model');
const { generateAllSalaries } = require('../services/salary.service');
const { runAllAlerts } = require('../services/emailAlerts.service');

async function runAutoAbsent() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const employees = await User.find({ role: { $in: ['EMPLOYEE', 'HR', 'ACCOUNTS'] }, isActive: true });
  let count = 0;
  for (const emp of employees) {
    const existing = await Attendance.findOne({ employee: emp._id, date: today });
    if (!existing) {
      await Attendance.create({ employee: emp._id, date: today, status: 'ABSENT', displayStatus: 'ABSENT', markedBy: 'CRON' });
      count++;
    }
  }
  return { count };
}

async function runHolidayMark() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const employees = await User.find({ role: { $in: ['EMPLOYEE', 'HR', 'ACCOUNTS', 'DIRECTOR'] }, isActive: true });
  if (today.getDay() === 0) {
    for (const emp of employees) {
      await Attendance.findOneAndUpdate({ employee: emp._id, date: today }, { status: 'WEEKLY_OFF', displayStatus: 'FULL_DAY', markedBy: 'CRON' }, { upsert: true });
    }
    return { weeklyOff: employees.length };
  }
  const holiday = await Holiday.findOne({ date: today });
  if (holiday) {
    for (const emp of employees) {
      await Attendance.findOneAndUpdate({ employee: emp._id, date: today }, { status: 'HOLIDAY', displayStatus: 'FULL_DAY', notes: `Holiday: ${holiday.name}`, markedBy: 'CRON' }, { upsert: true });
    }
    return { holiday: holiday.name, count: employees.length };
  }
  return {};
}

async function runEodEvaluation() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let absentCount = 0, halfCount = 0, fullCount = 0;

  const noCheckout = await Attendance.find({
    date: today,
    checkIn:  { $exists: true, $ne: null },
    $or: [{ checkOut: { $exists: false } }, { checkOut: null }],
    status: { $nin: ['ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF'] },
    markedBy: { $nin: ['HR', 'DIRECTOR', 'SUPER_ADMIN'] },
  });
  for (const r of noCheckout) {
    await Attendance.findByIdAndUpdate(r._id, {
      status: 'ABSENT', displayStatus: 'ABSENT', isRealHalfDay: false,
      notes: (r.notes || '') + ' | no_checkout', markedBy: 'CRON',
    });
    absentCount++;
  }

  const withBoth = await Attendance.find({
    date: today,
    checkIn:  { $exists: true, $ne: null },
    checkOut: { $exists: true, $ne: null },
    status: { $nin: ['ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF'] },
    markedBy: { $nin: ['HR', 'DIRECTOR', 'SUPER_ADMIN'] },
  });

  const FULLDAY_H = 8;
  const HALFDAY_CHECKIN_MIN = 13 * 60;
  const EARLY_CHECKOUT_MIN  = 16 * 60;

  for (const r of withBoth) {
    const hours = r.workingHours || parseFloat(((new Date(r.checkOut) - new Date(r.checkIn)) / (1000 * 60 * 60)).toFixed(2));
    const checkinMins  = new Date(r.checkIn).getHours() * 60 + new Date(r.checkIn).getMinutes();
    const checkoutMins = new Date(r.checkOut).getHours() * 60 + new Date(r.checkOut).getMinutes();

    let newStatus, newDisplay, newRealHalf;

    if (hours >= FULLDAY_H) {
      newStatus = 'FULL_DAY'; newDisplay = 'FULL_DAY'; newRealHalf = false;
      fullCount++;
    } else if (checkinMins > HALFDAY_CHECKIN_MIN || checkoutMins < EARLY_CHECKOUT_MIN) {
      newStatus = 'HALF_DAY'; newDisplay = 'HALF_DAY'; newRealHalf = true;
      halfCount++;
    } else {
      newStatus = 'HALF_DAY'; newDisplay = 'HALF_DAY'; newRealHalf = true;
      halfCount++;
    }

    if (r.status !== newStatus) {
      await Attendance.findByIdAndUpdate(r._id, {
        status: newStatus, displayStatus: newDisplay, isRealHalfDay: newRealHalf,
        workingHours: hours, markedBy: 'CRON',
      });
    }
  }

  return { absentNoCheckout: absentCount, fullCount, halfCount };
}

async function runSalaryGen() {
  const now = new Date();
  let month = now.getMonth();
  let year  = now.getFullYear();
  if (month === 0) { month = 12; year--; }
  return await generateAllSalaries(month, year, { _id: null, name: 'System Cron', role: 'SUPER_ADMIN' });
}

async function runAutoRemoveResigned() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const due = await Resignation.find({
    status: 'APPROVED',
    employeeRemoved: false,
    headReviewedAt: { $lte: cutoff },
  });
  for (const r of due) {
    await User.findByIdAndDelete(r.employee);
    r.employeeRemoved   = true;
    r.employeeRemovedAt = new Date();
    await r.save();
  }
  return { removed: due.length };
}

async function runEmailAlerts() {
  return await runAllAlerts();
}

const initCronJobs = () => {
  cron.schedule('59 23 * * *', async () => {
    try {
      const r = await runAutoAbsent();
      console.log(`[CRON] Auto-absent: ${r.count} staff marked`);
    } catch (err) { console.error('[CRON] Auto-absent failed:', err.message); }
  });

  cron.schedule('5 0 * * *', async () => {
    try {
      const r = await runHolidayMark();
      if (r.weeklyOff) console.log(`[CRON] Sunday weekly-off marked for ${r.weeklyOff} staff`);
      else if (r.holiday) console.log(`[CRON] Holiday "${r.holiday}" marked for ${r.count} staff`);
    } catch (err) { console.error('[CRON] Holiday job failed:', err.message); }
  });

  cron.schedule('30 23 * * 1-6', async () => {
    try {
      const r = await runEodEvaluation();
      console.log(`[CRON] EOD evaluation: ${r.absentNoCheckout} absent (no checkout), ${r.fullCount} full-day, ${r.halfCount} half-day re-evaluated`);
    } catch (err) { console.error('[CRON] End-of-day evaluation failed:', err.message); }
  });

  cron.schedule('0 6 1 * *', async () => {
    try {
      const results = await runSalaryGen();
      console.log(`[CRON] Salary gen: ${results.success.length} success, ${results.failed.length} failed`);
    } catch (err) { console.error('[CRON] Salary generation failed:', err.message); }
  });

  cron.schedule('0 2 * * *', async () => {
    try {
      const r = await runAutoRemoveResigned();
      if (r.removed) console.log(`[CRON] Auto-removed ${r.removed} resigned employee(s)`);
    } catch (err) { console.error('[CRON] Auto-remove resigned employees failed:', err.message); }
  });

  cron.schedule('30 8 * * *', async () => {
    try {
      const results = await runEmailAlerts();
      console.log('[CRON] Email alerts:', JSON.stringify(results));
    } catch (err) { console.error('[CRON] Email alerts failed:', err.message); }
  });

  console.log('✅ Cron jobs scheduled: auto-absent | holiday | eod-evaluation | salary-gen | auto-remove-resigned | email-alerts');
};

module.exports = {
  initCronJobs,
  runAutoAbsent,
  runHolidayMark,
  runEodEvaluation,
  runSalaryGen,
  runAutoRemoveResigned,
  runEmailAlerts,
};
