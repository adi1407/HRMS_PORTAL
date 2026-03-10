const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
  warningId: { type: String, unique: true },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['VERBAL', 'WRITTEN', 'FINAL_WRITTEN', 'SUSPENSION', 'TERMINATION'],
    required: true,
  },
  category: {
    type: String,
    enum: ['ATTENDANCE', 'PERFORMANCE', 'CONDUCT', 'POLICY_VIOLATION', 'INSUBORDINATION', 'OTHER'],
    required: true,
  },
  subject:     { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  actionRequired: { type: String, trim: true, maxlength: 1000, default: '' },
  responseDeadline: { type: Date },
  employeeResponse: { type: String, trim: true, maxlength: 2000, default: '' },
  respondedAt: { type: Date },
  status: {
    type: String,
    enum: ['ACTIVE', 'ACKNOWLEDGED', 'APPEALED', 'RESOLVED', 'ESCALATED'],
    default: 'ACTIVE',
  },
  escalatedTo: {
    type: String,
    enum: ['WRITTEN', 'FINAL_WRITTEN', 'SUSPENSION', 'TERMINATION'],
  },
  attachments: [{ type: String }],
}, {
  timestamps: true,
});

warningSchema.index({ employee: 1, status: 1 });
warningSchema.index({ createdAt: -1 });
warningSchema.index({ warningId: 1 });

const ESCALATION_PATH = {
  VERBAL: 'WRITTEN',
  WRITTEN: 'FINAL_WRITTEN',
  FINAL_WRITTEN: 'SUSPENSION',
  SUSPENSION: 'TERMINATION',
};

warningSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    this.warningId = `WRN-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Warning', warningSchema);
module.exports.ESCALATION_PATH = ESCALATION_PATH;
