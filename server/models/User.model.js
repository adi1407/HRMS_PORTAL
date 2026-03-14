const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const UserSchema = new Schema({
  employeeId:   { type: String, unique: true },
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, select: false, minlength: 6 },
  phone:        { type: String },
  role:         { type: String, enum: ['SUPER_ADMIN', 'DIRECTOR', 'HR', 'ACCOUNTS', 'EMPLOYEE'], default: 'EMPLOYEE' },
  department:   { type: Schema.Types.ObjectId, ref: 'Department' },
  branch:       { type: Schema.Types.ObjectId, ref: 'Branch' },
  designation:  { type: String },
  joiningDate:       { type: Date, default: Date.now },
  dateOfBirth:       { type: Date },
  probationEndDate:  { type: Date },
  probationMonths:   { type: Number, default: 6 },
  grossSalary:       { type: Number, default: 0 },
  isActive:          { type: Boolean, default: true },
  bankAccountNumber: { type: String, default: '' },
  ifscCode:          { type: String, uppercase: true, default: '' },
  isManagingHead:    { type: Boolean, default: false },
  photoUrl:          { type: String, default: '' },
  faceDescriptors: { type: [[Number]], select: false, default: [] },
  faceEnrolled:    { type: Boolean, default: false },
  faceEnrolledAt:  { type: Date },
  faceEnrolledBy:  { type: Schema.Types.ObjectId, ref: 'User' },
  refreshToken:    { type: String, select: false },
  payslipPin:      { type: String, select: false, default: '' },
  createdBy:       { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
  next();
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('payslipPin')) return next();
  if (this.payslipPin && this.payslipPin.length >= 4) {
    this.payslipPin = await bcrypt.hash(this.payslipPin, 10);
  }
  next();
});

UserSchema.pre('save', async function (next) {
  if (this.employeeId) return next();
  const count = await mongoose.model('User').countDocuments();
  this.employeeId = `EMP-${String(count + 1).padStart(4, '0')}`;
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.comparePayslipPin = async function (candidatePin) {
  if (!this.payslipPin) return false;
  return bcrypt.compare(String(candidatePin || ''), this.payslipPin);
};

UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.faceDescriptors;
  delete obj.payslipPin;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
