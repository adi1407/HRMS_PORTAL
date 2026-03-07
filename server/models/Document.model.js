const mongoose = require('mongoose');
const { Schema } = mongoose;

const DocumentSchema = new Schema({
  employee:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  name:     { type: String, required: true, trim: true }, // display name
  type:     {
    type: String,
    enum: ['OFFER_LETTER', 'ID_PROOF', 'CERTIFICATE', 'CONTRACT', 'PAYSLIP', 'OTHER'],
    default: 'OTHER',
  },
  fileUrl:   { type: String, required: true }, // Cloudinary secure URL
  publicId:  { type: String, required: true }, // Cloudinary public_id for deletion
  fileSize:  { type: Number, default: 0 },     // bytes
  mimeType:  { type: String, default: '' },
}, { timestamps: true });

DocumentSchema.index({ employee: 1, createdAt: -1 });

module.exports = mongoose.model('Document', DocumentSchema);
