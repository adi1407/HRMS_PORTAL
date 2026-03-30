/**
 * Weekly feedback ratings — IST week boundaries, role matrix, anonymized reads for ratees.
 */
const FeedbackRating = require('../models/FeedbackRating.model');
const User = require('../models/User.model');
const { ApiError } = require('../utils/api.utils');

const TZ = 'Asia/Kolkata';

const LEADERSHIP_ROLES = new Set(['HR', 'DIRECTOR', 'SUPER_ADMIN']);
/** Staff roles that leadership may rate */
const STAFF_RATEE_ROLES = new Set(['EMPLOYEE', 'ACCOUNTS']);

const REVIEW_MIN = 20;
const REVIEW_MAX = 500;

function formatISTParts(d) {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const [y, m, day] = s.split('-').map(Number);
  return { y, m, day };
}

function istMidnightDate(y, m, day) {
  return new Date(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+05:30`);
}

function istWeekdayMon0To6(d) {
  const w = d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[w] ?? 0;
}

/**
 * Monday 00:00 IST of the ISO week containing `date` (week starts Monday).
 */
function getWeekStartIST(date = new Date()) {
  const { y, m, day } = formatISTParts(date);
  const noon = new Date(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+05:30`);
  const mondayIndex = istWeekdayMon0To6(noon);
  const monday = new Date(noon.getTime() - mondayIndex * 24 * 60 * 60 * 1000);
  const { y: y2, m: m2, day: d2 } = formatISTParts(monday);
  return istMidnightDate(y2, m2, d2);
}

function formatWeekRangeLabel(weekStart) {
  const ws = weekStart instanceof Date ? weekStart : new Date(weekStart);
  const end = new Date(ws.getTime() + 6 * 24 * 60 * 60 * 1000);
  const f = (d) =>
    new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  return `${f(ws)} – ${f(end)}`;
}

function getCurrentWeekInfo() {
  const weekStart = getWeekStartIST(new Date());
  return {
    weekStart,
    weekLabel: formatWeekRangeLabel(weekStart),
  };
}

/**
 * Infer direction from rater and ratee roles. Returns null if invalid pair.
 */
function inferDirection(raterRole, rateeRole) {
  if (raterRole === rateeRole) return null;
  if (LEADERSHIP_ROLES.has(raterRole) && STAFF_RATEE_ROLES.has(rateeRole)) {
    return 'LEADERSHIP_TO_EMPLOYEE';
  }
  if (raterRole === 'EMPLOYEE' && LEADERSHIP_ROLES.has(rateeRole)) {
    return 'EMPLOYEE_TO_LEADERSHIP';
  }
  return null;
}

function assertCanCreate(rater, ratee, direction) {
  if (!rater?.isActive || !ratee?.isActive) {
    throw new ApiError(400, 'Both users must be active.');
  }
  if (rater._id.equals(ratee._id)) {
    throw new ApiError(400, 'You cannot rate yourself.');
  }
  const inferred = inferDirection(rater.role, ratee.role);
  if (!inferred || inferred !== direction) {
    throw new ApiError(403, 'You are not allowed to rate this user for this feedback type.');
  }
}

async function createRating({ rater, rateeId, score, review, weekStartOverride }) {
  const trimmed = String(review || '').trim();
  if (trimmed.length < REVIEW_MIN || trimmed.length > REVIEW_MAX) {
    throw new ApiError(400, `Review must be between ${REVIEW_MIN} and ${REVIEW_MAX} characters.`);
  }
  const s = Number(score);
  if (!Number.isInteger(s) || s < 1 || s > 5) {
    throw new ApiError(400, 'Score must be an integer from 1 to 5.');
  }

  const ratee = await User.findById(rateeId).select('_id role name isActive');
  if (!ratee) throw new ApiError(404, 'User to rate not found.');

  const direction = inferDirection(rater.role, ratee.role);
  if (!direction) {
    throw new ApiError(403, 'You are not allowed to rate this user.');
  }

  assertCanCreate(rater, ratee, direction);

  let weekStart;
  if (weekStartOverride) {
    if (rater.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'Only Super Admin can set a custom week.');
    }
    weekStart = getWeekStartIST(new Date(weekStartOverride));
  } else {
    weekStart = getWeekStartIST(new Date());
  }

  try {
    const doc = await FeedbackRating.create({
      rater: rater._id,
      ratee: ratee._id,
      direction,
      weekStart,
      score: s,
      review: trimmed,
    });
    return doc;
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'You have already submitted feedback for this person for this week.');
    }
    throw err;
  }
}

