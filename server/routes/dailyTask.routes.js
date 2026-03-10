const express    = require('express');
const router     = express.Router();
const DailyTask  = require('../models/DailyTask.model');
const User       = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');
const { generateMonthlyTaskPDF } = require('../utils/pdf.utils');

function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

// ── POST / — Employee submits today's task update (once per day) ──
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return next(new ApiError(400, 'At least one task is required.'));
    }
    if (tasks.length > 20) {
      return next(new ApiError(400, 'Maximum 20 tasks per day.'));
    }

    for (const t of tasks) {
      if (!t.title?.trim()) return next(new ApiError(400, 'Each task must have a title.'));
      if (t.title.length > 200) return next(new ApiError(400, 'Task title must be 200 chars or less.'));
      if (t.description && t.description.length > 1000) return next(new ApiError(400, 'Task description must be 1000 chars or less.'));
    }

    const today = startOfDay(new Date());

    const existing = await DailyTask.findOne({ employee: req.user._id, date: today });
    if (existing) {
      return next(new ApiError(409, 'You have already submitted tasks for today. Only one submission per day is allowed.'));
    }

    const sanitizedTasks = tasks.map(t => ({
      title:       t.title.trim(),
      description: (t.description || '').trim(),
      status:      ['COMPLETED', 'IN_PROGRESS', 'BLOCKED'].includes(t.status) ? t.status : 'COMPLETED',
    }));

    const entry = await DailyTask.create({
      employee: req.user._id,
      date:     today,
      tasks:    sanitizedTasks,
    });

    res.status(201).json({ success: true, message: 'Daily tasks submitted.', data: entry });
  } catch (err) {
    if (err.code === 11000) {
      return next(new ApiError(409, 'You have already submitted tasks for today.'));
    }
    next(err);
  }
});

// ── GET /my — Employee: own task history ──────────────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const filter = { employee: req.user._id };

    if (month && year) {
      const m = parseInt(month) - 1;
      const y = parseInt(year);
      filter.date = {
        $gte: new Date(y, m, 1),
        $lt:  new Date(y, m + 1, 1),
      };
    }

    const entries = await DailyTask.find(filter).sort({ date: -1 });
    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
});

// ── GET /today — Employee: check if today's task is submitted ─
router.get('/today', authenticate, async (req, res, next) => {
  try {
    const today = startOfDay(new Date());
    const entry = await DailyTask.findOne({ employee: req.user._id, date: today });
    res.json({ success: true, data: entry || null, submitted: !!entry });
  } catch (err) { next(err); }
});

// ── GET / — HR/Admin: all task entries with filters ───────────
router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { employeeId, name, date, month, year } = req.query;
    const filter = {};

    if (employeeId || name) {
      const userFilter = {};
      if (employeeId) userFilter.employeeId = new RegExp(employeeId.trim(), 'i');
      if (name) userFilter.name = new RegExp(name.trim(), 'i');
      const users = await User.find(userFilter).select('_id');
      filter.employee = { $in: users.map(u => u._id) };
    }

    if (date) {
      filter.date = startOfDay(new Date(date));
    } else if (month && year) {
      const m = parseInt(month) - 1;
      const y = parseInt(year);
      filter.date = {
        $gte: new Date(y, m, 1),
        $lt:  new Date(y, m + 1, 1),
      };
    }

    const entries = await DailyTask.find(filter)
      .populate('employee', 'name employeeId designation department')
      .sort({ date: -1, createdAt: -1 })
      .limit(500);

    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
});

// ── GET /report/:empId/:month/:year/pdf — Monthly task report ─
router.get('/report/:empId/:month/:year/pdf', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { empId, month, year } = req.params;
    const m = parseInt(month) - 1;
    const y = parseInt(year);

    const employee = await User.findOne({ employeeId: empId }).select('name employeeId designation department').populate('department', 'name');
    if (!employee) return next(new ApiError(404, 'Employee not found.'));

    const entries = await DailyTask.find({
      employee: employee._id,
      date: { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) },
    }).sort({ date: 1 });

    const pdfBuffer = await generateMonthlyTaskPDF(employee, entries, parseInt(month), y);

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const filename = `Task_Report_${empId}_${MONTHS[m]}_${y}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

module.exports = router;
