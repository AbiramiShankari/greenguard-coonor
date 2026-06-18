// GreenGuard — AI Route Optimization Controller
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response.utils');

const prisma = new PrismaClient();

// Simulated route optimization using nearest neighbor and priority heuristics
// GET /api/routes/optimize
const optimizeRoute = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return sendError(res, 400, 'Current location lat/lng required');
    
    const collectorLat = parseFloat(lat);
    const collectorLng = parseFloat(lng);
    const collectorId = req.user.id;

    // Fetch assigned collections
    const collections = await prisma.collectionRequest.findMany({
      where: { collectorId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
      include: { citizen: { select: { name: true, phone: true } } }
    });

    // Fetch overflowing smart bins (simulating that collectors also empty these)
    const bins = await prisma.smartBin.findMany({
      where: { fillLevel: { gte: 80 } }
    });

    // Combine tasks
    let tasks = [
      ...collections.map(c => ({ ...c, type: 'COLLECTION', priorityScore: 1 })),
      ...bins.map(b => ({ ...b, type: 'SMART_BIN', priorityScore: b.fillLevel >= 95 ? 2 : 1 }))
    ];

    // Distance calculation helper (Haversine)
    const getDist = (lat1, lon1, lat2, lon2) => {
      const p = 0.017453292519943295;    // Math.PI / 180
      const c = Math.cos;
      const a = 0.5 - c((lat2 - lat1) * p)/2 + 
                c(lat1 * p) * c(lat2 * p) * 
                (1 - c((lon2 - lon1) * p))/2;
      return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
    };

    // Sort tasks by priority and then distance (nearest neighbor heuristic)
    let optimizedRoute = [];
    let currentLat = collectorLat;
    let currentLng = collectorLng;

    while (tasks.length > 0) {
      // Find nearest highest priority task
      tasks.sort((a, b) => {
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore; // Higher priority first
        }
        const distA = getDist(currentLat, currentLng, a.lat, a.lng);
        const distB = getDist(currentLat, currentLng, b.lat, b.lng);
        return distA - distB; // Closer first
      });

      const nextTask = tasks.shift();
      nextTask.distanceFromPrevious = getDist(currentLat, currentLng, nextTask.lat, nextTask.lng).toFixed(2);
      optimizedRoute.push(nextTask);

      currentLat = nextTask.lat;
      currentLng = nextTask.lng;
    }

    return sendSuccess(res, 200, 'Route optimized', { route: optimizedRoute });
  } catch (err) {
    console.error('[ROUTE] optimizeRoute error:', err);
    return sendError(res, 500, 'Failed to optimize route');
  }
};

module.exports = { optimizeRoute };
