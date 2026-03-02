const mongoose = require('mongoose');

const AttendanceRequestSchema = new mongoose.Schema({
  employee:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:         { type: Date, required: true },
  message:      { type: String, required: true, trim: true },
  status:       { type: String, enum: ['PENDING', 'RESOLVED'], default: 'PENDING' },
  resolvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedNote: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('AttendanceRequest', AttendanceRequestSchema);
