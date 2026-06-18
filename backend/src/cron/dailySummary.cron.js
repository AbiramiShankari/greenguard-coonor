// GreenGuard — Daily Summary Cron Job
// Runs every day at 08:00 AM
// Sends daily_summary SMS to ADMIN_PHONE with today's stats

const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { sendEventSMS } = require('../services/sms.service');

const prisma = new PrismaClient();

const sendDailySummary = async () => {
  console.log('[CRON] Running daily summary job...');

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get today's stats — group by city
    const cities = ['Bedford', 'Brooklands', 'Grey Hills', 'Church Hill', 'Alwarpet', 'Tiger Hill', 'Mount Pleasant', "Walker's Hill", 'Singara', 'Springfield', 'Yedapalli', 'Wellington', 'Ketti', 'Adikaratti', 'Huligal', 'Bandishola', 'Bearhatty', 'Burliar', 'Hubbathalai', 'Melur'];

    for (const city of cities) {
      const [newCount, resolved, pending, critical] = await Promise.all([
        prisma.complaint.count({ where: { city, status: 'NEW', createdAt: { gte: todayStart } } }),
        prisma.complaint.count({ where: { city, status: 'RESOLVED', updatedAt: { gte: todayStart } } }),
        prisma.complaint.count({ where: { city, status: { in: ['NEW', 'IN_PROGRESS'] } } }),
        prisma.complaint.count({ where: { city, priority: 'CRITICAL', status: { in: ['NEW', 'IN_PROGRESS'] } } }),
      ]);

      // Only send if there's activity in this city
      if (newCount + resolved + pending + critical > 0 && process.env.ADMIN_PHONE) {
        await sendEventSMS(
          'daily_summary',
          { city, newCount, resolved, pending, critical },
          process.env.ADMIN_PHONE,
          null,
          false // Skip opt-in check for admin
        );
      }
    }

    console.log('[CRON] Daily summary sent successfully');
  } catch (err) {
    console.error('[CRON] Daily summary error:', err.message);
  }
};

// Schedule: every day at 8:00 AM IST
const scheduleDailySummary = () => {
  cron.schedule('0 8 * * *', sendDailySummary, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  console.log('[CRON] Daily summary scheduled for 08:00 AM IST');
};

module.exports = { scheduleDailySummary, sendDailySummary };
