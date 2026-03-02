const express = require('express');
const router = express.Router();
const { authenticate, authorize, selfOrAdmin } = require('../middleware/auth.middleware');
const User = require('../models/User.model');
const Branch = require('../models/Branch.model');
const { ApiError } = require('../utils/api.utils');
const { createAuditLog } = require('../utils/auditLog.utils');

router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN', 'ACCOUNTS'), async (req, res, next) => {
  try {
    const { dept, branch, role, isActive, search } = req.query;
    const filter = {};
    if (dept) filter.department = dept;
    if (branch) filter.branch = branch;
    if (role) filter.role = role;
    else filter.role = { $ne: 'SUPER_ADMIN' };
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
    const users = await User.find(filter).populate('department', 'name').populate('branch', 'name').sort({ createdAt: -1 });
    res.json({ success: true, data: users, count: users.length });
  } catch (err) { next(err); }
});

// ACCOUNTS can now create employees (and set salary/bank details at creation time)
router.post('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN', 'ACCOUNTS'), async (req, res, next) => {
  try {
    const { name, email, password, role, department, branch, designation, phone, joiningDate, grossSalary, bankAccountNumber, ifscCode, isManagingHead } = req.body;
    if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') return next(new ApiError(403, 'Only Super Admin can create Super Admin.'));
    // Only ACCOUNTS / SUPER_ADMIN may set bank details and managing head flag
    const canSetBankDetails = ['ACCOUNTS', 'SUPER_ADMIN'].includes(req.user.role);
    // Default to the single main branch if none provided
    const defaultBranch = branch || (await Branch.findOne())?._id;
    const user = await User.create({
      name, email, password: password || 'Welcome@123',
      role: role || 'EMPLOYEE', department, branch: defaultBranch, designation, phone,
      joiningDate: joiningDate || new Date(), grossSalary: canSetBankDetails ? (grossSalary || 0) : 0,
      bankAccountNumber: canSetBankDetails ? (bankAccountNumber || '') : '',
      ifscCode:          canSetBankDetails ? (ifscCode || '')          : '',
      isManagingHead:    canSetBankDetails ? (isManagingHead === true) : false,
      createdBy: req.user._id
    });
    await createAuditLog({ actor: req.user, action: 'EMPLOYEE_CREATED', entity: 'User', entityId: user._id, description: `${user.name} (${user.employeeId}) created`, req });
    res.status(201).json({ success: true, data: user.toSafeObject(), message: `Employee ${user.employeeId} created.` });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, selfOrAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('department', 'name').populate('branch', 'name address');
    if (!user) return next(new ApiError(404, 'Employee not found.'));
    res.json({ success: true, data: user.toSafeObject() });
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN', 'ACCOUNTS'), async (req, res, next) => {
  try {
    const { password, role, bankAccountNumber, ifscCode, grossSalary, isManagingHead, ...updates } = req.body;
    if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') return next(new ApiError(403, 'Insufficient permissions.'));
    if (role) updates.role = role;
    // Only ACCOUNTS / SUPER_ADMIN may update salary, bank details, and managing head flag
    const canSetSalaryDetails = ['ACCOUNTS', 'SUPER_ADMIN'].includes(req.user.role);
    if (canSetSalaryDetails) {
      if (bankAccountNumber !== undefined) updates.bankAccountNumber = bankAccountNumber;
      if (ifscCode          !== undefined) updates.ifscCode          = ifscCode;
      if (grossSalary       !== undefined) updates.grossSalary       = grossSalary;
      if (isManagingHead    !== undefined) updates.isManagingHead    = isManagingHead;
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return next(new ApiError(404, 'Employee not found.'));
    await createAuditLog({ actor: req.user, action: 'EMPLOYEE_UPDATED', entity: 'User', entityId: user._id, description: `${user.name} updated by ${req.user.name}`, req });
    res.json({ success: true, data: user.toSafeObject() });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const target = await User.findByIdAndDelete(req.params.id);
    if (!target) return next(new ApiError(404, 'Employee not found.'));
    await createAuditLog({ actor: req.user, action: 'EMPLOYEE_DELETED', entity: 'User', entityId: target._id, description: `${target.name} (${target.employeeId}) permanently removed`, req });
    res.json({ success: true, message: `${target.name} has been permanently removed.` });
  } catch (err) { next(err); }
});

module.exports = router;
