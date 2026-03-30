const express = require('express');
const router = express.Router();
const { authenticate, authorize, selfOrAdmin } = require('../middleware/auth.middleware');
const User = require('../models/User.model');
const Branch = require('../models/Branch.model');
const { ApiError } = require('../utils/api.utils');
const { createAuditLog } = require('../utils/auditLog.utils');
const {
  isSalaryBankLockedForAccounts,
  markSalaryBankInitialCaptureIfNeeded,
  hasSalaryBankData,
} = require('../utils/salaryBank.utils');

// Directory: all authenticated users can list (limited fields). Search by name, employeeId, department, designation.
router.get('/directory', authenticate, async (req, res, next) => {
  try {
    const { search, department, role: roleFilter } = req.query;
    const filter = { isActive: true };
    if (roleFilter) filter.role = roleFilter;
    else filter.role = { $ne: 'SUPER_ADMIN' };
    if (department) filter.department = department;
    if (search && search.trim()) {
      const q = search.trim();
      const regex = { $regex: q, $options: 'i' };
      filter.$or = [
        { name: regex },
        { employeeId: regex },
        { email: regex },
        { designation: regex },
      ];
    }
    const users = await User.find(filter)
      .select('name employeeId email phone role designation department branch photoUrl')
      .populate('department', 'name code')
      .populate('branch', 'name')
      .sort({ name: 1 });
    const list = users.map(u => ({
      _id: u._id,
      name: u.name,
      employeeId: u.employeeId,
      email: u.email,
      phone: u.phone,
      role: u.role,
      designation: u.designation,
      department: u.department,
      branch: u.branch,
      photoUrl: u.photoUrl,
    }));
    res.json({ success: true, data: list, count: list.length });
  } catch (err) { next(err); }
});

// Payslip PIN: optional secure access for viewing/downloading own payslips
router.get('/me/payslip-pin', authenticate, async (req, res, next) => {
  try {
    const u = await User.findById(req.user._id).select('payslipPin').lean();
    res.json({ success: true, data: { hasPayslipPin: !!(u && u.payslipPin) } });
  } catch (err) { next(err); }
});

router.post('/me/payslip-pin', authenticate, async (req, res, next) => {
  try {
    const { pin } = req.body;
    const p = String(pin || '').trim();
    if (p.length < 4 || p.length > 8) return next(new ApiError(400, 'PIN must be 4–8 digits.'));
    if (!/^\d+$/.test(p)) return next(new ApiError(400, 'PIN must contain only digits.'));
    const user = await User.findById(req.user._id).select('payslipPin');
    if (!user) return next(new ApiError(404, 'User not found.'));
    user.payslipPin = p;
    await user.save();
    await createAuditLog({ actor: req.user, action: 'PAYSLIP_PIN_SET', entity: 'User', entityId: user._id, description: 'Payslip PIN set', req });
    res.json({ success: true, message: 'Payslip PIN set. You will need it to view or download your salary slip.' });
  } catch (err) { next(err); }
});

router.patch('/me/payslip-pin', authenticate, async (req, res, next) => {
  try {
    const { currentPin, newPin } = req.body;
    const user = await User.findById(req.user._id).select('payslipPin');
    if (!user) return next(new ApiError(404, 'User not found.'));
    if (!user.payslipPin) return next(new ApiError(400, 'No payslip PIN set. Use POST to set one.'));
    const valid = await user.comparePayslipPin(currentPin);
    if (!valid) return next(new ApiError(401, 'Current PIN is incorrect.'));
    if (newPin !== undefined && newPin !== null && newPin !== '') {
      const p = String(newPin).trim();
      if (p.length < 4 || p.length > 8) return next(new ApiError(400, 'New PIN must be 4–8 digits.'));
      if (!/^\d+$/.test(p)) return next(new ApiError(400, 'New PIN must contain only digits.'));
      user.payslipPin = p;
      await user.save();
      await createAuditLog({ actor: req.user, action: 'PAYSLIP_PIN_CHANGED', entity: 'User', entityId: user._id, description: 'Payslip PIN changed', req });
      res.json({ success: true, message: 'Payslip PIN updated.' });
    } else {
      user.payslipPin = '';
      await user.save();
      await createAuditLog({ actor: req.user, action: 'PAYSLIP_PIN_REMOVED', entity: 'User', entityId: user._id, description: 'Payslip PIN removed', req });
      res.json({ success: true, message: 'Payslip PIN removed.' });
    }
  } catch (err) { next(err); }
});

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
    const users = await User.find(filter)
      .populate({ path: 'department', select: 'name head code', populate: { path: 'head', select: 'name employeeId' } })
      .populate('branch', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: users, count: users.length });
  } catch (err) { next(err); }
});

