const express    = require('express');
const router     = express.Router();
const Onboarding = require('../models/Onboarding.model');
const { DEFAULT_CHECKLIST } = require('../models/Onboarding.model');
const User       = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');

// ── POST / — HR: create onboarding checklist for an employee ─
router.post('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { employeeId, checklist, dueDate, notes } = req.body;
    if (!employeeId) return next(new ApiError(400, 'Employee ID is required.'));

    const employee = await User.findOne({ employeeId }).select('_id name');
    if (!employee) return next(new ApiError(404, 'Employee not found.'));

    const existing = await Onboarding.findOne({ employee: employee._id });
    if (existing) return next(new ApiError(409, 'Onboarding checklist already exists for this employee.'));

    const items = (Array.isArray(checklist) && checklist.length > 0)
      ? checklist.map((item, i) => ({
          title: item.title?.trim(),
          description: item.description?.trim() || '',
          category: ['DOCUMENTS', 'IT_SETUP', 'HR_FORMALITIES', 'TRAINING', 'OTHER'].includes(item.category) ? item.category : 'OTHER',
          order: i + 1,
        }))
      : DEFAULT_CHECKLIST.map(item => ({ ...item }));

    const onboarding = await Onboarding.create({
      employee: employee._id,
      assignedBy: req.user._id,
      checklist: items,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes: notes?.trim() || '',
    });

    res.status(201).json({ success: true, message: `Onboarding created for ${employee.name}.`, data: onboarding });
  } catch (err) {
    if (err.code === 11000) return next(new ApiError(409, 'Onboarding already exists for this employee.'));
    next(err);
  }
});

// ── GET /my — Employee: own onboarding checklist ─────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const onboarding = await Onboarding.findOne({ employee: req.user._id })
      .populate('assignedBy', 'name')
      .populate('checklist.completedBy', 'name');
    res.json({ success: true, data: onboarding || null });
  } catch (err) { next(err); }
});

// ── GET / — HR: all onboarding records with progress ─────────
router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;

    if (search) {
      const users = await User.find({
        $or: [
          { name: new RegExp(search.trim(), 'i') },
          { employeeId: new RegExp(search.trim(), 'i') },
        ],
      }).select('_id');
      filter.employee = { $in: users.map(u => u._id) };
    }

    const records = await Onboarding.find(filter)
      .populate('employee', 'name employeeId designation department joiningDate')
      .populate('assignedBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: records });
  } catch (err) { next(err); }
});

// ── GET /stats — HR: onboarding statistics ───────────────────
router.get('/stats', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const [total, inProgress, completed] = await Promise.all([
      Onboarding.countDocuments(),
      Onboarding.countDocuments({ status: 'IN_PROGRESS' }),
      Onboarding.countDocuments({ status: 'COMPLETED' }),
    ]);

    const overdue = await Onboarding.countDocuments({
      status: 'IN_PROGRESS',
      dueDate: { $lt: new Date() },
    });

    res.json({ success: true, data: { total, inProgress, completed, overdue } });
  } catch (err) { next(err); }
});

// ── PATCH /:id/item/:itemId — Toggle checklist item ──────────
router.patch('/:id/item/:itemId', authenticate, async (req, res, next) => {
  try {
    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) return next(new ApiError(404, 'Onboarding not found.'));

    const isOwner = onboarding.employee.toString() === req.user._id.toString();
    const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role);
    if (!isOwner && !isAdmin) return next(new ApiError(403, 'Access denied.'));

    const item = onboarding.checklist.id(req.params.itemId);
    if (!item) return next(new ApiError(404, 'Checklist item not found.'));

    const { isCompleted, note } = req.body;
    if (isCompleted !== undefined) {
      item.isCompleted = isCompleted;
      item.completedAt = isCompleted ? new Date() : undefined;
      item.completedBy = isCompleted ? req.user._id : undefined;
    }
    if (note !== undefined) item.note = note.trim();

    // Auto-complete onboarding if all items done
    const allDone = onboarding.checklist.every(i => i.isCompleted);
    if (allDone && onboarding.status !== 'COMPLETED') {
      onboarding.status = 'COMPLETED';
      onboarding.completedAt = new Date();
    } else if (!allDone && onboarding.status === 'COMPLETED') {
      onboarding.status = 'IN_PROGRESS';
      onboarding.completedAt = undefined;
    }

    await onboarding.save();

    const updated = await Onboarding.findById(onboarding._id)
      .populate('assignedBy', 'name')
      .populate('checklist.completedBy', 'name');

    res.json({ success: true, message: 'Checklist updated.', data: updated });
  } catch (err) { next(err); }
});

// ── POST /:id/item — HR: add custom checklist item ───────────
router.post('/:id/item', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { title, description, category } = req.body;
    if (!title?.trim()) return next(new ApiError(400, 'Title is required.'));

    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) return next(new ApiError(404, 'Onboarding not found.'));

    onboarding.checklist.push({
      title: title.trim(),
      description: description?.trim() || '',
      category: ['DOCUMENTS', 'IT_SETUP', 'HR_FORMALITIES', 'TRAINING', 'OTHER'].includes(category) ? category : 'OTHER',
      order: onboarding.checklist.length + 1,
    });

    if (onboarding.status === 'COMPLETED') {
      onboarding.status = 'IN_PROGRESS';
      onboarding.completedAt = undefined;
    }

    await onboarding.save();
    res.json({ success: true, message: 'Item added.', data: onboarding });
  } catch (err) { next(err); }
});

// ── DELETE /:id/item/:itemId — HR: remove checklist item ─────
router.delete('/:id/item/:itemId', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const onboarding = await Onboarding.findById(req.params.id);
    if (!onboarding) return next(new ApiError(404, 'Onboarding not found.'));

    const item = onboarding.checklist.id(req.params.itemId);
    if (!item) return next(new ApiError(404, 'Item not found.'));

    item.deleteOne();

    const allDone = onboarding.checklist.length > 0 && onboarding.checklist.every(i => i.isCompleted);
    if (allDone) { onboarding.status = 'COMPLETED'; onboarding.completedAt = new Date(); }

    await onboarding.save();
    res.json({ success: true, message: 'Item removed.', data: onboarding });
  } catch (err) { next(err); }
});

// ── DELETE /:id — HR: delete entire onboarding record ────────
router.delete('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const record = await Onboarding.findById(req.params.id);
    if (!record) return next(new ApiError(404, 'Onboarding not found.'));
    await record.deleteOne();
    res.json({ success: true, message: 'Onboarding record deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
