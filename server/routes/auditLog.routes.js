const express  = require('express');
const router   = express.Router();
const AuditLog = require('../models/AuditLog.model');
const User     = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// ── GET / — paginated, filtered audit logs ───────────────────
router.get('/', authenticate, authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const {
      page = 1, limit = 50,
      severity, action, entity, method,
      search, actor,
      startDate, endDate,
    } = req.query;

    const filter = {};

    if (severity) filter.severity = severity;
    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (method) filter.method = method;

    if (search) {
      filter.$or = [
        { description: new RegExp(search.trim(), 'i') },
        { actorName: new RegExp(search.trim(), 'i') },
        { path: new RegExp(search.trim(), 'i') },
        { action: new RegExp(search.trim(), 'i') },
      ];
    }

    if (actor) {
      const users = await User.find({
        $or: [
          { name: new RegExp(actor.trim(), 'i') },
          { employeeId: new RegExp(actor.trim(), 'i') },
        ],
      }).select('_id');
      filter.actor = { $in: users.map(u => u._id) };
    }

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
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('actor', 'name employeeId role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

// ── GET /stats — aggregate statistics ────────────────────────
router.get('/stats', authenticate, authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart  = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [
      total, today, thisWeek,
      bySeverity, byAction, byEntity, byMethod,
      recentActors,
      hourlyToday,
    ] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ createdAt: { $gte: todayStart } }),
      AuditLog.countDocuments({ createdAt: { $gte: weekStart } }),

      AuditLog.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      AuditLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      AuditLog.aggregate([
        { $group: { _id: '$entity', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      AuditLog.aggregate([
        { $group: { _id: '$method', count: { $sum: 1 } } },
      ]),

      AuditLog.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        { $group: { _id: '$actor', actorName: { $first: '$actorName' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),

      AuditLog.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { '_id': 1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        total, today, thisWeek,
        bySeverity: Object.fromEntries(bySeverity.map(s => [s._id, s.count])),
        byAction: byAction.map(a => ({ action: a._id, count: a.count })),
        byEntity: byEntity.map(e => ({ entity: e._id, count: e.count })),
        byMethod: Object.fromEntries(byMethod.map(m => [m._id, m.count])),
        recentActors: recentActors.map(a => ({ name: a.actorName || 'System', count: a.count })),
        hourlyToday: hourlyToday.map(h => ({ hour: h._id, count: h.count })),
      },
    });
  } catch (err) { next(err); }
});

// ── DELETE /clear — Super Admin: clear old logs ──────────────
router.delete('/clear', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { olderThanDays = 90 } = req.query;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(olderThanDays));
    const result = await AuditLog.deleteMany({ createdAt: { $lt: cutoff } });
    res.json({ success: true, message: `Deleted ${result.deletedCount} logs older than ${olderThanDays} days.` });
  } catch (err) { next(err); }
});

module.exports = router;