function anonReceived(doc) {
  return {
    _id: doc._id,
    score: doc.score,
    review: doc.review,
    weekStart: doc.weekStart,
    direction: doc.direction,
    weekLabel: formatWeekRangeLabel(doc.weekStart),
    createdAt: doc.createdAt,
  };
}

async function listReceivedAnonymized(rateeId, { page = 1, limit = 50 } = {}) {
  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
  const take = Math.min(100, Math.max(1, limit));
  const [rows, total] = await Promise.all([
    FeedbackRating.find({ ratee: rateeId })
      .sort({ weekStart: -1, createdAt: -1 })
      .skip(skip)
      .limit(take)
      .lean(),
    FeedbackRating.countDocuments({ ratee: rateeId }),
  ]);
  return {
    ratings: rows.map(anonReceived),
    total,
    page: Math.max(1, page),
    limit: take,
  };
}

async function listGiven(raterId, { page = 1, limit = 50 } = {}) {
  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
  const take = Math.min(100, Math.max(1, limit));
  const [rows, total] = await Promise.all([
    FeedbackRating.find({ rater: raterId })
      .populate('ratee', 'name employeeId role')
      .sort({ weekStart: -1, createdAt: -1 })
      .skip(skip)
      .limit(take)
      .lean(),
    FeedbackRating.countDocuments({ rater: raterId }),
  ]);
  return {
    ratings: rows.map((r) => ({
      _id: r._id,
      score: r.score,
      review: r.review,
      weekStart: r.weekStart,
      direction: r.direction,
      weekLabel: formatWeekRangeLabel(r.weekStart),
      ratee: r.ratee
        ? { _id: r.ratee._id, name: r.ratee.name, employeeId: r.ratee.employeeId, role: r.ratee.role }
        : null,
      createdAt: r.createdAt,
    })),
    total,
    page: Math.max(1, page),
    limit: take,
  };
}

async function listAuditForAdmin({ page = 1, limit = 50, weekStart, direction, raterId, rateeId }) {
  const q = {};
  if (weekStart) q.weekStart = getWeekStartIST(new Date(weekStart));
  if (direction) q.direction = direction;
  if (raterId) q.rater = raterId;
  if (rateeId) q.ratee = rateeId;

  const skip = (Math.max(1, page) - 1) * Math.min(200, Math.max(1, limit));
  const take = Math.min(200, Math.max(1, limit));

  const [rows, total] = await Promise.all([
    FeedbackRating.find(q)
      .populate('rater', 'name employeeId role')
      .populate('ratee', 'name employeeId role')
      .sort({ weekStart: -1, createdAt: -1 })
      .skip(skip)
      .limit(take)
      .lean(),
    FeedbackRating.countDocuments(q),
  ]);

  return {
    ratings: rows.map((r) => ({
      _id: r._id,
      score: r.score,
      review: r.review,
      weekStart: r.weekStart,
      weekLabel: formatWeekRangeLabel(r.weekStart),
      direction: r.direction,
      rater: r.rater ? { _id: r.rater._id, name: r.rater.name, employeeId: r.rater.employeeId, role: r.rater.role } : null,
      ratee: r.ratee ? { _id: r.ratee._id, name: r.ratee.name, employeeId: r.ratee.employeeId, role: r.ratee.role } : null,
      createdAt: r.createdAt,
    })),
    total,
    page: Math.max(1, page),
    limit: take,
  };
}

