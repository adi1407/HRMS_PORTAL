const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  category: {
    type: String,
    enum: ['DOCUMENTS', 'IT_SETUP', 'HR_FORMALITIES', 'TRAINING', 'OTHER'],
    default: 'OTHER',
  },
  isCompleted:  { type: Boolean, default: false },
  completedAt:  { type: Date },
  completedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note:         { type: String, trim: true, maxlength: 500, default: '' },
  order:        { type: Number, default: 0 },
});

const onboardingSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  checklist: [checklistItemSchema],
  status: {
    type: String,
    enum: ['IN_PROGRESS', 'COMPLETED'],
    default: 'IN_PROGRESS',
  },
  dueDate: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  },
}, {
  timestamps: true,
});

onboardingSchema.index({ employee: 1 }, { unique: true });
onboardingSchema.index({ status: 1 });

onboardingSchema.virtual('completionPercent').get(function () {
  if (!this.checklist || this.checklist.length === 0) return 0;
  const done = this.checklist.filter(i => i.isCompleted).length;
  return Math.round((done / this.checklist.length) * 100);
});

onboardingSchema.set('toJSON', { virtuals: true });
onboardingSchema.set('toObject', { virtuals: true });

const DEFAULT_CHECKLIST = [
  { title: 'Personal information form submitted', category: 'HR_FORMALITIES', order: 1 },
  { title: 'Bank account details provided', category: 'HR_FORMALITIES', order: 2 },
  { title: 'ID proof / address proof uploaded', category: 'DOCUMENTS', order: 3 },
  { title: 'Offer letter signed & submitted', category: 'DOCUMENTS', order: 4 },
  { title: 'PAN card & Aadhaar copy submitted', category: 'DOCUMENTS', order: 5 },
  { title: 'Emergency contact details provided', category: 'HR_FORMALITIES', order: 6 },
  { title: 'Company email / accounts created', category: 'IT_SETUP', order: 7 },
  { title: 'Laptop / equipment assigned', category: 'IT_SETUP', order: 8 },
  { title: 'Software & tools access granted', category: 'IT_SETUP', order: 9 },
  { title: 'Policy handbook acknowledged', category: 'TRAINING', order: 10 },
  { title: 'Welcome orientation completed', category: 'TRAINING', order: 11 },
  { title: 'Team introduction done', category: 'TRAINING', order: 12 },
];

module.exports = mongoose.model('Onboarding', onboardingSchema);
module.exports.DEFAULT_CHECKLIST = DEFAULT_CHECKLIST;
