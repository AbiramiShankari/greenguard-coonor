// GreenGuard — Gemini AI Service
// All AI functions for complaint categorisation, duplicate detection, and admin insights
// Uses: google/generative-ai with gemini-1.5-flash
// RULE: Wrap every call in try/catch — never block complaint submission on AI failure

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Lazy-initialize Gemini client
let genAI = null;
let model = null;

const getModel = () => {
  if (!model) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'REPLACE_WITH_REAL_VALUE') {
      return null;
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }
  return model;
};

// ─── Fallback Defaults ────────────────────────────────────────────────────────

const CATEGORY_FALLBACK = {
  category: 'other',
  confidence: 0.5,
  severity: 'medium',
  severityScore: 0.5,
  suggestedPriority: 'MEDIUM',
  summary: 'Unable to classify — please review manually',
};

const DUPLICATE_FALLBACK = {
  isDuplicate: false,
  duplicateOf: null,
  confidence: 0,
};

// ─── Helper: Log AI call to AILog table ──────────────────────────────────────

const logAICall = async ({ complaintId, fn, inputText, outputJson, success, error, durationMs }) => {
  try {
    await prisma.aILog.create({
      data: {
        complaintId: complaintId || null,
        function: fn,
        inputText: inputText.slice(0, 2000), // Truncate very long inputs
        outputJson: outputJson ? JSON.stringify(outputJson) : null,
        success,
        error: error ? String(error).slice(0, 500) : null,
        durationMs: durationMs || null,
      },
    });
  } catch (logErr) {
    console.error('[AI] Failed to write AILog:', logErr.message);
  }
};

// ─── Function 1: Categorise Complaint ────────────────────────────────────────

/**
 * Analyse a complaint description and return AI categorisation.
 * Returns structured data: category, confidence, severity, priority, summary
 *
 * @param {string} description - Citizen's complaint text
 * @param {string|null} imageUrl - Optional Cloudinary image URL (fallback/reference)
 * @param {Object|null} imageFile - { buffer, mimetype } from multer
 * @param {string|null} complaintId - For AILog linking
 */
const categoriseComplaint = async (description, imageUrl = null, imageFile = null, complaintId = null) => {
  const startTime = Date.now();
  const inputText = `Description: ${description}${imageUrl ? ` | Image: ${imageUrl}` : ''}${imageFile ? ` | [Image Buffer Attached]` : ''}`;

  try {
    const aiModel = getModel();
    if (!aiModel) {
      console.log('[AI] Gemini not configured — using fallback categorisation');
      return CATEGORY_FALLBACK;
    }

    // Build prompt — strict JSON only, no markdown wrappers
    const prompt = `You are a waste management AI for Indian cities. Analyse this waste complaint carefully:
- Use 'waste_dumping' for unauthorized piles of trash or garbage. Do NOT use the term "illegal" or assume it's illegal unless there's evidence of massive industrial dumping.
- Use 'litter' for smaller, scattered pieces of trash.
Description: ${description}
${imageUrl ? `Image URL: ${imageUrl}` : ''}

Return ONLY valid JSON, no markdown, no extra text:
{
  "category": "overflow|waste_dumping|drainage|litter|dead_animal|construction_waste|other",
  "confidence": 0.0-1.0,
  "severity": "low|medium|high|critical",
  "severityScore": 0.0-1.0,
  "suggestedPriority": "LOW|MEDIUM|HIGH|CRITICAL",
  "summary": "one line description for admin (max 100 chars)"
}`;

    const parts = [prompt];
    
    // Attach the image buffer as inline data if provided
    if (imageFile && imageFile.buffer) {
      parts.push({
        inlineData: {
          data: imageFile.buffer.toString("base64"),
          mimeType: imageFile.mimetype || "image/jpeg"
        }
      });
    }

    const result = await aiModel.generateContent(parts);
    const rawText = result.response.text().trim();

    // Parse JSON — fallback on any parse error
    let parsed;
    try {
      // Strip markdown code block if model wraps in ```json
      const cleanText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      parsed = JSON.parse(cleanText);
    } catch {
      console.warn('[AI] categoriseComplaint: Failed to parse JSON response');
      await logAICall({ complaintId, fn: 'categoriseComplaint', inputText, outputJson: null, success: false, error: 'JSON parse failed', durationMs: Date.now() - startTime });
      return CATEGORY_FALLBACK;
    }

    await logAICall({ complaintId, fn: 'categoriseComplaint', inputText, outputJson: parsed, success: true, durationMs: Date.now() - startTime });
    return parsed;
  } catch (err) {
    console.error('[AI] categoriseComplaint error:', err.message);
    await logAICall({ complaintId, fn: 'categoriseComplaint', inputText, outputJson: null, success: false, error: err.message, durationMs: Date.now() - startTime });
    return CATEGORY_FALLBACK; // Never throw — caller gets fallback
  }
};

