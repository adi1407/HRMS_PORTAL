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
const ExpenseClaim = require('../../models/ExpenseClaim.model');
const Ticket = require('../../models/Ticket.model');
const Onboarding = require('../../models/Onboarding.model');
const Notification = require('../../models/Notification.model');
const JobOpening = require('../../models/JobOpening.model');
const Application = require('../../models/Application.model');
const AuditLog = require('../../models/AuditLog.model');
const Salary = require('../../models/Salary.model');

const HR_ROLES = new Set(['HR', 'DIRECTOR', 'SUPER_ADMIN', 'ACCOUNTS']);
/** Same as audit log GET route: authorize('SUPER_ADMIN', 'DIRECTOR') */
const AUDIT_ROLES = new Set(['SUPER_ADMIN', 'DIRECTOR']);

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

    case 'my_expense_claims_summary': {
      const [pending, approved, rejected, total] = await Promise.all([
        ExpenseClaim.countDocuments({ employee: user._id, status: 'PENDING' }),
        ExpenseClaim.countDocuments({ employee: user._id, status: 'APPROVED' }),
        ExpenseClaim.countDocuments({ employee: user._id, status: 'REJECTED' }),
        ExpenseClaim.countDocuments({ employee: user._id }),
      ]);
      return {
        success: true,
        scope: 'self',
        counts: { pending, approved, rejected, total },
      };
    }

    case 'my_tickets_summary': {
      const [open, inProgress, resolved, closed] = await Promise.all([
        Ticket.countDocuments({ employee: user._id, status: 'OPEN' }),
        Ticket.countDocuments({ employee: user._id, status: 'IN_PROGRESS' }),
        Ticket.countDocuments({ employee: user._id, status: 'RESOLVED' }),
        Ticket.countDocuments({ employee: user._id, status: 'CLOSED' }),
      ]);
      const activeOpen = open + inProgress;
      const done = resolved + closed;
      return {
        success: true,
        scope: 'self',
        byStatus: { OPEN: open, IN_PROGRESS: inProgress, RESOLVED: resolved, CLOSED: closed },
        openVsClosed: { openOrInProgress: activeOpen, resolvedOrClosed: done, total: activeOpen + done },
      };
    }

    case 'my_onboarding_status': {
      const ob = await Onboarding.findOne({ employee: user._id }).lean();
      if (!ob) {
        return { success: true, scope: 'self', hasRecord: false, message: 'No onboarding checklist assigned yet.' };
      }
      const items = ob.checklist || [];
      const completedItems = items.filter((i) => i.isCompleted).length;
      const totalItems = items.length;
      const completionPercent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
      return {
        success: true,
        scope: 'self',
        hasRecord: true,
        status: ob.status,
        dueDate: ob.dueDate,
        completedItems,
        totalItems,
        completionPercent,
        notesPresent: !!(ob.notes && String(ob.notes).trim()),
      };
    }

    case 'my_notifications_unread_count': {
      const unread = await Notification.countDocuments({ recipient: user._id, isRead: false });
      return { success: true, scope: 'self', unreadCount: unread };
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

    case 'hr_pending_leaves_list': {
      if (!HR_ROLES.has(role)) return deny('This tool is only available for HR, Director, Accounts, or Super Admin.');
      let limit = args.limit != null ? parseInt(String(args.limit), 10) : 20;
      if (Number.isNaN(limit) || limit < 1) limit = 20;
      if (limit > 50) limit = 50;

      const pending = await Leave.find({ status: 'PENDING' })
        .populate('employee', 'name employeeId designation')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const totalPending = await Leave.countDocuments({ status: 'PENDING' });

      return {
        success: true,
        scope: 'organization',
        totalPending,
        returned: pending.length,
        items: pending.map((l) => ({
          employeeName: l.employee?.name,
          employeeId: l.employee?.employeeId,
          type: l.type,
          fromDate: l.fromDate,
          toDate: l.toDate,
          totalDays: l.totalDays,
          reasonPreview: l.reason ? String(l.reason).slice(0, 120) : '',
        })),
      };
    }

    case 'hr_recruitment_pipeline_summary': {
      if (!HR_ROLES.has(role)) return deny('This tool is only available for HR, Director, Accounts, or Super Admin.');

      const [jobByStatus, appByStatus] = await Promise.all([
        JobOpening.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ]);

      const jobs = {};
      jobByStatus.forEach((r) => {
        jobs[r._id || 'UNKNOWN'] = r.count;
      });
      const applications = {};
      appByStatus.forEach((r) => {
        applications[r._id || 'UNKNOWN'] = r.count;
      });

      return {
        success: true,
        scope: 'organization',
        jobOpeningsByStatus: jobs,
        applicationsByStatus: applications,
      };
    }

    case 'hr_daily_task_org_summary': {
      if (!HR_ROLES.has(role)) return deny('This tool is only available for HR, Director, Accounts, or Super Admin.');
      const now = new Date();
      let month = args.month != null ? parseInt(String(args.month), 10) : now.getMonth() + 1;
      let year = args.year != null ? parseInt(String(args.year), 10) : now.getFullYear();
      if (Number.isNaN(month) || month < 1 || month > 12) month = now.getMonth() + 1;
      if (Number.isNaN(year)) year = now.getFullYear();

      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 0, 23, 59, 59, 999);

      const [totalDayEntries, distinctEmployees, taskAgg] = await Promise.all([
        DailyTask.countDocuments({ date: { $gte: from, $lte: to } }),
        DailyTask.distinct('employee', { date: { $gte: from, $lte: to } }),
        DailyTask.aggregate([
          { $match: { date: { $gte: from, $lte: to } } },
          { $unwind: '$tasks' },
          { $group: { _id: '$tasks.status', count: { $sum: 1 } } },
        ]),
      ]);

      const taskLinesByStatus = {};
      taskAgg.forEach((r) => {
        taskLinesByStatus[r._id || 'UNKNOWN'] = r.count;
      });

      return {
        success: true,
        scope: 'organization',
        month,
        year,
        totalDailyTaskSubmissions: totalDayEntries,
        employeesWithAtLeastOneSubmission: distinctEmployees.length,
        taskLinesByStatus,
      };
    }

    case 'admin_audit_recent_summary': {
      if (!AUDIT_ROLES.has(role)) return deny('This tool is only available for Director or Super Admin.');
      const now = new Date();
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [byAction24h, byAction7d, total24h, total7d] = await Promise.all([
        AuditLog.aggregate([
          { $match: { createdAt: { $gte: since24h } } },
          { $group: { _id: '$action', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        AuditLog.aggregate([
          { $match: { createdAt: { $gte: since7d } } },
          { $group: { _id: '$action', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        AuditLog.countDocuments({ createdAt: { $gte: since24h } }),
        AuditLog.countDocuments({ createdAt: { $gte: since7d } }),
      ]);

      const mapAgg = (rows) => {
        const o = {};
        rows.forEach((r) => {
          o[r._id || 'UNKNOWN'] = r.count;
        });
        return o;
      };

      return {
        success: true,
        scope: 'audit',
        last24h: { totalEntries: total24h, countsByAction: mapAgg(byAction24h) },
        last7days: { totalEntries: total7d, countsByAction: mapAgg(byAction7d) },
      };
    }

    case 'accounts_salary_month_status': {
      if (role !== 'ACCOUNTS') return deny('This tool is only available for Accounts.');
      const now = new Date();
      let month = args.month != null ? parseInt(String(args.month), 10) : now.getMonth() + 1;
      let year = args.year != null ? parseInt(String(args.year), 10) : now.getFullYear();
      if (Number.isNaN(month) || month < 1 || month > 12) month = now.getMonth() + 1;
      if (Number.isNaN(year) || year < 2000 || year > 2100) year = now.getFullYear();

      const byStatus = await Salary.aggregate([
        { $match: { month, year } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
      const counts = { DRAFT: 0, FINAL: 0 };
      let totalSlips = 0;
      byStatus.forEach((r) => {
        const k = r._id;
        if (k === 'DRAFT' || k === 'FINAL') counts[k] = r.count;
        totalSlips += r.count;
      });

      return {
        success: true,
        scope: 'organization',
        month,
        year,
        salarySlipCountsByStatus: counts,
        totalSalaryRecords: totalSlips,
        note: 'Counts only; no salary amounts are included.',
      };
    }

    default:
      return deny(`Unknown tool: ${toolName}`);
  }
}

module.exports = { executeTool, HR_ROLES, AUDIT_ROLES };
