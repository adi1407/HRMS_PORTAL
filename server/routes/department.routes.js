const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const Department = require('../models/Department.model');
const User = require('../models/User.model');
const { ApiError } = require('../utils/api.utils');
const { createAuditLog } = require('../utils/auditLog.utils');
const { setDepartmentHeadUser } = require('../services/dailyTask.service');

// Anyone logged in can read departments (needed for employee forms)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const depts = await Department.find({ isActive: true }).populate('head', 'name employeeId').populate('branch', 'name');
    res.json({ success: true, data: depts });
  } catch (err) { next(err); }
});

/** Department head context for daily tasks UI */
router.get('/me-head', authenticate, async (req, res, next) => {
  try {
    const dept = await Department.findOne({ head: req.user._id, isActive: true })
      .select('name code head branch')
      .populate('head', 'name employeeId');
    if (!dept) {
      return res.json({ success: true, data: { isHead: false, department: null } });
    }
    const memberCount = await User.countDocuments({ department: dept._id, isActive: true });
    res.json({
      success: true,
      data: {
        isHead: true,
        department: dept,
        memberCount,
      },
    });
  } catch (err) { next(err); }
});

/** Team members — department head, Director, or Super Admin */
router.get('/:id/team', authenticate, async (req, res, next) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return next(new ApiError(404, 'Department not found.'));
    const isHead = dept.head && dept.head.toString() === req.user._id.toString();
    const isExec = ['SUPER_ADMIN', 'DIRECTOR'].includes(req.user.role);
    if (!isHead && !isExec) return next(new ApiError(403, 'Access denied.'));
    const users = await User.find({ department: dept._id, isActive: true })
      .select('name employeeId designation role department')
      .sort({ name: 1 });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

// Create — Super Admin & Director only
router.post('/', authenticate, authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const { name, code } = req.body;
    if (!name?.trim()) return next(new ApiError(400, 'Department name is required.'));
    const dept = await Department.create({ name: name.trim(), code: code?.trim().toUpperCase() || undefined, createdBy: req.user._id });
    await createAuditLog({ actor: req.user, action: 'DEPARTMENT_CREATE', entity: 'Department', entityId: dept._id, description: `Created department ${dept.name}`, req });
    res.status(201).json({ success: true, data: dept });
  } catch (err) { next(err); }
});

// Update — Super Admin & Director only
router.patch('/:id', authenticate, authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return next(new ApiError(404, 'Department not found.'));
    const { name, code, branch, isActive, head } = req.body;
    if (name !== undefined) dept.name = String(name).trim();
    if (code !== undefined) dept.code = code ? String(code).trim().toUpperCase() : undefined;
    if (branch !== undefined) dept.branch = branch || undefined;
    if (isActive !== undefined) dept.isActive = !!isActive;
    await dept.save();
    if (head !== undefined) {
      await setDepartmentHeadUser(dept._id, head || null);
    }
    const refreshed = await Department.findById(dept._id).populate('head', 'name employeeId').populate('branch', 'name');
    await createAuditLog({ actor: req.user, action: 'DEPARTMENT_UPDATE', entity: 'Department', entityId: dept._id, description: `Updated ${refreshed.name}`, req });
    res.json({ success: true, data: refreshed });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!dept) return next(new ApiError(404, 'Department not found.'));
    await createAuditLog({ actor: req.user, action: 'DEPARTMENT_DEACTIVATE', entity: 'Department', entityId: dept._id, description: `Deactivated ${dept.name}`, req });
    res.json({ success: true, message: `Department "${dept.name}" deactivated.` });
  } catch (err) { next(err); }
});

module.exports = router;
