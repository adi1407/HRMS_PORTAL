const mongoose = require('mongoose');
const { Schema } = mongoose;

const LeaveSchema = new Schema({
  employee:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  branch:      { type: Schema.Types.ObjectId, ref: 'Branch' },
  type:        { type: String, enum: ['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID', 'COMP_OFF', 'OTHER'], required: true },
  sundayWorkedDate: { type: Date },          // for COMP_OFF: the Sunday the employee actually worked
  fromDate:    { type: Date, required: true },
  toDate:      { type: Date, required: true },
  totalDays:   { type: Number, required: true },
  reason:      { type: String, required: true },
  status:      { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING' },
  reviewedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt:  { type: Date },
  reviewNotes: { type: String },
  isPaid:      { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Leave', LeaveSchema);
