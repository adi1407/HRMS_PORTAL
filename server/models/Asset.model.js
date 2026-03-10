const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedDate: { type: Date, default: Date.now },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  returnDate: { type: Date },
  returnCondition: { type: String, enum: ['GOOD', 'DAMAGED', 'LOST'], },
  returnNote: { type: String, trim: true, maxlength: 500 },
  returnProcessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const assetSchema = new mongoose.Schema({
  assetId: {
    type: String,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  type: {
    type: String,
    enum: ['LAPTOP', 'DESKTOP', 'PHONE', 'TABLET', 'MONITOR', 'ACCESS_CARD', 'HEADSET', 'CHAIR', 'OTHER'],
    required: true,
  },
  brand: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  modelName: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  serialNumber: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  purchaseDate: {
    type: Date,
  },
  purchaseCost: {
    type: Number,
  },
  condition: {
    type: String,
    enum: ['NEW', 'GOOD', 'FAIR', 'POOR'],
    default: 'NEW',
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'ASSIGNED', 'UNDER_REPAIR', 'RETIRED', 'LOST'],
    default: 'AVAILABLE',
  },
  currentAssignment: assignmentSchema,
  assignmentHistory: [assignmentSchema],
  notes: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

assetSchema.index({ status: 1 });
assetSchema.index({ 'currentAssignment.employee': 1 });
assetSchema.index({ assetId: 1 });

assetSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    this.assetId = `AST-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Asset', assetSchema);
