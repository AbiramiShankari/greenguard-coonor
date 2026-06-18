// GreenGuard — Reward Service
// Handles awardPoints() with daily cap, badge thresholds, and duplicate prevention

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Badge thresholds — ascending order matters for threshold checks
const BADGE_THRESHOLDS = [
  { minPoints: 1000, badge: 'City Hero 🏆' },
  { minPoints: 500, badge: 'Eco Warrior 🌿' },
  { minPoints: 200, badge: 'Green Champion 🥇' },
  { minPoints: 100, badge: 'Silver Guardian 🥈' },
  { minPoints: 50, badge: 'Bronze Citizen 🥉' },
];

const DAILY_POINTS_CAP = 50;

/**
 * Determine the badge for a given total points value
 * Returns the highest badge the user qualifies for
 */
const getBadgeForPoints = (totalPoints) => {
  for (const threshold of BADGE_THRESHOLDS) {
    if (totalPoints >= threshold.minPoints) {
      return threshold.badge;
    }
  }
  return null;
};

/**
 * Award points to a user with daily cap and badge threshold checks.
 * Returns: { awarded, newTotal, newBadge } or null if duplicate/capped
 *
 * @param {string} userId
 * @param {number} points - Points to award
 * @param {string} reason - Event reason string (e.g. "complaint_submitted")
 * @param {string|null} complaintId - Optional linked complaint ID
 * @param {string|null} collectionId - Optional linked collection ID
 * @returns {Promise<{awarded: boolean, newTotal: number, newBadge: string|null, badgeUnlocked: boolean}>}
 */
const awardPoints = async (userId, points, reason, complaintId = null, collectionId = null) => {
  try {
    // 1. Check for daily cap — sum today's rewards for this user
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayPoints = await prisma.reward.aggregate({
      where: {
        userId,
        createdAt: { gte: todayStart },
      },
      _sum: { points: true },
    });

    const earnedToday = todayPoints._sum.points || 0;
    if (earnedToday >= DAILY_POINTS_CAP) {
      console.log(`[REWARD] Daily cap reached for user ${userId} — skipping award`);
      return { awarded: false, reason: 'daily_cap_reached' };
    }

    // Cap the award to not exceed daily limit
    const cappedPoints = Math.min(points, DAILY_POINTS_CAP - earnedToday);

    // 2. Create the reward entry (@@unique prevents duplicates)
    const reward = await prisma.reward.create({
      data: {
        userId,
        points: cappedPoints,
        reason,
        complaintId,
        collectionId,
      },
    });

    // 3. Update user total points
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { increment: cappedPoints } },
      select: { totalPoints: true, currentBadge: true },
    });

    const newTotal = updatedUser.totalPoints;
    const previousBadge = updatedUser.currentBadge;
    const newBadge = getBadgeForPoints(newTotal);
    const badgeUnlocked = newBadge && newBadge !== previousBadge;

    // 4. If new badge unlocked — update user record and create badge reward entry
    if (badgeUnlocked) {
      await prisma.user.update({
        where: { id: userId },
        data: { currentBadge: newBadge },
      });

      // Log badge reward (reason = "badge_earned")
      await prisma.reward.create({
        data: {
          userId,
          points: 0,
          reason: 'badge_earned',
          badge: newBadge,
          complaintId,
          collectionId,
        },
      });
    }

    return {
      awarded: true,
      pointsAwarded: cappedPoints,
      newTotal,
      newBadge: badgeUnlocked ? newBadge : null,
      badgeUnlocked,
    };
  } catch (err) {
    // Ignore unique constraint errors (duplicate award attempts)
    if (err.code === 'P2002') {
      console.log(`[REWARD] Duplicate award prevented for user ${userId}, reason: ${reason}`);
      return { awarded: false, reason: 'duplicate_prevented' };
    }
    console.error('[REWARD] awardPoints error:', err);
    return { awarded: false, reason: 'error' };
  }
};

module.exports = { awardPoints, getBadgeForPoints, BADGE_THRESHOLDS };
