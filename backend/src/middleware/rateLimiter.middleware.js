// GreenGuard — Rate Limiter Middleware
// Global: 100 req/min · Login: 5 req/min (strict to prevent brute force)

const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter — applied to all routes
 * 100 requests per minute per IP
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests — please try again in a minute',
  },
});

/**
 * Auth rate limiter — applied specifically to POST /api/auth/login
 * 5 requests per minute per IP (brute force protection)
 */
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts — please wait 1 minute before trying again',
  },
});

module.exports = { globalLimiter, loginLimiter };
