// GreenGuard — Auth Controller
// Handles: register, login, refresh, logout, me
// Security: bcrypt (12 rounds), JWT access (1hr) + refresh cookie (7d)

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt.utils');
const { sendSuccess, sendError } = require('../utils/response.utils');
const { formatIndianPhone } = require('../utils/phone.utils');
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

// Cookie options for the HTTP-only refresh token
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 365 * 24 * 60 * 60 * 1000, // 365 days in milliseconds
};

// ─── Register ────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 422, 'Validation failed', errors.array());
  }

  try {
    const { name, email, phone, password, role, city } = req.body;

    // Normalize phone to +91XXXXXXXXXX
    const formattedPhone = formatIndianPhone(phone);

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone: formattedPhone }] },
    });
    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'phone number';
      return sendError(res, 409, `This ${field} is already registered`);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate unique ID
    const greenguardId = `GG-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Create user
    const user = await prisma.user.create({
      data: {
        greenguardId,
        name,
        email,
        phone: formattedPhone,
        password: hashedPassword,
        role: role || 'CITIZEN',
        city,
      },
      select: {
        id: true, greenguardId: true, name: true, email: true, phone: true,
        role: true, city: true, totalPoints: true,
        currentBadge: true, smsOptIn: true, createdAt: true,
      },
    });

    // Issue tokens
    const tokenPayload = { id: user.id, email: user.email, role: user.role, city: user.city };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Store refresh token hash in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    return sendSuccess(res, 201, 'Account created successfully', { user, accessToken });
  } catch (err) {
    console.error('[AUTH] register error:', err);
    return sendError(res, 500, 'Registration failed — please try again');
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 422, 'Validation failed', errors.array());
  }

  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return sendError(res, 401, 'Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return sendError(res, 401, 'Invalid email or password');
    }

    // Issue tokens
    const tokenPayload = { id: user.id, email: user.email, role: user.role, city: user.city };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Update refresh token in DB
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

    const safeUser = {
      id: user.id, greenguardId: user.greenguardId, name: user.name, email: user.email, phone: user.phone,
      role: user.role, city: user.city, totalPoints: user.totalPoints,
      currentBadge: user.currentBadge, smsOptIn: user.smsOptIn,
    };

    return sendSuccess(res, 200, 'Login successful', { user: safeUser, accessToken });
  } catch (err) {
    console.error('[AUTH] login error:', err);
    return sendError(res, 500, 'Login failed — please try again');
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) {
      return sendError(res, 401, 'Refresh token not found — please login again');
    }

    // Verify the token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user and compare stored token
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.refreshToken !== refreshToken) {
      return sendError(res, 401, 'Invalid refresh token — please login again');
    }

    // Issue new access token
    const tokenPayload = { id: user.id, email: user.email, role: user.role, city: user.city };
    const newAccessToken = signAccessToken(tokenPayload);

    return sendSuccess(res, 200, 'Token refreshed', { accessToken: newAccessToken });
  } catch (err) {
    return sendError(res, 401, 'Refresh token expired — please login again');
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      // Clear stored refresh token in DB
      await prisma.user.updateMany({
        where: { refreshToken },
        data: { refreshToken: null },
      });
    }

    res.clearCookie('refreshToken');
    return sendSuccess(res, 200, 'Logged out successfully');
  } catch (err) {
    console.error('[AUTH] logout error:', err);
    return sendError(res, 500, 'Logout failed');
  }
};

// ─── Me (Current User Profile) ────────────────────────────────────────────────
const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, greenguardId: true, name: true, email: true, phone: true,
        role: true, city: true, totalPoints: true,
        currentBadge: true, smsOptIn: true, createdAt: true,
      },
    });

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    return sendSuccess(res, 200, 'Profile retrieved', { user });
  } catch (err) {
    console.error('[AUTH] me error:', err);
    return sendError(res, 500, 'Failed to retrieve profile');
  }
};

module.exports = { register, login, refresh, logout, me };