// ─── Function 2: Detect Duplicate ────────────────────────────────────────────

/**
 * Check if a new complaint is a duplicate of recent ones in same area.
 * Returns: { isDuplicate, duplicateOf, confidence }
 *
 * @param {Object} newComplaint - { description, location, city, ward }
 * @param {Array} recentComplaints - Array of { id, description, location } from last 48h
 * @param {string|null} complaintId - For AILog linking
 */
const detectDuplicate = async (newComplaint, recentComplaints, complaintId = null) => {
  const startTime = Date.now();

  try {
    if (!recentComplaints || recentComplaints.length === 0) {
      return DUPLICATE_FALLBACK;
    }

    const aiModel = getModel();
    if (!aiModel) {
      return DUPLICATE_FALLBACK;
    }

    // Build numbered list of recent complaints for the prompt
    const recentList = recentComplaints
      .slice(0, 10) // Limit to 10 most recent to control token usage
      .map((c, i) => `${i + 1}. ID:${c.id} | "${c.description.slice(0, 100)}" at "${c.location}"`)
      .join('\n');

    const inputText = `New: "${newComplaint.description}" at "${newComplaint.location}" | Recent: ${recentList}`;

    const prompt = `Check if this new complaint is a duplicate of recent ones in the same area (last 48 hours).

New complaint: "${newComplaint.description}" at location "${newComplaint.location}" in ${newComplaint.city}, ward: ${newComplaint.ward}

Recent complaints in same area:
${recentList}

Return ONLY valid JSON, no markdown:
{
  "isDuplicate": true or false,
  "duplicateOf": "complaint_id_string or null",
  "confidence": 0.0-1.0
}`;

    const result = await aiModel.generateContent(prompt);
    const rawText = result.response.text().trim();

    let parsed;
    try {
      const cleanText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      parsed = JSON.parse(cleanText);
    } catch {
      console.warn('[AI] detectDuplicate: Failed to parse JSON response');
      await logAICall({ complaintId, fn: 'detectDuplicate', inputText, outputJson: null, success: false, error: 'JSON parse failed', durationMs: Date.now() - startTime });
      return DUPLICATE_FALLBACK;
    }

    await logAICall({ complaintId, fn: 'detectDuplicate', inputText, outputJson: parsed, success: true, durationMs: Date.now() - startTime });
    return parsed;
  } catch (err) {
    console.error('[AI] detectDuplicate error:', err.message);
    await logAICall({ complaintId, fn: 'detectDuplicate', inputText: `New: ${newComplaint.description}`, outputJson: null, success: false, error: err.message, durationMs: Date.now() - startTime });
    return DUPLICATE_FALLBACK; // Never throw
  }
};

// ─── Function 3: Generate Admin Insight ──────────────────────────────────────

/**
 * Analyse last 7 days of complaints for a city and return admin insights.
 * Called by cron at midnight and stored in Settings table.
 * Result shape: { topIssue, hotspot, avgResolutionTime, urgentCount, weeklyTrend, recommendation }
 *
 * @param {Array} complaints - Array of complaint objects from last 7 days
 * @param {string} city - City name for context
 */
