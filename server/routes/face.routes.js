const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { enrollFace, deleteFaceEnrollment } = require('../services/face.service');
const { encodeFaceDescriptorFromBuffer } = require('../services/faceEncoder.service');
const { createAuditLog } = require('../utils/auditLog.utils');
const { ApiError } = require('../utils/api.utils');
const User = require('../models/User.model');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Extract a 128-D face descriptor from a JPEG/PNG (same pipeline as web face-api.js).
 * Used by the React Native app; web continues to compute descriptors in the browser.
 */
router.post('/encode', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file?.buffer) return next(new ApiError(400, 'Image file is required (field name: image).'));
    const mime = (req.file.mimetype || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      return next(new ApiError(400, 'Unsupported image type. Use JPEG or PNG.'));
    }
    const descriptor = await encodeFaceDescriptorFromBuffer(req.file.buffer);
    res.status(200).json({ success: true, data: { descriptor } });
  } catch (err) { next(err); }
});

router.post('/enroll/:employeeId', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    await enrollFace(req.params.employeeId, req.body.descriptors, req.user);
    await createAuditLog({ actor: req.user, action: 'FACE_ENROLLED', entity: 'User', entityId: req.params.employeeId, description: `Enrolled by ${req.user.name}`, req });
    res.status(200).json({ success: true, message: 'Face enrolled successfully.' });
  } catch (err) { next(err); }
});

router.delete('/enroll/:employeeId', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    await deleteFaceEnrollment(req.params.employeeId);
    res.status(200).json({ success: true, message: 'Face enrollment removed.' });
  } catch (err) { next(err); }
});

router.get('/status/:employeeId', authenticate, async (req, res, next) => {
  try {
    const { user } = req;
    if (user.role === 'EMPLOYEE' && user._id.toString() !== req.params.employeeId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const employee = await User.findById(req.params.employeeId).select('name employeeId faceEnrolled faceEnrolledAt');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    res.status(200).json({ success: true, data: employee });
  } catch (err) { next(err); }
});

module.exports = router;
