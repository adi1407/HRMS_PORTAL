const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const Leave = require('../models/Leave.model');
const Attendance = require('../models/Attendance.model');
const User = require('../models/User.model');
const { ApiError } = require('../utils/api.utils');
const { sendLeaveStatusEmail } = require('../utils/email.utils');

router.post('/', authenticate, authorize('EMPLOYEE', 'ACCOUNTS', 'HR'), async (req, res, next) => {
  try {
    const { type, fromDate, toDate, reason } = req.body;
    const from = new Date(fromDate), to = new Date(toDate);
    const totalDays = Math.ceil((to - from) / (1000*60*60*24)) + 1;
    const leave = await Leave.create({ employee: req.user._id, branch: req.user.branch, type, fromDate: from, toDate: to, totalDays, reason });
    res.status(201).json({ success: true, data: leave, message: 'Leave application submitted.' });
  } catch (err) { next(err); }
});

router.get('/my', authenticate, authorize('EMPLOYEE', 'ACCOUNTS', 'HR'), async (req, res, next) => {
  try {
    const leaves = await Leave.find({ employee: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: leaves });
  } catch (err) { next(err); }
});

router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.empId)  filter.employee = req.query.empId;
    const leaves = await Leave.find(filter).populate('employee', 'name employeeId department').sort({ createdAt: -1 });
    res.json({ success: true, data: leaves, count: leaves.length });
  } catch (err) { next(err); }
});

// ── HR: Get employees who worked on Sundays in a given month ────────────────
router.get('/sunday-workers', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const from  = new Date(year, month - 1, 1);
    const to    = new Date(year, month - 1, new Date(year, month, 0).getDate(), 23, 59, 59);

    // Fetch all attendance records in the month
    const records = await Attendance.find({
      date: { $gte: from, $lte: to },
      status: { $in: ['FULL_DAY', 'HALF_DAY'] },
    }).populate('employee', 'name employeeId designation').sort({ date: 1 });

    // Filter to Sundays only (getDay() === 0)
    const sundays = records.filter(r => new Date(r.date).getDay() === 0);

    // Group by Sunday date for easy display
    const grouped = {};
    sundays.forEach(r => {
      const key = new Date(r.date).toISOString().slice(0, 10);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ employeeId: r.employee?._id, name: r.employee?.name, empId: r.employee?.employeeId, designation: r.employee?.designation, status: r.status, attendanceId: r._id });
    });

    res.json({ success: true, data: grouped });
  } catch (err) { next(err); }
});

// ── HR: Grant compensatory off to an employee who worked on Sunday ──────────
router.post('/grant-comp-off', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { employeeId, sundayWorkedDate, compOffDate, reason } = req.body;
    if (!employeeId || !sundayWorkedDate || !compOffDate)
      return next(new ApiError(400, 'employeeId, sundayWorkedDate and compOffDate are required.'));

    const sunday  = new Date(sundayWorkedDate);
    const compOff = new Date(compOffDate);
    compOff.setHours(0, 0, 0, 0);

    // Make sure the target day is not itself a Sunday
    if (compOff.getDay() === 0)
      return next(new ApiError(400, 'Comp-off date cannot itself be a Sunday.'));

    // Check the employee actually has attendance on that Sunday
    const sundayStart = new Date(sunday); sundayStart.setHours(0, 0, 0, 0);
    const attended = await Attendance.findOne({ employee: employeeId, date: sundayStart, status: { $in: ['FULL_DAY', 'HALF_DAY'] } });
    if (!attended)
      return next(new ApiError(400, 'No attendance record found for that Sunday.'));

    // Prevent duplicate comp-off for the same Sunday
    const duplicate = await Leave.findOne({ employee: employeeId, type: 'COMP_OFF', sundayWorkedDate: sundayStart, status: { $ne: 'REJECTED' } });
    if (duplicate)
      return next(new ApiError(409, 'Comp-off already granted for this Sunday.'));

    // Create an already-APPROVED comp-off leave
    const leave = await Leave.create({
      employee: employeeId,
      type: 'COMP_OFF',
      fromDate: compOff,
      toDate:   compOff,
      totalDays: 1,
      reason: reason || `Compensatory off for working on Sunday ${sundayStart.toDateString()}`,
      status: 'APPROVED',
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      reviewNotes: `Granted by ${req.user.name}`,
      isPaid: true,
      sundayWorkedDate: sundayStart,
    });

    // Mark the comp-off date as ON_LEAVE in attendance
    await Attendance.findOneAndUpdate(
      { employee: employeeId, date: compOff },
      { status: 'ON_LEAVE', displayStatus: 'ON_LEAVE', isPaidLeave: true, leaveId: leave._id, markedBy: req.user.role },
      { upsert: true }
    );

    const emp = await User.findById(employeeId).select('name employeeId');
    res.status(201).json({ success: true, data: leave, message: `Comp-off granted to ${emp?.name || employeeId} for ${compOff.toDateString()}.` });
  } catch (err) { next(err); }
});

router.patch('/:id/review', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { status, reviewNotes, isPaid } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) return next(new ApiError(400, 'Status must be APPROVED or REJECTED.'));
    const leave = await Leave.findByIdAndUpdate(req.params.id, { status, reviewedBy: req.user._id, reviewedAt: new Date(), reviewNotes, isPaid: isPaid !== false }, { new: true }).populate('employee');
    if (!leave) return next(new ApiError(404, 'Leave not found.'));
    if (status === 'APPROVED') {
      const current = new Date(leave.fromDate);
      while (current <= leave.toDate) {
        const day = new Date(current); day.setHours(0,0,0,0);
        await Attendance.findOneAndUpdate({ employee: leave.employee._id, date: day }, { status: 'ON_LEAVE', displayStatus: 'ON_LEAVE', isPaidLeave: leave.isPaid, leaveId: leave._id, markedBy: req.user.role }, { upsert: true });
        current.setDate(current.getDate() + 1);
      }
    }
    // Send email notification to employee (fire-and-forget)
    if (leave.employee?.email) {
      sendLeaveStatusEmail({ employee: leave.employee, leave, reviewerName: req.user.name }).catch(() => {});
    }

    res.json({ success: true, data: leave, message: `Leave ${status.toLowerCase()}.` });
  } catch (err) { next(err); }
});

module.exports = router;
