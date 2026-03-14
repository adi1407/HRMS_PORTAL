const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const Attendance = require('../models/Attendance.model');
const User    = require('../models/User.model');
const Salary  = require('../models/Salary.model');
const Holiday = require('../models/Holiday.model');

router.get('/dashboard', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN', 'ACCOUNTS'), async (req, res, next) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const next30     = new Date(todayStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [totalEmployees, todayRecords, roleAgg, upcomingHolidays, isSunday, todayHoliday, expectedEmployeeIds] = await Promise.all([
      User.countDocuments({ role: { $nin: ['SUPER_ADMIN'] }, isActive: true }),
      Attendance.find({ date: todayStart }).populate('employee', '_id'),
      User.aggregate([
        { $match: { isActive: true, role: { $ne: 'SUPER_ADMIN' } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      Holiday.find({ date: { $gte: todayStart, $lte: next30 } }).sort({ date: 1 }).limit(5),
      Promise.resolve(todayStart.getDay() === 0),
      Holiday.findOne({ date: todayStart }).then(h => !!h),
      User.find({ role: { $in: ['EMPLOYEE', 'HR', 'ACCOUNTS'] }, isActive: true }).select('_id').lean(),
    ]);

    const summary = { totalEmployees, presentToday: 0, halfDayToday: 0, absentToday: 0, onLeaveToday: 0 };
    todayRecords.forEach(r => {
      if      (r.displayStatus === 'FULL_DAY')  summary.presentToday++;
      else if (r.displayStatus === 'HALF_DAY')  summary.halfDayToday++;
      else if (r.displayStatus === 'ABSENT')    summary.absentToday++;
      else if (r.displayStatus === 'ON_LEAVE')  summary.onLeaveToday++;
    });

    // If cron didn't run (e.g. Render free tier sleep), treat "expected to work but no record" as absent so red block is correct
    const workingToday = !isSunday && !todayHoliday;
    if (workingToday && expectedEmployeeIds.length > 0) {
      const hasRecord = new Set(todayRecords.map(r => (r.employee?._id || r.employee)?.toString()).filter(Boolean));
      const absentNoRecord = expectedEmployeeIds.filter(e => !hasRecord.has(e._id.toString())).length;
      summary.absentToday += absentNoRecord;
    }

    summary.notMarkedYet = Math.max(0, totalEmployees - todayRecords.length);

    // Build role breakdown map { EMPLOYEE: n, HR: n, ACCOUNTS: n, DIRECTOR: n }
    const roleBreakdown = {};
    roleAgg.forEach(r => { roleBreakdown[r._id] = r.count; });

    res.json({ success: true, data: { ...summary, roleBreakdown, upcomingHolidays } });
  } catch (err) { next(err); }
});

router.get('/monthly/:m/:y', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN', 'ACCOUNTS'), async (req, res, next) => {
  try {
    const month = parseInt(req.params.m), year = parseInt(req.params.y);
    const salaries = await Salary.find({ month, year }).populate('employee', 'name employeeId');
    res.json({ success: true, data: {
      totalSalaries: salaries.length,
      totalPayout:      salaries.reduce((s, r) => s + r.netSalary, 0),
      totalDeductions:  salaries.reduce((s, r) => s + r.deductionAmount, 0),
    }});
  } catch (err) { next(err); }
});

module.exports = router;
