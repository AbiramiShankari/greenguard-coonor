const { GoogleGenAI } = require('@google/genai');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

exports.analyzeComplaintImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }

    const { lat, lng } = req.body;

    // Convert multer file to format expected by Gemini
    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    };

    let duplicateWarning = false;
    
    // Check for recent nearby complaints for duplicate detection
    if (lat && lng) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const recentComplaints = await prisma.complaint.findMany({
        where: {
          createdAt: { gte: oneDayAgo },
          lat: { not: null },
          lng: { not: null },
        }
      });

      // Basic Haversine filter (100m radius)
      const isNearby = (cLat, cLng) => {
        const R = 6371e3;
        const φ1 = lat * Math.PI/180, φ2 = cLat * Math.PI/180;
        const Δφ = (cLat - lat) * Math.PI/180, Δλ = (cLng - lng) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return (R * c) <= 100;
      };

      const nearbyComplaints = recentComplaints.filter(c => isNearby(c.lat, c.lng));
      
      if (nearbyComplaints.length > 0) {
        duplicateWarning = true; // We flag it just based on proximity to save API calls
      }
    }

    const prompt = `Analyze this image of a civic issue (likely waste or infrastructure problem).
Return a raw JSON object (no markdown tags, just pure JSON) with the following structure:
{
  "category": "One of: overflow, illegal_dumping, drainage, litter, other",
  "priority": "One of: LOW, MEDIUM, HIGH, CRITICAL. (CRITICAL if blocking road/drain or hazardous)",
  "description_suggestion": "A concise 1-sentence description of the issue shown."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt, imagePart],
      config: {
        responseMimeType: "application/json"
      }
    });

    const aiText = response.text;
    const aiData = JSON.parse(aiText);

    res.status(200).json({
      success: true,
      data: {
        category: aiData.category || 'other',
        priority: aiData.priority || 'MEDIUM',
        descriptionSuggestion: aiData.description_suggestion || 'Waste accumulation reported.',
        duplicateWarning
      }
    });

  } catch (err) {
    console.error('AI Analysis Error:', err);
    res.status(500).json({ success: false, message: 'AI Analysis failed' });
  }
};
