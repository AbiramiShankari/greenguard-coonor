const express = require('express');
const { analyzeComplaintImage } = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth.middleware');
const multer = require('multer');

const router = express.Router();

// Using memory storage for multer since we pass it directly to Gemini
const upload = multer({ storage: multer.memoryStorage() });

router.post('/analyze-image', authenticate, upload.single('image'), analyzeComplaintImage);

module.exports = router;
