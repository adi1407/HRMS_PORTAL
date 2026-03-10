const express  = require('express');
const router   = express.Router();
const Warning  = require('../models/Warning.model');
const { ESCALATION_PATH } = require('../models/Warning.model');
const Notification = require('../models/Notification.model');
const User     = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');

// ── POST / — HR: issue a warning ─────────────────────────────
router.post('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { employeeId, type, category, subject, description, actionRequired, responseDeadline } = req.body;
    if (!employeeId || !type || !category || !subject || !description) {
      return next(new ApiError(400, 'employeeId, type, category, subject, and description are required.'));
    }

    const employee = await User.findOne({ employeeId }).select('_id name');
    if (!employee) return next(new ApiError(404, 'Employee not found.'));

    const warning = await Warning.create({
      employee: employee._id,
      issuedBy: req.user._id,
      type,
      category,
      subject: subject.trim(),
      description: description.trim(),
      actionRequired: actionRequired?.trim() || '',
      responseDeadline: responseDeadline ? new Date(responseDeadline) : undefined,
    });

    await Notification.create({
      recipient: employee._id,
      type: 'WARNING_ISSUED',
      title: `Warning Issued: ${subject}`,
      message: `A ${type.replace('_', ' ').toLowerCase()} warning has been issued for ${category.replace('_', ' ').toLowerCase()}.`,
      link: '/warnings',
      metadata: { warningId: warning._id },
    });

    res.status(201).json({ success: true, message: `Warning issued to ${employee.name}.`, data: warning });
  } catch (err) { next(err); }
});

// ── GET / — HR: all warnings with filters ─────────────────────
router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { status, type, category, search, flagged } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (category) filter.category = category;

    if (search) {
      const users = await User.find({
        $or: [
          { name: new RegExp(search.trim(), 'i') },
          { employeeId: new RegExp(search.trim(), 'i') },
        ],
      }).select('_id');
      filter.employee = { $in: users.map(u => u._id) };
    }

    let warnings = await Warning.find(filter)
      .populate('employee', 'name employeeId designation department')
      .populate('issuedBy', 'name')
      .sort({ createdAt: -1 });

    if (flagged === 'true') {
      const counts = {};
      for (const w of warnings) {
        const empId = w.employee?._id?.toString();
        if (empId) counts[empId] = (counts[empId] || 0) + 1;
      }
      const flaggedIds = new Set(Object.entries(counts).filter(([, c]) => c >= 3).map(([id]) => id));
      warnings = warnings.filter(w => flaggedIds.has(w.employee?._id?.toString()));
    }

    res.json({ success: true, data: warnings });
  } catch (err) { next(err); }
});

// ── GET /my — Employee: own warnings ──────────────────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const warnings = await Warning.find({ employee: req.user._id })
      .populate('issuedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: warnings });
  } catch (err) { next(err); }
});

// ── GET /stats — HR: warning statistics ───────────────────────
router.get('/stats', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const [total, active, acknowledged, escalated] = await Promise.all([
      Warning.countDocuments(),
      Warning.countDocuments({ status: 'ACTIVE' }),
      Warning.countDocuments({ status: 'ACKNOWLEDGED' }),
      Warning.countDocuments({ status: 'ESCALATED' }),
    ]);

    const pipeline = await Warning.aggregate([
      { $group: { _id: '$employee', count: { $sum: 1 } } },
      { $match: { count: { $gte: 3 } } },
      { $count: 'flagged' },
    ]);
    const flaggedEmployees = pipeline[0]?.flagged || 0;

    res.json({ success: true, data: { total, active, acknowledged, escalated, flaggedEmployees } });
  } catch (err) { next(err); }
});

// ── GET /employee/:empId — HR: all warnings for an employee ──
router.get('/employee/:empId', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const employee = await User.findOne({ employeeId: req.params.empId }).select('_id name employeeId designation');
    if (!employee) return next(new ApiError(404, 'Employee not found.'));

    const warnings = await Warning.find({ employee: employee._id })
      .populate('issuedBy', 'name')
      .sort({ createdAt: -1 });

    const nextEscalation = warnings.length > 0
      ? ESCALATION_PATH[warnings[0].type] || null
      : null;

    res.json({
      success: true,
      data: {
        employee,
        warnings,
        totalWarnings: warnings.length,
        isFlagged: warnings.length >= 3,
        nextEscalation,
      },
    });
  } catch (err) { next(err); }
});

// ── PATCH /:id/respond — Employee: respond/acknowledge ────────
router.patch('/:id/respond', authenticate, async (req, res, next) => {
  try {
    const warning = await Warning.findById(req.params.id);
    if (!warning) return next(new ApiError(404, 'Warning not found.'));
    if (warning.employee.toString() !== req.user._id.toString()) {
      return next(new ApiError(403, 'Not your warning.'));
    }
    if (!['ACTIVE'].includes(warning.status)) {
      return next(new ApiError(409, 'Warning already responded to.'));
    }

    const { response, appeal } = req.body;
    warning.employeeResponse = response?.trim() || '';
    warning.respondedAt = new Date();
    warning.status = appeal ? 'APPEALED' : 'ACKNOWLEDGED';
    await warning.save();

    const admins = await User.find({ role: { $in: ['HR', 'DIRECTOR', 'SUPER_ADMIN'] }, isActive: true }).select('_id');
    if (admins.length > 0) {
      await Notification.insertMany(admins.map(a => ({
        recipient: a._id,
        type: 'GENERAL',
        title: `Warning ${appeal ? 'Appealed' : 'Acknowledged'}: ${warning.warningId}`,
        message: `${req.user.name} has ${appeal ? 'appealed' : 'acknowledged'} warning ${warning.warningId}.`,
        link: '/warnings',
      })));
    }

    res.json({ success: true, message: `Warning ${appeal ? 'appealed' : 'acknowledged'}.`, data: warning });
  } catch (err) { next(err); }
});

// ── PATCH /:id/status — HR: update warning status ─────────────
router.patch('/:id/status', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const warning = await Warning.findById(req.params.id);
    if (!warning) return next(new ApiError(404, 'Warning not found.'));

    const { status } = req.body;
    if (!['ACTIVE', 'ACKNOWLEDGED', 'APPEALED', 'RESOLVED', 'ESCALATED'].includes(status)) {
      return next(new ApiError(400, 'Invalid status.'));
    }

    if (status === 'ESCALATED') {
      warning.escalatedTo = ESCALATION_PATH[warning.type] || 'TERMINATION';
    }

    warning.status = status;
    await warning.save();

    await Notification.create({
      recipient: warning.employee,
      type: 'WARNING_ISSUED',
      title: `Warning ${status}: ${warning.warningId}`,
      message: `Your warning ${warning.warningId} status changed to ${status.replace('_', ' ').toLowerCase()}.`,
      link: '/warnings',
    });

    res.json({ success: true, message: 'Status updated.', data: warning });
  } catch (err) { next(err); }
});

// ── DELETE /:id — HR: delete warning ──────────────────────────
router.delete('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const warning = await Warning.findById(req.params.id);
    if (!warning) return next(new ApiError(404, 'Warning not found.'));
    await warning.deleteOne();
    res.json({ success: true, message: 'Warning deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
