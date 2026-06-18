// GreenGuard — Reward Store Routes
const express = require('express');
const { getStoreItems, redeemItem, sendRedeemOtp } = require('../controllers/store.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

router.use(authenticate);

// Everyone can view store items
router.get('/', getStoreItems);

// Only Citizens can redeem
router.post('/redeem/send-otp', authorize('CITIZEN'), sendRedeemOtp);
router.post('/redeem', authorize('CITIZEN'), redeemItem);

module.exports = router;
