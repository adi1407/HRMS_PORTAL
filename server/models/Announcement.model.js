const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  priority: {
    type: String,
    enum: ['NORMAL', 'IMPORTANT', 'URGENT'],
    default: 'NORMAL',
  },
  audience: {
    type: String,
    enum: ['ALL', 'DEPARTMENT', 'BRANCH'],
    default: 'ALL',
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
  },
  expiresAt: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

announcementSchema.index({ isActive: 1, expiresAt: 1 });
announcementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
