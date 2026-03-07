const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const Resignation = require('../models/Resignation.model');
const Salary      = require('../models/Salary.model');
const User        = require('../models/User.model');
const { ApiError } = require('../utils/api.utils');
const { generateResignationPDF } = require('../utils/pdf.utils');

// EMPLOYEE / HR / ACCOUNTS: submit resignation
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { reason, lastWorkingDate } = req.body;
    if (!reason?.trim()) return next(new ApiError(400, 'Reason is required.'));

    const existing = await Resignation.findOne({ employee: req.user._id, status: { $in: ['PENDING_HR', 'PENDING_HEAD'] } });
    if (existing) return next(new ApiError(409, 'You already have a pending resignation request.'));

    const resignation = await Resignation.create({
      employee:        req.user._id,
      reason:          reason.trim(),
      lastWorkingDate: lastWorkingDate ? new Date(lastWorkingDate) : undefined,
    });

    res.status(201).json({ success: true, message: 'Resignation submitted. HR will review it shortly.', data: resignation });
  } catch (err) { next(err); }
});

// EMPLOYEE: view all own resignations (history preserved, newest first)
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const resignations = await Resignation.find({ employee: req.user._id })
      .populate('hrReviewedBy', 'name')
      .populate('headReviewedBy', 'name')
      .sort({ createdAt: -1 });
    // Return array — latest is first; frontend uses [0] as current and rest as history
    res.status(200).json({ success: true, data: resignations });
  } catch (err) { next(err); }
});

// HR: list resignations pending HR review
router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'HR') filter.status = 'PENDING_HR';
    else if (req.query.status) filter.status = req.query.status;

    const list = await Resignation.find(filter)
      .populate('employee', 'name employeeId designation department joiningDate')
      .populate('hrReviewedBy', 'name')
      .populate('headReviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: list });
  } catch (err) { next(err); }
});

// Managing Head: list resignations pending head review
router.get('/pending-head', authenticate, async (req, res, next) => {
  try {
    if (!req.user.isManagingHead && !['DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role)) {
      return next(new ApiError(403, 'Access denied.'));
    }
    const list = await Resignation.find({ status: 'PENDING_HEAD' })
      .populate('employee', 'name employeeId designation department joiningDate')
      .populate('hrReviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: list });
  } catch (err) { next(err); }
});

// HR: approve or reject
router.patch('/:id/hr-review', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) return next(new ApiError(400, 'action must be approve or reject.'));

    const resignation = await Resignation.findById(req.params.id);
    if (!resignation) return next(new ApiError(404, 'Resignation not found.'));
    if (resignation.status !== 'PENDING_HR') return next(new ApiError(409, 'Not pending HR review.'));

    resignation.hrReviewedBy = req.user._id;
    resignation.hrNote       = note || '';
    resignation.hrReviewedAt = new Date();

    if (action === 'approve') {
      resignation.status = 'PENDING_HEAD'; // moves to managing head
    } else {
      resignation.status        = 'REJECTED';
      resignation.rejectedBy    = 'HR';
      resignation.rejectionNote = note || '';
    }

    await resignation.save();
    res.status(200).json({ success: true, message: action === 'approve' ? 'Forwarded to Managing Head.' : 'Resignation rejected.', data: resignation });
  } catch (err) { next(err); }
});

// Managing Head / DIRECTOR / SUPER_ADMIN: final approval or rejection
router.patch('/:id/head-review', authenticate, async (req, res, next) => {
  try {
    if (!req.user.isManagingHead && !['DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role)) {
      return next(new ApiError(403, 'Only the Managing Head can give final approval.'));
    }
    const { action, note } = req.body;
    if (!['approve', 'reject'].includes(action)) return next(new ApiError(400, 'action must be approve or reject.'));

    const resignation = await Resignation.findById(req.params.id).populate('employee');
    if (!resignation) return next(new ApiError(404, 'Resignation not found.'));
    if (resignation.status !== 'PENDING_HEAD') return next(new ApiError(409, 'Not pending head review.'));

    resignation.headReviewedBy = req.user._id;
    resignation.headNote       = note || '';
    resignation.headReviewedAt = new Date();

    if (action === 'reject') {
      resignation.status        = 'REJECTED';
      resignation.rejectedBy    = 'HEAD';
      resignation.rejectionNote = note || '';
      await resignation.save();
      return res.status(200).json({ success: true, message: 'Resignation rejected by Managing Head.', data: resignation });
    }

    resignation.status = 'APPROVED';
    await resignation.save();

    res.status(200).json({ success: true, message: 'Resignation approved. Documents are ready for download.', data: resignation });
  } catch (err) { next(err); }
});

// Download experience letter + last 2 payslips PDF (available after approval)
router.get('/:id/documents', authenticate, async (req, res, next) => {
  try {
    const resignation = await Resignation.findById(req.params.id).populate('employee');
    if (!resignation) return next(new ApiError(404, 'Resignation not found.'));

    // Only employee themselves, HR, Head, Director can download
    const isOwn  = resignation.employee._id.toString() === req.user._id.toString();
    const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role) || req.user.isManagingHead;
    if (!isOwn && !isAdmin) return next(new ApiError(403, 'Access denied.'));
    if (resignation.status !== 'APPROVED') return next(new ApiError(400, 'Documents only available after resignation is approved.'));

    // Get last 2 months salary slips
    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    const months = [
      { month: month === 1 ? 12 : month - 1, year: month === 1 ? year - 1 : year },
      { month: month === 2 ? 11 : month === 1 ? 12 : month - 2, year: month <= 2 ? year - 1 : year },
    ];
    const salaries = await Salary.find({
      employee: resignation.employee._id,
      $or: months,
    }).populate('employee', 'name employeeId designation department joiningDate bankAccountNumber ifscCode');

    const pdfBuffer = await generateResignationPDF(resignation, salaries);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Resignation_Documents_${resignation.employee.name.replace(/\s+/g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

module.exports = router;
