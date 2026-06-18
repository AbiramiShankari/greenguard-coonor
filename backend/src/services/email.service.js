// GreenGuard — Email Service
// Nodemailer — sends status update emails to citizens on complaint resolution

const nodemailer = require('nodemailer');

/**
 * Create reusable transporter using Gmail SMTP (or any SMTP provider)
 * Credentials loaded from .env
 */
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send complaint status update email to citizen
 * Called when admin changes complaint status
 *
 * @param {Object} params
 * @param {string} params.toEmail - Citizen's email
 * @param {string} params.toName - Citizen's name
 * @param {string} params.complaintId - Short complaint ID
 * @param {string} params.newStatus - New status (IN_PROGRESS | RESOLVED | etc.)
 * @param {string} params.city - City name
 * @param {number} params.earnedPoints - Points earned (if any)
 */
const sendStatusUpdateEmail = async ({ toEmail, toName, complaintId, newStatus, city, earnedPoints = 0 }) => {
  try {
    // Only send email if credentials are configured
    if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'REPLACE_WITH_REAL_VALUE') {
      console.log('[EMAIL] Email credentials not configured — skipping email send');
      return { sent: false, reason: 'not_configured' };
    }

    const transporter = createTransporter();

    const statusMessages = {
      IN_PROGRESS: { emoji: '🔄', text: 'is now IN PROGRESS', detail: 'Our team is actively working on this.' },
      RESOLVED: { emoji: '🎉', text: 'has been RESOLVED', detail: `You earned ${earnedPoints} bonus points!` },
      CLOSED: { emoji: '📁', text: 'has been CLOSED', detail: 'This complaint has been closed by the admin.' },
      DUPLICATE: { emoji: '🔁', text: 'was marked as DUPLICATE', detail: 'A similar issue is already being addressed.' },
    };

    const statusInfo = statusMessages[newStatus] || { emoji: '📢', text: `status updated to ${newStatus}`, detail: '' };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 20px;">
        <div style="background: #16a34a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🌿 GreenGuard</h1>
          <p style="color: #bbf7d0; margin: 4px 0 0 0; font-size: 14px;">Civic Waste Management · Tamil Nadu</p>
        </div>
        <div style="background: white; padding: 32px; border-radius: 0 0 8px 8px;">
          <p style="color: #374151; font-size: 16px;">Hello <strong>${toName}</strong>,</p>
          <p style="color: #374151; font-size: 16px;">
            Your waste complaint <strong>#${complaintId.slice(-8).toUpperCase()}</strong> in <strong>${city}</strong>
            ${statusInfo.emoji} <strong>${statusInfo.text}</strong>.
          </p>
          <p style="color: #6b7280; font-size: 15px;">${statusInfo.detail}</p>
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="color: #15803d; font-weight: bold; margin: 0;">Complaint ID: #${complaintId.slice(-8).toUpperCase()}</p>
            <p style="color: #16a34a; margin: 4px 0 0 0;">Status: ${newStatus}</p>
          </div>
          <p style="color: #9ca3af; font-size: 13px;">
            Thank you for helping keep Tamil Nadu clean. Every report matters!
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
            — GreenGuard Team · Sanitation Department, Tamil Nadu
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"GreenGuard 🌿" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `GreenGuard ${statusInfo.emoji} — Complaint #${complaintId.slice(-8).toUpperCase()} ${statusInfo.text}`,
      html,
    });

    return { sent: true };
  } catch (err) {
    // Fail silently — email failure must never crash the main flow
    console.error('[EMAIL] sendStatusUpdateEmail error:', err.message);
    return { sent: false, error: err.message };
  }
};

module.exports = { sendStatusUpdateEmail };