function bucketKey(d, granularity) {
  const { y, m, day } = formatISTParts(d);
  const month = m;
  const q = Math.ceil(month / 3);
  if (granularity === 'week') {
    return getWeekStartIST(d).toISOString();
  }
  if (granularity === 'month') {
    return `${y}-${String(month).padStart(2, '0')}`;
  }
  if (granularity === 'quarter') {
    return `${y}-Q${q}`;
  }
  if (granularity === 'half_year') {
    const h = month <= 6 ? 'H1' : 'H2';
    return `${y}-${h}`;
  }
  if (granularity === 'year') {
    return `${y}`;
  }
  return `${y}-${String(month).padStart(2, '0')}`;
}

function bucketLabel(key, granularity) {
  if (granularity === 'week') {
    return formatWeekRangeLabel(new Date(key));
  }
  if (granularity === 'month') {
    const [y, m] = key.split('-');
    return `${new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' })}`;
  }
  if (granularity === 'quarter') {
    const [y, q] = key.split('-Q');
    return `Q${q} ${y}`;
  }
  if (granularity === 'half_year') {
    const [y, h] = key.split('-');
    return h === 'H1' ? `H1 ${y}` : `H2 ${y}`;
  }
  if (granularity === 'year') {
    return key;
  }
  return key;
}

function aggregateByGranularity(rows, granularity, fromDate, toDate) {
  const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const to = toDate ? new Date(toDate) : new Date();

  const filtered = rows.filter((r) => {
    const t = new Date(r.weekStart).getTime();
    return t >= from.getTime() && t <= to.getTime();
  });

  const map = new Map();
  for (const r of filtered) {
    const k = bucketKey(new Date(r.weekStart), granularity);
    if (!map.has(k)) map.set(k, { sum: 0, count: 0 });
    const b = map.get(k);
    b.sum += r.score;
    b.count += 1;
  }

  const keys = Array.from(map.keys()).sort();
  const labels = keys.map((k) => bucketLabel(k, granularity));
  const averages = keys.map((k) => {
    const { sum, count } = map.get(k);
    return count ? Math.round((sum / count) * 100) / 100 : 0;
  });
  const counts = keys.map((k) => map.get(k).count);

  return { labels, averages, counts, granularity };
}

async function aggregateSeriesMe(rateeId, { granularity = 'month', from, to }) {
  const fromD = from ? new Date(from) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const toD = to ? new Date(to) : new Date();
  const rows = await FeedbackRating.find({
    ratee: rateeId,
    weekStart: { $gte: fromD, $lte: toD },
  })
    .select('score weekStart')
    .lean();
  return aggregateByGranularity(rows, granularity, fromD, toD);
}

async function aggregateSeriesAdmin({ granularity = 'month', from, to, direction }) {
  const fromD = from ? new Date(from) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const toD = to ? new Date(to) : new Date();
  const q = { weekStart: { $gte: fromD, $lte: toD } };
  if (direction) q.direction = direction;
  const rows = await FeedbackRating.find(q).select('score weekStart direction').lean();
  return aggregateByGranularity(rows, granularity, fromD, toD);
}

async function getEligibleRatees(rater) {
  if (LEADERSHIP_ROLES.has(rater.role)) {
    return User.find({ role: { $in: ['EMPLOYEE', 'ACCOUNTS'] }, isActive: true })
      .select('name employeeId role')
      .sort({ name: 1 })
      .limit(500)
      .lean();
  }
  if (rater.role === 'EMPLOYEE') {
    return User.find({ role: { $in: ['HR', 'DIRECTOR', 'SUPER_ADMIN'] }, isActive: true })
      .select('name employeeId role')
      .sort({ name: 1 })
      .limit(100)
      .lean();
  }
  return [];
}

module.exports = {
  TZ,
  LEADERSHIP_ROLES,
  STAFF_RATEE_ROLES,
  REVIEW_MIN,
  REVIEW_MAX,
  getWeekStartIST,
  formatWeekRangeLabel,
  inferDirection,
  createRating,
  listReceivedAnonymized,
  listGiven,
  listAuditForAdmin,
  aggregateSeriesMe,
  aggregateSeriesAdmin,
  getEligibleRatees,
  getCurrentWeekInfo,
};
