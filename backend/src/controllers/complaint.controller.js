// GreenGuard — Complaint Controller
// Full complaint lifecycle: submit → AI → Cloudinary → SMS → Socket
// GET with role-based filtering, status update with full side-effect chain

const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError } = require('../utils/response.utils');
const { uploadImage } = require('../services/cloudinary.service');
const { categoriseComplaint, detectDuplicate } = require('../services/gemini.service');
const { sendEventSMS } = require('../services/sms.service');
const { awardPoints } = require('../services/reward.service');
const { sendStatusUpdateEmail } = require('../services/email.service');
const socketService = require('../services/socket.service');

const prisma = new PrismaClient();

// ─── POST /api/complaints ─────────────────────────────────────────────────────
const createComplaint = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 422, 'Validation failed', errors.array());
  }

  try {
    const { location, city, ward, description } = req.body;
    const lat = req.body.lat ? parseFloat(req.body.lat) : null;
    const lng = req.body.lng ? parseFloat(req.body.lng) : null;
    const userId = req.user.id;

    // Step 1: Upload image to Cloudinary (mandatory)
    if (!req.file) {
      return sendError(res, 400, 'Image upload is mandatory for complaints.');
    }
    
    let imageUrl = null;
    let imageHash = null;
    
    const uploadResult = await uploadImage(req.file.buffer, 'complaints');
    imageUrl = uploadResult?.url || null;
    if (!imageUrl) {
      return sendError(res, 500, 'Image upload failed. Please try again.');
    }
    
    // Simulate AI Image Analysis for duplicate detection (e.g., perceptual hash)
    // In a real app, this would use an AI model or phash library.
    imageHash = `hash-${req.file.buffer.length}-${Date.now()}`;

    // Step 2: AI categorisation (never blocks — fallback on failure)
    // Pass both the imageUrl and the raw file buffer to Gemini for multi-modal processing
    const aiResult = await categoriseComplaint(description, imageUrl, req.file);

    // Step 3: Fetch recent complaints in same city + ward for duplicate detection
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recentComplaints = await prisma.complaint.findMany({
      where: {
        city,
        ward,
        createdAt: { gte: fortyEightHoursAgo },
        status: { notIn: ['DUPLICATE'] },
      },
      select: { id: true, description: true, location: true, imageHash: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Step 4: Detect duplicate (text/location based + image hash based)
    const dupResult = await detectDuplicate({ description, location, city, ward }, recentComplaints);
    let isDuplicate = dupResult.isDuplicate && dupResult.confidence > 0.75;
    let duplicateOfId = dupResult.duplicateOf;
    
    // Image duplicate check (simulate exact or near match)
    // Here we just check if an exact hash exists for simplicity of simulation
    const imageDup = recentComplaints.find(c => c.imageHash === imageHash);
    if (imageDup) {
      isDuplicate = true;
      duplicateOfId = imageDup.id;
    }

    // Extract street from req.body or location
    const street = req.body.street || location.split(',')[0].trim();

    // Step 5: Save complaint to database
    const complaint = await prisma.complaint.create({
      data: {
        userId,
        city,
        ward,
        street,
        location,
        description,
        imageUrl,
        imageHash,
        lat,
        lng,
        aiCategory: aiResult.category,
        aiConfidence: aiResult.confidence,
        aiSeverity: aiResult.severity,
        aiSeverityScore: aiResult.severityScore,
        aiSummary: aiResult.summary,
        priority: isDuplicate ? 'MEDIUM' : (aiResult.suggestedPriority || 'MEDIUM'),
        status: isDuplicate ? 'DUPLICATE' : 'NEW',
        duplicateOf: isDuplicate ? duplicateOfId : null,
      },
      include: { user: { select: { name: true, phone: true, totalPoints: true } } },
    });

    // Step 6: Award points (skip for duplicates)
    let pointsResult = { awarded: false };
    if (!isDuplicate) {
      pointsResult = await awardPoints(userId, 10, 'complaint_submitted', complaint.id);
    }

    // Step 7: Send SMS to citizen (fire-and-forget — do not await blocking)
    const citizen = complaint.user;
    if (!isDuplicate) {
      sendEventSMS(
        'complaint_submitted',
        { id: complaint.id, city, category: aiResult.category },
        citizen.phone,
        userId
      );
    } else {
      sendEventSMS(
        'complaint_duplicate',
        { id: complaint.id, duplicateOf: dupResult.duplicateOf },
        citizen.phone,
        userId
      );
    }

    // Step 8: Send alert SMS to ADMIN_PHONE
    if (!isDuplicate && process.env.ADMIN_PHONE) {
      const eventName = complaint.priority === 'CRITICAL' ? 'critical_complaint' : 'admin_new_complaint';
      sendEventSMS(
        eventName,
        { id: complaint.id, ward, city, category: aiResult.category },
        process.env.ADMIN_PHONE,
        null,
        false // skip opt-in check for admin notifications
      );
    }

    // Step 9: Emit Socket.io event to admin room
    socketService.emitNewComplaint({
      complaintId: complaint.id,
      city,
      aiCategory: aiResult.category,
      aiConfidence: aiResult.confidence,
      priority: complaint.priority,
      aiSummary: aiResult.summary,
      location,
    });

    // Step 10: Emit points to citizen's socket room
    if (pointsResult.awarded) {
      socketService.emitPointsAwarded(userId, {
        points: pointsResult.pointsAwarded,
        newTotal: pointsResult.newTotal,
        badge: pointsResult.newBadge,
      });
    }

    return sendSuccess(res, 201, 'Complaint submitted successfully', {
      complaint,
      aiResult,
      isDuplicate,
      duplicateOf: isDuplicate ? dupResult.duplicateOf : null,
      pointsAwarded: pointsResult.pointsAwarded || 0,
    });
  } catch (err) {
    console.error('[COMPLAINT] createComplaint error:', err);
    return sendError(res, 500, 'Failed to submit complaint — please try again');
  }
};

// ─── GET /api/complaints ──────────────────────────────────────────────────────
const getComplaints = async (req, res) => {
  try {
    const { role, id: userId, city: userCity } = req.user;
    const { status, city, priority, category, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

    // Build where clause based on role
    const where = {};

    if (role === 'CITIZEN') {
      where.userId = userId; // Citizens see only their own complaints
    }

    // Apply filters (admin can filter by city; citizen locked to own data)
    if (status) where.status = status;
    if (city && role === 'ADMIN') where.city = city;
    if (priority) where.priority = priority;
    if (category) where.aiCategory = category;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: {
          user: { select: { name: true, email: true, phone: true } },
          _count: { select: { upvotes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.complaint.count({ where }),
    ]);

    return sendSuccess(res, 200, 'Complaints retrieved', {
      complaints,
      pagination: { total, page: parseInt(page), limit: take, pages: Math.ceil(total / take) },
    });
  } catch (err) {
    console.error('[COMPLAINT] getComplaints error:', err);
    return sendError(res, 500, 'Failed to retrieve complaints');
  }
};

// ─── GET /api/complaints/:id ──────────────────────────────────────────────────
const getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        statusHistory: { include: { changedBy: { select: { name: true, role: true } } } },
        _count: { select: { upvotes: true } },
      },
    });

    if (!complaint) return sendError(res, 404, 'Complaint not found');
    if (role === 'CITIZEN' && complaint.userId !== userId) {
      return sendError(res, 403, 'Access denied');
    }

    return sendSuccess(res, 200, 'Complaint retrieved', { complaint });
  } catch (err) {
    console.error('[COMPLAINT] getComplaintById error:', err);
    return sendError(res, 500, 'Failed to retrieve complaint');
  }
};

