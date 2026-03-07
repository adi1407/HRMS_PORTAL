const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { generateMonthlySalary, generateAllSalaries } = require('../services/salary.service');
const Salary = require('../models/Salary.model');
const { ApiError } = require('../utils/api.utils');
const { buildSalaryExcel }      = require('../utils/excel.utils');
const { generateSalarySlipPDF } = require('../utils/pdf.utils');

router.post('/generate', authenticate, authorize('ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { month, year, employeeId } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year required.' });
    if (employeeId) {
      const result = await generateMonthlySalary(employeeId, parseInt(month), parseInt(year), req.user);
      res.status(200).json({ success: true, data: result });
    } else {
      const result = await generateAllSalaries(parseInt(month), parseInt(year), req.user);
      res.status(200).json({ success: true, data: result, message: `Generated for ${result.success.length} employees.` });
    }
  } catch (err) { next(err); }
});

router.get('/my', authenticate, async (req, res, next) => {
  try {
    const m = parseInt(req.query.month) || new Date().getMonth() + 1;
    const y = parseInt(req.query.year)  || new Date().getFullYear();
    const salary = await Salary.findOne({ employee: req.user._id, month: m, year: y }).populate('employee', 'name employeeId designation department');
    if (!salary) return next(new ApiError(404, 'Salary slip not found for this month.'));
    const safe = salary.toObject();
    delete safe.displayHalfDays;
    res.status(200).json({ success: true, data: safe });
  } catch (err) { next(err); }
});

router.get('/', authenticate, authorize('ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.month) filter.month = parseInt(req.query.month);
    if (req.query.year)  filter.year  = parseInt(req.query.year);
    if (req.query.empId) filter.employee = req.query.empId;
    const records = await Salary.find(filter).populate('employee', 'name employeeId department designation').sort({ year: -1, month: -1 });
    res.status(200).json({ success: true, data: records, count: records.length });
  } catch (err) { next(err); }
});

router.get('/:empId/:month/:year', authenticate, async (req, res, next) => {
  try {
    const { user } = req;
    const { empId, month, year } = req.params;
    if (user.role === 'EMPLOYEE' && user._id.toString() !== empId) return next(new ApiError(403, 'Access denied.'));
    const salary = await Salary.findOne({ employee: empId, month: parseInt(month), year: parseInt(year) }).populate('employee', 'name employeeId designation');
    if (!salary) return next(new ApiError(404, 'Salary slip not found.'));
    res.status(200).json({ success: true, data: salary });
  } catch (err) { next(err); }
});

router.patch('/:id/finalize', authenticate, authorize('ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const salary = await Salary.findByIdAndUpdate(req.params.id, { status: 'FINAL', finalizedBy: req.user._id, finalizedAt: new Date() }, { new: true });
    if (!salary) return next(new ApiError(404, 'Salary record not found.'));
    res.status(200).json({ success: true, data: salary, message: 'Salary finalized.' });
  } catch (err) { next(err); }
});

// Download monthly salary report as Excel
router.get('/export', authenticate, authorize('ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const filter = { month, year };
    if (req.query.empId) filter.employee = req.query.empId;
    const records = await Salary.find(filter)
      .populate('employee', 'name employeeId department designation')
      .sort({ year: -1, month: -1 });
    const wb = buildSalaryExcel(records, month, year);
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const filename = `Salary_Report_${MONTHS[month-1]}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// Manually add bonus or deduction to a DRAFT salary
router.patch('/:id/adjust', authenticate, authorize('ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { amount, note } = req.body;
    if (amount === undefined || amount === null || isNaN(Number(amount))) return next(new ApiError(400, 'amount is required (positive = bonus, negative = deduction).'));
    const salary = await Salary.findById(req.params.id);
    if (!salary) return next(new ApiError(404, 'Salary record not found.'));
    if (salary.status === 'FINAL') return next(new ApiError(400, 'Cannot adjust a finalized salary slip.'));
    const adj = parseFloat(amount);
    salary.manualAdjustment = (salary.manualAdjustment || 0) + adj;
    salary.adjustmentNote   = note || (adj >= 0 ? 'Manual bonus' : 'Manual deduction');
    salary.netSalary        = Math.max(0, salary.netSalary + adj);
    salary.adjustedBy       = req.user._id;
    salary.adjustedAt       = new Date();
    await salary.save();
    res.status(200).json({ success: true, data: salary, message: `Salary adjusted by ₹${adj > 0 ? '+' : ''}${adj}.` });
  } catch (err) { next(err); }
});

// Download individual salary slip as PDF
router.get('/:empId/:month/:year/pdf', authenticate, async (req, res, next) => {
  try {
    const { user } = req;
    const { empId, month, year } = req.params;
    const isAdmin = ['ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN', 'HR'].includes(user.role);
    if (!isAdmin && user._id.toString() !== empId) return next(new ApiError(403, 'Access denied.'));

    const salary = await Salary.findOne({ employee: empId, month: parseInt(month), year: parseInt(year) })
      .populate('employee', 'name employeeId designation department joiningDate');
    if (!salary) return next(new ApiError(404, 'Salary slip not found.'));

    const pdfBuffer = await generateSalarySlipPDF(salary);
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Salary_${salary.employee?.name?.replace(/\s+/g,'_')}_${MONTHS[parseInt(month)-1]}_${year}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

module.exports = router;
