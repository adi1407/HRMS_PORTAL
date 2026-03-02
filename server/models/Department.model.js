const mongoose = require('mongoose');
const { Schema } = mongoose;

const DepartmentSchema = new Schema({
  name:      { type: String, required: true, unique: true, trim: true },
  code:      { type: String, unique: true, uppercase: true },
  head:      { type: Schema.Types.ObjectId, ref: 'User' },
  branch:    { type: Schema.Types.ObjectId, ref: 'Branch' },
  isActive:  { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Department', DepartmentSchema);
