const mongoose = require('mongoose');
const { Schema } = mongoose;

const ResignationSchema = new Schema({
  employee:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason:          { type: String, required: true },
  lastWorkingDate: { type: Date },

  status: {
    type: String,
    enum: ['PENDING_HR', 'PENDING_HEAD', 'APPROVED', 'REJECTED'],
    default: 'PENDING_HR',
  },

  // HR decision
  hrReviewedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
  hrNote:        { type: String, default: '' },
  hrReviewedAt:  { type: Date },

  // Managing Head decision
  headReviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  headNote:       { type: String, default: '' },
  headReviewedAt: { type: Date },

  // Rejection info
  rejectedBy:    { type: String, enum: ['HR', 'HEAD', null], default: null },
  rejectionNote: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Resignation', ResignationSchema);