// ACCOUNTS can now create employees (and set salary/bank details at creation time)
router.post('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN', 'ACCOUNTS'), async (req, res, next) => {
  try {
    const { name, email, password, role, department, branch, designation, phone, joiningDate, grossSalary, bankAccountNumber, ifscCode, isManagingHead } = req.body;
    if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') return next(new ApiError(403, 'Only Super Admin can create Super Admin.'));
    // ACCOUNTS (initial capture), DIRECTOR, SUPER_ADMIN may set salary/bank at creation
    const canSetBankDetails = ['ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role);
    // Default to the single main branch if none provided
    const defaultBranch = branch || (await Branch.findOne())?._id;
    const gs = canSetBankDetails ? (grossSalary || 0) : 0;
    const bank = canSetBankDetails ? (bankAccountNumber || '') : '';
    const ifsc = canSetBankDetails ? (ifscCode || '') : '';
    const draft = {
      name, email, password: password || 'Welcome@123',
      role: role || 'EMPLOYEE', department, branch: defaultBranch, designation, phone,
      joiningDate: joiningDate || new Date(), grossSalary: gs,
      bankAccountNumber: bank,
      ifscCode: ifsc,
      isManagingHead: canSetBankDetails ? (isManagingHead === true) : false,
      createdBy: req.user._id,
    };
    if (canSetBankDetails && hasSalaryBankData(draft)) draft.salaryBankInitialCaptureDone = true;
    const user = await User.create(draft);
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
    const {
      password,
      role,
      bankAccountNumber,
      ifscCode,
      grossSalary,
      isManagingHead,
      biometricAttendanceEnabled,
      ...updates
    } = req.body;
    if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') return next(new ApiError(403, 'Insufficient permissions.'));
    if (role) updates.role = role;

    const target = await User.findById(req.params.id);
    if (!target) return next(new ApiError(404, 'Employee not found.'));

    const wantsSalaryFields =
      bankAccountNumber !== undefined ||
      ifscCode !== undefined ||
      grossSalary !== undefined ||
      isManagingHead !== undefined;

    const isAccounts = req.user.role === 'ACCOUNTS';
    const isDirector = req.user.role === 'DIRECTOR';
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    if (wantsSalaryFields) {
      if (isAccounts && isSalaryBankLockedForAccounts(target)) {
        return next(new ApiError(403,
          'Initial salary and bank details are already on file. Submit a salary update request for Director approval, or ask a Director / Super Admin to update.'));
      }
      const canSetSalaryDetails =
        isSuperAdmin ||
        isDirector ||
        (isAccounts && !isSalaryBankLockedForAccounts(target));
      if (!canSetSalaryDetails) {
        return next(new ApiError(403, 'Only Accounts (first-time setup), Director, or Super Admin can set salary and bank details.'));
      }
      if (bankAccountNumber !== undefined) updates.bankAccountNumber = bankAccountNumber;
      if (ifscCode !== undefined) updates.ifscCode = ifscCode;
      if (grossSalary !== undefined) updates.grossSalary = grossSalary;
      if (isManagingHead !== undefined) updates.isManagingHead = isManagingHead;
      if (isAccounts || isDirector || isSuperAdmin) {
        Object.assign(updates, markSalaryBankInitialCaptureIfNeeded(updates, target));
      }
    }

    if (biometricAttendanceEnabled !== undefined) {
      if (!['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role)) {
        return next(new ApiError(403, 'Only HR, Director, or Super Admin can manage biometric attendance.'));
      }
      updates.biometricAttendanceEnabled = !!biometricAttendanceEnabled;
      updates.biometricAttendanceSetAt = new Date();
      updates.biometricAttendanceSetBy = req.user._id;
      // Force re-enrollment when toggling
      updates.biometricMobileEnrolledAt = null;
      updates.webAuthnCredentials = [];
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
