const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const JobOpening = require('../models/JobOpening.model');
const Application = require('../models/Application.model');
const User       = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');
const { uploadBuffer, deleteFile } = require('../utils/cloudinary.utils');

const ALLOWED_MIME = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX, JPG, PNG allowed.'));
  },
});
function rType(mime) { return mime.startsWith('image/') ? 'image' : 'raw'; }

const HR_DIRECTOR_ADMIN = ['HR', 'DIRECTOR', 'SUPER_ADMIN'];

// ── GET /jobs/stats ───────────────────────────────────────────
router.get('/jobs/stats', authenticate, authorize(...HR_DIRECTOR_ADMIN), async (req, res, next) => {
  try {
    const [openJobs, totalApplications, byStatus] = await Promise.all([
      JobOpening.countDocuments({ status: 'OPEN' }),
      Application.countDocuments(),
      Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const statusCounts = {};
    byStatus.forEach(s => { statusCounts[s._id] = s.count; });
    res.json({ success: true, data: { openJobs, totalApplications, byStatus: statusCounts } });
  } catch (err) { next(err); }
});

// ── GET /jobs ─────────────────────────────────────────────────
router.get('/jobs', authenticate, authorize(...HR_DIRECTOR_ADMIN), async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search?.trim()) filter.title = new RegExp(search.trim(), 'i');
    const jobs = await JobOpening.find(filter)
      .populate('department', 'name code')
      .populate('hiringManager', 'name employeeId')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    const appCounts = await Application.aggregate([
      { $group: { _id: '$job', total: { $sum: 1 }, hired: { $sum: { $cond: [{ $eq: ['$status', 'HIRED'] }, 1, 0] } } } },
    ]);
    const countMap = {};
    appCounts.forEach(a => { countMap[a._id.toString()] = { total: a.total, hired: a.hired }; });
    const list = jobs.map(j => ({
      ...j.toObject(),
      applicationCount: countMap[j._id.toString()]?.total || 0,
      hiredCount: countMap[j._id.toString()]?.hired || 0,
    }));
    res.json({ success: true, data: list });
  } catch (err) { next(err); }
});

// ── POST /jobs ─────────────────────────────────────────────────
router.post('/jobs', authenticate, authorize(...HR_DIRECTOR_ADMIN), async (req, res, next) => {
  try {
    const { title, description, department, location, employmentType, noOfPositions, requirements, salaryRangeMin, salaryRangeMax, closingDate, hiringManager } = req.body;
    if (!title?.trim()) return next(new ApiError(400, 'Job title is required.'));
    const job = await JobOpening.create({
      title: title.trim(),
      description: description?.trim() || '',
      department: department || undefined,
      location: location?.trim() || '',
      employmentType: employmentType || 'FULL_TIME',
      noOfPositions: noOfPositions ? Number(noOfPositions) : 1,
      requirements: requirements?.trim() || '',
      salaryRangeMin: salaryRangeMin ? Number(salaryRangeMin) : undefined,
      salaryRangeMax: salaryRangeMax ? Number(salaryRangeMax) : undefined,
      closingDate: closingDate ? new Date(closingDate) : undefined,
      hiringManager: hiringManager || undefined,
      status: 'DRAFT',
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, message: 'Job opening created.', data: job });
  } catch (err) { next(err); }
});

// ── GET /jobs/:jobId/applications ──────────────────────────────
router.get('/jobs/:jobId/applications', authenticate, authorize(...HR_DIRECTOR_ADMIN), async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { job: req.params.jobId };
    if (status) filter.status = status;
    const applications = await Application.find(filter)
      .populate('job', 'title status noOfPositions')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: applications });
  } catch (err) { next(err); }
});

// ── POST /jobs/:jobId/applications ─────────────────────────────
router.post('/jobs/:jobId/applications', authenticate, authorize(...HR_DIRECTOR_ADMIN), upload.single('resume'), async (req, res, next) => {
  try {
    const job = await JobOpening.findById(req.params.jobId);
    if (!job) return next(new ApiError(404, 'Job opening not found.'));
    const { candidateName, email, phone, source, currentCompany, experienceYears, expectedSalary, noticePeriod, notes } = req.body;
    if (!candidateName?.trim() || !email?.trim()) return next(new ApiError(400, 'Candidate name and email are required.'));
    let resumeUrl = '';
    let resumePublicId = '';
    let resumeFileName = '';
    if (req.file) {
      const pubId = `hrms/ats/${req.params.jobId}/${Date.now()}_resume`;
      const result = await uploadBuffer(req.file.buffer, '', pubId, rType(req.file.mimetype));
      resumeUrl = result.secure_url;
      resumePublicId = result.public_id;
      resumeFileName = req.file.originalname;
    }
    const app = await Application.create({
      job: job._id,
      candidateName: candidateName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || '',
      resumeUrl,
      resumePublicId,
      resumeFileName,
      source: source || 'DIRECT',
      currentCompany: currentCompany?.trim() || '',
      experienceYears: experienceYears ? Number(experienceYears) : undefined,
      expectedSalary: expectedSalary ? Number(expectedSalary) : undefined,
      noticePeriod: noticePeriod?.trim() || '',
      notes: notes?.trim() || '',
      status: 'APPLIED',
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, message: 'Application added.', data: app });
  } catch (err) { next(err); }
});

