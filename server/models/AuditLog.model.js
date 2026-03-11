const mongoose = require('mongoose');
const { Schema } = mongoose;

const AuditLogSchema = new Schema({
  actor:       { type: Schema.Types.ObjectId, ref: 'User' },
  actorName:   { type: String },
  actorRole:   { type: String },
  action:      { type: String, required: true },
  method:      { type: String, enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OTHER'], default: 'OTHER' },
  entity:      { type: String },
  entityId:    { type: Schema.Types.ObjectId },
  description: { type: String },
  ip:          { type: String },
  userAgent:   { type: String },
  statusCode:  { type: Number },
  path:        { type: String },
  severity:    { type: String, enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'], default: 'INFO' },
}, { timestamps: true });

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ entity: 1 });
AuditLogSchema.index({ severity: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
