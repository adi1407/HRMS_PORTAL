const AuditLog = require('../models/AuditLog.model');

const createAuditLog = async (opts) => {
  try {
    await AuditLog.create({
      actor:       opts.actor?._id || opts.actor,
      actorName:   opts.actor?.name,
      action:      opts.action,
      entity:      opts.entity,
      entityId:    opts.entityId,
      description: opts.description,
      severity:    opts.severity || 'INFO',
      ip:          opts.req?.ip,
      userAgent:   opts.req?.headers?.['user-agent'],
    });
  } catch (err) {
    console.error('[AuditLog] Failed:', err.message);
  }
};

module.exports = { createAuditLog };