// ── GET /jobs/:jobId ───────────────────────────────────────────
router.get('/jobs/:jobId', authenticate, authorize(...HR_DIRECTOR_ADMIN), async (req, res, next) => {
  try {
    const job = await JobOpening.findById(req.params.jobId)
      .populate('department', 'name code')
      .populate('hiringManager', 'name employeeId email')
      .populate('createdBy', 'name');
    if (!job) return next(new ApiError(404, 'Job opening not found.'));
    const appCount = await Application.countDocuments({ job: job._id });
    const hiredCount = await Application.countDocuments({ job: job._id, status: 'HIRED' });
    res.json({ success: true, data: { ...job.toObject(), applicationCount: appCount, hiredCount } });
  } catch (err) { next(err); }
});

// ── PATCH /jobs/:jobId ─────────────────────────────────────────
router.patch('/jobs/:jobId', authenticate, authorize(...HR_DIRECTOR_ADMIN), async (req, res, next) => {
  try {
    const job = await JobOpening.findById(req.params.jobId);
    if (!job) return next(new ApiError(404, 'Job opening not found.'));
    const allowed = ['title', 'description', 'department', 'location', 'employmentType', 'noOfPositions', 'requirements', 'salaryRangeMin', 'salaryRangeMax', 'status', 'hiringManager'];
    for (const k of allowed) {
      if (req.body[k] !== undefined) job[k] = req.body[k];
    }
    if (req.body.title !== undefined) job.title = req.body.title.trim();
    if (req.body.postedDate !== undefined) job.postedDate = req.body.postedDate ? new Date(req.body.postedDate) : undefined;
    if (req.body.closingDate !== undefined) job.closingDate = req.body.closingDate ? new Date(req.body.closingDate) : undefined;
    await job.save();
    res.json({ success: true, message: 'Job updated.', data: job });
  } catch (err) { next(err); }
});

// ── DELETE /jobs/:jobId ────────────────────────────────────────
router.delete('/jobs/:jobId', authenticate, authorize(...HR_DIRECTOR_ADMIN), async (req, res, next) => {
  try {
    const job = await JobOpening.findById(req.params.jobId);
    if (!job) return next(new ApiError(404, 'Job opening not found.'));
    const apps = await Application.find({ job: job._id }).select('resumePublicId offerLetterPublicId');
    for (const a of apps) {
      if (a.resumePublicId) await deleteFile(a.resumePublicId, 'raw').catch(() => {});
      if (a.offerLetterPublicId) await deleteFile(a.offerLetterPublicId, 'raw').catch(() => {});
    }
    await Application.deleteMany({ job: job._id });
    await job.deleteOne();
    res.json({ success: true, message: 'Job opening deleted.' });
  } catch (err) { next(err); }
});

// ── GET /applications/:appId ────────────────────────────────────
router.get('/applications/:appId', authenticate, authorize(...HR_DIRECTOR_ADMIN), async (req, res, next) => {
  try {
    const app = await Application.findById(req.params.appId)
      .populate('job', 'title department status noOfPositions')
      .populate('createdBy', 'name');
    if (!app) return next(new ApiError(404, 'Application not found.'));
    res.json({ success: true, data: app });
  } catch (err) { next(err); }
});

// ── PATCH /applications/:appId ──────────────────────────────────
router.patch('/applications/:appId', authenticate, authorize(...HR_DIRECTOR_ADMIN), async (req, res, next) => {
  try {
    const app = await Application.findById(req.params.appId);
    if (!app) return next(new ApiError(404, 'Application not found.'));
    const allowed = ['status', 'notes', 'rating', 'interviewDate', 'interviewFeedback', 'offeredSalary', 'rejectedReason'];
    for (const k of allowed) {
      if (req.body[k] !== undefined) app[k] = req.body[k];
    }
    if (req.body.status === 'HIRED') app.hiredAt = app.hiredAt || new Date();
    if (req.body.interviewDate !== undefined) app.interviewDate = req.body.interviewDate ? new Date(req.body.interviewDate) : undefined;
    await app.save();
    res.json({ success: true, message: 'Application updated.', data: app });
  } catch (err) { next(err); }
});

// ── DELETE /applications/:appId ─────────────────────────────────
router.delete('/applications/:appId', authenticate, authorize(...HR_DIRECTOR_ADMIN), async (req, res, next) => {
  try {
    const app = await Application.findById(req.params.appId);
    if (!app) return next(new ApiError(404, 'Application not found.'));
    if (app.resumePublicId) await deleteFile(app.resumePublicId, 'raw').catch(() => {});
    if (app.offerLetterPublicId) await deleteFile(app.offerLetterPublicId, 'raw').catch(() => {});
    await app.deleteOne();
    res.json({ success: true, message: 'Application deleted.' });
  } catch (err) { next(err); }
});

// ── POST /applications/:appId/resume ────────────────────────────
router.post('/applications/:appId/resume', authenticate, authorize(...HR_DIRECTOR_ADMIN), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return next(new ApiError(400, 'No file uploaded.'));
    const app = await Application.findById(req.params.appId);
    if (!app) return next(new ApiError(404, 'Application not found.'));
    if (app.resumePublicId) await deleteFile(app.resumePublicId, rType(req.file.mimetype)).catch(() => {});
    const pubId = `hrms/ats/${app.job}/${Date.now()}_resume`;
    const result = await uploadBuffer(req.file.buffer, '', pubId, rType(req.file.mimetype));
    app.resumeUrl = result.secure_url;
    app.resumePublicId = result.public_id;
    app.resumeFileName = req.file.originalname;
    await app.save();
    res.json({ success: true, message: 'Resume uploaded.', data: app });
  } catch (err) { next(err); }
});

module.exports = router;
