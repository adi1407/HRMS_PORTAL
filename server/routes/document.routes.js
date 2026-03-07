const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const Document = require('../models/Document.model');
const User     = require('../models/User.model');
const { ApiError } = require('../utils/api.utils');
const { uploadBuffer, deleteFile } = require('../utils/cloudinary.utils');

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, JPG, PNG, DOC, DOCX files are allowed.'));
  },
});

// Helper: detect resource type for Cloudinary
function resourceType(mimetype) {
  return mimetype.startsWith('image/') ? 'image' : 'raw';
}

// ── POST / — upload a document ──────────────────────────────
// Any authenticated user can upload for themselves.
// HR/DIRECTOR/SUPER_ADMIN can upload for any employee (pass employeeId in body).
router.post('/', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return next(new ApiError(400, 'No file uploaded.'));

    const { name, type, employeeId } = req.body;
    if (!name?.trim()) return next(new ApiError(400, 'Document name is required.'));

    let targetEmployee = req.user._id;

    if (employeeId && employeeId !== req.user._id.toString()) {
      // Only HR+ can upload for others
      if (!['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role)) {
        return next(new ApiError(403, 'You can only upload your own documents.'));
      }
      const emp = await User.findById(employeeId);
      if (!emp) return next(new ApiError(404, 'Employee not found.'));
      targetEmployee = emp._id;
    }

    const rType   = resourceType(req.file.mimetype);
    const pubId   = `hrms/documents/${targetEmployee}/${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
    const result  = await uploadBuffer(req.file.buffer, '', pubId, rType);

    const doc = await Document.create({
      employee:   targetEmployee,
      uploadedBy: req.user._id,
      name:       name.trim(),
      type:       type || 'OTHER',
      fileUrl:    result.secure_url,
      publicId:   result.public_id,
      fileSize:   req.file.size,
      mimeType:   req.file.mimetype,
    });

    res.status(201).json({ success: true, message: 'Document uploaded.', data: doc });
  } catch (err) { next(err); }
});

// ── GET /my — employee's own documents ──────────────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const docs = await Document.find({ employee: req.user._id })
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
});

// ── GET /employee/:empId — HR/Director: docs for any employee ─
router.get('/employee/:empId', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const docs = await Document.find({ employee: req.params.empId })
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
});

// ── GET /all-employees — HR: list of employees for the selector ─
router.get('/all-employees', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const employees = await User.find({ isActive: true, role: { $nin: ['SUPER_ADMIN'] } })
      .select('name employeeId designation department')
      .populate('department', 'name')
      .sort({ name: 1 });
    res.json({ success: true, data: employees });
  } catch (err) { next(err); }
});

// ── DELETE /:id — delete a document ─────────────────────────
// Owner or HR/Director/Super_Admin can delete.
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return next(new ApiError(404, 'Document not found.'));

    const isOwner = doc.employee.toString() === req.user._id.toString();
    const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role);
    if (!isOwner && !isAdmin) return next(new ApiError(403, 'Access denied.'));

    // Detect resource type from mimeType stored in doc
    const rType = doc.mimeType?.startsWith('image/') ? 'image' : 'raw';
    await deleteFile(doc.publicId, rType).catch(() => {}); // don't fail if already gone
    await doc.deleteOne();

    res.json({ success: true, message: 'Document deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
