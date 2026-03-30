const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');
const {
  createRating,
  listReceivedAnonymized,
  listGiven,
  listAuditForAdmin,
  aggregateSeriesMe,
  aggregateSeriesAdmin,
  getEligibleRatees,
  getCurrentWeekInfo,
  REVIEW_MIN,
  REVIEW_MAX,
  LEADERSHIP_ROLES,
} = require('../services/feedbackRating.service');

const router = express.Router();

const GRANULARITIES = new Set(['week', 'month', 'quarter', 'half_year', 'year']);

function requireAdminAudit(req, res, next) {
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(req.user.role)) return next();
  return next(new ApiError(403, 'Only Super Admin or Director can access this.'));
}

function canSubmitFeedback(user) {
  return LEADERSHIP_ROLES.has(user.role) || user.role === 'EMPLOYEE';
}

/** Current IST week (for UI). */
router.get('/week-info', authenticate, (req, res) => {
  const info = getCurrentWeekInfo();
  res.json({
    success: true,
    data: {
      weekStart: info.weekStart,
      weekLabel: info.weekLabel,
      reviewMin: REVIEW_MIN,
      reviewMax: REVIEW_MAX,
    },
  });
});

/** Users the current user is allowed to rate (for dropdowns). */
router.get('/eligible-ratees', authenticate, async (req, res, next) => {
  try {
    if (!canSubmitFeedback(req.user)) {
      return res.json({ success: true, data: { ratees: [] } });
    }
    const ratees = await getEligibleRatees(req.user);
    res.json({ success: true, data: { ratees } });
  } catch (err) {
    next(err);
  }
});

/** Submit weekly feedback. */
router.post('/', authenticate, async (req, res, next) => {
  try {
    if (!canSubmitFeedback(req.user)) {
      return next(new ApiError(403, 'Your role cannot submit this type of feedback.'));
    }
    const { rateeId, score, review, weekStart } = req.body;
    if (!rateeId) return next(new ApiError(400, 'rateeId is required.'));

    const doc = await createRating({
      rater: req.user,
      rateeId,
      score,
      review,
      weekStartOverride: weekStart,
    });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted.',
      data: {
        id: doc._id,
        weekStart: doc.weekStart,
        score: doc.score,
        direction: doc.direction,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Ratings about me — anonymized (no rater identity). */
router.get('/me/received', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const result = await listReceivedAnonymized(req.user._id, { page, limit });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/** Ratings I gave (shows ratee — leadership naming employees). */
router.get('/me/given', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const result = await listGiven(req.user._id, { page, limit });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/** Chart series for ratings I received. */
router.get('/analytics/me', authenticate, async (req, res, next) => {
  try {
    let granularity = req.query.granularity || 'month';
    if (!GRANULARITIES.has(granularity)) granularity = 'month';
    const series = await aggregateSeriesMe(req.user._id, {
      granularity,
      from: req.query.from,
      to: req.query.to,
    });
    res.json({ success: true, data: series });
  } catch (err) {
    next(err);
  }
});

/** Full audit: who rated whom. */
router.get('/admin/audit', authenticate, requireAdminAudit, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const result = await listAuditForAdmin({
      page,
      limit,
      weekStart: req.query.weekStart,
      direction: req.query.direction,
      raterId: req.query.raterId,
      rateeId: req.query.rateeId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/** Org-wide chart series. */
router.get('/admin/analytics', authenticate, requireAdminAudit, async (req, res, next) => {
  try {
    let granularity = req.query.granularity || 'month';
    if (!GRANULARITIES.has(granularity)) granularity = 'month';
    const series = await aggregateSeriesAdmin({
      granularity,
      from: req.query.from,
      to: req.query.to,
      direction: req.query.direction,
    });
    res.json({ success: true, data: series });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
