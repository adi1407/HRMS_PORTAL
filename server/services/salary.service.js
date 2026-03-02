const User       = require('../models/User.model');
const Attendance = require('../models/Attendance.model');
const Salary     = require('../models/Salary.model');
const { createAuditLog } = require('../utils/auditLog.utils');
const { ApiError }       = require('../utils/api.utils');

const generateMonthlySalary = async (employeeId, month, year, generatedBy) => {
  const employee = await User.findById(employeeId);
  if (!employee) throw new ApiError(404, 'Employee not found.');
  if (!employee.grossSalary || employee.grossSalary <= 0) {
    throw new ApiError(400, `Gross salary not set for ${employee.name}.`);
  }

  const daysInMonth  = new Date(year, month, 0).getDate();
  const perDaySalary = parseFloat((employee.grossSalary / daysInMonth).toFixed(4));

  let fullDays = 0, realHalfDays = 0, displayHalfDays = 0, absentDays = 0, paidLeaves = 0, unpaidLeaves = 0, holidays = 0, weeklyOffs = 0;
  let deductionDays = 0, deductionAmount = 0, netSalary = 0;

  // Director role OR explicitly flagged Managing Head: full salary, no deduction, no attendance required
  if (employee.role === 'DIRECTOR' || employee.isManagingHead) {
    fullDays      = daysInMonth;
    deductionDays = 0;
    deductionAmount = 0;
    netSalary     = employee.grossSalary;
  } else {
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month - 1, daysInMonth, 23, 59, 59);
    const records = await Attendance.find({ employee: employeeId, date: { $gte: from, $lte: to } });

    records.forEach(r => {
      switch (r.status) {
        case 'FULL_DAY':         fullDays++;         break;
        case 'HALF_DAY_DISPLAY': displayHalfDays++;  break;
        case 'HALF_DAY':         realHalfDays++;     break;
        case 'ABSENT':           absentDays++;       break;
        case 'HOLIDAY':          holidays++;         break;
        case 'WEEKLY_OFF':       weeklyOffs++;       break;
        case 'ON_LEAVE': r.isPaidLeave ? paidLeaves++ : unpaidLeaves++; break;
      }
    });

    deductionDays   = parseFloat(((realHalfDays * 0.5) + absentDays + unpaidLeaves).toFixed(2));
    deductionAmount = parseFloat((deductionDays * perDaySalary).toFixed(2));
    netSalary       = parseFloat((employee.grossSalary - deductionAmount).toFixed(2));
  }

  const salaryRecord = await Salary.findOneAndUpdate(
    { employee: employeeId, month, year },
    { grossSalary: employee.grossSalary, daysInMonth, perDaySalary, fullDays, realHalfDays, displayHalfDays, absentDays, paidLeaves, unpaidLeaves, holidays, weeklyOffs, deductionDays, deductionAmount, netSalary, hasDeduction: deductionAmount > 0, generatedBy: generatedBy._id, generatedAt: new Date() },
    { new: true, upsert: true }
  );

  await createAuditLog({ actor: generatedBy, action: 'SALARY_GENERATED', entity: 'Salary', entityId: salaryRecord._id, description: `Salary for ${employee.name} ${month}/${year}. Net: ₹${netSalary}` });
  return salaryRecord;
};

const generateAllSalaries = async (month, year, generatedBy) => {
  // Include all roles that need salary slips: EMPLOYEE, ACCOUNTS, HR, DIRECTOR (Manager Head)
  const employees = await User.find({ role: { $in: ['EMPLOYEE', 'ACCOUNTS', 'HR', 'DIRECTOR'] }, isActive: true });
  const results = { success: [], failed: [] };
  for (const emp of employees) {
    try {
      await generateMonthlySalary(emp._id, month, year, generatedBy);
      results.success.push(emp.name);
    } catch (err) {
      results.failed.push({ name: emp.name, reason: err.message });
    }
  }
  return results;
};

module.exports = { generateMonthlySalary, generateAllSalaries };
