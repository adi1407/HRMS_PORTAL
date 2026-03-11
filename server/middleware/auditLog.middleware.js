const { createAuditLog } = require('../utils/auditLog.utils');

const SKIP_PATHS = [
  '/api/health',
  '/api/auth/refresh',
  '/api/notifications/unread-count',
  '/api/notifications/my',
];

const ENTITY_MAP = {
  '/api/auth':            'Auth',
  '/api/users':           'User',
  '/api/attendance':      'Attendance',
  '/api/salary':          'Salary',
  '/api/leaves':          'Leave',
  '/api/branches':        'Branch',
  '/api/departments':     'Department',
  '/api/holidays':        'Holiday',
  '/api/resignations':    'Resignation',
  '/api/documents':       'Document',
  '/api/expense-claims':  'ExpenseClaim',
  '/api/daily-tasks':     'DailyTask',
  '/api/announcements':   'Announcement',
  '/api/tickets':         'Ticket',
  '/api/assets':          'Asset',
  '/api/onboarding':      'Onboarding',
  '/api/notifications':   'Notification',
  '/api/warnings':        'Warning',
  '/api/appraisals':      'Appraisal',
  '/api/salary-requests': 'SalaryRequest',
  '/api/analytics':       'Analytics',
  '/api/export':          'Export',
  '/api/face':            'Face',
};

const ACTION_MAP = {
  POST:   'CREATE',
  PATCH:  'UPDATE',
  PUT:    'UPDATE',
  DELETE: 'DELETE',
};

function deriveEntity(path) {
  for (const [prefix, entity] of Object.entries(ENTITY_MAP)) {
    if (path.startsWith(prefix)) return entity;
  }
  return 'System';
}

function deriveSeverity(method, statusCode) {
  if (statusCode >= 500) return 'ERROR';
  if (method === 'DELETE') return 'WARNING';
  if (statusCode >= 400) return 'WARNING';
  return 'INFO';
}

function auditLogMiddleware(req, res, next) {
  if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') return next();
  if (SKIP_PATHS.some(p => req.originalUrl.startsWith(p))) return next();

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const user = req.user;
    if (!user) return originalJson(body);

    const entity = deriveEntity(req.originalUrl);
    const action = ACTION_MAP[req.method] || req.method;
    const severity = deriveSeverity(req.method, res.statusCode);

    let description = `${action} ${entity}`;
    if (req.originalUrl.includes('/login'))  description = 'User logged in';
    if (req.originalUrl.includes('/logout')) description = 'User logged out';
    if (body?.message) description = body.message;

    createAuditLog({
      actor: user,
      actorName: user.name,
      actorRole: user.role,
      action,
      method: req.method,
      entity,
      description,
      severity,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
      path: req.originalUrl,
    });

    return originalJson(body);
  };

  next();
}

module.exports = { auditLogMiddleware };
