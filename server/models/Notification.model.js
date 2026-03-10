const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'LEAVE_APPROVED', 'LEAVE_REJECTED', 'LEAVE_REQUEST',
      'TICKET_UPDATE', 'TICKET_ASSIGNED', 'TICKET_NEW',
      'ANNOUNCEMENT',
      'ONBOARDING_ASSIGNED', 'ONBOARDING_COMPLETE',
      'ASSET_ASSIGNED', 'ASSET_RETURNED',
      'WARNING_ISSUED',
      'EXPENSE_APPROVED', 'EXPENSE_REJECTED',
      'RESIGNATION_UPDATE',
      'SALARY_UPDATE',
      'GENERAL',
    ],
    default: 'GENERAL',
  },
  title:   { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  link:    { type: String, trim: true, default: '' },
  isRead:  { type: Boolean, default: false },
  readAt:  { type: Date },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
