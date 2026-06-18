// GreenGuard — Upload Middleware
// Multer config: 5MB max, jpeg/png/webp only, UUID filenames
// Files are stored in memory buffer for Cloudinary upload

const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { sendError } = require('../utils/response.utils');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Use memory storage — buffer passed directly to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/**
 * Multer error handler middleware — call after upload middleware
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 400, 'File too large — maximum size is 5MB');
    }
    return sendError(res, 400, `Upload error: ${err.message}`);
  }
  if (err) {
    return sendError(res, 400, err.message);
  }
  next();
};

module.exports = { upload, handleUploadError };
