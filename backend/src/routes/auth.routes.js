// GreenGuard — Auth Routes
// POST /api/auth/register · POST /api/auth/login · POST /api/auth/refresh
// POST /api/auth/logout · GET /api/auth/me

const express = require('express');
const { body } = require('express-validator');
const { register, login, refresh, logout, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { loginLimiter } = require('../middleware/rateLimiter.middleware');

const router = express.Router();

// Validation rules for registration
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^(\+91|91|0)?[6-9]\d{9}$/)
    .withMessage('Valid Indian mobile number required (+91XXXXXXXXXX)'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('role')
    .optional()
    .isIn(['CITIZEN', 'ADMIN', 'COLLECTOR'])
    .withMessage('Invalid role'),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isIn(['Bedford', 'Brooklands', 'Grey Hills', 'Church Hill', 'Alwarpet', 'Tiger Hill', 'Mount Pleasant', "Walker's Hill", 'Singara', 'Springfield', 'Yedapalli', 'Wellington', 'Ketti', 'Adikaratti', 'Huligal', 'Bandishola', 'Bearhatty', 'Burliar', 'Hubbathalai', 'Melur'])
    .withMessage('City must be a valid Coonoor/Nilgiris area'),
];

// Validation rules for login
const loginValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/auth/register
router.post('/register', registerValidation, register);

// POST /api/auth/login (strict rate limit: 5/min)
router.post('/login', loginLimiter, loginValidation, login);

// POST /api/auth/refresh (reads refresh cookie)
router.post('/refresh', refresh);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/me (protected)
router.get('/me', authenticate, me);

module.exports = router;
