const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { processCheckIn, processCheckOut, getTodayAttendance, overrideAttendance } = require('../services/attendance.service');
const Attendance        = require('../models/Attendance.model');
const AttendanceRequest = require('../models/AttendanceRequest.model');
const Salary            = require('../models/Salary.model');
const { ApiError } = require('../utils/api.utils');
const { createAuditLog } = require('../utils/auditLog.utils');
const { generateMonthlySalary } = require('../services/salary.service');
const { buildAttendanceExcel } = require('../utils/excel.utils');

router.post('/checkin', authenticate, authorize('EMPLOYEE', 'ACCOUNTS', 'HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { branchId, faceDescriptor, lat, lon } = req.body;
    const result = await processCheckIn({ employeeId: req.user._id, branchId, faceDescriptor, lat, lon, req });
    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post('/checkout', authenticate, authorize('EMPLOYEE', 'ACCOUNTS', 'HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { branchId, faceDescriptor, lat, lon } = req.body;
    const result = await processCheckOut({ employeeId: req.user._id, branchId, faceDescriptor, lat, lon, req });
    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/today', authenticate, authorize('EMPLOYEE', 'ACCOUNTS', 'HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const result = await getTodayAttendance(req.user._id);
    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/my', authenticate, authorize('EMPLOYEE', 'ACCOUNTS', 'HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const filter = { employee: req.user._id };
    if (month && year) {
      filter.date = { $gte: new Date(year, month - 1, 1), $lte: new Date(year, month - 1, new Date(year, month, 0).getDate(), 23, 59, 59) };
    }
    const records = await Attendance.find(filter, { isRealHalfDay: 0, faceConfidence: 0 }).sort({ date: -1 }).limit(90);
    res.status(200).json({ success: true, data: records });
  } catch (err) { next(err); }
});

router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { empId, date, month, year, status } = req.query;
    const filter = {};
    if (empId) filter.employee = empId;
    if (status) filter.status = status;
    if (date) { const d = new Date(date); d.setHours(0,0,0,0); filter.date = d; }
    else if (month && year) filter.date = { $gte: new Date(year, month-1, 1), $lte: new Date(year, month-1, new Date(year, month, 0).getDate(), 23, 59, 59) };
    const records = await Attendance.find(filter).populate('employee', 'name employeeId department designation').sort({ date: -1 }).limit(500);
    res.status(200).json({ success: true, data: records, count: records.length });
  } catch (err) { next(err); }
});

router.patch('/:id/override', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const result = await overrideAttendance({ attendanceId: req.params.id, status: req.body.status, notes: req.body.notes, admin: req.user });
    res.status(200).json({ success: true, data: result.attendance, salaryRecalculated: result.salaryRecalculated || false, salaryWarning: result.salaryWarning || null });
  } catch (err) { next(err); }
});

// Manually create/upsert attendance for any employee on any date
router.post('/manual', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { employeeId, date, status, notes } = req.body;
    if (!employeeId || !date || !status) return next(new ApiError(400, 'employeeId, date and status are required.'));
    if (!notes || !notes.trim()) return next(new ApiError(400, 'Reason is required when manually marking attendance.'));
    const displayMap = { FULL_DAY: 'FULL_DAY', HALF_DAY: 'HALF_DAY', ABSENT: 'ABSENT', ON_LEAVE: 'ON_LEAVE', HOLIDAY: 'FULL_DAY', WEEKLY_OFF: 'FULL_DAY' };
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const attendance = await Attendance.findOneAndUpdate(
      { employee: employeeId, date: dayStart },
      { employee: employeeId, date: dayStart, status, displayStatus: displayMap[status] || status, isRealHalfDay: status === 'HALF_DAY', markedBy: req.user.role, overriddenByName: req.user.name, notes: notes.trim() },
      { new: true, upsert: true }
    );
    await createAuditLog({ actor: req.user, action: 'ATTENDANCE_MANUAL', entity: 'Attendance', entityId: attendance._id, description: `Marked ${status} for employee on ${date}`, req });

    // Auto-recalculate salary if a DRAFT slip exists for this month
    const month = dayStart.getMonth() + 1;
    const year  = dayStart.getFullYear();
    const existingSalary = await Salary.findOne({ employee: employeeId, month, year });
    let salaryRecalculated = false;
    let salaryWarning      = null;
    if (existingSalary?.status === 'DRAFT') {
      await generateMonthlySalary(employeeId, month, year, req.user);
      salaryRecalculated = true;
    } else if (existingSalary?.status === 'FINAL') {
      salaryWarning = 'Salary slip is already finalized. Deductions not auto-updated.';
    }

    const baseMsg = `Attendance marked as ${status.replace(/_/g, ' ')}.`;
    res.status(200).json({ success: true, data: attendance, message: baseMsg, salaryRecalculated, salaryWarning });
  } catch (err) { next(err); }
});

// Download monthly attendance report as Excel
router.get('/export', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const filter = {};
    if (req.query.empId) filter.employee = req.query.empId;
    filter.date = { $gte: new Date(year, month - 1, 1), $lte: new Date(year, month - 1, new Date(year, month, 0).getDate(), 23, 59, 59) };
    const records = await Attendance.find(filter)
      .populate('employee', 'name employeeId department designation')
      .sort({ date: 1 });
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const wb = buildAttendanceExcel(records, month, year);
    const filename = `Attendance_Report_${MONTHS[month-1]}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// Employee submits an attendance issue to HR
router.post('/request', authenticate, authorize('EMPLOYEE', 'ACCOUNTS', 'HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return next(new ApiError(400, 'Message is required.'));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const existing = await AttendanceRequest.findOne({ employee: req.user._id, date: today, status: 'PENDING' });
    if (existing) return next(new ApiError(409, 'You already have a pending request for today.'));
    const request = await AttendanceRequest.create({ employee: req.user._id, date: today, message: message.trim() });
    res.status(201).json({ success: true, data: request });
  } catch (err) { next(err); }
});

// HR gets all pending attendance requests
router.get('/requests', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const requests = await AttendanceRequest.find({ status: 'PENDING' })
      .populate('employee', 'name employeeId designation')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: requests });
  } catch (err) { next(err); }
});

// HR resolves a request (after marking attendance manually)
router.patch('/requests/:id/resolve', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const request = await AttendanceRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'RESOLVED', resolvedBy: req.user._id, resolvedNote: req.body.note || '' },
      { new: true }
    );
    if (!request) return next(new ApiError(404, 'Request not found.'));
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
});

module.exports = router;
