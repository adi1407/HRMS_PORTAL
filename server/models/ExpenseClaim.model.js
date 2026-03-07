const mongoose = require('mongoose');
const { Schema } = mongoose;

const ExpenseClaimSchema = new Schema({
  employee:   { type: Schema.Types.ObjectId, ref: 'User', required: true },

  amount:      { type: Number, required: true, min: 1 },
  category:    {
    type: String,
    enum: ['TRAVEL', 'FOOD', 'ACCOMMODATION', 'COMMUNICATION', 'MEDICAL', 'OTHER'],
    default: 'OTHER',
  },
  description: { type: String, required: true, trim: true },
  expenseDate: { type: Date, required: true },

  // Optional receipt upload (Cloudinary)
  receiptUrl:      { type: String, default: '' },
  receiptPublicId: { type: String, default: '' },
  receiptMime:     { type: String, default: '' },

  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  },

  // ACCOUNTS decision
  reviewedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
  reviewNote:        { type: String, default: '' },
  reviewedAt:        { type: Date },
  reimbursementType: { type: String, enum: ['CASH', 'SALARY', null], default: null },

  // Set true once included in a salary slip, to avoid double-counting
  addedToSalary: { type: Boolean, default: false },
}, { timestamps: true });

ExpenseClaimSchema.index({ employee: 1, createdAt: -1 });
ExpenseClaimSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ExpenseClaim', ExpenseClaimSchema);
