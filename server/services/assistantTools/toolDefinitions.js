const { HR_ROLES } = require('./execute');

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
];

function getToolsForRole(role) {
  const hr = HR_ROLES.has(role);
  return ALL_TOOLS.filter((t) => {
    const n = t.function.name;
    if (n.startsWith('hr_')) return hr;
    return true;
  });
}

module.exports = { getToolsForRole, ALL_TOOLS };