const generateAdminInsight = async (complaints, city = 'Tamil Nadu') => {
  const startTime = Date.now();

  try {
    const aiModel = getModel();
    if (!aiModel || complaints.length === 0) {
      return null;
    }

    const complaintSummary = complaints.slice(0, 50).map(c =>
      `Category:${c.aiCategory || 'unknown'} Status:${c.status} Priority:${c.priority} Ward:${c.ward}`
    ).join('\n');

    const inputText = `City: ${city} | Count: ${complaints.length} | Complaints: ${complaintSummary.slice(0, 1000)}`;

    const prompt = `Analyse these ${complaints.length} waste complaints from ${city} this week.

Complaint data:
${complaintSummary}

Return ONLY valid JSON, no markdown:
{
  "topIssue": "most common complaint category as a readable string",
  "hotspot": "ward or area with most complaints",
  "avgResolutionTime": "e.g. '2.5 days' or 'N/A'",
  "urgentCount": number,
  "weeklyTrend": "improving|worsening|stable",
  "recommendation": "one actionable sentence for the admin"
}`;

    const result = await aiModel.generateContent(prompt);
    const rawText = result.response.text().trim();

    let parsed;
    try {
      const cleanText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      parsed = JSON.parse(cleanText);
    } catch {
      console.warn('[AI] generateAdminInsight: Failed to parse JSON');
      await logAICall({ complaintId: null, fn: 'generateAdminInsight', inputText, outputJson: null, success: false, error: 'JSON parse failed', durationMs: Date.now() - startTime });
      return null;
    }

    await logAICall({ complaintId: null, fn: 'generateAdminInsight', inputText, outputJson: parsed, success: true, durationMs: Date.now() - startTime });
    return parsed;
  } catch (err) {
    console.error('[AI] generateAdminInsight error:', err.message);
    await logAICall({ complaintId: null, fn: 'generateAdminInsight', inputText: `City: ${city}`, outputJson: null, success: false, error: err.message, durationMs: Date.now() - startTime });
    return null;
  }
};

// ─── Function 4: Generate Escalation Draft ───────────────────────────────────

/**
 * Generate a formal escalation memo for worsening trends.
 * @param {Array} complaints - List of critical/unresolved complaints
 * @param {Object} insight - Weekly insight data
 */
const generateEscalationDraft = async (complaints, insight) => {
  const startTime = Date.now();
  try {
    const aiModel = getModel();
    if (!aiModel || complaints.length === 0) return null;

    const complaintSummary = complaints.map(c => `- Ward: ${c.ward}, Category: ${c.aiCategory}, Priority: ${c.priority}, Location: ${c.location}`).join('\n');
    const inputText = `Generating escalation memo for ${complaints.length} complaints based on worsening trend in ${insight.hotspot}.`;

    const prompt = `You are an AI Civic Agent drafting an official escalation memo to the Municipal Health Officer (MHO) regarding a worsening waste management crisis.

Insight Data:
- Top Issue: ${insight.topIssue}
- Hotspot: ${insight.hotspot}
- Unresolved Critical Count: ${complaints.length}

Recent Critical Complaints:
${complaintSummary}

Write a concise, professional, and urgent 3-paragraph memo. Include a subject line. Do not use Markdown JSON, just return plain text.`;

    const result = await aiModel.generateContent(prompt);
    const draftText = result.response.text().trim();

    await logAICall({ complaintId: null, fn: 'generateEscalationDraft', inputText, outputJson: null, success: true, durationMs: Date.now() - startTime });
    return draftText;
  } catch (err) {
    console.error('[AI] generateEscalationDraft error:', err.message);
    return null;
  }
};

// ─── Function 5: Generate Smart Bin Alert ────────────────────────────────────

const generateBinAlert = async (location, fillLevel) => {
  try {
    const aiModel = getModel();
    if (!aiModel) return `Smart Bin at ${location} has reached ${fillLevel}% capacity. Immediate pickup required.`;

    const prompt = `A smart garbage bin at "${location}" has just hit ${fillLevel}% capacity. Write a very brief (1 sentence), urgent, and professional alert message to the municipal admin to dispatch a truck immediately. Do not use markdown JSON.`;
    const result = await aiModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('[AI] generateBinAlert error:', err.message);
    return `Smart Bin at ${location} has reached ${fillLevel}% capacity. Immediate pickup required.`;
  }
};

module.exports = { categoriseComplaint, detectDuplicate, generateAdminInsight, generateEscalationDraft, generateBinAlert };
