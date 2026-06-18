// GreenGuard — Admin Routes
const express = require('express');
const {
  getDashboardStats, getAIInsight, refreshAIInsight,
  getSMSLogs, resendSMS, getSMSStats, toggleSMS,
  getAILogs, exportComplaints, getCollectors, assignTask,
} = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

// All admin routes require ADMIN role
router.use(authenticate, authorize('ADMIN'));

router.get('/stats', getDashboardStats);
router.get('/ai-insight', getAIInsight);
router.post('/ai-insight/refresh', refreshAIInsight);
router.get('/sms-logs', getSMSLogs);
router.post('/sms-resend/:logId', resendSMS);
router.get('/sms-stats', getSMSStats);
router.put('/sms-toggle', toggleSMS);
router.get('/ai-logs', getAILogs);
router.get('/export/complaints', exportComplaints);
router.get('/collectors', getCollectors);
router.post('/assign-task', assignTask);

module.exports = router;
