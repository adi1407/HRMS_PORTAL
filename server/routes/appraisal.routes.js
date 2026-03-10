const express    = require('express');
const router     = express.Router();
const Appraisal  = require('../models/Appraisal.model');
const Notification = require('../models/Notification.model');
const User       = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');
const { generateAppraisalLetterPDF } = require('../utils/pdf.utils');

const POPULATE_FIELDS = [
  { path: 'employee', select: 'name employeeId designation department joiningDate' },
  { path: 'reviewer', select: 'name employeeId designation' },
  { path: 'createdBy', select: 'name' },
];

// ── POST / — HR: create appraisal cycle for an employee ──────
router.post('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { employeeId, reviewerId, cycleType, cycleName, startDate, endDate, deadline, kpis } = req.body;

    if (!employeeId || !reviewerId || !cycleType || !cycleName || !startDate || !endDate) {
      return next(new ApiError(400, 'employeeId, reviewerId, cycleType, cycleName, startDate, and endDate are required.'));
    }
    if (!Array.isArray(kpis) || kpis.length === 0) {
      return next(new ApiError(400, 'At least one KPI is required.'));
    }

    const totalWeight = kpis.reduce((s, k) => s + (Number(k.weight) || 0), 0);
    if (totalWeight !== 100) {
      return next(new ApiError(400, `KPI weights must total 100%. Current total: ${totalWeight}%.`));
    }

    const employee = await User.findOne({ employeeId }).select('_id name');
    if (!employee) return next(new ApiError(404, 'Employee not found.'));

    const reviewer = await User.findOne({ employeeId: reviewerId }).select('_id name');
    if (!reviewer) return next(new ApiError(404, 'Reviewer not found.'));

    const appraisal = await Appraisal.create({
      employee: employee._id,
      reviewer: reviewer._id,
      createdBy: req.user._id,
      cycleType,
      cycleName: cycleName.trim(),
      period: { startDate: new Date(startDate), endDate: new Date(endDate) },
      deadline: deadline ? new Date(deadline) : undefined,
      kpis: kpis.map(k => ({
        title: k.title?.trim(),
        description: k.description?.trim() || '',
        weight: Number(k.weight),
      })),
      status: 'SELF_REVIEW',
    });

    await Notification.create({
      recipient: employee._id,
      type: 'GENERAL',
      title: `Appraisal Assigned: ${cycleName}`,
      message: `A ${cycleType.replace(/_/g, ' ').toLowerCase()} performance review has been assigned. Please complete your self-assessment.`,
      link: '/appraisals',
    });

    res.status(201).json({ success: true, message: `Appraisal created for ${employee.name}.`, data: appraisal });
  } catch (err) {
    if (err.code === 11000) return next(new ApiError(409, 'Duplicate appraisal ID.'));
    next(err);
  }
});

// ── GET / — HR: all appraisals with filters ──────────────────
router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { status, cycleType, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (cycleType) filter.cycleType = cycleType;

    if (search) {
      const users = await User.find({
        $or: [
          { name: new RegExp(search.trim(), 'i') },
          { employeeId: new RegExp(search.trim(), 'i') },
        ],
      }).select('_id');
      filter.employee = { $in: users.map(u => u._id) };
    }

    const appraisals = await Appraisal.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ createdAt: -1 });

    res.json({ success: true, data: appraisals });
  } catch (err) { next(err); }
});

// ── GET /my — Employee: own appraisals ───────────────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const appraisals = await Appraisal.find({ employee: req.user._id })
      .populate(POPULATE_FIELDS)
      .sort({ createdAt: -1 });
    res.json({ success: true, data: appraisals });
  } catch (err) { next(err); }
});

// ── GET /to-review — Manager: appraisals assigned to review ──
router.get('/to-review', authenticate, async (req, res, next) => {
  try {
    const appraisals = await Appraisal.find({ reviewer: req.user._id })
      .populate(POPULATE_FIELDS)
      .sort({ createdAt: -1 });
    res.json({ success: true, data: appraisals });
  } catch (err) { next(err); }
});

// ── GET /stats — HR: appraisal statistics ────────────────────
router.get('/stats', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const [total, draft, selfReview, managerReview, completed] = await Promise.all([
      Appraisal.countDocuments(),
      Appraisal.countDocuments({ status: 'DRAFT' }),
      Appraisal.countDocuments({ status: 'SELF_REVIEW' }),
      Appraisal.countDocuments({ status: 'MANAGER_REVIEW' }),
      Appraisal.countDocuments({ status: 'COMPLETED' }),
    ]);

    const avgPipeline = await Appraisal.aggregate([
      { $match: { status: 'COMPLETED', finalScore: { $ne: null } } },
      { $group: { _id: null, avgScore: { $avg: '$finalScore' } } },
    ]);
    const avgScore = avgPipeline[0]?.avgScore
      ? Math.round(avgPipeline[0].avgScore * 100) / 100
      : null;

    res.json({ success: true, data: { total, draft, selfReview, managerReview, completed, avgScore } });
  } catch (err) { next(err); }
});

