// GreenGuard — Map Controller
// Endpoints optimised for Leaflet.js map rendering
// Returns lat/lng + AI fields for complaint markers and heatmap overlay

const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response.utils');

const prisma = new PrismaClient();

// Status → marker color mapping (used by frontend)
const STATUS_COLORS = {
  NEW: 'red',
  IN_PROGRESS: 'orange',
  RESOLVED: 'green',
  CLOSED: 'grey',
  DUPLICATE: 'grey',
};

// ─── GET /api/map/complaints ──────────────────────────────────────────────────
const getComplaintMapData = async (req, res) => {
  try {
    const { city, status, category, dateFrom, dateTo } = req.query;

    const where = {
      lat: { not: null }, // Only complaints with coordinates
      lng: { not: null },
    };
    if (city) where.city = city;
    if (status) where.status = status;
    if (category) where.aiCategory = category;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const complaints = await prisma.complaint.findMany({
      where,
      select: {
        id: true,
        lat: true,
        lng: true,
        status: true,
        priority: true,
        aiCategory: true,
        aiConfidence: true,
        aiSummary: true,
        description: true,
        imageUrl: true,
        upvoteCount: true,
        city: true,
        ward: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500, // Cap to prevent browser overload
    });

    // Add color hint for marker rendering
    const markers = complaints.map((c) => ({
      ...c,
      markerColor: STATUS_COLORS[c.status] || 'grey',
      descriptionPreview: c.description.slice(0, 80),
    }));

    return sendSuccess(res, 200, 'Map data retrieved', { markers });
  } catch (err) {
    console.error('[MAP] getComplaintMapData error:', err);
    return sendError(res, 500, 'Failed to retrieve map data');
  }
};

// ─── GET /api/map/collections ─────────────────────────────────────────────────
const getCollectionMapData = async (req, res) => {
  try {
    const collections = await prisma.collectionRequest.findMany({
      where: {
        lat: { not: null },
        lng: { not: null },
        status: { in: ['PENDING', 'ASSIGNED'] },
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        wasteType: true,
        quantity: true,
        address: true,
        status: true,
        citizen: { select: { name: true } },
      },
      take: 200,
    });

    return sendSuccess(res, 200, 'Collection map data retrieved', { collections });
  } catch (err) {
    console.error('[MAP] getCollectionMapData error:', err);
    return sendError(res, 500, 'Failed to retrieve collection map data');
  }
};

// ─── GET /api/map/heatmap ─────────────────────────────────────────────────────
const getHeatmapData = async (req, res) => {
  try {
    const { city } = req.query;
    const where = { lat: { not: null }, lng: { not: null } };
    if (city) where.city = city;

    const complaints = await prisma.complaint.findMany({
      where,
      select: { lat: true, lng: true, priority: true },
      take: 1000,
    });

    // Return [lat, lng, intensity] — intensity based on priority
    const priorityIntensity = { LOW: 0.2, MEDIUM: 0.5, HIGH: 0.8, CRITICAL: 1.0 };
    const heatData = complaints.map((c) => [
      c.lat,
      c.lng,
      priorityIntensity[c.priority] || 0.5,
    ]);

    return sendSuccess(res, 200, 'Heatmap data retrieved', { heatData });
  } catch (err) {
    console.error('[MAP] getHeatmapData error:', err);
    return sendError(res, 500, 'Failed to retrieve heatmap data');
  }
};

module.exports = { getComplaintMapData, getCollectionMapData, getHeatmapData };
