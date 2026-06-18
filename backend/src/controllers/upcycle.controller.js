// GreenGuard — Upcycle Hub Controller
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response.utils');
const { uploadImage } = require('../services/cloudinary.service');
const { awardPoints } = require('../services/reward.service');

const prisma = new PrismaClient();

// GET /api/upcycle
const getUpcycleItems = async (req, res) => {
  try {
    const { status, category } = req.query;
    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const items = await prisma.upcycleItem.findMany({
      where,
      include: { donor: { select: { name: true, city: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(res, 200, 'Upcycle items retrieved', { items });
  } catch (err) {
    console.error('[UPCYCLE] getUpcycleItems error:', err);
    return sendError(res, 500, 'Failed to fetch upcycle items');
  }
};

// POST /api/upcycle
const createUpcycleItem = async (req, res) => {
  try {
    const { title, description, category } = req.body;
    const donorId = req.user.id;

    if (!req.file) {
      return sendError(res, 400, 'Image upload is mandatory for upcycling items.');
    }

    let imageUrl = null;
    const uploadResult = await uploadImage(req.file.buffer, 'upcycle');
    imageUrl = uploadResult?.url || null;
    if (!imageUrl) {
      return sendError(res, 500, 'Image upload failed.');
    }

    const item = await prisma.upcycleItem.create({
      data: {
        donorId,
        title,
        description,
        category,
        imageUrl,
      }
    });

    // Reward points for donating
    const rewardResult = await awardPoints(donorId, 15, 'upcycle_item_donated');

    return sendSuccess(res, 201, 'Upcycle item listed successfully', { item, pointsAwarded: rewardResult.pointsAwarded });
  } catch (err) {
    console.error('[UPCYCLE] createUpcycleItem error:', err);
    return sendError(res, 500, 'Failed to list upcycle item');
  }
};

// PUT /api/upcycle/:id/claim
const claimUpcycleItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // e.g., CLAIMED
    
    // Admins can mark as CLAIMED or maybe users can claim it
    const item = await prisma.upcycleItem.update({
      where: { id },
      data: { status }
    });

    return sendSuccess(res, 200, 'Upcycle item status updated', { item });
  } catch (err) {
    console.error('[UPCYCLE] claimUpcycleItem error:', err);
    return sendError(res, 500, 'Failed to update upcycle item');
  }
};

module.exports = { getUpcycleItems, createUpcycleItem, claimUpcycleItem };
