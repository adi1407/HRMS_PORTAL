const mongoose = require('mongoose');

const APPLICATION_STATUS = [
  'APPLIED',      // Just applied
  'SCREENING',    // Under review
  'SHORTLISTED',  // Shortlisted for interview
  'INTERVIEW',    // Interview scheduled / done
  'OFFER',        // Offer extended
  'HIRED',        // Joined
  'REJECTED',     // Rejected
  'WITHDRAWN',    // Candidate withdrew
];

const applicationSchema = new mongoose.Schema({
  job:              { type: mongoose.Schema.Types.ObjectId, ref: 'JobOpening', required: true },
  candidateName:    { type: String, required: true, trim: true, maxlength: 150 },
  email:            { type: String, required: true, trim: true, lowercase: true, maxlength: 150 },
  phone:            { type: String, trim: true, maxlength: 20, default: '' },
  resumeUrl:        { type: String, default: '' },
  resumePublicId:   { type: String, default: '' },
  resumeFileName:   { type: String, default: '' },
  source: {
    type: String,
    enum: ['REFERRAL', 'JOB_PORTAL', 'LINKEDIN', 'DIRECT', 'CAMPUS', 'AGENCY', 'OTHER'],
    default: 'DIRECT',
  },
  currentCompany:   { type: String, trim: true, maxlength: 200, default: '' },
  experienceYears:  { type: Number, min: 0 },
  expectedSalary:   { type: Number },
  noticePeriod:     { type: String, trim: true, maxlength: 100, default: '' },
  status: {
    type: String,
    enum: APPLICATION_STATUS,
    default: 'APPLIED',
  },
  notes:            { type: String, trim: true, maxlength: 2000, default: '' },
  rating:           { type: Number, min: 1, max: 5 },
  interviewDate:    { type: Date },
  interviewFeedback: { type: String, trim: true, maxlength: 2000, default: '' },
  offeredSalary:    { type: Number },
  offerLetterUrl:   { type: String, default: '' },
  offerLetterPublicId: { type: String, default: '' },
  rejectedReason:   { type: String, trim: true, maxlength: 500, default: '' },
  hiredAt:          { type: Date },
  createdEmployee:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

applicationSchema.index({ job: 1, status: 1 });
applicationSchema.index({ email: 1, job: 1 });
applicationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);
module.exports.APPLICATION_STATUS = APPLICATION_STATUS;
