/**
 * Local HRMS assistant — no OpenAI / external LLM.
 * Routes the user's last message to role-scoped tools and formats JSON into plain text.
 */
const { ApiError } = require('../utils/api.utils');
const { getToolsForRole } = require('./assistantTools/toolDefinitions');
const { executeTool } = require('./assistantTools/execute');

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function isAiConfigured() {
  return true;
}

function resolveModel() {
  return 'local-rules';
}

function getClient() {
  return null;
}

function parseMonthYear(text) {
  const now = new Date();
  let month = now.getMonth() + 1;
  let year = now.getFullYear();
  const lower = text.toLowerCase();

  const ym = lower.match(/\b(20\d{2})\b/);
  if (ym) year = parseInt(ym[1], 10);

  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (lower.includes(MONTH_NAMES[i])) {
      month = i + 1;
      break;
    }
  }
  const numM = lower.match(/\b(1[0-2]|[1-9])\s*\/\s*(20\d{2})\b/);
  if (numM) {
    month = parseInt(numM[1], 10);
    year = parseInt(numM[2], 10);
  }

  return { month, year };
}

function allowedToolNames(role) {
  return new Set(getToolsForRole(role).map((t) => t.function.name));
}

/**
 * Pick one tool + args from free text. Capability = HRMS tools only.
 * @returns {{ name: string, args: object } | null}
 */
function matchIntent(text, role) {
  const q = (text || '').toLowerCase().trim();
  if (!q) return null;

  const allowed = allowedToolNames(role);
  const { month, year } = parseMonthYear(q);
  const can = (name) => allowed.has(name);

  const pick = (name, args = {}) => (can(name) ? { name, args } : null);

  if (/\b(help|what can you|capabilities|commands)\b/.test(q)) {
    return { name: '__help__', args: {} };
  }

  if (/\b(pending\s+leave|leave\s+request|approve\s+leave)\b/.test(q) && can('hr_pending_leaves_list')) {
    return pick('hr_pending_leaves_list', { limit: 20 });
  }
  if (/\b(org|organization|company|team|today).*(leave)|leave.*(overview|month|org)\b/.test(q) && can('hr_leave_month_overview')) {
    return pick('hr_leave_month_overview', { month, year });
  }
  if (/\b(my\s+)?(leave|pto|vacation|time\s*off|cl|sl)\b/.test(q) && can('my_leave_summary')) {
    return pick('my_leave_summary', { month, year });
  }

  if (/\b(present|absent|half\s*day|attendance\s+dashboard|who\s+is\s+in|org.*attendance|attendance.*today)\b/.test(q)
    && can('hr_org_attendance_dashboard')) {
    return pick('hr_org_attendance_dashboard', {});
  }
  if (/\b(my\s+)?attendance|check[- ]?in|check[- ]?out|punch\b/.test(q) && can('my_attendance_recent')) {
    const daysMatch = q.match(/\b(\d{1,2})\s*days?\b/);
    const days = daysMatch ? Math.min(31, Math.max(1, parseInt(daysMatch[1], 10))) : 14;
    return pick('my_attendance_recent', { days });
  }

  if (/\b(org|organization|company).*(task)|task.*(org|organization|company|submission)\b/.test(q)
    && can('hr_daily_task_org_summary')) {
    return pick('hr_daily_task_org_summary', { month, year });
  }
  if (/\b(daily\s*task|my\s+task|task\s+update|tasks?\s+summary)\b/.test(q) && can('my_daily_tasks_summary')) {
    return pick('my_daily_tasks_summary', { month, year });
  }

  if (/\b(profile|completion)\b/.test(q) && can('my_profile_completion')) {
    return pick('my_profile_completion', {});
  }
  if (/\b(expense|reimbursement|claim)\b/.test(q) && can('my_expense_claims_summary')) {
    return pick('my_expense_claims_summary', {});
  }
  if (/\b(ticket|help\s*desk|support\s+request)\b/.test(q) && can('my_tickets_summary')) {
    return pick('my_tickets_summary', {});
  }
  if (/\b(onboarding|checklist)\b/.test(q) && can('my_onboarding_status')) {
    return pick('my_onboarding_status', {});
  }
  if (/\b(notification|unread)\b/.test(q) && can('my_notifications_unread_count')) {
    return pick('my_notifications_unread_count', {});
  }

  if (/\b(org|organization|company).*(feedback)|feedback.*(org|organization|90)\b/.test(q)
    && can('hr_feedback_org_summary')) {
    return pick('hr_feedback_org_summary', {});
  }
  if (/\b(feedback|rating|weekly\s+feedback)\b/.test(q) && can('my_feedback_received_summary')) {
    return pick('my_feedback_received_summary', {});
  }

  if (/\b(recruit|hiring|ats|job\s+opening|application|pipeline)\b/.test(q) && can('hr_recruitment_pipeline_summary')) {
    return pick('hr_recruitment_pipeline_summary', {});
  }
  if (/\b(audit)\b/.test(q) && can('admin_audit_recent_summary')) {
    return pick('admin_audit_recent_summary', {});
  }
  if (/\b(salary|payslip|payroll|draft|final)\b/.test(q) && can('accounts_salary_month_status')) {
    return pick('accounts_salary_month_status', { month, year });
  }

  return null;
}

