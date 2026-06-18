// GreenGuard — AI Route Optimization Routes
const express = require('express');
const { optimizeRoute } = require('../controllers/route.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/optimize', authorize('COLLECTOR'), optimizeRoute);

module.exports = router;
