const cron = require('node-cron');
const User        = require('../models/User.model');
const Attendance  = require('../models/Attendance.model');
const Holiday     = require('../models/Holiday.model');
const Resignation = require('../models/Resignation.model');
const { generateAllSalaries } = require('../services/salary.service');

const initCronJobs = () => {

  // Auto-absent — 11:59 PM daily
  cron.schedule('59 23 * * *', async () => {
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      // Include HR and ACCOUNTS since they now do check-in/check-out
      const employees = await User.find({ role: { $in: ['EMPLOYEE', 'HR', 'ACCOUNTS'] }, isActive: true });
      let count = 0;
      for (const emp of employees) {
        const existing = await Attendance.findOne({ employee: emp._id, date: today });
        if (!existing) {
          await Attendance.create({ employee: emp._id, date: today, status: 'ABSENT', displayStatus: 'ABSENT', markedBy: 'CRON' });
          count++;
        }
      }
      console.log(`[CRON] Auto-absent: ${count} staff marked`);
    } catch (err) { console.error('[CRON] Auto-absent failed:', err.message); }
  });

  // Sunday/Holiday mark — 00:05 AM daily
  cron.schedule('5 0 * * *', async () => {
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      // Include HR, ACCOUNTS and DIRECTOR for holiday/weekly-off marking
      const employees = await User.find({ role: { $in: ['EMPLOYEE', 'HR', 'ACCOUNTS', 'DIRECTOR'] }, isActive: true });

      if (today.getDay() === 0) { // Sunday
        for (const emp of employees) {
          await Attendance.findOneAndUpdate({ employee: emp._id, date: today }, { status: 'WEEKLY_OFF', displayStatus: 'FULL_DAY', markedBy: 'CRON' }, { upsert: true });
        }
        console.log(`[CRON] Sunday weekly-off marked for ${employees.length} staff`);
        return;
      }

      const holiday = await Holiday.findOne({ date: today });
      if (holiday) {
        for (const emp of employees) {
          await Attendance.findOneAndUpdate({ employee: emp._id, date: today }, { status: 'HOLIDAY', displayStatus: 'FULL_DAY', notes: `Holiday: ${holiday.name}`, markedBy: 'CRON' }, { upsert: true });
        }
        console.log(`[CRON] Holiday "${holiday.name}" marked for ${employees.length} staff`);
      }
    } catch (err) { console.error('[CRON] Holiday job failed:', err.message); }
  });

  // Auto-checkout — 6:00 PM Mon-Sat
  cron.schedule('0 18 * * 1-6', async () => {
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      const now   = new Date();
      const notCheckedOut = await Attendance.find({ date: today, checkIn: { $exists: true }, checkOut: { $exists: false } });
      for (const r of notCheckedOut) {
        const wh = parseFloat(((now - r.checkIn) / (1000*60*60)).toFixed(2));
        await Attendance.findByIdAndUpdate(r._id, { checkOut: now, checkOutTime: '18:00', workingHours: wh });
      }
      console.log(`[CRON] Auto-checkout: ${notCheckedOut.length} records processed`);
    } catch (err) { console.error('[CRON] Auto-checkout failed:', err.message); }
  });

  // Monthly salary generation — 1st of month 6:00 AM
  cron.schedule('0 6 1 * *', async () => {
    try {
      const now = new Date();
      let month = now.getMonth(); // Previous month
      let year  = now.getFullYear();
      if (month === 0) { month = 12; year--; }
      const results = await generateAllSalaries(month, year, { _id: null, name: 'System Cron', role: 'SUPER_ADMIN' });
      console.log(`[CRON] Salary gen: ${results.success.length} success, ${results.failed.length} failed`);
    } catch (err) { console.error('[CRON] Salary generation failed:', err.message); }
  });

  // Auto-remove employees 7 days after resignation approved — 2:00 AM daily
  cron.schedule('0 2 * * *', async () => {
    try {
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
      if (due.length) console.log(`[CRON] Auto-removed ${due.length} resigned employee(s)`);
    } catch (err) { console.error('[CRON] Auto-remove resigned employees failed:', err.message); }
  });

  console.log('✅ Cron jobs scheduled: auto-absent | holiday | auto-checkout | salary-gen | auto-remove-resigned');
};

module.exports = { initCronJobs };
