const express  = require('express');
const router   = express.Router();
const Ticket   = require('../models/Ticket.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');

// ── POST / — Employee raises a ticket ────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { category, subject, description, priority } = req.body;
    if (!category) return next(new ApiError(400, 'Category is required.'));
    if (!subject?.trim()) return next(new ApiError(400, 'Subject is required.'));
    if (!description?.trim()) return next(new ApiError(400, 'Description is required.'));

    const ticket = await Ticket.create({
      employee: req.user._id,
      category,
      subject: subject.trim(),
      description: description.trim(),
      priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority) ? priority : 'MEDIUM',
    });

    res.status(201).json({ success: true, message: `Ticket ${ticket.ticketId} created.`, data: ticket });
  } catch (err) { next(err); }
});

// ── GET /my — Employee: own tickets ──────────────────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ employee: req.user._id })
      .populate('assignedTo', 'name')
      .populate('comments.author', 'name role')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tickets });
  } catch (err) { next(err); }
});

// ── GET / — HR/Admin: all tickets with filters ───────────────
router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { status, category, priority } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    // Update SLA breach for overdue tickets
    const now = new Date();
    await Ticket.updateMany(
      { status: { $in: ['OPEN', 'IN_PROGRESS'] }, slaDueAt: { $lt: now }, slaBreached: false },
      { $set: { slaBreached: true } }
    );

    const tickets = await Ticket.find(filter)
      .populate('employee', 'name employeeId designation department')
      .populate('assignedTo', 'name')
      .populate('comments.author', 'name role')
      .sort({ slaBreached: -1, createdAt: -1 });

    res.json({ success: true, data: tickets });
  } catch (err) { next(err); }
});

// ── GET /stats — HR/Admin: ticket statistics ─────────────────
router.get('/stats', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const [open, inProgress, resolved, closed, breached] = await Promise.all([
      Ticket.countDocuments({ status: 'OPEN' }),
      Ticket.countDocuments({ status: 'IN_PROGRESS' }),
      Ticket.countDocuments({ status: 'RESOLVED' }),
      Ticket.countDocuments({ status: 'CLOSED' }),
      Ticket.countDocuments({ slaBreached: true, status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
    ]);
    res.json({ success: true, data: { open, inProgress, resolved, closed, breached } });
  } catch (err) { next(err); }
});

// ── PATCH /:id/status — HR/Admin: update ticket status/assignment ─
router.patch('/:id/status', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { status, assignedTo } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return next(new ApiError(404, 'Ticket not found.'));

    if (status && ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      ticket.status = status;
    }
    if (assignedTo !== undefined) ticket.assignedTo = assignedTo || undefined;

    await ticket.save();
    res.json({ success: true, message: 'Ticket updated.', data: ticket });
  } catch (err) { next(err); }
});

// ── POST /:id/comment — Add comment (employee or HR) ────────
router.post('/:id/comment', authenticate, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return next(new ApiError(400, 'Comment message is required.'));

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return next(new ApiError(404, 'Ticket not found.'));

    const isOwner = ticket.employee.toString() === req.user._id.toString();
    const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role);
    if (!isOwner && !isAdmin) return next(new ApiError(403, 'Access denied.'));

    ticket.comments.push({ author: req.user._id, message: message.trim() });
    await ticket.save();

    const updated = await Ticket.findById(ticket._id)
      .populate('comments.author', 'name role');

    res.json({ success: true, message: 'Comment added.', data: updated });
  } catch (err) { next(err); }
});

module.exports = router;
