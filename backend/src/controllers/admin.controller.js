// GreenGuard — Admin Controller
// Dashboard stats, AI insight management, SMS log management

const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response.utils');
const { generateAdminInsight } = require('../services/gemini.service');
const { sendSMS, sendEventSMS } = require('../services/sms.service');

const prisma = new PrismaClient();

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const [
      totalComplaintsToday,
      resolvedToday,
      criticalOpen,
      activeUsersThisWeek,
      smsSentToday,
      categoryData,
      severityData
    ] = await Promise.all([
      prisma.complaint.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.complaint.count({ where: { status: 'RESOLVED', updatedAt: { gte: todayStart } } }),
      prisma.complaint.count({ where: { priority: 'CRITICAL', status: { in: ['NEW', 'IN_PROGRESS'] } } }),
      prisma.user.count({ where: { updatedAt: { gte: weekStart } } }),
      prisma.sMSLog.count({ where: { status: 'SENT', createdAt: { gte: todayStart } } }),
      prisma.complaint.groupBy({ by: ['aiCategory'], _count: { aiCategory: true }, where: { aiCategory: { not: null } } }),
      prisma.complaint.groupBy({ by: ['priority'], _count: { priority: true } })
    ]);

    // Trend data for last 7 days
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d.setHours(0,0,0,0));
      const end = new Date(d.setHours(23,59,59,999));
      const count = await prisma.complaint.count({ where: { createdAt: { gte: start, lte: end } } });
      trendData.push({ name: start.toLocaleDateString('en-US', { weekday: 'short' }), complaints: count });
    }

    return sendSuccess(res, 200, 'Stats retrieved', {
      totalComplaintsToday,
      resolvedToday,
      criticalOpen,
      activeUsersThisWeek,
      smsSentToday,
      categoryData: categoryData.map(c => ({ name: c.aiCategory || 'Uncategorized', value: c._count.aiCategory })),
      severityData: severityData.map(s => ({ name: s.priority, value: s._count.priority })),
      trendData
    });
  } catch (err) {
    console.error('[ADMIN] getDashboardStats error:', err);
    return sendError(res, 500, 'Failed to retrieve stats');
  }
};

// ─── GET /api/admin/ai-insight ────────────────────────────────────────────────
const getAIInsight = async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({ where: { key: 'ai_weekly_insight' } });
    if (!setting) {
      return sendSuccess(res, 200, 'No insight available yet — will be generated at midnight', { insight: null });
    }
    const insight = JSON.parse(setting.value);
    return sendSuccess(res, 200, 'AI insight retrieved', { insight, cachedAt: setting.updatedAt });
  } catch (err) {
    console.error('[ADMIN] getAIInsight error:', err);
    return sendError(res, 500, 'Failed to retrieve AI insight');
  }
};

// ─── POST /api/admin/ai-insight/refresh ───────────────────────────────────────
const refreshAIInsight = async (req, res) => {
  try {
    const { city } = req.query;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const where = city ? { city, createdAt: { gte: sevenDaysAgo } } : { createdAt: { gte: sevenDaysAgo } };
    const complaints = await prisma.complaint.findMany({ where, take: 100 });

    const insight = await generateAdminInsight(complaints, city || 'Tamil Nadu');
    if (!insight) {
      return sendError(res, 503, 'AI insight generation failed — check Gemini API key');
    }

    await prisma.settings.upsert({
      where: { key: 'ai_weekly_insight' },
      update: { value: JSON.stringify(insight) },
      create: { key: 'ai_weekly_insight', value: JSON.stringify(insight) },
    });

    return sendSuccess(res, 200, 'AI insight refreshed', { insight });
  } catch (err) {
    console.error('[ADMIN] refreshAIInsight error:', err);
    return sendError(res, 500, 'Failed to refresh AI insight');
  }
};

// ─── GET /api/admin/sms-logs ──────────────────────────────────────────────────
const getSMSLogs = async (req, res) => {
  try {
    const { event, status, dateFrom, dateTo, page = 1 } = req.query;
    const LIMIT = 20;

    const where = {};
    if (event) where.event = event;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * LIMIT;
    const [logs, total] = await Promise.all([
      prisma.sMSLog.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: LIMIT,
      }),
      prisma.sMSLog.count({ where }),
    ]);

    return sendSuccess(res, 200, 'SMS logs retrieved', {
      logs,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / LIMIT) },
    });
  } catch (err) {
    console.error('[ADMIN] getSMSLogs error:', err);
    return sendError(res, 500, 'Failed to retrieve SMS logs');
  }
};

// ─── POST /api/admin/sms-resend/:logId ────────────────────────────────────────
const resendSMS = async (req, res) => {
  try {
    const { logId } = req.params;
    const log = await prisma.sMSLog.findUnique({ where: { id: logId } });
    if (!log) return sendError(res, 404, 'SMS log entry not found');

    const result = await sendSMS({
      userId: log.userId,
      phone: log.phone,
      event: log.event,
      message: log.message,
      checkOptIn: false, // Admin-triggered resend bypasses opt-in
    });

    return sendSuccess(res, 200, result.sent ? 'SMS resent successfully' : 'SMS resend failed', { result });
  } catch (err) {
    console.error('[ADMIN] resendSMS error:', err);
    return sendError(res, 500, 'Failed to resend SMS');
  }
};

