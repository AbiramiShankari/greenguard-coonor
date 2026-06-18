// GreenGuard — Role Middleware
// Restricts routes to specified roles (CITIZEN, ADMIN, COLLECTOR)
// Must be used AFTER authenticate middleware

const { sendError } = require('../utils/response.utils');

/**
 * Factory function — returns middleware that allows only specified roles
 * Usage: authorize('ADMIN') or authorize('ADMIN', 'COLLECTOR')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        `Access denied — requires role: ${allowedRoles.join(' or ')}`
      );
    }

    next();
  };
};

module.exports = { authorize };
