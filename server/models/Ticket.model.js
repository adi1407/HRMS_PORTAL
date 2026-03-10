const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
});

const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true,
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category: {
    type: String,
    enum: ['IT', 'HR', 'ADMIN', 'FINANCE', 'OTHER'],
    required: true,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000,
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
  },
  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    default: 'OPEN',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  slaHours: {
    type: Number,
    default: 48,
  },
  slaDueAt: {
    type: Date,
  },
  slaBreached: {
    type: Boolean,
    default: false,
  },
  resolvedAt: {
    type: Date,
  },
  closedAt: {
    type: Date,
  },
  comments: [commentSchema],
}, {
  timestamps: true,
});

ticketSchema.index({ employee: 1, status: 1 });
ticketSchema.index({ status: 1, slaDueAt: 1 });
ticketSchema.index({ ticketId: 1 });

const SLA_MAP = { LOW: 72, MEDIUM: 48, HIGH: 24, CRITICAL: 8 };

ticketSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    this.ticketId = `TKT-${String(count + 1).padStart(4, '0')}`;
    this.slaHours = SLA_MAP[this.priority] || 48;
    this.slaDueAt = new Date(Date.now() + this.slaHours * 60 * 60 * 1000);
  }
  if (this.isModified('status')) {
    if (this.status === 'RESOLVED' && !this.resolvedAt) this.resolvedAt = new Date();
    if (this.status === 'CLOSED' && !this.closedAt) this.closedAt = new Date();
  }
  if (this.slaDueAt && new Date() > this.slaDueAt && !['RESOLVED', 'CLOSED'].includes(this.status)) {
    this.slaBreached = true;
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
