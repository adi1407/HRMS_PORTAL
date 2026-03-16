const express    = require('express');
const router     = express.Router();
const EmailAlert = require('../models/EmailAlert.model');
const User       = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  runAllAlerts, sendBirthdayWishes, sendAnniversaryGreetings,
  sendProbationReminders, sendLeaveBalanceAlerts, sendSLABreachWarnings,
} = require('../services/emailAlerts.service');

const TYPE_RUNNERS = {
  BIRTHDAY: sendBirthdayWishes,
  WORK_ANNIVERSARY: sendAnniversaryGreetings,
  PROBATION_REMINDER: sendProbationReminders,
  LEAVE_BALANCE: sendLeaveBalanceAlerts,
  SLA_BREACH: sendSLABreachWarnings,
};

// ── GET /history — alert send history with filters ───────────
router.get('/history', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { type, status, page = 1, limit = 50, startDate, endDate } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [alerts, total] = await Promise.all([
      EmailAlert.find(filter)
        .populate('recipient', 'name employeeId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      EmailAlert.countDocuments(filter),
    ]);

    res.json({ success: true, data: { alerts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

// ── GET /stats — alert statistics ────────────────────────────
router.get('/stats', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const todayStart = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    todayStart.setHours(0, 0, 0, 0);

    const [total, sentToday, byType, byStatus] = await Promise.all([
      EmailAlert.countDocuments(),
      EmailAlert.countDocuments({ createdAt: { $gte: todayStart } }),
      EmailAlert.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      EmailAlert.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const upcomingBirthdays = await User.find({ isActive: true, dateOfBirth: { $exists: true, $ne: null } }).select('name employeeId dateOfBirth');
    const today = new Date();
    const upcoming = upcomingBirthdays
      .map(u => {
        const dob = new Date(u.dateOfBirth);
        let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        if (next < today) next = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        const daysUntil = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
        return { name: u.name, employeeId: u.employeeId, date: next, daysUntil };
      })
      .filter(u => u.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 10);

    const upcomingAnniversaries = await User.find({ isActive: true, joiningDate: { $exists: true, $ne: null } }).select('name employeeId joiningDate');
    const upcomingAnn = upcomingAnniversaries
      .map(u => {
        const jd = new Date(u.joiningDate);
        let next = new Date(today.getFullYear(), jd.getMonth(), jd.getDate());
        if (next < today) next = new Date(today.getFullYear() + 1, jd.getMonth(), jd.getDate());
        const daysUntil = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
        const years = next.getFullYear() - jd.getFullYear();
        if (years <= 0) return null;
        return { name: u.name, employeeId: u.employeeId, date: next, daysUntil, years };
      })
      .filter(u => u && u.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        total, sentToday,
        byType: Object.fromEntries(byType.map(t => [t._id, t.count])),
        byStatus: Object.fromEntries(byStatus.map(s => [s._id, s.count])),
        upcomingBirthdays: upcoming,
        upcomingAnniversaries: upcomingAnn,
      },
    });
  } catch (err) { next(err); }
});

// ── POST /trigger — manually trigger alerts ──────────────────
router.post('/trigger', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { type } = req.body;
    let results;

    if (type && TYPE_RUNNERS[type]) {
      const count = await TYPE_RUNNERS[type]();
      results = { [type]: count };
    } else {
      results = await runAllAlerts();
    }

    res.json({ success: true, message: 'Alerts triggered.', data: results });
  } catch (err) { next(err); }
});

module.exports = router;
