// GreenGuard — IoT Bins Routes
const express = require('express');
const { getSmartBins, updateBinFillLevel } = require('../controllers/iot.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/bins', getSmartBins);
// In a real scenario, this PUT would be secured by a hardware API key, not user auth. 
// For demo, we'll allow ADMIN.
router.put('/bins/:id', authorize('ADMIN'), updateBinFillLevel);

module.exports = router;