// ── GET /:id — Single appraisal detail ───────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findById(req.params.id).populate(POPULATE_FIELDS);
    if (!appraisal) return next(new ApiError(404, 'Appraisal not found.'));

    const userId = req.user._id.toString();
    const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role);
    const isOwner = appraisal.employee?._id?.toString() === userId;
    const isReviewer = appraisal.reviewer?._id?.toString() === userId;

    if (!isAdmin && !isOwner && !isReviewer) {
      return next(new ApiError(403, 'Access denied.'));
    }

    res.json({ success: true, data: appraisal });
  } catch (err) { next(err); }
});

// ── PATCH /:id/self-review — Employee: submit self-assessment ─
router.patch('/:id/self-review', authenticate, async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findById(req.params.id);
    if (!appraisal) return next(new ApiError(404, 'Appraisal not found.'));

    if (appraisal.employee.toString() !== req.user._id.toString()) {
      return next(new ApiError(403, 'Not your appraisal.'));
    }
    if (appraisal.status !== 'SELF_REVIEW') {
      return next(new ApiError(409, `Cannot submit self-review in ${appraisal.status} status.`));
    }

    const { kpiScores, overallComment } = req.body;
    if (!Array.isArray(kpiScores)) return next(new ApiError(400, 'kpiScores array is required.'));

    for (const entry of kpiScores) {
      const kpi = appraisal.kpis.id(entry.kpiId);
      if (!kpi) continue;
      if (entry.score != null) kpi.selfScore = Math.min(5, Math.max(0, Number(entry.score)));
      if (entry.comment != null) kpi.selfComment = entry.comment.trim();
    }

    appraisal.overallSelfComment = overallComment?.trim() || '';
    appraisal.selfSubmittedAt = new Date();
    appraisal.status = 'MANAGER_REVIEW';
    await appraisal.save();

    await Notification.create({
      recipient: appraisal.reviewer,
      type: 'GENERAL',
      title: `Self-Review Submitted: ${appraisal.appraisalId}`,
      message: `${req.user.name} has submitted their self-assessment. Please complete your manager review.`,
      link: '/appraisals',
    });

    const updated = await Appraisal.findById(appraisal._id).populate(POPULATE_FIELDS);
    res.json({ success: true, message: 'Self-assessment submitted.', data: updated });
  } catch (err) { next(err); }
});

// ── PATCH /:id/manager-review — Manager: submit rating ───────
router.patch('/:id/manager-review', authenticate, async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findById(req.params.id);
    if (!appraisal) return next(new ApiError(404, 'Appraisal not found.'));

    const userId = req.user._id.toString();
    const isReviewer = appraisal.reviewer.toString() === userId;
    const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role);
    if (!isReviewer && !isAdmin) {
      return next(new ApiError(403, 'Only the assigned reviewer or HR can submit manager review.'));
    }
    if (appraisal.status !== 'MANAGER_REVIEW') {
      return next(new ApiError(409, `Cannot submit manager review in ${appraisal.status} status.`));
    }

    const { kpiScores, overallComment } = req.body;
    if (!Array.isArray(kpiScores)) return next(new ApiError(400, 'kpiScores array is required.'));

    for (const entry of kpiScores) {
      const kpi = appraisal.kpis.id(entry.kpiId);
      if (!kpi) continue;
      if (entry.score != null) kpi.managerScore = Math.min(5, Math.max(0, Number(entry.score)));
      if (entry.comment != null) kpi.managerComment = entry.comment.trim();
    }

    appraisal.overallManagerComment = overallComment?.trim() || '';
    appraisal.managerSubmittedAt = new Date();
    appraisal.status = 'COMPLETED';
    await appraisal.save();

    await Notification.create({
      recipient: appraisal.employee,
      type: 'GENERAL',
      title: `Appraisal Completed: ${appraisal.appraisalId}`,
      message: `Your performance appraisal for ${appraisal.cycleName} is now complete. Final rating: ${appraisal.rating?.replace(/_/g, ' ')}.`,
      link: '/appraisals',
    });

    const updated = await Appraisal.findById(appraisal._id).populate(POPULATE_FIELDS);
    res.json({ success: true, message: 'Manager review submitted. Appraisal completed.', data: updated });
  } catch (err) { next(err); }
});

// ── GET /:id/pdf — Generate appraisal letter PDF ─────────────
router.get('/:id/pdf', authenticate, async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findById(req.params.id).populate(POPULATE_FIELDS);
    if (!appraisal) return next(new ApiError(404, 'Appraisal not found.'));

    if (appraisal.status !== 'COMPLETED') {
      return next(new ApiError(409, 'PDF can only be generated for completed appraisals.'));
    }

    const userId = req.user._id.toString();
    const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role);
    const isOwner = appraisal.employee?._id?.toString() === userId;
    if (!isAdmin && !isOwner) {
      return next(new ApiError(403, 'Access denied.'));
    }

    const pdfBuffer = await generateAppraisalLetterPDF(appraisal);

    appraisal.letterGenerated = true;
    await appraisal.save();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Appraisal_${appraisal.appraisalId}_${appraisal.employee?.name?.replace(/\s/g, '_')}.pdf`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

// ── DELETE /:id — HR: delete appraisal ───────────────────────
router.delete('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const record = await Appraisal.findById(req.params.id);
    if (!record) return next(new ApiError(404, 'Appraisal not found.'));
    await record.deleteOne();
    res.json({ success: true, message: 'Appraisal deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
