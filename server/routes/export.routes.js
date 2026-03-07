const express    = require('express');
const router     = express.Router();
const ExcelJS    = require('exceljs');
const { authenticate } = require('../middleware/auth.middleware');
const { ApiError }     = require('../utils/api.utils');
const User        = require('../models/User.model');
const Attendance  = require('../models/Attendance.model');
const Leave       = require('../models/Leave.model');
const Salary      = require('../models/Salary.model');
const Resignation = require('../models/Resignation.model');
const Holiday     = require('../models/Holiday.model');

// Only Managing Head, DIRECTOR, SUPER_ADMIN can export
router.get('/all', authenticate, async (req, res, next) => {
  try {
    if (!req.user.isManagingHead && !['DIRECTOR', 'SUPER_ADMIN'].includes(req.user.role)) {
      return next(new ApiError(403, 'Access denied. Only Managing Head or Director can export data.'));
    }

    // Fetch all data in parallel
    const [employees, attendance, leaves, salaries, resignations, holidays] = await Promise.all([
      User.find({ role: { $nin: ['SUPER_ADMIN'] } })
        .populate('department', 'name')
        .populate('branch', 'name')
        .sort({ createdAt: 1 }),
      Attendance.find({})
        .populate('employee', 'name employeeId')
        .sort({ date: -1 }),
      Leave.find({})
        .populate('employee', 'name employeeId')
        .populate('reviewedBy', 'name')
        .sort({ createdAt: -1 }),
      Salary.find({})
        .populate('employee', 'name employeeId designation department')
        .sort({ year: -1, month: -1 }),
      Resignation.find({})
        .populate('employee', 'name employeeId designation department')
        .populate('hrReviewedBy', 'name')
        .populate('headReviewedBy', 'name')
        .sort({ createdAt: -1 }),
      Holiday.find({}).sort({ date: 1 }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator  = 'Sangi HRMS';
    wb.created  = new Date();
    wb.modified = new Date();

    const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const BORDER      = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };

    function styleHeader(sheet, cols) {
      sheet.columns = cols;
      const headerRow = sheet.getRow(1);
      headerRow.eachCell(cell => {
        cell.fill   = HEADER_FILL;
        cell.font   = HEADER_FONT;
        cell.border = BORDER;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      headerRow.height = 32;
    }

    function styleDataRow(row) {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.border    = BORDER;
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
    }

    function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-IN') : ''; }
    function fmtNum(n)  { return typeof n === 'number' ? n : 0; }

    // ── Sheet 1: Employees ──────────────────────────────────────
    {
      const ws = wb.addWorksheet('Employees');
      styleHeader(ws, [
        { header: 'Employee ID',    key: 'employeeId',   width: 14 },
        { header: 'Name',           key: 'name',         width: 22 },
        { header: 'Email',          key: 'email',        width: 28 },
        { header: 'Phone',          key: 'phone',        width: 15 },
        { header: 'Role',           key: 'role',         width: 14 },
        { header: 'Designation',    key: 'designation',  width: 22 },
        { header: 'Department',     key: 'department',   width: 18 },
        { header: 'Branch',         key: 'branch',       width: 18 },
        { header: 'Joining Date',   key: 'joiningDate',  width: 14 },
        { header: 'Gross Salary',   key: 'grossSalary',  width: 14 },
        { header: 'Bank Account',   key: 'bank',         width: 20 },
        { header: 'IFSC Code',      key: 'ifsc',         width: 14 },
        { header: 'Face Enrolled',  key: 'faceEnrolled', width: 14 },
        { header: 'Managing Head',  key: 'isHead',       width: 14 },
        { header: 'Active',         key: 'isActive',     width: 10 },
        { header: 'Created On',     key: 'createdAt',    width: 14 },
      ]);
      for (const emp of employees) {
        const row = ws.addRow({
          employeeId:  emp.employeeId || '',
          name:        emp.name || '',
          email:       emp.email || '',
          phone:       emp.phone || '',
          role:        emp.role || '',
          designation: emp.designation || '',
          department:  emp.department?.name || '',
          branch:      emp.branch?.name || '',
          joiningDate: fmtDate(emp.joiningDate),
          grossSalary: fmtNum(emp.grossSalary),
          bank:        emp.bankAccountNumber || '',
          ifsc:        emp.ifscCode || '',
          faceEnrolled: emp.faceEnrolled ? 'Yes' : 'No',
          isHead:      emp.isManagingHead ? 'Yes' : 'No',
          isActive:    emp.isActive ? 'Yes' : 'No',
          createdAt:   fmtDate(emp.createdAt),
        });
        styleDataRow(row);
      }
    }

    // ── Sheet 2: Attendance ─────────────────────────────────────
    {
      const ws = wb.addWorksheet('Attendance');
      styleHeader(ws, [
        { header: 'Employee ID',   key: 'employeeId',   width: 14 },
        { header: 'Name',          key: 'name',         width: 22 },
        { header: 'Date',          key: 'date',         width: 14 },
        { header: 'Status',        key: 'status',       width: 16 },
        { header: 'Display Status',key: 'displayStatus',width: 16 },
        { header: 'Check In',      key: 'checkIn',      width: 12 },
        { header: 'Check Out',     key: 'checkOut',     width: 12 },
        { header: 'Working Hours', key: 'workingHours', width: 14 },
        { header: 'Marked By',     key: 'markedBy',     width: 14 },
        { header: 'Notes',         key: 'notes',        width: 28 },
      ]);
      for (const a of attendance) {
        const row = ws.addRow({
          employeeId:   a.employee?.employeeId || '',
          name:         a.employee?.name || '',
          date:         fmtDate(a.date),
          status:       a.status || '',
          displayStatus:a.displayStatus || '',
          checkIn:      a.checkInTime || '',
          checkOut:     a.checkOutTime || '',
          workingHours: fmtNum(a.workingHours),
          markedBy:     a.markedBy || '',
          notes:        a.notes || '',
        });
        styleDataRow(row);
      }
    }

    // ── Sheet 3: Leave Requests ─────────────────────────────────
    {
      const ws = wb.addWorksheet('Leave Requests');
      styleHeader(ws, [
        { header: 'Employee ID',  key: 'employeeId', width: 14 },
        { header: 'Name',         key: 'name',       width: 22 },
        { header: 'Type',         key: 'type',       width: 14 },
        { header: 'From Date',    key: 'fromDate',   width: 14 },
        { header: 'To Date',      key: 'toDate',     width: 14 },
        { header: 'Total Days',   key: 'totalDays',  width: 12 },
        { header: 'Status',       key: 'status',     width: 12 },
        { header: 'Is Paid',      key: 'isPaid',     width: 10 },
        { header: 'Reason',       key: 'reason',     width: 32 },
        { header: 'Reviewed By',  key: 'reviewedBy', width: 18 },
        { header: 'Review Notes', key: 'reviewNotes',width: 28 },
        { header: 'Applied On',   key: 'createdAt',  width: 14 },
      ]);
      for (const l of leaves) {
        const row = ws.addRow({
          employeeId:  l.employee?.employeeId || '',
          name:        l.employee?.name || '',
          type:        l.type || '',
          fromDate:    fmtDate(l.fromDate),
          toDate:      fmtDate(l.toDate),
          totalDays:   fmtNum(l.totalDays),
          status:      l.status || '',
          isPaid:      l.isPaid ? 'Yes' : 'No',
          reason:      l.reason || '',
          reviewedBy:  l.reviewedBy?.name || '',
          reviewNotes: l.reviewNotes || '',
          createdAt:   fmtDate(l.createdAt),
        });
        styleDataRow(row);
      }
    }

    // ── Sheet 4: Salary Records ─────────────────────────────────
    {
      const ws = wb.addWorksheet('Salary Records');
      styleHeader(ws, [
        { header: 'Employee ID',     key: 'employeeId',     width: 14 },
        { header: 'Name',            key: 'name',           width: 22 },
        { header: 'Month',           key: 'month',          width: 10 },
        { header: 'Year',            key: 'year',           width: 10 },
        { header: 'Gross Salary',    key: 'grossSalary',    width: 14 },
        { header: 'Days in Month',   key: 'daysInMonth',    width: 14 },
        { header: 'Full Days',       key: 'fullDays',       width: 12 },
        { header: 'Half Days',       key: 'halfDays',       width: 12 },
        { header: 'Absent Days',     key: 'absentDays',     width: 12 },
        { header: 'Paid Leaves',     key: 'paidLeaves',     width: 12 },
        { header: 'Unpaid Leaves',   key: 'unpaidLeaves',   width: 14 },
        { header: 'Holidays',        key: 'holidays',       width: 12 },
        { header: 'Weekly Offs',     key: 'weeklyOffs',     width: 12 },
        { header: 'Deduction Days',  key: 'deductionDays',  width: 14 },
        { header: 'Deduction Amt',   key: 'deductionAmount',width: 14 },
        { header: 'Manual Adjust',   key: 'manualAdj',      width: 14 },
        { header: 'Net Salary',      key: 'netSalary',      width: 14 },
        { header: 'Status',          key: 'status',         width: 10 },
      ]);
      for (const s of salaries) {
        const row = ws.addRow({
          employeeId:     s.employee?.employeeId || '',
          name:           s.employee?.name || '',
          month:          fmtNum(s.month),
          year:           fmtNum(s.year),
          grossSalary:    fmtNum(s.grossSalary),
          daysInMonth:    fmtNum(s.daysInMonth),
          fullDays:       fmtNum(s.fullDays),
          halfDays:       fmtNum(s.realHalfDays),
          absentDays:     fmtNum(s.absentDays),
          paidLeaves:     fmtNum(s.paidLeaves),
          unpaidLeaves:   fmtNum(s.unpaidLeaves),
          holidays:       fmtNum(s.holidays),
          weeklyOffs:     fmtNum(s.weeklyOffs),
          deductionDays:  fmtNum(s.deductionDays),
          deductionAmount:fmtNum(s.deductionAmount),
          manualAdj:      fmtNum(s.manualAdjustment),
          netSalary:      fmtNum(s.netSalary),
          status:         s.status || '',
        });
        styleDataRow(row);
      }
    }

    // ── Sheet 5: Resignations ───────────────────────────────────
    {
      const ws = wb.addWorksheet('Resignations');
      styleHeader(ws, [
        { header: 'Employee ID',    key: 'employeeId',    width: 14 },
        { header: 'Name',           key: 'name',          width: 22 },
        { header: 'Reason',         key: 'reason',        width: 36 },
        { header: 'Last Work Date', key: 'lastWorkDate',  width: 16 },
        { header: 'Status',         key: 'status',        width: 16 },
        { header: 'HR Reviewer',    key: 'hrReviewer',    width: 18 },
        { header: 'HR Note',        key: 'hrNote',        width: 28 },
        { header: 'HR Review Date', key: 'hrDate',        width: 16 },
        { header: 'Head Reviewer',  key: 'headReviewer',  width: 18 },
        { header: 'Head Note',      key: 'headNote',      width: 28 },
        { header: 'Head Review Date',key:'headDate',      width: 16 },
        { header: 'Rejected By',    key: 'rejectedBy',    width: 12 },
        { header: 'Rejection Note', key: 'rejectionNote', width: 28 },
        { header: 'Employee Removed',key:'removed',       width: 16 },
        { header: 'Removed On',     key: 'removedAt',     width: 14 },
        { header: 'Submitted On',   key: 'createdAt',     width: 14 },
      ]);
      for (const r of resignations) {
        const row = ws.addRow({
          employeeId:   r.employee?.employeeId || '',
          name:         r.employee?.name || '',
          reason:       r.reason || '',
          lastWorkDate: fmtDate(r.lastWorkingDate),
          status:       r.status || '',
          hrReviewer:   r.hrReviewedBy?.name || '',
          hrNote:       r.hrNote || '',
          hrDate:       fmtDate(r.hrReviewedAt),
          headReviewer: r.headReviewedBy?.name || '',
          headNote:     r.headNote || '',
          headDate:     fmtDate(r.headReviewedAt),
          rejectedBy:   r.rejectedBy || '',
          rejectionNote:r.rejectionNote || '',
          removed:      r.employeeRemoved ? 'Yes' : 'No',
          removedAt:    fmtDate(r.employeeRemovedAt),
          createdAt:    fmtDate(r.createdAt),
        });
        styleDataRow(row);
      }
    }

    // ── Sheet 6: Holidays ───────────────────────────────────────
    {
      const ws = wb.addWorksheet('Holidays');
      styleHeader(ws, [
        { header: 'Name',  key: 'name', width: 28 },
        { header: 'Date',  key: 'date', width: 14 },
        { header: 'Type',  key: 'type', width: 14 },
      ]);
      for (const h of holidays) {
        const row = ws.addRow({
          name: h.name || '',
          date: fmtDate(h.date),
          type: h.type || '',
        });
        styleDataRow(row);
      }
    }

    // Stream the workbook back as a download
    const now      = new Date();
    const dateTag  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const filename = `HRMS_Export_${dateTag}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

module.exports = router;