// ─── GET /api/complaints/nearby ───────────────────────────────────────────────
const getNearbyComplaints = async (req, res) => {
  try {
    const { id: userId, city } = req.user;
    
    // Fetch recent complaints in the same city, excluding the user's own
    const nearby = await prisma.complaint.findMany({
      where: {
        city: city,
        userId: { not: userId },
        status: { notIn: ['DUPLICATE'] }
      },
      include: {
        _count: { select: { upvotes: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    return sendSuccess(res, 200, 'Nearby complaints retrieved', { nearby });
  } catch (err) {
    console.error('[COMPLAINT] getNearbyComplaints error:', err);
    return sendError(res, 500, 'Failed to retrieve nearby complaints');
  }
};

// ─── PUT /api/complaints/:id (admin only) ─────────────────────────────────────
const updateComplaintStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 422, 'Validation failed', errors.array());
  }

  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const adminId = req.user.id;

    const existing = await prisma.complaint.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, phone: true, email: true, totalPoints: true } } },
    });

    if (!existing) return sendError(res, 404, 'Complaint not found');

    const fromStatus = existing.status;

    // Update complaint status + insert StatusHistory in a transaction
    const [updatedComplaint] = await prisma.$transaction([
      prisma.complaint.update({
        where: { id },
        data: { status },
      }),
      prisma.statusHistory.create({
        data: {
          complaintId: id,
          changedById: adminId,
          fromStatus,
          toStatus: status,
          note: note || null,
        },
      }),
    ]);

    const citizen = existing.user;
    let earnedPoints = 0;

    // Award +5 pts on RESOLVED
    if (status === 'RESOLVED') {
      const rewardResult = await awardPoints(citizen.id, 5, 'complaint_resolved', id);
      earnedPoints = rewardResult.pointsAwarded || 0;

      // Emit points to citizen room
      if (rewardResult.awarded) {
        socketService.emitPointsAwarded(citizen.id, {
          points: rewardResult.pointsAwarded,
          newTotal: rewardResult.newTotal,
          badge: rewardResult.newBadge,
        });

        // Send badge SMS if unlocked
        if (rewardResult.badgeUnlocked) {
          sendEventSMS('badge_earned', { badge: rewardResult.newBadge, points: rewardResult.newTotal }, citizen.phone, citizen.id);
        }
      }
    }

    // SMS event map for status changes
    const smsEventMap = {
      IN_PROGRESS: 'complaint_in_progress',
      RESOLVED: 'complaint_resolved',
    };

    const smsEvent = smsEventMap[status];
    if (smsEvent) {
      // Fetch updated total points for SMS
      const freshUser = await prisma.user.findUnique({ where: { id: citizen.id }, select: { totalPoints: true } });
      sendEventSMS(smsEvent, { id, points: freshUser?.totalPoints || 0 }, citizen.phone, citizen.id);
    }

    // Send email on status change
    sendStatusUpdateEmail({
      toEmail: citizen.email,
      toName: citizen.name,
      complaintId: id,
      newStatus: status,
      city: existing.city,
      earnedPoints,
    });

    // Emit Socket.io status update to citizen's room
    socketService.emitStatusUpdated(citizen.id, {
      complaintId: id,
      newStatus: status,
      earnedPoints,
    });

    return sendSuccess(res, 200, 'Complaint status updated', { complaint: updatedComplaint, earnedPoints });
  } catch (err) {
    console.error('[COMPLAINT] updateComplaintStatus error:', err);
    return sendError(res, 500, 'Failed to update complaint status');
  }
};

