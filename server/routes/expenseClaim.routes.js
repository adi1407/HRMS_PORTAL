const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ExpenseClaim = require('../models/ExpenseClaim.model');
const { ApiError } = require('../utils/api.utils');
const { uploadBuffer, deleteFile } = require('../utils/cloudinary.utils');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype);
    cb(ok ? null : new Error('Only PDF, JPG, PNG allowed for receipts.'), ok);
  },
});

function rType(mime) { return mime?.startsWith('image/') ? 'image' : 'raw'; }

// ── POST / — Employee submits expense claim ─────────────────
router.post('/', authenticate, upload.single('receipt'), async (req, res, next) => {
  try {
    const { amount, category, description, expenseDate } = req.body;
    if (!amount || isNaN(amount) || Number(amount) < 1) return next(new ApiError(400, 'Valid amount is required.'));
    if (!description?.trim()) return next(new ApiError(400, 'Description is required.'));
    if (!expenseDate) return next(new ApiError(400, 'Expense date is required.'));

    let receiptUrl = '', receiptPublicId = '', receiptMime = '';
    if (req.file) {
      const pubId  = `hrms/receipts/${req.user._id}/${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
      const result = await uploadBuffer(req.file.buffer, '', pubId, rType(req.file.mimetype));
      receiptUrl      = result.secure_url;
      receiptPublicId = result.public_id;
      receiptMime     = req.file.mimetype;
    }

    const claim = await ExpenseClaim.create({
      employee:    req.user._id,
      amount:      Number(amount),
      category:    category || 'OTHER',
      description: description.trim(),
      expenseDate: new Date(expenseDate),
      receiptUrl, receiptPublicId, receiptMime,
    });

    res.status(201).json({ success: true, message: 'Expense claim submitted.', data: claim });
  } catch (err) { next(err); }
});

// ── GET /my — Employee: own claims ──────────────────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const claims = await ExpenseClaim.find({ employee: req.user._id })
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: claims });
  } catch (err) { next(err); }
});

// ── GET / — ACCOUNTS / DIRECTOR / SUPER_ADMIN: all claims ──
router.get('/', authenticate, authorize('ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const claims = await ExpenseClaim.find(filter)
      .populate('employee', 'name employeeId designation department')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: claims });
  } catch (err) { next(err); }
});

// ── PATCH /:id/review — ACCOUNTS approves or rejects ────────
router.patch('/:id/review', authenticate, authorize('ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { action, note, reimbursementType } = req.body;
    if (!['approve', 'reject'].includes(action)) return next(new ApiError(400, 'action must be approve or reject.'));
    if (action === 'approve' && !['CASH', 'SALARY'].includes(reimbursementType)) {
      return next(new ApiError(400, 'reimbursementType must be CASH or SALARY when approving.'));
    }

    const claim = await ExpenseClaim.findById(req.params.id);
    if (!claim) return next(new ApiError(404, 'Expense claim not found.'));
    if (claim.status !== 'PENDING') return next(new ApiError(409, 'Claim is not pending.'));

    claim.reviewedBy   = req.user._id;
    claim.reviewNote   = note || '';
    claim.reviewedAt   = new Date();

    if (action === 'approve') {
      claim.status            = 'APPROVED';
      claim.reimbursementType = reimbursementType;
    } else {
      claim.status = 'REJECTED';
    }

    await claim.save();
    const msg = action === 'approve'
      ? `Claim approved. Will be reimbursed via ${reimbursementType === 'CASH' ? 'cash' : 'next salary'}.`
      : 'Claim rejected.';
    res.json({ success: true, message: msg, data: claim });
  } catch (err) { next(err); }
});

// ── DELETE /:id — Employee can delete own PENDING claim ─────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const claim = await ExpenseClaim.findById(req.params.id);
    if (!claim) return next(new ApiError(404, 'Claim not found.'));
    if (claim.employee.toString() !== req.user._id.toString()) return next(new ApiError(403, 'Access denied.'));
    if (claim.status !== 'PENDING') return next(new ApiError(409, 'Only pending claims can be deleted.'));
    if (claim.receiptPublicId) {
      await deleteFile(claim.receiptPublicId, rType(claim.receiptMime)).catch(() => {});
    }
    await claim.deleteOne();
    res.json({ success: true, message: 'Claim deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
