// GreenGuard — Auth Middleware
// Verifies JWT access token from Authorization header and attaches user to req

const { verifyAccessToken } = require('../utils/jwt.utils');
const { sendError } = require('../utils/response.utils');

/**
 * Protects all routes — must be called before role middleware.
 * Expects: Authorization: Bearer <token>
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Access token required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Attach full user payload to request
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Access token expired — please refresh');
    }
    return sendError(res, 401, 'Invalid access token');
  }
};

module.exports = { authenticate };
