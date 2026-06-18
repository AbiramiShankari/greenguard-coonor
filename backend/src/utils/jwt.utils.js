// GreenGuard — JWT Utilities
// Signs and verifies access + refresh tokens

const jwt = require('jsonwebtoken');

/**
 * Sign a short-lived access token (30 days)
 */
const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
};

/**
 * Sign a long-lived refresh token (365 days)
 */
const signRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '365d' });
};

/**
 * Verify an access token — throws on invalid/expired
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Verify a refresh token — throws on invalid/expired
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
