const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['10TH', '12TH', 'DIPLOMA', 'GRADUATION', 'POST_GRADUATION', 'PHD', 'CERTIFICATION', 'OTHER'],
    required: true,
  },
  boardOrUniversity: { type: String, trim: true, maxlength: 200, default: '' },
  schoolOrCollege:   { type: String, trim: true, maxlength: 200, default: '' },
  degree:            { type: String, trim: true, maxlength: 200, default: '' },
  specialization:    { type: String, trim: true, maxlength: 200, default: '' },
  stream:            { type: String, trim: true, maxlength: 100, default: '' },
  yearOfPassing:     { type: Number },
  percentage:        { type: Number, min: 0, max: 100 },
  cgpa:              { type: Number, min: 0, max: 10 },
  marksheetUrl:      { type: String, default: '' },
  marksheetPublicId: { type: String, default: '' },
  certificateUrl:    { type: String, default: '' },
  certificatePublicId: { type: String, default: '' },
});

const experienceSchema = new mongoose.Schema({
  companyName:      { type: String, required: true, trim: true, maxlength: 200 },
  designation:      { type: String, trim: true, maxlength: 200, default: '' },
  department:       { type: String, trim: true, maxlength: 200, default: '' },
  location:         { type: String, trim: true, maxlength: 200, default: '' },
  fromDate:         { type: Date },
  toDate:           { type: Date },
  ctcPerAnnum:      { type: Number },
  reasonForLeaving: { type: String, trim: true, maxlength: 500, default: '' },
  experienceLetterUrl:      { type: String, default: '' },
  experienceLetterPublicId: { type: String, default: '' },
  relievingLetterUrl:       { type: String, default: '' },
  relievingLetterPublicId:  { type: String, default: '' },
  offerLetterUrl:           { type: String, default: '' },
  offerLetterPublicId:      { type: String, default: '' },
});

const documentUploadSchema = new mongoose.Schema({
  label:    { type: String, required: true, trim: true, maxlength: 100 },
  category: {
    type: String,
    enum: ['AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE', 'PHOTO', 'RESUME', 'OTHER'],
    default: 'OTHER',
  },
  fileUrl:   { type: String, required: true },
  publicId:  { type: String, default: '' },
  fileName:  { type: String, default: '' },
  fileSize:  { type: Number },
  uploadedAt: { type: Date, default: Date.now },
});

const employeeProfileSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // ── Personal Information ──
  fatherName:     { type: String, trim: true, maxlength: 100, default: '' },
  motherName:     { type: String, trim: true, maxlength: 100, default: '' },
  dateOfBirth:    { type: Date },
  gender:         { type: String, enum: ['MALE', 'FEMALE', 'OTHER', ''], default: '' },
  bloodGroup:     { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''], default: '' },
  maritalStatus:  { type: String, enum: ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', ''], default: '' },
  spouseName:     { type: String, trim: true, maxlength: 100, default: '' },
  nationality:    { type: String, trim: true, maxlength: 50, default: 'Indian' },
  religion:       { type: String, trim: true, maxlength: 50, default: '' },

  // ── Contact Details ──
  personalEmail:  { type: String, trim: true, lowercase: true, default: '' },
  personalPhone:  { type: String, trim: true, default: '' },

  // ── Emergency Contact ──
  emergencyContactName:     { type: String, trim: true, maxlength: 100, default: '' },
  emergencyContactRelation: { type: String, trim: true, maxlength: 50, default: '' },
  emergencyContactPhone:    { type: String, trim: true, maxlength: 20, default: '' },

  // ── Address ──
  currentAddress:   { type: String, trim: true, maxlength: 500, default: '' },
  permanentAddress: { type: String, trim: true, maxlength: 500, default: '' },

  // ── Identity Documents ──
  aadhaarNumber:  { type: String, trim: true, maxlength: 20, default: '' },
  panNumber:      { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
  passportNumber: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
  passportExpiry: { type: Date },
  uanNumber:      { type: String, trim: true, maxlength: 20, default: '' },
  esicNumber:     { type: String, trim: true, maxlength: 20, default: '' },

  // ── Bank Details ──
  bankName:          { type: String, trim: true, maxlength: 100, default: '' },
  bankAccountNumber: { type: String, trim: true, maxlength: 30, default: '' },
  ifscCode:          { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
  bankBranch:        { type: String, trim: true, maxlength: 100, default: '' },

  // ── Education ──
  education: [educationSchema],

  // ── Experience ──
  experience: [experienceSchema],
  totalExperienceYears: { type: Number, default: 0 },
  isFresher:            { type: Boolean, default: true },

  // ── Document Uploads ──
  documents: [documentUploadSchema],

  // ── Profile Completion ──
  profileCompleted: { type: Boolean, default: false },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

employeeProfileSchema.index({ employee: 1 }, { unique: true });

employeeProfileSchema.virtual('completionPercent').get(function () {
  const fields = [
    this.fatherName, this.motherName, this.dateOfBirth, this.gender, this.bloodGroup,
    this.personalPhone, this.emergencyContactName, this.emergencyContactPhone,
    this.currentAddress, this.permanentAddress, this.aadhaarNumber, this.panNumber,
    this.bankName, this.bankAccountNumber, this.ifscCode,
  ];
  const filled = fields.filter(f => f != null && f !== '' && f !== undefined).length;
  const eduFilled = (this.education?.length || 0) > 0 ? 1 : 0;
  const total = fields.length + 1;
  return Math.round(((filled + eduFilled) / total) * 100);
});

employeeProfileSchema.set('toJSON', { virtuals: true });
employeeProfileSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('EmployeeProfile', employeeProfileSchema);
