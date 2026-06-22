// GreenGuard — Collector Routes
const express = require('express');
const { getMyTasks, resolveTask } = require('../controllers/collector.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { upload, handleUploadError } = require('../middleware/upload.middleware');

const router = express.Router();

router.use(authenticate, authorize('COLLECTOR'));

router.get('/tasks', getMyTasks);
router.post('/tasks/resolve', upload.single('image'), handleUploadError, resolveTask);

module.exports = router;
