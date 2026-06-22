// GreenGuard — Complaint Routes
const express = require('express');
const { body, param } = require('express-validator');
const {
  createComplaint, getComplaints, getComplaintById, getNearbyComplaints,
  updateComplaintStatus, upvoteComplaint,
} = require('../controllers/complaint.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { upload, handleUploadError } = require('../middleware/upload.middleware');

const router = express.Router();

const createComplaintValidation = [
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('city').isIn(['Bedford', 'Brooklands', 'Grey Hills', 'Church Hill', 'Alwarpet', 'Tiger Hill', 'Mount Pleasant', "Walker's Hill", 'Singara', 'Springfield', 'Yedapalli', 'Wellington', 'Ketti', 'Adikaratti', 'Huligal', 'Bandishola', 'Bearhatty', 'Burliar', 'Hubbathalai', 'Melur']).withMessage('Invalid city'),
  body('ward').trim().notEmpty().withMessage('Ward is required'),
  body('description').trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
];

const updateStatusValidation = [
  body('status').isIn(['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DUPLICATE']).withMessage('Invalid status'),
];

// All routes require authentication
router.use(authenticate);

router.post('/', authorize('CITIZEN'), upload.fields([{ name: 'image', maxCount: 1 }, { name: 'landmarkImage', maxCount: 1 }]), handleUploadError, createComplaintValidation, createComplaint);
router.get('/', getComplaints);
router.get('/nearby', getNearbyComplaints);
router.get('/:id', getComplaintById);
router.put('/:id', authorize('ADMIN'), updateStatusValidation, updateComplaintStatus);
router.post('/:id/upvote', authorize('CITIZEN'), upvoteComplaint);

module.exports = router;
