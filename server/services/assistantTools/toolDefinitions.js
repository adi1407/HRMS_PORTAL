const { HR_ROLES, AUDIT_ROLES } = require('./execute');

const ALL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'my_leave_summary',
      description:
        'Get the logged-in employee\'s leave applications for a calendar month: counts by status and recent items. Use when asked about my leaves, PTO, vacation, approvals.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'integer', description: 'Month 1-12 (default: current month)' },
          year: { type: 'integer', description: 'Year e.g. 2026 (default: current year)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_attendance_recent',
      description:
        'Get the logged-in employee\'s recent attendance rows (display status, check-in/out). Use for personal attendance history.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'How many recent days to fetch (1-31, default 14)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_daily_tasks_summary',
      description:
        'Summarize daily task submissions for the employee in a month: how many days submitted and task status counts.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'integer', description: 'Month 1-12' },
          year: { type: 'integer', description: 'Year' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_profile_completion',
      description:
        'Get HR profile completion percentage and whether the extended profile is marked complete.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_expense_claims_summary',
      description:
        'Count the employee\'s expense claims by status (pending, approved, rejected). No amounts.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_tickets_summary',
      description:
        'Summarize help desk tickets raised by the employee: counts by status and open vs closed.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_onboarding_status',
      description:
        'Read-only onboarding checklist progress for the logged-in employee (completion %, status, due date).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'my_notifications_unread_count',
      description: 'How many unread in-app notifications the user has.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hr_org_attendance_dashboard',
      description:
        'Organization-wide attendance snapshot for today (IST): present, absent, on leave, half day, total employees, role breakdown, upcoming holidays. HR/Director/Accounts/Super Admin only.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hr_leave_month_overview',
      description:
        'Organization-wide leave records overlapping a month: counts by status and a sample list. HR/Director/Accounts/Super Admin only.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'integer', description: 'Month 1-12' },
          year: { type: 'integer', description: 'Year' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hr_pending_leaves_list',
      description:
        'List pending leave requests (newest first) with employee name/id and dates. HR/Director/Accounts/Super Admin only.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Max rows to return (1-50, default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hr_recruitment_pipeline_summary',
      description:
        'ATS-style counts: job openings by status and job applications by status. No salary amounts.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'hr_daily_task_org_summary',
      description:
        'Organization-wide daily task submissions for a month: how many day-entries, how many distinct employees, task line counts by status.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'integer', description: 'Month 1-12' },
          year: { type: 'integer', description: 'Year' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'admin_audit_recent_summary',
      description:
        'Audit log entry counts in the last 24 hours and last 7 days, grouped by action. Director or Super Admin only.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'accounts_salary_month_status',
      description:
        'For a payroll month/year: counts of salary slips by status (DRAFT vs FINAL) only — no employee amounts. Accounts role only.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'integer', description: 'Month 1-12' },
          year: { type: 'integer', description: 'Year' },
        },
      },
    },
  },
];

function getToolsForRole(role) {
  const hr = HR_ROLES.has(role);
  const audit = AUDIT_ROLES.has(role);
  const accounts = role === 'ACCOUNTS';

  return ALL_TOOLS.filter((t) => {
    const n = t.function.name;
    if (n.startsWith('hr_')) return hr;
    if (n.startsWith('admin_')) return audit;
    if (n.startsWith('accounts_')) return accounts;
    return true;
  });
}

module.exports = { getToolsForRole, ALL_TOOLS };
