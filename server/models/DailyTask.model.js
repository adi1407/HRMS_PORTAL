const mongoose = require('mongoose');

const taskEntrySchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  status:      { type: String, enum: ['COMPLETED', 'IN_PROGRESS', 'BLOCKED'], default: 'COMPLETED' },
}, { _id: true });

const dailyTaskSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  tasks: {
    type: [taskEntrySchema],
    validate: [arr => arr.length > 0, 'At least one task is required.'],
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

dailyTaskSchema.index({ employee: 1, date: 1 }, { unique: true });
dailyTaskSchema.index({ date: 1 });

module.exports = mongoose.model('DailyTask', dailyTaskSchema);
