// GreenGuard — Upcycle Hub Routes
const express = require('express');
const { getUpcycleItems, createUpcycleItem, claimUpcycleItem } = require('../controllers/upcycle.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { upload, handleUploadError } = require('../middleware/upload.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', getUpcycleItems);
router.post('/', authorize('CITIZEN'), upload.single('image'), handleUploadError, createUpcycleItem);
router.put('/:id/claim', authorize('ADMIN'), claimUpcycleItem); // Admins can mark as claimed

module.exports = router;
