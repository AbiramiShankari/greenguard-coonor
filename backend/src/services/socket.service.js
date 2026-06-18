// GreenGuard — Socket.io Service
// Centralizes all Socket.io emit logic so controllers stay clean
// Server instance is injected once at startup via init()

let io = null;

/**
 * Initialize with the Socket.io server instance.
 * Called once from server.js after socket setup.
 */
const init = (socketServer) => {
  io = socketServer;
};

/**
 * Emit a new complaint alert to all admin users
 * Room: "admin"
 */
const emitNewComplaint = (data) => {
  if (!io) return;
  io.to('admin').emit('new_complaint', {
    complaintId: data.complaintId,
    city: data.city,
    category: data.aiCategory,
    confidence: data.aiConfidence,
    priority: data.priority,
    summary: data.aiSummary,
    timestamp: new Date().toISOString(),
  });

  // If CRITICAL — also emit critical_alert
  if (data.priority === 'CRITICAL') {
    io.to('admin').emit('critical_alert', {
      complaintId: data.complaintId,
      priority: 'CRITICAL',
      location: data.location,
      category: data.aiCategory,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Emit status update to the specific citizen's room
 * Room: userId
 */
const emitStatusUpdated = (userId, data) => {
  if (!io) return;
  io.to(userId).emit('status_updated', {
    complaintId: data.complaintId,
    newStatus: data.newStatus,
    earnedPoints: data.earnedPoints || 0,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit collection assignment to citizen + collector
 */
const emitCollectionAssigned = (citizenId, collectorId, data) => {
  if (!io) return;
  const payload = {
    collectionId: data.collectionId,
    address: data.address,
    wasteType: data.wasteType,
    timestamp: new Date().toISOString(),
  };
  io.to(citizenId).emit('collection_assigned', payload);
  io.to(`collector_${collectorId}`).emit('collection_assigned', payload);
};

/**
 * Emit points awarded event to the specific user's room
 */
const emitPointsAwarded = (userId, data) => {
  if (!io) return;
  io.to(userId).emit('points_awarded', {
    points: data.points,
    newTotal: data.newTotal,
    badge: data.badge || null,
    timestamp: new Date().toISOString(),
  });
};

module.exports = { init, emitNewComplaint, emitStatusUpdated, emitCollectionAssigned, emitPointsAwarded };
