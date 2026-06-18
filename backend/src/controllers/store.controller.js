// GreenGuard — Reward Store Controller
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response.utils');
const { sendEventSMS } = require('../services/sms.service');

const prisma = new PrismaClient();

// GET /api/store
const getStoreItems = async (req, res) => {
  try {
    const items = await prisma.rewardItem.findMany({
      where: { isActive: true },
      orderBy: { pointCost: 'asc' },
    });
    return sendSuccess(res, 200, 'Reward items retrieved', { items });
  } catch (err) {
    console.error('[STORE] getStoreItems error:', err);
    return sendError(res, 500, 'Failed to fetch store items');
  }
};

// POST /api/store/redeem/send-otp
const sendRedeemOtp = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return sendError(res, 404, 'User not found');

    // Generate 6 digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: userId },
      data: { otpCode, otpExpiry },
    });

    // Send SMS
    await sendEventSMS('otp_verification', { otp: otpCode }, user.phone, user.id, true);

    return sendSuccess(res, 200, 'OTP sent successfully');
  } catch (err) {
    console.error('[STORE] sendRedeemOtp error:', err);
    return sendError(res, 500, 'Failed to send OTP');
  }
};

// POST /api/store/redeem
const redeemItem = async (req, res) => {
  try {
    const { rewardItemId, otp } = req.body;
    const userId = req.user.id;

    // Fetch user and reward item
    const [user, item] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.rewardItem.findUnique({ where: { id: rewardItemId } })
    ]);

    if (!item || !item.isActive) return sendError(res, 404, 'Reward item not found or inactive');
    if (user.totalPoints < item.pointCost) return sendError(res, 400, 'Insufficient points');

    // Verify OTP
    if (!user.otpCode || user.otpCode !== otp) {
      return sendError(res, 400, 'Invalid OTP');
    }
    if (user.otpExpiry && new Date() > user.otpExpiry) {
      return sendError(res, 400, 'OTP expired');
    }

    // Process redemption in transaction
    const [updatedUser, history] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { 
          totalPoints: { decrement: item.pointCost },
          otpCode: null,
          otpExpiry: null
        },
      }),
      prisma.redemptionHistory.create({
        data: {
          userId,
          rewardItemId,
          pointsSpent: item.pointCost,
        }
      })
    ]);

    return sendSuccess(res, 200, 'Reward redeemed successfully', { 
      pointsRemaining: updatedUser.totalPoints,
      history
    });
  } catch (err) {
    console.error('[STORE] redeemItem error:', err);
    return sendError(res, 500, 'Failed to redeem reward');
  }
};

module.exports = { getStoreItems, sendRedeemOtp, redeemItem };
