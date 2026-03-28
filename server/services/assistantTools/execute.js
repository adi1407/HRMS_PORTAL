/**
 * Role-scoped tool implementations for the HRMS assistant.
 * All queries run server-side; the LLM never touches the database directly.
 */
const Attendance = require('../../models/Attendance.model');
const Leave = require('../../models/Leave.model');
const User = require('../../models/User.model');
const Holiday = require('../../models/Holiday.model');
const DailyTask = require('../../models/DailyTask.model');
const EmployeeProfile = require('../../models/EmployeeProfile.model');

const HR_ROLES = new Set(['HR', 'DIRECTOR', 'SUPER_ADMIN', 'ACCOUNTS']);

function istToday() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  d.setHours(0, 0, 0, 0);
  return d;
}

function deny(msg) {
  return { success: false, error: msg };
}

async function fetchOrgAttendanceDashboard() {
  const todayStart = istToday();
  const next30 = new Date(todayStart.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [totalEmployees, todayRecords, roleAgg, upcomingHolidays, isSunday, todayHoliday, expectedEmployeeIds] = await Promise.all([
    User.countDocuments({ role: { $nin: ['SUPER_ADMIN'] }, isActive: true }),
    Attendance.find({ date: todayStart }).populate('employee', '_id'),
    User.aggregate([
      { $match: { isActive: true, role: { $ne: 'SUPER_ADMIN' } } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    Holiday.find({ date: { $gte: todayStart, $lte: next30 } }).sort({ date: 1 }).limit(5).lean(),
    Promise.resolve(todayStart.getDay() === 0),
    Holiday.findOne({ date: todayStart }).then((h) => !!h),
    User.find({ role: { $in: ['EMPLOYEE', 'HR', 'ACCOUNTS'] }, isActive: true }).select('_id').lean(),
  ]);

  const summary = { totalEmployees, presentToday: 0, halfDayToday: 0, absentToday: 0, onLeaveToday: 0 };
  todayRecords.forEach((r) => {
    if (r.displayStatus === 'FULL_DAY') summary.presentToday++;
    else if (r.displayStatus === 'HALF_DAY') summary.halfDayToday++;
    else if (r.displayStatus === 'ABSENT') summary.absentToday++;
    else if (r.displayStatus === 'ON_LEAVE') summary.onLeaveToday++;
  });

  const workingToday = !isSunday && !todayHoliday;
  if (workingToday && expectedEmployeeIds.length > 0) {
    const hasRecord = new Set(todayRecords.map((r) => (r.employee?._id || r.employee)?.toString()).filter(Boolean));
    const absentNoRecord = expectedEmployeeIds.filter((e) => !hasRecord.has(e._id.toString())).length;
    summary.absentToday += absentNoRecord;
  }

  summary.notMarkedYet = Math.max(0, totalEmployees - todayRecords.length);

  const roleBreakdown = {};
  roleAgg.forEach((r) => {
    roleBreakdown[r._id] = r.count;
  });

  return {
    success: true,
    dateIST: todayStart.toISOString().slice(0, 10),
    isSunday,
    isPublicHolidayToday: todayHoliday,
    summary,
    roleBreakdown,
    upcomingHolidays: upcomingHolidays.map((h) => ({ name: h.name, date: h.date })),
  };
}

/**
 * @param {import('mongoose').Document} user - req.user
 * @param {string} toolName
 * @param {Record<string, unknown>} args
 */
async function executeTool(user, toolName, args) {
  const role = user.role;

  switch (toolName) {
    case 'my_leave_summary': {
      const now = new Date();
      let month = args.month != null ? parseInt(String(args.month), 10) : now.getMonth() + 1;
      let year = args.year != null ? parseInt(String(args.year), 10) : now.getFullYear();
      if (Number.isNaN(month) || month < 1 || month > 12) month = now.getMonth() + 1;
      if (Number.isNaN(year) || year < 2000 || year > 2100) year = now.getFullYear();

      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 0, 23, 59, 59, 999);

      const leaves = await Leave.find({
        employee: user._id,
        fromDate: { $lte: to },
        toDate: { $gte: from },
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const pending = leaves.filter((l) => l.status === 'PENDING').length;
      const approved = leaves.filter((l) => l.status === 'APPROVED').length;
      const rejected = leaves.filter((l) => l.status === 'REJECTED').length;
      const totalDaysApproved = leaves.filter((l) => l.status === 'APPROVED').reduce((s, l) => s + (l.totalDays || 0), 0);

      return {
        success: true,
        scope: 'self',
        month,
        year,
        counts: { pending, approved, rejected, totalDaysApproved },
        recentLeaves: leaves.slice(0, 10).map((l) => ({
          type: l.type,
          status: l.status,
          fromDate: l.fromDate,
          toDate: l.toDate,
          totalDays: l.totalDays,
        })),
      };
    }

    case 'my_attendance_recent': {
      let days = args.days != null ? parseInt(String(args.days), 10) : 14;
      if (Number.isNaN(days) || days < 1) days = 14;
      if (days > 31) days = 31;

      const records = await Attendance.find({ employee: user._id })
        .sort({ date: -1 })
        .limit(days)
        .lean();

      return {
        success: true,
        scope: 'self',
        days,
        records: records.map((r) => ({
          date: r.date,
          displayStatus: r.displayStatus,
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
        })),
      };
    }

    case 'my_daily_tasks_summary': {
      const now = new Date();
      let month = args.month != null ? parseInt(String(args.month), 10) : now.getMonth() + 1;
      let year = args.year != null ? parseInt(String(args.year), 10) : now.getFullYear();
      if (Number.isNaN(month) || month < 1 || month > 12) month = now.getMonth() + 1;
      if (Number.isNaN(year)) year = now.getFullYear();

      const m = month - 1;
      const filter = {
        employee: user._id,
        date: { $gte: new Date(year, m, 1), $lt: new Date(year, m + 1, 1) },
      };

      const entries = await DailyTask.find(filter).sort({ date: -1 }).lean();
      let completed = 0;
      let inProgress = 0;
      let blocked = 0;
      entries.forEach((e) => {
        (e.tasks || []).forEach((t) => {
          if (t.status === 'COMPLETED') completed++;
          else if (t.status === 'IN_PROGRESS') inProgress++;
          else if (t.status === 'BLOCKED') blocked++;
        });
      });

      return {
        success: true,
        scope: 'self',
        month,
        year,
        daysSubmitted: entries.length,
        taskLineCounts: { completed, inProgress, blocked },
      };
    }

    case 'my_profile_completion': {
      let profile = await EmployeeProfile.findOne({ employee: user._id });
      if (!profile) {
        profile = await EmployeeProfile.create({ employee: user._id });
      }
      const json = profile.toJSON();
      return {
        success: true,
        scope: 'self',
        completionPercent: json.completionPercent ?? 0,
        profileCompleted: json.profileCompleted ?? false,
      };
    }

    case 'hr_org_attendance_dashboard': {
      if (!HR_ROLES.has(role)) return deny('This tool is only available for HR, Director, Accounts, or Super Admin.');
      return fetchOrgAttendanceDashboard();
    }

    case 'hr_leave_month_overview': {
      if (!HR_ROLES.has(role)) return deny('This tool is only available for HR, Director, Accounts, or Super Admin.');
      const now = new Date();
      let month = args.month != null ? parseInt(String(args.month), 10) : now.getMonth() + 1;
      let year = args.year != null ? parseInt(String(args.year), 10) : now.getFullYear();
      if (Number.isNaN(month) || month < 1 || month > 12) month = now.getMonth() + 1;
      if (Number.isNaN(year)) year = now.getFullYear();

      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 0, 23, 59, 59, 999);

      const leaves = await Leave.find({
        fromDate: { $lte: to },
        toDate: { $gte: from },
      })
        .populate('employee', 'name employeeId')
        .lean();

      const byStatus = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
      leaves.forEach((l) => {
        if (byStatus[l.status] != null) byStatus[l.status]++;
      });

      return {
        success: true,
        scope: 'organization',
        month,
        year,
        totalLeaveRecordsTouchingMonth: leaves.length,
        byStatus,
        sample: leaves.slice(0, 15).map((l) => ({
          employeeName: l.employee?.name,
          employeeId: l.employee?.employeeId,
          type: l.type,
          status: l.status,
          fromDate: l.fromDate,
          toDate: l.toDate,
          totalDays: l.totalDays,
        })),
      };
    }

    default:
      return deny(`Unknown tool: ${toolName}`);
  }
}

module.exports = { executeTool, HR_ROLES };
