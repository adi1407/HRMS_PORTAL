const mongoose = require('mongoose');

const emailAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['BIRTHDAY', 'WORK_ANNIVERSARY', 'PROBATION_REMINDER', 'LEAVE_BALANCE', 'SLA_BREACH'],
    required: true,
  },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipientName:  { type: String },
  recipientEmail: { type: String },
  subject:     { type: String },
  status:      { type: String, enum: ['SENT', 'FAILED', 'SKIPPED'], default: 'SENT' },
  error:       { type: String },
  metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

emailAlertSchema.index({ type: 1, createdAt: -1 });
emailAlertSchema.index({ createdAt: -1 });
emailAlertSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('EmailAlert', emailAlertSchema);