// ─── GET /api/admin/sms-stats ─────────────────────────────────────────────────
const getSMSStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [sentToday, failedToday, topEvents] = await Promise.all([
      prisma.sMSLog.count({ where: { status: 'SENT', createdAt: { gte: todayStart } } }),
      prisma.sMSLog.count({ where: { status: 'FAILED', createdAt: { gte: todayStart } } }),
      prisma.sMSLog.groupBy({
        by: ['event'],
        _count: { event: true },
        orderBy: { _count: { event: 'desc' } },
        take: 3,
      }),
    ]);

    const total = sentToday + failedToday;
    const deliveryRate = total === 0 ? 100 : Math.round((sentToday / total) * 100);

    return sendSuccess(res, 200, 'SMS stats retrieved', {
      sentToday, failedToday, deliveryRate, topEvents,
    });
  } catch (err) {
    console.error('[ADMIN] getSMSStats error:', err);
    return sendError(res, 500, 'Failed to retrieve SMS stats');
  }
};

// ─── PUT /api/admin/sms-toggle ────────────────────────────────────────────────
const toggleSMS = async (req, res) => {
  try {
    const current = await prisma.settings.findUnique({ where: { key: 'sms_enabled' } });
    const currentValue = current ? current.value === 'true' : true;
    const newValue = !currentValue;

    await prisma.settings.upsert({
      where: { key: 'sms_enabled' },
      update: { value: String(newValue) },
      create: { key: 'sms_enabled', value: String(newValue) },
    });

    return sendSuccess(res, 200, `SMS notifications ${newValue ? 'enabled' : 'disabled'}`, { smsEnabled: newValue });
  } catch (err) {
    console.error('[ADMIN] toggleSMS error:', err);
    return sendError(res, 500, 'Failed to toggle SMS');
  }
};

// ─── GET /api/admin/ai-logs ───────────────────────────────────────────────────
const getAILogs = async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const LIMIT = 20;
    const skip = (parseInt(page) - 1) * LIMIT;

    const [logs, total] = await Promise.all([
      prisma.aILog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: LIMIT,
      }),
      prisma.aILog.count(),
    ]);

    return sendSuccess(res, 200, 'AI logs retrieved', {
      logs,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / LIMIT) },
    });
  } catch (err) {
    console.error('[ADMIN] getAILogs error:', err);
    return sendError(res, 500, 'Failed to retrieve AI logs');
  }
};

// ─── GET /api/admin/export/complaints ─────────────────────────────────────────
const exportComplaints = async (req, res) => {
  try {
    const { status, city, priority, category } = req.query;
    const where = {};
    if (status) where.status = status;
    if (city) where.city = city;
    if (priority) where.priority = priority;
    if (category) where.aiCategory = category;

    const complaints = await prisma.complaint.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV
    const headers = ['ID', 'Date', 'User', 'City', 'Ward', 'Description', 'Category', 'Confidence', 'Priority', 'Status', 'Upvotes'];
    const rows = complaints.map(c => [
      c.id.slice(-8).toUpperCase(),
      new Date(c.createdAt).toLocaleDateString('en-IN'),
      c.user?.name || '',
      c.city,
      c.ward,
      `"${c.description.replace(/"/g, '""')}"`,
      c.aiCategory || '',
      c.aiConfidence || '',
      c.priority,
      c.status,
      c.upvoteCount,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="greenguard_complaints_${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error('[ADMIN] exportComplaints error:', err);
    return sendError(res, 500, 'Failed to export complaints');
  }
};

// ─── GET /api/admin/collectors ────────────────────────────────────────────────
const getCollectors = async (req, res) => {
  try {
    const collectors = await prisma.user.findMany({
      where: { role: 'COLLECTOR' },
      select: { id: true, name: true, phone: true, city: true }
    });
    return sendSuccess(res, 200, 'Collectors retrieved', { collectors });
  } catch (err) {
    console.error('[ADMIN] getCollectors error:', err);
    return sendError(res, 500, 'Failed to retrieve collectors');
  }
};

// ─── POST /api/admin/assign-task ──────────────────────────────────────────────
const assignTask = async (req, res) => {
  try {
    const { taskId, type, collectorId } = req.body; // type: 'complaint' | 'pickup'

    if (!taskId || !type || !collectorId) {
      return sendError(res, 400, 'Missing taskId, type, or collectorId');
    }

    const collector = await prisma.user.findUnique({ where: { id: collectorId } });
    if (!collector) return sendError(res, 404, 'Collector not found');

    if (type === 'complaint') {
      const updated = await prisma.complaint.update({
        where: { id: taskId },
        data: { collectorId, status: 'IN_PROGRESS' },
      });
      // Send SMS
      await sendEventSMS('admin_assign_task', { id: taskId, taskType: 'Complaint', location: updated.location }, collector.phone, collector.id, false);
      return sendSuccess(res, 200, 'Complaint assigned successfully');
    } else if (type === 'pickup') {
      const updated = await prisma.collectionRequest.update({
        where: { id: taskId },
        data: { collectorId, status: 'ASSIGNED' },
      });
      // Send SMS
      await sendEventSMS('admin_assign_task', { id: taskId, taskType: 'Pickup', location: updated.address }, collector.phone, collector.id, false);
      return sendSuccess(res, 200, 'Pickup assigned successfully');
    } else {
      return sendError(res, 400, 'Invalid task type');
    }
  } catch (err) {
    console.error('[ADMIN] assignTask error:', err);
    return sendError(res, 500, 'Failed to assign task');
  }
};

module.exports = {
  getDashboardStats, getAIInsight, refreshAIInsight,
  getSMSLogs, resendSMS, getSMSStats, toggleSMS,
  getAILogs, exportComplaints, getCollectors, assignTask,
};
