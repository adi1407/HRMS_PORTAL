const mongoose = require('mongoose');
const { Schema } = mongoose;

const BranchSchema = new Schema({
  name:         { type: String, required: true },
  address:      { type: String, required: true },
  floor:        { type: Number, default: 1 },
  latitude:     { type: Number, default: 0 },
  longitude:    { type: Number, default: 0 },
  radiusMeters: { type: Number, default: 30 },
  wifiSSIDs:    [{ type: String }],
  allowedIPs:   [{ type: String }],
  isActive:     { type: Boolean, default: true },
  createdBy:    { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Branch', BranchSchema);