// ─── POST /api/complaints/:id/upvote ──────────────────────────────────────────
const upvoteComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return sendError(res, 404, 'Complaint not found');

    // Check if already upvoted
    const existing = await prisma.upvote.findUnique({
      where: { userId_complaintId: { userId, complaintId: id } },
    });

    if (existing) {
      // Toggle off — remove upvote
      await prisma.$transaction([
        prisma.upvote.delete({ where: { userId_complaintId: { userId, complaintId: id } } }),
        prisma.complaint.update({ where: { id }, data: { upvoteCount: { decrement: 1 } } }),
      ]);
      return sendSuccess(res, 200, 'Upvote removed', { upvoted: false });
    }

    // Add upvote
    await prisma.$transaction([
      prisma.upvote.create({ data: { userId, complaintId: id } }),
      prisma.complaint.update({ where: { id }, data: { upvoteCount: { increment: 1 } } }),
    ]);

    return sendSuccess(res, 200, 'Upvote added', { upvoted: true });
  } catch (err) {
    console.error('[COMPLAINT] upvoteComplaint error:', err);
    return sendError(res, 500, 'Failed to upvote');
  }
};

module.exports = { createComplaint, getComplaints, getComplaintById, getNearbyComplaints, updateComplaintStatus, upvoteComplaint };
