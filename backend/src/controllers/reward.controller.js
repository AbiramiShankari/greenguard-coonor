// GreenGuard — Reward Controller
// GET /api/rewards/me — personal points history
// GET /api/rewards/leaderboard — top users by city

const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response.utils');
const { getBadgeForPoints } = require('../services/reward.service');

const prisma = new PrismaClient();

// ─── GET /api/rewards/me ──────────────────────────────────────────────────────
const getMyRewards = async (req, res) => {
  try {
    const userId = req.user.id;

    const rewards = await prisma.reward.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalPoints: true, currentBadge: true },
    });

    return sendSuccess(res, 200, 'Reward history retrieved', {
      history: rewards,
      totalPoints: user?.totalPoints || 0,
      currentBadge: user?.currentBadge || null,
    });
  } catch (err) {
    console.error('[REWARD] getMyRewards error:', err);
    return sendError(res, 500, 'Failed to retrieve reward history');
  }
};

// ─── GET /api/rewards/leaderboard ─────────────────────────────────────────────
const getLeaderboard = async (req, res) => {
  try {
    const { city, limit = 10 } = req.query;

    const where = {};
    if (city) where.city = city;

    const users = await prisma.user.findMany({
      where: { ...where, role: 'CITIZEN' },
      select: {
        id: true,
        name: true,
        city: true,
        totalPoints: true,
        currentBadge: true,
      },
      orderBy: { totalPoints: 'desc' },
      take: parseInt(limit),
    });

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      name: user.name,
      city: user.city,
      points: user.totalPoints,
      badge: user.currentBadge,
    }));

    return sendSuccess(res, 200, 'Leaderboard retrieved', { leaderboard });
  } catch (err) {
    console.error('[REWARD] getLeaderboard error:', err);
    return sendError(res, 500, 'Failed to retrieve leaderboard');
  }
};

// POST /api/rewards/redeem
const redeemPoints = async (req, res) => {
  try {
    const { rewardId, cost } = req.body;
    const userId = req.user.id;

    if (!rewardId || !cost || cost <= 0) {
      return sendError(res, 400, 'Invalid reward or cost');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalPoints: true },
    });

    if (!user) return sendError(res, 404, 'User not found');
    if (user.totalPoints < cost) {
      return sendError(res, 400, 'Insufficient points');
    }

    // Deduct points and log reward
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { decrement: cost } },
      select: { totalPoints: true, currentBadge: true },
    });

    await prisma.reward.create({
      data: {
        userId,
        points: -cost,
        reason: `redeem_${rewardId}`,
      },
    });

    // Update badge if they fall below a threshold
    const newBadge = getBadgeForPoints(updatedUser.totalPoints);
    if (newBadge !== updatedUser.currentBadge) {
      await prisma.user.update({
        where: { id: userId },
        data: { currentBadge: newBadge },
      });
    }

    return sendSuccess(res, 200, 'Reward redeemed successfully', {
      totalPoints: updatedUser.totalPoints,
      currentBadge: newBadge,
    });
  } catch (err) {
    console.error('[REWARD] redeemPoints error:', err);
    return sendError(res, 500, 'Failed to redeem reward');
  }
};

module.exports = { getMyRewards, getLeaderboard, redeemPoints };
