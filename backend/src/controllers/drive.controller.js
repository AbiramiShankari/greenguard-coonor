// GreenGuard — Local Drive Controller
// Manages community cleanup and plantation drives

const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../utils/response.utils');
const { sendEventSMS } = require('../services/sms.service');
const { awardPoints } = require('../services/reward.service');
const { uploadImage } = require('../services/cloudinary.service');

const prisma = new PrismaClient();

// ─── POST /api/drives ──────────────────────────────────────────────────────────
const createDrive = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 422, 'Validation failed', errors.array());
  }

  try {
    const { title, description, location, city, ward, date } = req.body;
    const adminId = req.user.id;

    let imageUrl = null;
    if (req.file) {
      const uploadResult = await uploadImage(req.file.buffer, 'drives');
      imageUrl = uploadResult?.url || null;
    }

    const drive = await prisma.localDrive.create({
      data: {
        title,
        description,
        location,
        city,
        ward,
        date: new Date(date),
        imageUrl,
        organizerId: adminId,
        status: 'PLANNED',
      },
    });

    return sendSuccess(res, 201, 'Drive created successfully', drive);
  } catch (error) {
    console.error('[DriveController] createDrive Error:', error);
    return sendError(res, 500, 'Failed to create drive');
  }
};

// ─── GET /api/drives ───────────────────────────────────────────────────────────
const getDrives = async (req, res) => {
  try {
    const { status, city, ward } = req.query;

    const where = {};
    if (status) where.status = status;
    if (city) where.city = city;
    if (ward) where.ward = ward;

    const drives = await prisma.localDrive.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        _count: { select: { participants: true } },
      },
    });

    return sendSuccess(res, 200, 'Drives fetched successfully', drives);
  } catch (error) {
    console.error('[DriveController] getDrives Error:', error);
    return sendError(res, 500, 'Failed to fetch drives');
  }
};

// ─── GET /api/drives/:id ───────────────────────────────────────────────────────
const getDriveById = async (req, res) => {
  try {
    const { id } = req.params;

    const drive = await prisma.localDrive.findUnique({
      where: { id },
      include: {
        organizer: { select: { name: true, email: true } },
        participants: {
          include: { user: { select: { id: true, name: true, city: true, phone: true } } },
        },
      },
    });

    if (!drive) return sendError(res, 404, 'Drive not found');

    return sendSuccess(res, 200, 'Drive details fetched', drive);
  } catch (error) {
    console.error('[DriveController] getDriveById Error:', error);
    return sendError(res, 500, 'Failed to fetch drive');
  }
};

// ─── POST /api/drives/:id/join ─────────────────────────────────────────────────
const joinDrive = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const drive = await prisma.localDrive.findUnique({ where: { id } });
    if (!drive) return sendError(res, 404, 'Drive not found');
    if (drive.status === 'COMPLETED') return sendError(res, 400, 'Cannot join a completed drive');

    const existing = await prisma.driveParticipant.findUnique({
      where: { driveId_userId: { driveId: id, userId } },
    });

    if (existing) {
      return sendError(res, 400, 'You have already registered for this drive');
    }

    const participant = await prisma.driveParticipant.create({
      data: {
        driveId: id,
        userId,
        status: 'REGISTERED',
      },
    });

    // Send SMS
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.phone) {
      const formattedDate = new Date(drive.date).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short'
      });
      await sendEventSMS('drive_registered', { title: drive.title, date: formattedDate }, user.phone, userId);
    }

    return sendSuccess(res, 200, 'Successfully joined the drive', participant);
  } catch (error) {
    console.error('[DriveController] joinDrive Error:', error);
    return sendError(res, 500, 'Failed to join drive');
  }
};

// ─── POST /api/drives/:id/attendance ───────────────────────────────────────────
const markAttendance = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 422, 'Validation failed', errors.array());
  }

  try {
    const { id } = req.params;
    const { userId, attended } = req.body;

    const drive = await prisma.localDrive.findUnique({ where: { id } });
    if (!drive) return sendError(res, 404, 'Drive not found');

    const participant = await prisma.driveParticipant.findUnique({
      where: { driveId_userId: { driveId: id, userId } },
    });

    if (!participant) return sendError(res, 404, 'User is not registered for this drive');

    if (attended && participant.status !== 'ATTENDED') {
      await prisma.driveParticipant.update({
        where: { id: participant.id },
        data: { status: 'ATTENDED' },
      });

      // Award Points (20 points by default)
      const points = 20;
      await awardPoints(userId, points, 'drive_participation', null, null, id);

      // Send SMS
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user && user.phone) {
        await sendEventSMS('drive_attended', {
          title: drive.title,
          points,
          totalPoints: user.totalPoints + points, // Simplistic, might not reflect real-time total if concurrent
        }, user.phone, userId);
      }
    } else if (!attended && participant.status === 'ATTENDED') {
      // Revert if mistake (optional - usually better not to revert points automatically to avoid abuse, but let's just update status for now)
      await prisma.driveParticipant.update({
        where: { id: participant.id },
        data: { status: 'REGISTERED' },
      });
    }

    return sendSuccess(res, 200, 'Attendance updated successfully');
  } catch (error) {
    console.error('[DriveController] markAttendance Error:', error);
    return sendError(res, 500, 'Failed to mark attendance');
  }
};

// ─── PATCH /api/drives/:id/status ──────────────────────────────────────────────
const updateDriveStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 422, 'Validation failed', errors.array());
  }

  try {
    const { id } = req.params;
    const { status } = req.body; // PLANNED, ONGOING, COMPLETED

    const drive = await prisma.localDrive.findUnique({ where: { id } });
    if (!drive) return sendError(res, 404, 'Drive not found');

    const updatedDrive = await prisma.localDrive.update({
      where: { id },
      data: { status },
    });

    return sendSuccess(res, 200, 'Drive status updated', updatedDrive);
  } catch (error) {
    console.error('[DriveController] updateDriveStatus Error:', error);
    return sendError(res, 500, 'Failed to update status');
  }
};

module.exports = {
  createDrive,
  getDrives,
  getDriveById,
  joinDrive,
  markAttendance,
  updateDriveStatus,
};
