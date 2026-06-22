let app;
try {
  const serverModule = require('../backend/server.js');
  app = serverModule.app;
} catch (error) {
  app = (req, res) => {
    res.status(500).json({
      success: false,
      message: "Vercel Cold Start Crash",
      error: error.message,
      stack: error.stack
    });
  };
}
module.exports = app;
