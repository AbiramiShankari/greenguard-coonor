// GreenGuard — Cloudinary Service
// Uploads image buffers from Multer memory storage to Cloudinary
// Returns the secure HTTPS URL of the uploaded image

const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');

// Configure Cloudinary with env vars (called at startup)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload an image buffer to Cloudinary
 * Returns the secure URL of the uploaded image
 *
 * @param {Buffer} buffer - File buffer from Multer memory storage
 * @param {string} folder - Cloudinary folder name (e.g. "complaints" or "collections")
 * @returns {Promise<{url: string, publicId: string} | null>}
 */
const uploadImage = async (buffer, folder = 'greenguard') => {
  // If Cloudinary is not configured, skip upload and return null
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME === 'REPLACE_WITH_REAL_VALUE'
  ) {
    console.log('[CLOUDINARY] Not configured — skipping image upload in dev mode, returning mock URL');
    return { url: 'https://via.placeholder.com/800x600.png?text=Mock+Image', publicId: `mock_${uuidv4()}` };
  }

  return new Promise((resolve, reject) => {
    // Use UUID as the public_id to ensure unique, collision-free filenames
    const publicId = `${folder}/${uuidv4()}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 1200, height: 900, crop: 'limit' }, // Resize large images
          { quality: 'auto:good' }, // Auto optimize quality
        ],
      },
      (error, result) => {
        if (error) {
          console.error('[CLOUDINARY] Upload error:', error.message);
          return resolve(null); // Fail silently — return null instead of throwing
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    // Pipe buffer into the upload stream
    const Readable = require('stream').Readable;
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

module.exports = { uploadImage };
