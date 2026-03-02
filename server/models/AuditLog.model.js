const mongoose = require('mongoose');
const { Schema } = mongoose;

const AuditLogSchema = new Schema({
  actor:       { type: Schema.Types.ObjectId, ref: 'User' },
  actorName:   { type: String },
  action:      { type: String, required: true },
  entity:      { type: String },
  entityId:    { type: Schema.Types.ObjectId },
  description: { type: String },
  ip:          { type: String },
  severity:    { type: String, enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'], default: 'INFO' },
}, { timestamps: true });

AuditLogSchema.index({ createdAt: -1 });
module.exports = mongoose.model('AuditLog', AuditLogSchema);
