const express    = require('express');
const router     = express.Router();
const DailyTask  = require('../models/DailyTask.model');
const User       = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');
const { generateMonthlyTaskPDF } = require('../utils/pdf.utils');
const {
  startOfDay,
  sanitizeTasks,
  getActiveDepartmentForHead,
  assertHodManagesEmployee,
} = require('../services/dailyTask.service');

// ── POST / — Employee submits today's task update (once per day for self-only) ──
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { tasks } = req.body;
    const sanitizedTasks = sanitizeTasks(tasks);

    const today = startOfDay(new Date());

    const existing = await DailyTask.findOne({ employee: req.user._id, date: today });
    if (existing) {
      if (existing.source === 'HOD') {
        return next(new ApiError(409, 'Your HOD assigned tasks for today — use Update today\'s tasks to edit them.'));
      }
      return next(new ApiError(409, 'You have already submitted tasks for today. Only one submission per day is allowed.'));
    }

    const entry = await DailyTask.create({
      employee: req.user._id,
      date:     today,
      tasks:    sanitizedTasks,
      source:   'SELF',
    });

    res.status(201).json({ success: true, message: 'Daily tasks submitted.', data: entry });
  } catch (err) {
    if (err.code === 11000) {
      return next(new ApiError(409, 'You have already submitted tasks for today.'));
    }
    next(err);
  }
});

/** PATCH today — update tasks when HOD assigned, or allow editing same day (optional) */
router.patch('/today', authenticate, async (req, res, next) => {
  try {
    const { tasks } = req.body;
    const sanitizedTasks = sanitizeTasks(tasks);
    const today = startOfDay(new Date());
    const doc = await DailyTask.findOne({ employee: req.user._id, date: today });
    if (!doc) return next(new ApiError(404, 'No task entry for today.'));
    if (doc.source !== 'HOD') {
      return next(new ApiError(400, 'Only HOD-assigned task lists can be updated this way. Self-submitted days are locked after submit.'));
    }
    doc.tasks = sanitizedTasks;
    doc.submittedAt = new Date();
    await doc.save();
    res.json({ success: true, message: 'Tasks updated.', data: doc });
  } catch (err) { next(err); }
});

// ── GET /my — Employee: own task history ──────────────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const filter = { employee: req.user._id };

    if (month && year) {
      const m = parseInt(month, 10) - 1;
      const y = parseInt(year, 10);
      filter.date = {
        $gte: new Date(y, m, 1),
        $lt:  new Date(y, m + 1, 1),
      };
    }

    const entries = await DailyTask.find(filter).sort({ date: -1 });
    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
});

// ── GET /today — Employee: today's entry (includes source HOD) ─
router.get('/today', authenticate, async (req, res, next) => {
  try {
    const today = startOfDay(new Date());
    const entry = await DailyTask.findOne({ employee: req.user._id, date: today });
    res.json({ success: true, data: entry || null, submitted: !!entry });
  } catch (err) { next(err); }
});

