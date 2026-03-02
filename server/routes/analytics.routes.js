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

    const [totalEmployees, todayRecords, roleAgg, upcomingHolidays] = await Promise.all([
      User.countDocuments({ role: { $nin: ['SUPER_ADMIN'] }, isActive: true }),
      Attendance.find({ date: todayStart }),
      // Count every active non-super-admin role
      User.aggregate([
        { $match: { isActive: true, role: { $ne: 'SUPER_ADMIN' } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      Holiday.find({ date: { $gte: todayStart, $lte: next30 } }).sort({ date: 1 }).limit(5),
    ]);

    const summary = { totalEmployees, presentToday: 0, halfDayToday: 0, absentToday: 0, onLeaveToday: 0 };
    todayRecords.forEach(r => {
      if      (r.displayStatus === 'FULL_DAY')  summary.presentToday++;
      else if (r.displayStatus === 'HALF_DAY')  summary.halfDayToday++;
      else if (r.displayStatus === 'ABSENT')    summary.absentToday++;
      else if (r.displayStatus === 'ON_LEAVE')  summary.onLeaveToday++;
    });
    summary.notMarkedYet = totalEmployees - todayRecords.length;

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
