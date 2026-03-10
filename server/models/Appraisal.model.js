const mongoose = require('mongoose');

const kpiSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  weight:      { type: Number, required: true, min: 0, max: 100 },
  selfScore:   { type: Number, min: 0, max: 5 },
  selfComment: { type: String, trim: true, maxlength: 1000, default: '' },
  managerScore:   { type: Number, min: 0, max: 5 },
  managerComment: { type: String, trim: true, maxlength: 1000, default: '' },
});

const appraisalSchema = new mongoose.Schema({
  appraisalId: { type: String, unique: true },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  cycleType: {
    type: String,
    enum: ['QUARTERLY', 'HALF_YEARLY', 'ANNUAL'],
    required: true,
  },
  cycleName: { type: String, required: true, trim: true, maxlength: 100 },
  period: {
    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },
  },
  kpis: {
    type: [kpiSchema],
    validate: [arr => arr.length > 0, 'At least one KPI is required.'],
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SELF_REVIEW', 'MANAGER_REVIEW', 'COMPLETED'],
    default: 'DRAFT',
  },
  selfSubmittedAt:    { type: Date },
  managerSubmittedAt: { type: Date },

  weightedSelfScore:    { type: Number },
  weightedManagerScore: { type: Number },
  finalScore:           { type: Number },

  overallSelfComment:    { type: String, trim: true, maxlength: 2000, default: '' },
  overallManagerComment: { type: String, trim: true, maxlength: 2000, default: '' },

  rating: {
    type: String,
    enum: ['OUTSTANDING', 'EXCEEDS_EXPECTATIONS', 'MEETS_EXPECTATIONS', 'NEEDS_IMPROVEMENT', 'UNSATISFACTORY'],
  },

  deadline: { type: Date },
  letterGenerated: { type: Boolean, default: false },
}, {
  timestamps: true,
});

appraisalSchema.index({ employee: 1, status: 1 });
appraisalSchema.index({ reviewer: 1, status: 1 });
appraisalSchema.index({ status: 1, createdAt: -1 });
appraisalSchema.index({ appraisalId: 1 });

function computeWeightedScore(kpis, field) {
  const totalWeight = kpis.reduce((s, k) => s + (k.weight || 0), 0);
  if (totalWeight === 0) return 0;
  const raw = kpis.reduce((s, k) => {
    const score = k[field];
    return s + (score != null ? score * (k.weight || 0) : 0);
  }, 0);
  return Math.round((raw / totalWeight) * 100) / 100;
}

function deriveRating(score) {
  if (score >= 4.5) return 'OUTSTANDING';
  if (score >= 3.5) return 'EXCEEDS_EXPECTATIONS';
  if (score >= 2.5) return 'MEETS_EXPECTATIONS';
  if (score >= 1.5) return 'NEEDS_IMPROVEMENT';
  return 'UNSATISFACTORY';
}

appraisalSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    this.appraisalId = `APR-${String(count + 1).padStart(4, '0')}`;
  }

  if (this.kpis && this.kpis.length > 0) {
    const hasSelf = this.kpis.some(k => k.selfScore != null);
    const hasMgr  = this.kpis.some(k => k.managerScore != null);
    if (hasSelf) this.weightedSelfScore = computeWeightedScore(this.kpis, 'selfScore');
    if (hasMgr)  this.weightedManagerScore = computeWeightedScore(this.kpis, 'managerScore');
    if (hasMgr)  {
      this.finalScore = this.weightedManagerScore;
      this.rating = deriveRating(this.finalScore);
    }
  }

  next();
});

module.exports = mongoose.model('Appraisal', appraisalSchema);
module.exports.computeWeightedScore = computeWeightedScore;
module.exports.deriveRating = deriveRating;
