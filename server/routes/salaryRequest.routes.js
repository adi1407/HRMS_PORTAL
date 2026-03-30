const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const SalaryUpdateRequest = require('../models/SalaryUpdateRequest.model');
const User   = require('../models/User.model');
const { ApiError } = require('../utils/api.utils');
const {
  isSalaryBankLockedForAccounts,
  markSalaryBankInitialCaptureIfNeeded,
} = require('../utils/salaryBank.utils');

// ACCOUNTS: submit a salary/bank update request
// If initial capture not done yet → apply directly (first-time setup by Accounts)
// If already captured → create approval request for DIRECTOR / SUPER_ADMIN
router.post('/', authenticate, authorize('ACCOUNTS'), async (req, res, next) => {
  try {
    const { employeeId, newGrossSalary, newBankAccount, newIfscCode, reason } = req.body;
    if (!employeeId) return next(new ApiError(400, 'employeeId is required.'));

    const employee = await User.findById(employeeId);
    if (!employee) return next(new ApiError(404, 'Employee not found.'));

    const isFirstTime = !isSalaryBankLockedForAccounts(employee);

    if (isFirstTime) {
      // Apply directly — no approval needed for first-time salary setup (one-time capture by Accounts)
      let updates = {};
      if (newGrossSalary !== undefined) updates.grossSalary = Number(newGrossSalary);
      if (newBankAccount !== undefined) updates.bankAccountNumber = newBankAccount;
      if (newIfscCode !== undefined) updates.ifscCode = newIfscCode;
      if (Object.keys(updates).length === 0) {
        return next(new ApiError(400, 'Provide at least gross salary, bank account, or IFSC for initial setup.'));
      }
      updates = markSalaryBankInitialCaptureIfNeeded(updates, employee);
      await User.findByIdAndUpdate(employeeId, updates);
      return res.status(200).json({ success: true, message: 'Salary and bank details set successfully.', requiresApproval: false });
    }

    // Check for existing PENDING request
    const existing = await SalaryUpdateRequest.findOne({ employee: employeeId, status: 'PENDING' });
    if (existing) return next(new ApiError(409, 'A pending update request already exists for this employee. Wait for it to be reviewed.'));

    const request = await SalaryUpdateRequest.create({
      employee:            employeeId,
      requestedBy:         req.user._id,
      currentGrossSalary:  employee.grossSalary,
      newGrossSalary:      newGrossSalary !== undefined ? Number(newGrossSalary) : undefined,
      currentBankAccount:  employee.bankAccountNumber,
      newBankAccount:      newBankAccount,
      currentIfscCode:     employee.ifscCode,
      newIfscCode:         newIfscCode,
      reason:              reason || '',
    });

    res.status(201).json({ success: true, message: 'Update request submitted. Awaiting Director or Super Admin approval.', requiresApproval: true, data: request });
  } catch (err) { next(err); }
});

// DIRECTOR / SUPER_ADMIN: list pending requests
router.get('/', authenticate, authorize('DIRECTOR', 'SUPER_ADMIN', 'ACCOUNTS'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'ACCOUNTS') {
      filter.requestedBy = req.user._id; // ACCOUNTS sees only their own requests
    } else {
      if (req.query.status) filter.status = req.query.status;
    }
    const requests = await SalaryUpdateRequest.find(filter)
      .populate('employee', 'name employeeId department designation grossSalary bankAccountNumber ifscCode')
      .populate('requestedBy', 'name')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: requests });
  } catch (err) { next(err); }
});

// DIRECTOR / SUPER_ADMIN: approve or reject
router.patch('/:id/review', authenticate, authorize('DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { action, reviewNote } = req.body; // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) return next(new ApiError(400, 'action must be approve or reject.'));

    const request = await SalaryUpdateRequest.findById(req.params.id).populate('employee');
    if (!request) return next(new ApiError(404, 'Request not found.'));
    if (request.status !== 'PENDING') return next(new ApiError(409, 'Request already reviewed.'));

    request.status      = action === 'approve' ? 'APPROVED' : 'REJECTED';
    request.reviewedBy  = req.user._id;
    request.reviewNote  = reviewNote || '';
    request.reviewedAt  = new Date();
    await request.save();

    if (action === 'approve') {
      const updates = {};
      if (request.newGrossSalary  !== undefined) updates.grossSalary       = request.newGrossSalary;
      if (request.newBankAccount  !== undefined) updates.bankAccountNumber  = request.newBankAccount;
      if (request.newIfscCode     !== undefined) updates.ifscCode           = request.newIfscCode;
      await User.findByIdAndUpdate(request.employee._id, updates);
    }

    res.status(200).json({ success: true, message: `Request ${request.status.toLowerCase()}.`, data: request });
  } catch (err) { next(err); }
});

module.exports = router;
