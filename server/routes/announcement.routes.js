const express      = require('express');
const router       = express.Router();
const Announcement = require('../models/Announcement.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');

// ── POST / — HR/Director/SuperAdmin creates announcement ─────
router.post('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { title, content, priority, audience, department, branch, expiresAt } = req.body;
    if (!title?.trim()) return next(new ApiError(400, 'Title is required.'));
    if (!content?.trim()) return next(new ApiError(400, 'Content is required.'));

    const data = {
      title: title.trim(),
      content: content.trim(),
      priority: ['NORMAL', 'IMPORTANT', 'URGENT'].includes(priority) ? priority : 'NORMAL',
      audience: ['ALL', 'DEPARTMENT', 'BRANCH'].includes(audience) ? audience : 'ALL',
      createdBy: req.user._id,
    };

    if (audience === 'DEPARTMENT' && department) data.department = department;
    if (audience === 'BRANCH' && branch) data.branch = branch;
    if (expiresAt) data.expiresAt = new Date(expiresAt);

    const ann = await Announcement.create(data);
    res.status(201).json({ success: true, message: 'Announcement created.', data: ann });
  } catch (err) { next(err); }
});

// ── GET /active — All authenticated users: get active announcements ──
router.get('/active', authenticate, async (req, res, next) => {
  try {
    const now = new Date();
    const filter = {
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
    };

    let announcements = await Announcement.find(filter)
      .populate('createdBy', 'name role')
      .populate('department', 'name')
      .populate('branch', 'name')
      .sort({ priority: -1, createdAt: -1 })
      .limit(50);

    // Filter by audience relevance for current user
    const user = req.user;
    announcements = announcements.filter(a => {
      if (a.audience === 'ALL') return true;
      if (a.audience === 'DEPARTMENT' && a.department) {
        const userDeptId = user.department?._id?.toString() || user.department?.toString();
        return userDeptId === a.department._id.toString();
      }
      if (a.audience === 'BRANCH' && a.branch) {
        const userBranchId = user.branch?._id?.toString() || user.branch?.toString();
        return userBranchId === a.branch._id.toString();
      }
      return true;
    });

    // Sort: URGENT first, then IMPORTANT, then NORMAL
    const priorityOrder = { URGENT: 0, IMPORTANT: 1, NORMAL: 2 };
    announcements.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

    res.json({ success: true, data: announcements });
  } catch (err) { next(err); }
});

// ── GET / — HR/Director/SuperAdmin: all announcements (management) ──
router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const announcements = await Announcement.find()
      .populate('createdBy', 'name role')
      .populate('department', 'name')
      .populate('branch', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: announcements });
  } catch (err) { next(err); }
});

// ── PATCH /:id — Edit announcement ───────────────────────────
router.patch('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { title, content, priority, audience, department, branch, expiresAt, isActive } = req.body;
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return next(new ApiError(404, 'Announcement not found.'));

    if (title !== undefined) ann.title = title.trim();
    if (content !== undefined) ann.content = content.trim();
    if (priority !== undefined && ['NORMAL', 'IMPORTANT', 'URGENT'].includes(priority)) ann.priority = priority;
    if (audience !== undefined && ['ALL', 'DEPARTMENT', 'BRANCH'].includes(audience)) ann.audience = audience;
    if (department !== undefined) ann.department = department || undefined;
    if (branch !== undefined) ann.branch = branch || undefined;
    if (expiresAt !== undefined) ann.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
    if (isActive !== undefined) ann.isActive = isActive;

    await ann.save();
    res.json({ success: true, message: 'Announcement updated.', data: ann });
  } catch (err) { next(err); }
});

// ── DELETE /:id — Delete announcement ────────────────────────
router.delete('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return next(new ApiError(404, 'Announcement not found.'));
    await ann.deleteOne();
    res.json({ success: true, message: 'Announcement deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
