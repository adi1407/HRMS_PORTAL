const mongoose = require('mongoose');
const { Schema } = mongoose;

const AttendanceSchema = new Schema({
  employee:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date:      { type: Date, required: true },
  checkIn:         { type: Date },
  checkInTime:     { type: String },
  checkInLocation: { lat: Number, lng: Number },
  checkOut:         { type: Date },
  checkOutTime:     { type: String },
  checkOutLocation: { lat: Number, lng: Number },
  // REAL status — salary engine uses this, never sent to employee
  status: {
    type: String,
    enum: ['FULL_DAY', 'HALF_DAY_DISPLAY', 'HALF_DAY', 'ON_LEAVE', 'ABSENT', 'HOLIDAY', 'WEEKLY_OFF'],
    default: 'ABSENT',
  },
  // DISPLAY status — what employee sees on portal
  displayStatus: {
    type: String,
    enum: ['FULL_DAY', 'HALF_DAY', 'ON_LEAVE', 'ABSENT', 'HOLIDAY'],
    default: 'ABSENT',
  },
  isRealHalfDay:  { type: Boolean, default: false },
  workingHours:   { type: Number, default: 0 },
  geoDistance:    { type: Number },
  faceConfidence: { type: Number },
  markedBy: {
    type: String,
    enum: ['SYSTEM', 'HR', 'DIRECTOR', 'SUPER_ADMIN', 'ACCOUNTS', 'CRON'],
    default: 'SYSTEM',
  },
  overriddenByName: { type: String },   // Human-readable name of the admin who manually marked
  leaveId:     { type: Schema.Types.ObjectId, ref: 'Leave' },
  isPaidLeave: { type: Boolean, default: false },
  notes:       { type: String },
}, { timestamps: true });

AttendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1, status: 1 });
AttendanceSchema.index({ employee: 1, date: -1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
