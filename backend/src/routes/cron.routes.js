const express = require('express');
const { sendDailySummary } = require('../cron/dailySummary.cron');
const { runWeeklyInsight } = require('../cron/weeklyInsight.cron');

const router = express.Router();

// Middleware to verify Vercel Cron Secret
const verifyVercelCron = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized cron invocation' });
  }
  next();
};

router.use(verifyVercelCron);

router.get('/daily', async (req, res) => {
  try {
    await sendDailySummary();
    res.json({ success: true, message: 'Daily summary executed successfully' });
  } catch (error) {
    console.error('[CRON ROUTE] Daily summary error:', error);
    res.status(500).json({ success: false, message: 'Error executing daily summary' });
  }
});

router.get('/weekly', async (req, res) => {
  try {
    await runWeeklyInsight();
    res.json({ success: true, message: 'Weekly insight executed successfully' });
  } catch (error) {
    console.error('[CRON ROUTE] Weekly insight error:', error);
    res.status(500).json({ success: false, message: 'Error executing weekly insight' });
  }
});

module.exports = router;
