const mongoose = require('mongoose');

const acknowledgmentSchema = new mongoose.Schema({
  employee:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  acknowledgedAt: { type: Date, default: Date.now },
  ipAddress:      { type: String },
});

const policyDocumentSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  category: {
    type: String,
    enum: ['LEAVE_POLICY', 'WFH_POLICY', 'CODE_OF_CONDUCT', 'IT_POLICY', 'SAFETY_POLICY', 'HR_POLICY', 'FINANCE_POLICY', 'OTHER'],
    default: 'OTHER',
  },
  version:    { type: String, trim: true, maxlength: 20, default: '1.0' },
  fileUrl:    { type: String, required: true },
  publicId:   { type: String },
  fileName:   { type: String },
  fileSize:   { type: Number },
  mimeType:   { type: String },
  isActive:   { type: Boolean, default: true },
  isMandatory: { type: Boolean, default: true },
  effectiveDate: { type: Date, default: Date.now },
  expiryDate:    { type: Date },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  targetAudience: {
    type: String,
    enum: ['ALL', 'DEPARTMENT', 'BRANCH'],
    default: 'ALL',
  },
  targetDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  targetBranch:     { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  acknowledgments: [acknowledgmentSchema],
}, {
  timestamps: true,
});

policyDocumentSchema.index({ isActive: 1, category: 1 });
policyDocumentSchema.index({ createdAt: -1 });

policyDocumentSchema.virtual('acknowledgmentCount').get(function () {
  return this.acknowledgments?.length || 0;
});

policyDocumentSchema.set('toJSON', { virtuals: true });
policyDocumentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PolicyDocument', policyDocumentSchema);
