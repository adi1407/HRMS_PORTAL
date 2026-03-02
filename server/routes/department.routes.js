const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const Department = require('../models/Department.model');
const { ApiError } = require('../utils/api.utils');

// Anyone logged in can read departments (needed for employee forms)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const depts = await Department.find({ isActive: true }).populate('head', 'name').populate('branch', 'name');
    res.json({ success: true, data: depts });
  } catch (err) { next(err); }
});

// Create a department — SUPER_ADMIN / DIRECTOR / HR only
router.post('/', authenticate, authorize('SUPER_ADMIN', 'DIRECTOR', 'HR'), async (req, res, next) => {
  try {
    const { name, code } = req.body;
    if (!name?.trim()) return next(new ApiError(400, 'Department name is required.'));
    const dept = await Department.create({ name: name.trim(), code: code?.trim().toUpperCase() || undefined, createdBy: req.user._id });
    res.status(201).json({ success: true, data: dept });
  } catch (err) { next(err); }
});

// Update / deactivate a department
router.patch('/:id', authenticate, authorize('SUPER_ADMIN', 'DIRECTOR', 'HR'), async (req, res, next) => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!dept) return next(new ApiError(404, 'Department not found.'));
    res.json({ success: true, data: dept });
  } catch (err) { next(err); }
});

// Delete (soft-deactivate) a department
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!dept) return next(new ApiError(404, 'Department not found.'));
    res.json({ success: true, message: `Department "${dept.name}" deactivated.` });
  } catch (err) { next(err); }
});

module.exports = router;
