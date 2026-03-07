const mongoose = require('mongoose');
const { Schema } = mongoose;

const SalaryUpdateRequestSchema = new Schema({
  employee:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requestedBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true }, // ACCOUNTS user

  // What's changing
  currentGrossSalary:   { type: Number },
  newGrossSalary:       { type: Number },
  currentBankAccount:   { type: String },
  newBankAccount:       { type: String },
  currentIfscCode:      { type: String },
  newIfscCode:          { type: String },
  reason:               { type: String, default: '' },

  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  },

  reviewedBy:   { type: Schema.Types.ObjectId, ref: 'User' },
  reviewNote:   { type: String, default: '' },
  reviewedAt:   { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('SalaryUpdateRequest', SalaryUpdateRequestSchema);
