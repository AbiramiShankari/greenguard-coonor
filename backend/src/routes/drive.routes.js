// GreenGuard — Local Drive Routes

const express = require('express');
const { body } = require('express-validator');
const {
  createDrive,
  getDrives,
  getDriveById,
  joinDrive,
  markAttendance,
  updateDriveStatus,
} = require('../controllers/drive.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { upload } = require('../middleware/upload.middleware');

const router = express.Router();

// ─── Public/Citizen Routes ─────────────────────────────────────────────────────

// Get drives (can filter by status, city, ward via query)
router.get('/', authenticate, getDrives);

// Get specific drive details
router.get('/:id', authenticate, getDriveById);

// Join a drive (Citizen)
router.post('/:id/join', authenticate, authorize('CITIZEN'), joinDrive);

// ─── Admin Routes ──────────────────────────────────────────────────────────────

// Create a new drive
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  upload.single('image'),
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('ward').notEmpty().withMessage('Ward is required'),
    body('date').isISO8601().toDate().withMessage('Valid date is required'),
  ],
  createDrive
);

// Mark citizen attendance and award points
router.post(
  '/:id/attendance',
  authenticate,
  authorize('ADMIN'),
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('attended').isBoolean().withMessage('Attended status must be a boolean'),
  ],
  markAttendance
);

// Update drive status (PLANNED, ONGOING, COMPLETED)
router.patch(
  '/:id/status',
  authenticate,
  authorize('ADMIN'),
  [
    body('status').isIn(['PLANNED', 'ONGOING', 'COMPLETED']).withMessage('Invalid status'),
  ],
  updateDriveStatus
);

module.exports = router;
