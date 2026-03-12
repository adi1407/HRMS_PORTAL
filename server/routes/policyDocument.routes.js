const express        = require('express');
const router         = express.Router();
const multer         = require('multer');
const PolicyDocument = require('../models/PolicyDocument.model');
const User           = require('../models/User.model');
const Notification   = require('../models/Notification.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');
const { uploadBuffer, deleteFile } = require('../utils/cloudinary.utils');

const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX, JPG, PNG files are allowed.'));
  },
});

function resourceType(mimetype) {
  return mimetype.startsWith('image/') ? 'image' : 'raw';
}

// ── POST / — HR: upload a policy document ────────────────────
router.post('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return next(new ApiError(400, 'No file uploaded.'));

    const { title, description, category, version, isMandatory, effectiveDate, expiryDate, targetAudience, targetDepartment, targetBranch } = req.body;
    if (!title?.trim()) return next(new ApiError(400, 'Title is required.'));

    const rType  = resourceType(req.file.mimetype);
    const pubId  = `hrms/policies/${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
    const result = await uploadBuffer(req.file.buffer, '', pubId, rType);

    const policy = await PolicyDocument.create({
      title: title.trim(),
      description: description?.trim() || '',
      category: category || 'OTHER',
      version: version?.trim() || '1.0',
      fileUrl: result.secure_url,
      publicId: result.public_id,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      isMandatory: isMandatory === 'true' || isMandatory === true,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      uploadedBy: req.user._id,
      targetAudience: targetAudience || 'ALL',
      targetDepartment: targetDepartment || undefined,
      targetBranch: targetBranch || undefined,
    });

    const employees = await User.find({ isActive: true }).select('_id');
    if (employees.length > 0) {
      await Notification.insertMany(employees.map(e => ({
        recipient: e._id,
        type: 'GENERAL',
        title: `New Policy: ${title.trim()}`,
        message: `A new policy document "${title.trim()}" has been published. Please read and acknowledge.`,
        link: '/policies',
      })));
    }

    res.status(201).json({ success: true, message: 'Policy document uploaded.', data: policy });
  } catch (err) { next(err); }
});

// ── GET / — HR: all policies with filters ────────────────────
router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { category, isActive, search } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) filter.title = new RegExp(search.trim(), 'i');

    const policies = await PolicyDocument.find(filter)
      .populate('uploadedBy', 'name')
      .populate('targetDepartment', 'name')
      .populate('targetBranch', 'name')
      .populate('acknowledgments.employee', 'name employeeId')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: policies });
  } catch (err) { next(err); }
});

// ── GET /active — Employee: policies they need to see ────────
router.get('/active', authenticate, async (req, res, next) => {
  try {
    const now = new Date();
    const filter = {
      isActive: true,
      effectiveDate: { $lte: now },
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gt: now } },
      ],
    };

    let policies = await PolicyDocument.find(filter)
      .populate('uploadedBy', 'name')
      .populate('targetDepartment', 'name')
      .populate('targetBranch', 'name')
      .populate('acknowledgments.employee', 'name employeeId')
      .sort({ createdAt: -1 });

    const user = req.user;
    policies = policies.filter(p => {
      if (p.targetAudience === 'ALL') return true;
      if (p.targetAudience === 'DEPARTMENT' && p.targetDepartment) {
        const userDeptId = user.department?._id?.toString() || user.department?.toString();
        return userDeptId === p.targetDepartment._id.toString();
      }
      if (p.targetAudience === 'BRANCH' && p.targetBranch) {
        const userBranchId = user.branch?._id?.toString() || user.branch?.toString();
        return userBranchId === p.targetBranch._id.toString();
      }
      return true;
    });

    res.json({ success: true, data: policies });
  } catch (err) { next(err); }
});

// ── GET /stats — HR: acknowledgment statistics ───────────────
router.get('/stats', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const activeEmployees = await User.countDocuments({ isActive: true });
    const [totalPolicies, activePolicies, mandatoryPolicies] = await Promise.all([
      PolicyDocument.countDocuments(),
      PolicyDocument.countDocuments({ isActive: true }),
      PolicyDocument.countDocuments({ isActive: true, isMandatory: true }),
    ]);

    const mandatoryDocs = await PolicyDocument.find({ isActive: true, isMandatory: true }).select('title acknowledgments');
    let totalRequired = 0;
    let totalAcknowledged = 0;
    for (const doc of mandatoryDocs) {
      totalRequired += activeEmployees;
      totalAcknowledged += doc.acknowledgments?.length || 0;
    }
    const overallComplianceRate = totalRequired > 0
      ? Math.round((totalAcknowledged / totalRequired) * 100)
      : 100;

    res.json({
      success: true,
      data: { totalPolicies, activePolicies, mandatoryPolicies, activeEmployees, overallComplianceRate },
    });
  } catch (err) { next(err); }
});

// ── GET /:id/pending — HR: employees who haven't acknowledged ─
router.get('/:id/pending', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const policy = await PolicyDocument.findById(req.params.id).select('acknowledgments targetAudience targetDepartment targetBranch');
    if (!policy) return next(new ApiError(404, 'Policy not found.'));

    const acknowledgedIds = new Set(policy.acknowledgments.map(a => a.employee.toString()));

    let employeeFilter = { isActive: true };
    if (policy.targetAudience === 'DEPARTMENT' && policy.targetDepartment) {
      employeeFilter.department = policy.targetDepartment;
    }
    if (policy.targetAudience === 'BRANCH' && policy.targetBranch) {
      employeeFilter.branch = policy.targetBranch;
    }

    const employees = await User.find(employeeFilter).select('name employeeId designation department').populate('department', 'name');
    const pending = employees.filter(e => !acknowledgedIds.has(e._id.toString()));

    res.json({ success: true, data: pending });
  } catch (err) { next(err); }
});

// ── POST /:id/acknowledge — Employee: acknowledge a policy ───
router.post('/:id/acknowledge', authenticate, async (req, res, next) => {
  try {
    const policy = await PolicyDocument.findById(req.params.id);
    if (!policy) return next(new ApiError(404, 'Policy not found.'));
    if (!policy.isActive) return next(new ApiError(409, 'Policy is no longer active.'));

    const alreadyAcked = policy.acknowledgments.some(
      a => a.employee.toString() === req.user._id.toString()
    );
    if (alreadyAcked) return next(new ApiError(409, 'You have already acknowledged this policy.'));

    policy.acknowledgments.push({
      employee: req.user._id,
      acknowledgedAt: new Date(),
      ipAddress: req.ip,
    });
    await policy.save();

    res.json({ success: true, message: 'Policy acknowledged successfully.' });
  } catch (err) { next(err); }
});

// ── PATCH /:id — HR: update policy metadata ──────────────────
router.patch('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const policy = await PolicyDocument.findById(req.params.id);
    if (!policy) return next(new ApiError(404, 'Policy not found.'));

    const { title, description, category, version, isActive, isMandatory, expiryDate } = req.body;
    if (title !== undefined) policy.title = title.trim();
    if (description !== undefined) policy.description = description.trim();
    if (category !== undefined) policy.category = category;
    if (version !== undefined) policy.version = version.trim();
    if (isActive !== undefined) policy.isActive = isActive;
    if (isMandatory !== undefined) policy.isMandatory = isMandatory;
    if (expiryDate !== undefined) policy.expiryDate = expiryDate ? new Date(expiryDate) : undefined;

    await policy.save();
    res.json({ success: true, message: 'Policy updated.', data: policy });
  } catch (err) { next(err); }
});

// ── DELETE /:id — HR: delete policy ──────────────────────────
router.delete('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const policy = await PolicyDocument.findById(req.params.id);
    if (!policy) return next(new ApiError(404, 'Policy not found.'));

    if (policy.publicId) {
      const rType = policy.mimeType?.startsWith('image/') ? 'image' : 'raw';
      await deleteFile(policy.publicId, rType).catch(() => {});
    }
    await policy.deleteOne();
    res.json({ success: true, message: 'Policy deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
