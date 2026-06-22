// GreenGuard — SMS Service (Twilio)
// Sends SMS to Indian +91 numbers with full SMSLog tracking
// FAIL SILENTLY — SMS failure must never crash the main request flow

const twilio = require('twilio');
const { PrismaClient } = require('@prisma/client');
const { formatIndianPhone } = require('../utils/phone.utils');

const prisma = new PrismaClient();

// Lazy-initialize Twilio client (only when real keys are present)
let twilioClient = null;

const getTwilioClient = () => {
  if (!twilioClient) {
    if (
      !process.env.TWILIO_ACCOUNT_SID ||
      process.env.TWILIO_ACCOUNT_SID === 'REPLACE_WITH_REAL_VALUE'
    ) {
      return null;
    }
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
};

/**
 * Check if global SMS is enabled via Settings table
 */
const isSmsGloballyEnabled = async () => {
  try {
    const setting = await prisma.settings.findUnique({ where: { key: 'sms_enabled' } });
    if (!setting) return true; // Default: enabled
    return setting.value === 'true';
  } catch {
    return true; // Fail open — default to enabled
  }
};

/**
 * Main SMS sender — handles all checks and logging
 * Fails silently — never throws, always logs to SMSLog
 *
 * @param {Object} params
 * @param {string} params.userId - Recipient user ID (for log linking)
 * @param {string} params.phone - Recipient phone (+91 or raw)
 * @param {string} params.event - Event type key (complaint_submitted, etc.)
 * @param {string} params.message - Message body (≤160 chars enforced)
 * @param {boolean} params.checkOptIn - Whether to check user.smsOptIn (default true)
 */
const sendSMS = async ({ userId, phone, event, message, checkOptIn = true }) => {
  const logEntry = {
    userId: userId || null,
    phone,
    event,
    message: message.slice(0, 160), // Enforce 160-char limit
    status: 'QUEUED',
    twilioSid: null,
    error: null,
  };

  try {
    // 1. Check global SMS pause flag
    const globalEnabled = await isSmsGloballyEnabled();
    if (!globalEnabled) {
      logEntry.status = 'FAILED';
      logEntry.error = 'SMS globally disabled by admin';
      await prisma.sMSLog.create({ data: logEntry });
      return { sent: false, reason: 'globally_disabled' };
    }

    // 2. Check user opt-in (skip for admin notifications)
    if (checkOptIn && userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { smsOptIn: true, phone: true } });
      if (!user || !user.smsOptIn) {
        logEntry.status = 'FAILED';
        logEntry.error = 'User has opted out of SMS';
        await prisma.sMSLog.create({ data: logEntry });
        return { sent: false, reason: 'opted_out' };
      }
    }

    // 3. Format phone to +91XXXXXXXXXX
    const formattedPhone = formatIndianPhone(phone);
    logEntry.phone = formattedPhone;

    // 4. Determine Provider
    const provider = process.env.SMS_PROVIDER || 'twilio';

    // 5. Send via Selected Provider
    if (provider === 'mock') {
      logEntry.status = 'SENT';
      logEntry.twilioSid = `MOCK_${Date.now()}`;
      console.log(`[SMS MOCK] 📱 To: ${formattedPhone} | Message: ${message.slice(0, 80)}...`);
      await prisma.sMSLog.create({ data: logEntry });
      return { sent: true, sid: logEntry.twilioSid };
    } 
    
    if (provider === 'fast2sms') {
      if (!process.env.FAST2SMS_API_KEY) {
        throw new Error('FAST2SMS_API_KEY is missing');
      }
      
      const cleanPhone = formattedPhone.replace('+91', ''); // Fast2SMS expects 10 digit number
      
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          route: 'q',
          message: message.slice(0, 160),
          flash: 0,
          numbers: cleanPhone
        })
      });
      
      const data = await response.json();
      if (!data.return) {
        throw new Error(data.message || 'Fast2SMS failed');
      }

      logEntry.status = 'SENT';
      logEntry.twilioSid = `F2S_${data.request_id || Date.now()}`;
      await prisma.sMSLog.create({ data: logEntry });
      return { sent: true, sid: logEntry.twilioSid };
    }

    // Default to Twilio
    const client = getTwilioClient();
    if (!client) {
      logEntry.status = 'FAILED';
      logEntry.error = 'Twilio not configured — SMS skipped';
      await prisma.sMSLog.create({ data: logEntry });
      console.log(`[SMS WARNING] DEV MODE — Set SMS_PROVIDER=mock or fast2sms. Would send to ${formattedPhone}`);
      return { sent: false, reason: 'not_configured' };
    }

    const twilioMessage = await client.messages.create({
      body: message.slice(0, 160),
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    logEntry.status = 'SENT';
    logEntry.twilioSid = twilioMessage.sid;
    await prisma.sMSLog.create({ data: logEntry });

    return { sent: true, sid: twilioMessage.sid };
  } catch (err) {
    // FAIL SILENTLY — log the error but never propagate
    logEntry.status = 'FAILED';
    logEntry.error = err.message?.slice(0, 255) || 'Unknown error';

    try {
      await prisma.sMSLog.create({ data: logEntry });
    } catch (logErr) {
      console.error('[SMS] Failed to write SMSLog:', logErr.message);
    }

    console.error(`[SMS] Failed to send ${event} SMS:`, err.message);
    return { sent: false, error: err.message };
  }
};

