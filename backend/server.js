// GreenGuard — Express Server + Socket.io
// Main entry point: mounts all routes, applies security middleware,
// initializes Socket.io with JWT authentication

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const { globalLimiter } = require('./src/middleware/rateLimiter.middleware');
const { verifyAccessToken } = require('./src/utils/jwt.utils');
const socketService = require('./src/services/socket.service');
const { scheduleDailySummary } = require('./src/cron/dailySummary.cron');
const { scheduleWeeklyInsight } = require('./src/cron/weeklyInsight.cron');

// ─── Route Imports ─────────────────────────────────────────────────────────────
const authRoutes = require('./src/routes/auth.routes');
const complaintRoutes = require('./src/routes/complaint.routes');
const collectionRoutes = require('./src/routes/collection.routes');
const rewardRoutes = require('./src/routes/reward.routes');
const mapRoutes = require('./src/routes/map.routes');
const adminRoutes = require('./src/routes/admin.routes');
const collectorRoutes = require('./src/routes/collector.routes');
const storeRoutes = require('./src/routes/store.routes');
const upcycleRoutes = require('./src/routes/upcycle.routes');
const iotRoutes = require('./src/routes/iot.routes');
const routeRoutes = require('./src/routes/route.routes');
const aiRoutes = require('./src/routes/aiRoutes');
const driveRoutes = require('./src/routes/drive.routes');
const cronRoutes = require('./src/routes/cron.routes');

const app = express();
const httpServer = http.createServer(app);

// ─── Socket.io Setup ──────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

// JWT Authentication on socket handshake
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Socket authentication required'));
    }
    const decoded = verifyAccessToken(token);
    socket.user = decoded; // Attach decoded user to socket
    next();
  } catch (err) {
    next(new Error('Invalid socket token'));
  }
});

// Socket room management
io.on('connection', (socket) => {
  const { id: userId, role } = socket.user;
  console.log(`[SOCKET] Connected: ${userId} (${role})`);

  // Join appropriate rooms based on role
  if (role === 'ADMIN') {
    socket.join('admin');
    console.log(`[SOCKET] Admin ${userId} joined room: admin`);
  } else if (role === 'COLLECTOR') {
    socket.join(`collector_${userId}`);
    console.log(`[SOCKET] Collector ${userId} joined room: collector_${userId}`);
  } else {
    socket.join(userId); // Citizens join their own room
    console.log(`[SOCKET] Citizen ${userId} joined room: ${userId}`);
  }

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Disconnected: ${userId}`);
  });
});

// Initialize socket service with io instance (used by all controllers)
socketService.init(io);

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet()); // Set security headers (XSS, HSTS, etc.)
app.use(cors({
  origin: true,
  credentials: true, // Allow cookies
}));
app.use(globalLimiter); // Global rate limit: 100 req/min
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // Parse HTTP-only refresh cookie

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/collector', collectorRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/upcycle', upcycleRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/drives', driveRoutes);
app.use('/api/cron', cronRoutes);

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'GreenGuard API', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[SERVER] Unhandled error:', err);
  
  if (err.name === 'PrismaClientInitializationError' || err.message.includes('Can\'t reach database server')) {
    return res.status(503).json({ success: false, message: 'Database connection failed. Please try again later.' });
  }

  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

if (!process.env.VERCEL) {
  httpServer.listen(PORT, () => {
    console.log(`\n🌿 GreenGuard API running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.io ready`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}\n`);

    // Start cron jobs locally
    scheduleDailySummary();
    scheduleWeeklyInsight();
  });
}

module.exports = { app, httpServer };
