// GreenGuard — Collection Routes
const express = require('express');
const { body } = require('express-validator');
const {
  createCollection, getCollections, getNearbyCollections, updateCollection,
} = require('../controllers/collection.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { upload, handleUploadError } = require('../middleware/upload.middleware');

const router = express.Router();

const createValidation = [
  body('wasteType').isIn(['RECYCLABLE', 'ORGANIC', 'HAZARDOUS', 'E_WASTE', 'MIXED']).withMessage('Invalid waste type'),
  body('quantity').isFloat({ min: 0.1 }).withMessage('Quantity must be a positive number'),
  body('address').trim().notEmpty().withMessage('Address is required'),
];

router.use(authenticate);

router.post('/', authorize('CITIZEN'), upload.single('image'), handleUploadError, createValidation, createCollection);
router.get('/nearby', authorize('COLLECTOR'), getNearbyCollections);
router.get('/', getCollections);
router.put('/:id', authorize('ADMIN', 'COLLECTOR'), updateCollection);

module.exports = router;
