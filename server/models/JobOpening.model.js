const mongoose = require('mongoose');

const jobOpeningSchema = new mongoose.Schema({
  title:           { type: String, required: true, trim: true, maxlength: 200 },
  description:     { type: String, trim: true, maxlength: 5000, default: '' },
  department:      { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  location:        { type: String, trim: true, maxlength: 200, default: '' },
  employmentType:  {
    type: String,
    enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'OTHER'],
    default: 'FULL_TIME',
  },
  status: {
    type: String,
    enum: ['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED'],
    default: 'DRAFT',
  },
  noOfPositions:   { type: Number, default: 1, min: 1 },
  requirements:    { type: String, trim: true, maxlength: 2000, default: '' },
  salaryRangeMin:  { type: Number },
  salaryRangeMax:  { type: Number },
  postedDate:      { type: Date },
  closingDate:     { type: Date },
  hiringManager:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

jobOpeningSchema.index({ status: 1, createdAt: -1 });
jobOpeningSchema.index({ department: 1 });
jobOpeningSchema.index({ createdBy: 1 });

module.exports = mongoose.model('JobOpening', jobOpeningSchema);
