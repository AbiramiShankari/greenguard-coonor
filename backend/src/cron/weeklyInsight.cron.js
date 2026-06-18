// GreenGuard — Weekly AI Insight Cron Job
// Runs every day at midnight (00:00 IST)
// Calls Gemini generateAdminInsight() and caches result in Settings table
// Admin dashboard reads from this cache — NOT a live Gemini call

const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { generateAdminInsight, generateEscalationDraft } = require('../services/gemini.service');

const prisma = new PrismaClient();

const runWeeklyInsight = async () => {
  console.log('[CRON] Running weekly AI insight job...');

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const complaints = await prisma.complaint.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      take: 100,
      select: {
        aiCategory: true,
        status: true,
        priority: true,
        ward: true,
        city: true,
      },
    });

    if (complaints.length === 0) {
      console.log('[CRON] No complaints in last 7 days — skipping insight generation');
      return;
    }

    const insight = await generateAdminInsight(complaints, 'Tamil Nadu');
    if (!insight) {
      console.log('[CRON] Gemini returned null — skipping cache update');
      return;
    }

    // Cache result in Settings table
    await prisma.settings.upsert({
      where: { key: 'ai_weekly_insight' },
      update: { value: JSON.stringify(insight) },
      create: { key: 'ai_weekly_insight', value: JSON.stringify(insight) },
    });

    console.log('[CRON] AI insight cached successfully:', insight.weeklyTrend);

    // Agentic Step 2: Auto-Draft Escalation
    if (insight.weeklyTrend === 'worsening' && insight.urgentCount > 0) {
      console.log('[CRON] Agentic action triggered: Worsening trend detected. Drafting escalation...');
      const criticalComplaints = await prisma.complaint.findMany({
        where: { createdAt: { gte: sevenDaysAgo }, priority: 'CRITICAL', status: { in: ['NEW', 'IN_PROGRESS'] } },
        take: 20
      });
      const draft = await generateEscalationDraft(criticalComplaints, insight);
      if (draft) {
        await prisma.settings.upsert({
          where: { key: 'ai_escalation_draft' },
          update: { value: draft },
          create: { key: 'ai_escalation_draft', value: draft },
        });
        console.log('[CRON] Escalation draft cached successfully.');
      }
    }
  } catch (err) {
    console.error('[CRON] Weekly insight error:', err.message);
  }
};

// Schedule: every day at midnight IST
const scheduleWeeklyInsight = () => {
  cron.schedule('0 0 * * *', runWeeklyInsight, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  console.log('[CRON] Weekly AI insight scheduled for 00:00 IST');
};

module.exports = { scheduleWeeklyInsight, runWeeklyInsight };