/** HOD assigns tasks for a team member for a given day (create or replace) */
router.post('/hod-assign', authenticate, async (req, res, next) => {
  try {
    const { employeeId, date: dateStr, tasks } = req.body;
    if (!employeeId) return next(new ApiError(400, 'employeeId is required.'));
    await assertHodManagesEmployee(req.user._id, employeeId);
    const sanitizedTasks = sanitizeTasks(tasks);
    const day = dateStr ? startOfDay(new Date(dateStr)) : startOfDay(new Date());
    if (Number.isNaN(day.getTime())) return next(new ApiError(400, 'Invalid date.'));

    const prior = await DailyTask.findOne({ employee: employeeId, date: day });
    if (prior && prior.source === 'SELF') {
      return next(new ApiError(409, 'This employee already submitted their own tasks for that day.'));
    }

    const doc = await DailyTask.findOneAndUpdate(
      { employee: employeeId, date: day },
      {
        employee: employeeId,
        date: day,
        tasks: sanitizedTasks,
        submittedAt: new Date(),
        assignedBy: req.user._id,
        source: 'HOD',
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json({ success: true, message: 'Tasks assigned.', data: doc });
  } catch (err) { next(err); }
});

/** HOD: all daily task rows for the department for a date range */
router.get('/hod-team-tasks', authenticate, async (req, res, next) => {
  try {
    const dept = await getActiveDepartmentForHead(req.user._id);
    if (!dept) return next(new ApiError(403, 'Only department heads can view team tasks.'));

    const { date, month, year, weekStart, employeeId } = req.query;
    const team = await User.find({ department: dept._id, isActive: true }).select('_id');
    const ids = team.map((u) => u._id);

    let employeeFilter;
    if (employeeId) {
      const ok = ids.some((id) => id.toString() === String(employeeId));
      if (!ok) return next(new ApiError(400, 'That employee is not in your department.'));
      employeeFilter = employeeId;
    } else {
      employeeFilter = { $in: ids };
    }

    const filter = { employee: employeeFilter };

    if (weekStart) {
      const ws = startOfDay(new Date(weekStart));
      if (Number.isNaN(ws.getTime())) return next(new ApiError(400, 'Invalid weekStart.'));
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      filter.date = { $gte: ws, $lt: we };
    } else if (date) {
      const d = startOfDay(new Date(date));
      if (Number.isNaN(d.getTime())) return next(new ApiError(400, 'Invalid date.'));
      filter.date = d;
    } else if (month && year) {
      const m = parseInt(month, 10) - 1;
      const y = parseInt(year, 10);
      filter.date = { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) };
    } else {
      filter.date = startOfDay(new Date());
    }

    const entries = await DailyTask.find(filter)
      .populate({ path: 'employee', select: 'name employeeId designation department', populate: { path: 'department', select: 'name' } })
      .populate('assignedBy', 'name employeeId')
      .sort({ date: -1, createdAt: -1 })
      .limit(800);

    res.json({
      success: true,
      data: entries,
      department: { _id: dept._id, name: dept.name },
    });
  } catch (err) { next(err); }
});

/** Summary counts per team member for a month (HOD) */
router.get('/hod-team-summary', authenticate, async (req, res, next) => {
  try {
    const dept = await getActiveDepartmentForHead(req.user._id);
    if (!dept) return next(new ApiError(403, 'Only department heads can view team summary.'));

    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const team = await User.find({ department: dept._id, isActive: true })
      .select('name employeeId designation')
      .sort({ name: 1 });

    const summary = await Promise.all(team.map(async (emp) => {
      const entries = await DailyTask.find({
        employee: emp._id,
        date: { $gte: start, $lt: end },
      }).select('date tasks source');
      let taskCount = 0;
      let completed = 0;
      let hodAssignedDays = 0;
      for (const e of entries) {
        if (e.source === 'HOD') hodAssignedDays++;
        for (const t of e.tasks || []) {
          taskCount++;
          if (t.status === 'COMPLETED') completed++;
        }
      }
      return {
        employee: emp,
        daysWithTasks: entries.length,
        hodAssignedDays,
        taskCount,
        completed,
      };
    }));

    res.json({
      success: true,
      data: summary,
      department: { _id: dept._id, name: dept.name },
      month,
      year,
    });
  } catch (err) { next(err); }
});

// ── GET / — HR/Admin: all task entries with filters ───────────
router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { employeeId, name, department, date, month, year } = req.query;
    const filter = {};

    const userFilter = {};
    if (employeeId) userFilter.employeeId = new RegExp(employeeId.trim(), 'i');
    if (name) userFilter.name = new RegExp(name.trim(), 'i');
    if (department) userFilter.department = department;

    if (Object.keys(userFilter).length > 0) {
      const users = await User.find(userFilter).select('_id');
      filter.employee = { $in: users.map(u => u._id) };
    }

    if (date) {
      filter.date = startOfDay(new Date(date));
    } else if (month && year) {
      const m = parseInt(month, 10) - 1;
      const y = parseInt(year, 10);
      filter.date = {
        $gte: new Date(y, m, 1),
        $lt:  new Date(y, m + 1, 1),
      };
    }

    const entries = await DailyTask.find(filter)
      .populate({ path: 'employee', select: 'name employeeId designation department', populate: { path: 'department', select: 'name' } })
      .populate('assignedBy', 'name employeeId')
      .sort({ date: -1, createdAt: -1 })
      .limit(500);

    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
});

// ── GET /report/:empId/:month/:year/pdf — Monthly task report ─
router.get('/report/:empId/:month/:year/pdf', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { empId, month, year } = req.params;
    const m = parseInt(month, 10) - 1;
    const y = parseInt(year, 10);

    const employee = await User.findOne({ employeeId: empId }).select('name employeeId designation department').populate('department', 'name');
    if (!employee) return next(new ApiError(404, 'Employee not found.'));

    const entries = await DailyTask.find({
      employee: employee._id,
      date: { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) },
    }).sort({ date: 1 });

    const pdfBuffer = await generateMonthlyTaskPDF(employee, entries, parseInt(month, 10), y);

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
