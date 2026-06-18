// GreenGuard — Reward Routes
const express = require('express');
const { getMyRewards, getLeaderboard, redeemPoints } = require('../controllers/reward.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/me', getMyRewards);
router.get('/leaderboard', getLeaderboard);
router.post('/redeem', redeemPoints);

module.exports = router;