function helpText(role) {
  const names = [...allowedToolNames(role)];
  const lines = [
    'I am the local HRMS assistant (no API key). I only answer from HRMS data tools:',
    ...names.map((n) => `• ${n.replace(/_/g, ' ')}`),
    '',
    'Try: “my leave this month”, “my attendance”, “present today” (HR), “pending leaves”, “profile completion”.',
  ];
  return lines.join('\n');
}

function fmtCounts(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return Object.entries(obj)
    .map(([k, v]) => `• ${k}: ${v}`)
    .join('\n');
}

function formatToolResult(toolName, data) {
  if (!data) return 'No data returned.';
  if (data.success === false) return data.error || 'Request failed.';

  switch (toolName) {
    case 'my_leave_summary': {
      const c = data.counts || {};
      const lines = [
        `Your leave for ${data.month}/${data.year}:`,
        `• Pending: ${c.pending ?? 0}`,
        `• Approved: ${c.approved ?? 0}`,
        `• Rejected: ${c.rejected ?? 0}`,
        `• Approved days (total): ${c.totalDaysApproved ?? 0}`,
      ];
      if (Array.isArray(data.recentLeaves) && data.recentLeaves.length) {
        lines.push('', 'Recent:');
        data.recentLeaves.slice(0, 5).forEach((l) => {
          lines.push(`• ${l.type || 'LEAVE'} ${l.status} (${l.totalDays || '?'}d)`);
        });
      }
      return lines.join('\n');
    }
    case 'my_attendance_recent': {
      const rows = data.records || [];
      if (!rows.length) return 'No recent attendance records.';
      const lines = [`Your recent attendance (last ${data.days || rows.length} days):`];
      rows.slice(0, 14).forEach((r) => {
        const d = r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—';
        lines.push(
          `• ${d}: ${r.displayStatus || '—'}${r.checkInTime ? ` in ${r.checkInTime}` : ''}${r.checkOutTime ? ` out ${r.checkOutTime}` : ''}`
        );
      });
      return lines.join('\n');
    }
    case 'my_daily_tasks_summary': {
      return [
        `Daily tasks ${data.month}/${data.year}:`,
        `• Days with submissions: ${data.daysSubmitted ?? '—'}`,
        data.taskLineCounts ? fmtCounts(data.taskLineCounts) : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'my_profile_completion': {
      return `Profile completion: ${data.completionPercent ?? 0}%${data.profileCompleted ? ' (marked complete)' : ''}.`;
    }
    case 'my_expense_claims_summary': {
      return `Expense claims by status:\n${fmtCounts(data.counts || {})}`;
    }
    case 'my_tickets_summary': {
      const lines = [`Help desk tickets:\n${fmtCounts(data.byStatus || {})}`];
      if (data.openVsClosed) {
        lines.push(
          `Open/in progress: ${data.openVsClosed.openOrInProgress ?? 0}; resolved/closed: ${data.openVsClosed.resolvedOrClosed ?? 0}.`
        );
      }
      return lines.join('\n');
    }
    case 'my_onboarding_status': {
      if (data.hasRecord === false) return data.message || 'No onboarding checklist assigned yet.';
      return `Onboarding: ${data.status || '—'}, ${data.completionPercent ?? 0}% (${data.completedItems ?? 0}/${data.totalItems ?? 0} items)${data.dueDate ? `, due ${new Date(data.dueDate).toLocaleDateString('en-IN')}` : ''}.`;
    }
    case 'my_notifications_unread_count': {
      return `Unread notifications: ${data.unreadCount ?? 0}.`;
    }
    case 'my_feedback_received_summary': {
      return `Weekly feedback received (last ~8 weeks): count ${data.ratingsReceivedInLast8Weeks ?? 0}, average ${data.averageScore ?? '—'}. Anonymous — no rater names.`;
    }
    case 'hr_org_attendance_dashboard': {
      const s = data.summary || {};
      const lines = [
        `Attendance today (${data.dateIST || 'IST'}):`,
        `• Present: ${s.presentToday ?? 0}`,
        `• Half day: ${s.halfDayToday ?? 0}`,
        `• Absent: ${s.absentToday ?? 0}`,
        `• On leave: ${s.onLeaveToday ?? 0}`,
        `• Total staff (ex. Super Admin): ${s.totalEmployees ?? '—'}`,
        `• Not marked yet: ${s.notMarkedYet ?? '—'}`,
      ];
      if (data.isSunday) lines.push('• Today is Sunday (weekly off).');
      if (data.isPublicHolidayToday) lines.push('• Today is a public holiday.');
      return lines.join('\n');
    }
    case 'hr_leave_month_overview': {
      const lines = [
        `Org leave ${data.month}/${data.year}: ${data.totalLeaveRecordsTouchingMonth ?? 0} records`,
        fmtCounts(data.byStatus || {}),
      ];
      return lines.filter(Boolean).join('\n');
    }
    case 'hr_pending_leaves_list': {
      const list = data.items || [];
      if (!list.length) return 'No pending leave requests.';
      const lines = [`Pending leave requests (${data.totalPending ?? list.length} total):`];
      list.slice(0, 20).forEach((l) => {
        const name = l.employeeName || 'Employee';
        const id = l.employeeId || '';
        lines.push(
          `• ${name}${id ? ` (${id})` : ''}: ${l.type || ''} ${l.fromDate ? new Date(l.fromDate).toLocaleDateString('en-IN') : ''} → ${l.toDate ? new Date(l.toDate).toLocaleDateString('en-IN') : ''}`
        );
      });
      return lines.join('\n');
    }
    case 'hr_recruitment_pipeline_summary': {
      return [
        'Recruitment pipeline:',
        'Openings:',
        fmtCounts(data.jobOpeningsByStatus || {}),
        'Applications:',
        fmtCounts(data.applicationsByStatus || {}),
      ].join('\n');
    }
    case 'hr_daily_task_org_summary': {
      return [
        `Org daily tasks ${data.month}/${data.year}:`,
        `• Day submissions: ${data.totalDailyTaskSubmissions ?? '—'}`,
        `• Employees with ≥1 submission: ${data.employeesWithAtLeastOneSubmission ?? '—'}`,
        data.taskLinesByStatus ? fmtCounts(data.taskLinesByStatus) : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'hr_feedback_org_summary': {
      return [
        `Org weekly feedback (~90 days): count ${data.ratingsInLast90Days ?? 0}, average ${data.averageScore ?? '—'}.`,
        data.countByDirection ? fmtCounts(data.countByDirection) : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'admin_audit_recent_summary': {
      return [
        'Audit activity:',
        `Last 24h: ${data.last24h?.totalEntries ?? 0} entries`,
        fmtCounts(data.last24h?.countsByAction || {}),
        `Last 7 days: ${data.last7days?.totalEntries ?? 0} entries`,
        fmtCounts(data.last7days?.countsByAction || {}),
      ].join('\n');
    }
    case 'accounts_salary_month_status': {
      return [
        `Salary slips ${data.month}/${data.year} (counts only, no amounts):`,
        fmtCounts(data.salarySlipCountsByStatus || {}),
        `Total records: ${data.totalSalaryRecords ?? 0}`,
      ].join('\n');
    }
    default:
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2).slice(0, 1500);
  }
}

/**
 * @param {import('mongoose').Document} user
 * @param {{ role: string; content: string }[]} messages
 */
async function runAssistantChat(user, messages) {
  const filtered = (messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-24);

  const lastUser = [...filtered].reverse().find((m) => m.role === 'user');
  if (!lastUser?.content?.trim()) {
    throw new ApiError(400, 'Send at least one user message.');
  }

  const text = lastUser.content.trim();
  const intent = matchIntent(text, user.role);

  if (!intent) {
    return {
      message: [
        'I could not map that to an HRMS tool.',
        helpText(user.role),
      ].join('\n\n'),
      role: 'assistant',
      model: resolveModel(),
      usage: null,
      toolsUsed: [],
      provider: 'local',
    };
  }

  if (intent.name === '__help__') {
    return {
      message: helpText(user.role),
      role: 'assistant',
      model: resolveModel(),
      usage: null,
      toolsUsed: [],
      provider: 'local',
    };
  }

  const result = await executeTool(user, intent.name, intent.args || {});
  const message = formatToolResult(intent.name, result);

  return {
    message,
    role: 'assistant',
    model: resolveModel(),
    usage: null,
    toolsUsed: [intent.name],
    provider: 'local',
  };
}

module.exports = { runAssistantChat, getClient, isAiConfigured, resolveModel };
