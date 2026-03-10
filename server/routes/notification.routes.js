const express      = require('express');
const router       = express.Router();
const Notification = require('../models/Notification.model');
const User         = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');

// ── GET /my — current user's notifications ───────────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 30, unreadOnly } = req.query;
    const filter = { recipient: req.user._id };
    if (unreadOnly === 'true') filter.isRead = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.json({ success: true, data: { notifications, total, unreadCount, page: parseInt(page) } });
  } catch (err) { next(err); }
});

// ── GET /unread-count — just the badge number ────────────────
router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
});

// ── PATCH /:id/read — mark one as read ───────────────────────
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const notif = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
    if (!notif) return next(new ApiError(404, 'Notification not found.'));
    if (!notif.isRead) {
      notif.isRead = true;
      notif.readAt = new Date();
      await notif.save();
    }
    res.json({ success: true, data: notif });
  } catch (err) { next(err); }
});

// ── PATCH /read-all — mark all as read ───────────────────────
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) { next(err); }
});

// ── DELETE /:id — delete single notification ─────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    if (!notif) return next(new ApiError(404, 'Notification not found.'));
    res.json({ success: true, message: 'Deleted.' });
  } catch (err) { next(err); }
});

// ── DELETE /clear-all — delete all for current user ──────────
router.delete('/clear-all', authenticate, async (req, res, next) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ success: true, message: 'All notifications cleared.' });
  } catch (err) { next(err); }
});

// ── POST /send — HR/Admin: send notification to employee(s) ─
router.post('/send', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { recipientIds, title, message, type, link } = req.body;
    if (!title?.trim() || !message?.trim()) return next(new ApiError(400, 'Title and message are required.'));

    let recipients = [];
    if (Array.isArray(recipientIds) && recipientIds.length > 0) {
      recipients = recipientIds;
    } else if (req.body.recipientId) {
      recipients = [req.body.recipientId];
    } else if (req.body.broadcast) {
      const users = await User.find({ isActive: true }).select('_id');
      recipients = users.map(u => u._id);
    } else {
      return next(new ApiError(400, 'Provide recipientId, recipientIds, or broadcast: true.'));
    }

    const docs = recipients.map(r => ({
      recipient: r,
      title: title.trim(),
      message: message.trim(),
      type: type || 'GENERAL',
      link: link || '',
    }));

    await Notification.insertMany(docs);
    res.status(201).json({ success: true, message: `Sent to ${recipients.length} recipient(s).` });
  } catch (err) { next(err); }
});

module.exports = router;
