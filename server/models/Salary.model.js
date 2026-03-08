const mongoose = require('mongoose');
const { Schema } = mongoose;

const SalarySchema = new Schema({
  employee:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
  month:           { type: Number, min: 1, max: 12, required: true },
  year:            { type: Number, required: true },
  grossSalary:     { type: Number, required: true },
  daysInMonth:     { type: Number, required: true },
  perDaySalary:    { type: Number, required: true },
  fullDays:        { type: Number, default: 0 },
  realHalfDays:    { type: Number, default: 0 },
  displayHalfDays: { type: Number, default: 0 },
  absentDays:      { type: Number, default: 0 },
  paidLeaves:      { type: Number, default: 0 },
  unpaidLeaves:    { type: Number, default: 0 },
  holidays:        { type: Number, default: 0 },
  weeklyOffs:      { type: Number, default: 0 },
  deductionDays:   { type: Number, default: 0 },
  deductionAmount:    { type: Number, default: 0 },
  reimbursementTotal: { type: Number, default: 0 },  // expense claims added via salary
  netSalary:          { type: Number, required: true },
  hasDeduction:       { type: Boolean, default: false },
  manualAdjustment: { type: Number, default: 0 },   // positive = bonus, negative = deduction
  adjustmentNote:   { type: String, default: '' },
  adjustedBy:       { type: Schema.Types.ObjectId, ref: 'User' },
  adjustedAt:       { type: Date },
  status:          { type: String, enum: ['DRAFT', 'FINAL'], default: 'DRAFT' },
  generatedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
  generatedAt:     { type: Date, default: Date.now },
  finalizedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
  finalizedAt:     { type: Date },
}, { timestamps: true });

SalarySchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });
module.exports = mongoose.model('Salary', SalarySchema);
