// GreenGuard — Collection Request Controller
// POST: citizen submits pickup request
// GET: role-filtered list (citizen=own, admin=all, collector=assigned)
// PUT: admin assigns collector, collector updates status
// GET /nearby: collector fetches within 10km radius

const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../utils/response.utils');
const { uploadImage } = require('../services/cloudinary.service');
const { sendEventSMS } = require('../services/sms.service');
const { awardPoints } = require('../services/reward.service');
const socketService = require('../services/socket.service');

const prisma = new PrismaClient();

// ─── POST /api/collections ────────────────────────────────────────────────────
const createCollection = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, 422, 'Validation failed', errors.array());

  try {
    const { wasteType, quantity, address } = req.body;
    const lat = req.body.lat ? parseFloat(req.body.lat) : null;
    const lng = req.body.lng ? parseFloat(req.body.lng) : null;
    const citizenId = req.user.id;

    // Upload image if provided (mandatory now)
    if (!req.file) {
      return sendError(res, 400, 'Image upload is mandatory for collection requests.');
    }
    
    let imageUrl = null;
    const result = await uploadImage(req.file.buffer, 'collections');
    imageUrl = result?.url || null;
    if (!imageUrl) {
      return sendError(res, 500, 'Image upload failed. Please try again.');
    }

    const street = req.body.street || address.split(',')[0].trim();

    const collection = await prisma.collectionRequest.create({
      data: { citizenId, wasteType, quantity: parseFloat(quantity), address, street, lat, lng, imageUrl },
      include: { citizen: { select: { name: true, phone: true } } },
    });

    // Award +5 pts to citizen
    const rewardResult = await awardPoints(citizenId, 5, 'collection_submitted', null, collection.id);

    // SMS citizen
    const citizen = collection.citizen;
    sendEventSMS('collection_assigned', { id: collection.id, collectorName: 'TBD' }, citizen.phone, citizenId);

    // Emit to admin room
    if (socketService) {
      socketService.emitNewComplaint({ complaintId: collection.id, city: 'N/A', aiCategory: wasteType, aiConfidence: 1, priority: 'MEDIUM', aiSummary: `Pickup: ${wasteType}`, location: address });
    }

    return sendSuccess(res, 201, 'Pickup request submitted', {
      collection,
      pointsAwarded: rewardResult.pointsAwarded || 0,
    });
  } catch (err) {
    console.error('[COLLECTION] createCollection error:', err);
    return sendError(res, 500, 'Failed to submit pickup request');
  }
};

// ─── GET /api/collections ─────────────────────────────────────────────────────
const getCollections = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (role === 'CITIZEN') where.citizenId = userId;
    else if (role === 'COLLECTOR') where.collectorId = userId;
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [collections, total] = await Promise.all([
      prisma.collectionRequest.findMany({
        where,
        include: {
          citizen: { select: { name: true, phone: true } },
          collector: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.collectionRequest.count({ where }),
    ]);

    return sendSuccess(res, 200, 'Collections retrieved', {
      collections,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error('[COLLECTION] getCollections error:', err);
    return sendError(res, 500, 'Failed to retrieve collections');
  }
};

// ─── GET /api/collections/nearby ──────────────────────────────────────────────
const getNearbyCollections = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query; // radius in km
    if (!lat || !lng) return sendError(res, 400, 'lat and lng are required');

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    // Haversine approximation using bounding box first, then filter
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((userLat * Math.PI) / 180));

    const nearby = await prisma.collectionRequest.findMany({
      where: {
        status: 'PENDING',
        lat: { gte: userLat - latDelta, lte: userLat + latDelta },
        lng: { gte: userLng - lngDelta, lte: userLng + lngDelta },
      },
      include: { citizen: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, 200, 'Nearby collections retrieved', { collections: nearby });
  } catch (err) {
    console.error('[COLLECTION] getNearbyCollections error:', err);
    return sendError(res, 500, 'Failed to retrieve nearby collections');
  }
};

// ─── PUT /api/collections/:id ─────────────────────────────────────────────────
const updateCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, collectorId } = req.body;
    const { role, id: userId } = req.user;

    const collection = await prisma.collectionRequest.findUnique({
      where: { id },
      include: {
        citizen: { select: { id: true, name: true, phone: true } },
        collector: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!collection) return sendError(res, 404, 'Collection request not found');

    const updateData = {};

    // Admin assigning a collector
    if (role === 'ADMIN' && collectorId) {
      updateData.collectorId = collectorId;
      updateData.status = 'ASSIGNED';

      const collector = await prisma.user.findUnique({ where: { id: collectorId }, select: { name: true, phone: true } });

      // SMS citizen
      sendEventSMS('collection_assigned', { id, collectorName: collector?.name || 'Our team' }, collection.citizen.phone, collection.citizen.id);

      // SMS collector
      if (collector) {
        sendEventSMS('collection_new_task', { id, address: collection.address, wasteType: collection.wasteType }, collector.phone, collectorId);
      }

      // Socket
      socketService.emitCollectionAssigned(collection.citizen.id, collectorId, {
        collectionId: id, address: collection.address, wasteType: collection.wasteType,
      });
    }

    // Collector updating status
    if (role === 'COLLECTOR') {
      if (collection.collectorId !== userId) return sendError(res, 403, 'Not your assigned collection');
      updateData.status = status;
    }

    // On COMPLETED — award points to citizen (+15) and collector (+10)
    if (status === 'COMPLETED') {
      const citizenReward = await awardPoints(collection.citizen.id, 15, 'collection_completed', null, id);
      const collectorReward = await awardPoints(collection.collectorId, 10, 'collection_completed_collector', null, id);

      // SMS citizen
      const freshCitizen = await prisma.user.findUnique({ where: { id: collection.citizen.id }, select: { totalPoints: true, phone: true } });
      sendEventSMS('collection_completed', { id, points: freshCitizen?.totalPoints || 0 }, collection.citizen.phone, collection.citizen.id);

      // Emit points
      if (citizenReward.awarded) {
        socketService.emitPointsAwarded(collection.citizen.id, { points: citizenReward.pointsAwarded, newTotal: citizenReward.newTotal, badge: citizenReward.newBadge });
      }

      // Badge SMS for citizen
      if (citizenReward.badgeUnlocked) {
        sendEventSMS('badge_earned', { badge: citizenReward.newBadge, points: citizenReward.newTotal }, collection.citizen.phone, collection.citizen.id);
      }
    }

    const updated = await prisma.collectionRequest.update({
      where: { id },
      data: updateData,
    });

    return sendSuccess(res, 200, 'Collection updated', { collection: updated });
  } catch (err) {
    console.error('[COLLECTION] updateCollection error:', err);
    return sendError(res, 500, 'Failed to update collection');
  }
};

module.exports = { createCollection, getCollections, getNearbyCollections, updateCollection };