// ─── Event-Specific Sender Helpers ───────────────────────────────────────────

const smsEvents = {
  complaint_submitted: ({ id, city, category }) =>
    `GreenGuard✅ Complaint #${id.slice(-6).toUpperCase()} received in ${city}. Category: ${category}. Earned 10pts!`,

  complaint_in_progress: ({ id }) =>
    `GreenGuard🔄 Complaint #${id.slice(-6).toUpperCase()} is IN PROGRESS. Team is on it. -Sanitation Dept`,

  complaint_resolved: ({ id, points }) =>
    `GreenGuard🎉 Complaint #${id.slice(-6).toUpperCase()} RESOLVED! +5pts. Total: ${points}pts. View before/after collage: https://gg.tn/c/${id.slice(-6)}`,

  complaint_duplicate: ({ id, duplicateOf }) =>
    `GreenGuard🔁 Linked to existing report #${(duplicateOf || '').slice(-6).toUpperCase()}. One fix, double impact!`,

  admin_new_complaint: ({ id, ward, city, category }) =>
    `GreenGuard📬 New Complaint #${id.slice(-6).toUpperCase()} in ${ward}, ${city}. Category: ${category}. Please review.`,

  admin_assign_task: ({ id, taskType, location }) =>
    `GreenGuard📋 You have been assigned a new task: ${taskType} #${id.slice(-6).toUpperCase()} at ${location}. Please check your dashboard.`,

  critical_complaint: ({ id, ward, city, category }) =>
    `GreenGuard🚨 CRITICAL: #${id.slice(-6).toUpperCase()} in ${ward},${city}. Category:${category}. Act now.`,

  collection_assigned: ({ id, collectorName }) =>
    `GreenGuard📦 Pickup #${id.slice(-6).toUpperCase()} assigned. Collector: ${collectorName}. Thanks for segregating!`,

  collection_completed: ({ id, points }) =>
    `GreenGuard✅ Pickup #${id.slice(-6).toUpperCase()} done! +15pts. Total:${points}pts. You're a Green Champion!`,

  collection_new_task: ({ id, address, wasteType }) =>
    `GreenGuard📋 New pickup #${id.slice(-6).toUpperCase()} at ${address.slice(0, 30)}. Waste:${wasteType}. Open app for map.`,

  badge_earned: ({ badge, points }) =>
    `GreenGuard🏆 You earned '${badge}' badge with ${points}pts! Keep going!`,

  daily_summary: ({ city, newCount, resolved, pending, critical }) =>
    `GreenGuard📊 ${city}: New:${newCount} Resolved:${resolved} Pending:${pending} Critical:${critical}`,

  drive_registered: ({ title, date }) =>
    `GreenGuard🌱 You successfully registered for ${title} on ${date}. See you there! Every hand helps.`,

  drive_attended: ({ title, points, totalPoints }) =>
    `GreenGuard🌟 Thank you for participating in ${title}! +${points}pts awarded. Total: ${totalPoints}pts. You're making a difference!`,

  otp_verification: ({ otp }) =>
    `GreenGuard🔒 Your OTP to redeem the reward is ${otp}. Valid for 10 minutes. Do not share this.`,

  new_drive: ({ title, city, date }) =>
    `GreenGuard📢 New Drive in ${city}: ${title} on ${date}. Register now in the app to participate and earn rewards!`,
};

/**
 * Build and send a typed SMS event
 * @param {string} eventKey - Key from smsEvents map
 * @param {Object} templateData - Data to fill into the template
 * @param {string} recipientPhone - Recipient phone number
 * @param {string|null} userId - Recipient user ID for opt-in check
 * @param {boolean} checkOptIn - Whether to enforce opt-in check
 */
const sendEventSMS = async (eventKey, templateData, recipientPhone, userId = null, checkOptIn = true) => {
  const templateFn = smsEvents[eventKey];
  if (!templateFn) {
    console.error(`[SMS] Unknown event key: ${eventKey}`);
    return { sent: false, reason: 'unknown_event' };
  }

  const message = templateFn(templateData);
  return sendSMS({ userId, phone: recipientPhone, event: eventKey, message, checkOptIn });
};

module.exports = { sendSMS, sendEventSMS, isSmsGloballyEnabled };
