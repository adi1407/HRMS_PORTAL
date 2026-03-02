const mongoose = require('mongoose');
const { Schema } = mongoose;

const HolidaySchema = new Schema({
  name:      { type: String, required: true },
  date:      { type: Date, required: true },
  type:      { type: String, enum: ['NATIONAL', 'REGIONAL', 'COMPANY', 'OPTIONAL'], default: 'NATIONAL' },
  branch:    { type: Schema.Types.ObjectId, ref: 'Branch' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Holiday', HolidaySchema);
