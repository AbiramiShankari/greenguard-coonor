// GreenGuard — Map Routes
const express = require('express');
const { getComplaintMapData, getCollectionMapData, getHeatmapData } = require('../controllers/map.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/complaints', getComplaintMapData);
router.get('/collections', getCollectionMapData);
router.get('/heatmap', getHeatmapData);

module.exports = router;
