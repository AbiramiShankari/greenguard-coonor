// GreenGuard — Standard API Response Utilities
// Provides consistent success/error response shapes across all controllers

/**
 * Send a successful response
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code (default 200)
 * @param {string} message - Human-readable message
 * @param {*} data - Response payload
 */
const sendSuccess = (res, statusCode = 200, message = 'Success', data = null) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send an error response
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {string} message - Human-readable error message
 * @param {*} errors - Optional validation errors array
 */
const sendError = (res, statusCode = 500, message = 'Internal server error', errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
  });
};

module.exports = { sendSuccess, sendError };
