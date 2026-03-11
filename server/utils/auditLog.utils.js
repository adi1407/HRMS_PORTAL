const AuditLog = require('../models/AuditLog.model');

const createAuditLog = async (opts) => {
  try {
    await AuditLog.create({
      actor:       opts.actor?._id || opts.actor,
      actorName:   opts.actor?.name || opts.actorName,
      actorRole:   opts.actor?.role || opts.actorRole,
      action:      opts.action,
      method:      opts.method || opts.req?.method || 'OTHER',
      entity:      opts.entity,
      entityId:    opts.entityId,
      description: opts.description,
      severity:    opts.severity || 'INFO',
      ip:          opts.ip || opts.req?.ip,
      userAgent:   opts.userAgent || opts.req?.headers?.['user-agent'],
      statusCode:  opts.statusCode,
      path:        opts.path || opts.req?.originalUrl,
    });
  } catch (err) {
    console.error('[AuditLog] Failed:', err.message);
  }
};

module.exports = { createAuditLog };
