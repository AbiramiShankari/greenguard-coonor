// GreenGuard — Collector Controller
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response.utils');
const { sendEventSMS } = require('../services/sms.service');

const { uploadImage } = require('../services/cloudinary.service');

const prisma = new PrismaClient();

// ─── GET /api/collector/tasks ──────────────────────────────────────────────────
const getMyTasks = async (req, res) => {
  try {
    const collectorId = req.user.id;

    // Fetch complaints assigned to this collector
    const complaints = await prisma.complaint.findMany({
      where: { collectorId, status: { in: ['IN_PROGRESS', 'RESOLVED'] } },
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch pickups assigned to this collector
    const pickups = await prisma.collectionRequest.findMany({
      where: { collectorId, status: { in: ['ASSIGNED', 'COMPLETED'] } },
      include: { citizen: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, 200, 'Tasks retrieved', { complaints, pickups });
  } catch (err) {
    console.error('[COLLECTOR] getMyTasks error:', err);
    return sendError(res, 500, 'Failed to retrieve tasks');
  }
};

// ─── POST /api/collector/tasks/resolve ─────────────────────────────────────────
const resolveTask = async (req, res) => {
  try {
    const { taskId, type } = req.body;
    let { resolvedImageUrl } = req.body;
    const collectorId = req.user.id;

    if (!taskId || !type) {
      return sendError(res, 400, 'Missing required fields (taskId, type)');
    }

    if (req.file) {
      const uploadResult = await uploadImage(req.file.buffer, 'resolutions');
      if (uploadResult && uploadResult.url) {
        resolvedImageUrl = uploadResult.url;
      } else {
        return sendError(res, 500, 'Failed to upload resolution image');
      }
    }

    if (!resolvedImageUrl) {
      return sendError(res, 400, 'A resolution image is required');
    }

    if (type === 'complaint') {
      const complaint = await prisma.complaint.findUnique({ where: { id: taskId }, include: { user: true } });
      if (!complaint || complaint.collectorId !== collectorId) {
        return sendError(res, 403, 'Unauthorized or complaint not found');
      }

      await prisma.$transaction([
        prisma.complaint.update({
          where: { id: taskId },
          data: { status: 'RESOLVED', resolvedImageUrl }
        }),
        // Reward Collector
        prisma.reward.create({
          data: {
            userId: collectorId,
            points: 10,
            reason: 'Complaint Resolved (Worker Credit)',
            complaintId: taskId
          }
        }),
        prisma.user.update({
          where: { id: collectorId },
          data: { totalPoints: { increment: 10 } }
        })
      ]);

      // Notify citizen if applicable
      if (complaint.user?.phone) {
        // Assume citizen gets points too based on old logic, but let's just notify them
        await sendEventSMS('complaint_resolved', { id: taskId, points: complaint.user.totalPoints }, complaint.user.phone, complaint.user.id, true);
      }

      return sendSuccess(res, 200, 'Complaint resolved successfully');
    } else if (type === 'pickup') {
      const pickup = await prisma.collectionRequest.findUnique({ where: { id: taskId }, include: { citizen: true } });
      if (!pickup || pickup.collectorId !== collectorId) {
        return sendError(res, 403, 'Unauthorized or pickup not found');
      }

      await prisma.$transaction([
        prisma.collectionRequest.update({
          where: { id: taskId },
          data: { status: 'COMPLETED', resolvedImageUrl }
        }),
        // Reward Collector
        prisma.reward.create({
          data: {
            userId: collectorId,
            points: 15,
            reason: 'Pickup Completed (Worker Credit)',
            collectionId: taskId
          }
        }),
        prisma.user.update({
          where: { id: collectorId },
          data: { totalPoints: { increment: 15 } }
        })
      ]);

      // Notify citizen
      if (pickup.citizen?.phone) {
        await sendEventSMS('collection_completed', { id: taskId, points: pickup.citizen.totalPoints }, pickup.citizen.phone, pickup.citizen.id, true);
      }

      return sendSuccess(res, 200, 'Pickup resolved successfully');
    } else {
      return sendError(res, 400, 'Invalid task type');
    }
  } catch (err) {
    console.error('[COLLECTOR] resolveTask error:', err);
    return sendError(res, 500, 'Failed to resolve task');
  }
};

module.exports = { getMyTasks, resolveTask };
