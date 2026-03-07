const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {string} folder  - Cloudinary folder (e.g. 'hrms/documents')
 * @param {string} publicId - Unique identifier for the file
 * @param {string} resourceType - 'raw' for docs/PDFs, 'image' for images
 */
function uploadBuffer(buffer, folder, publicId, resourceType = 'raw') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: resourceType, overwrite: true },
      (err, result) => { if (err) reject(err); else resolve(result); }
    );
    stream.end(buffer);
  });
}

/**
 * Delete a file from Cloudinary by its public_id.
 */
function deleteFile(publicId, resourceType = 'raw') {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = { uploadBuffer, deleteFile };
