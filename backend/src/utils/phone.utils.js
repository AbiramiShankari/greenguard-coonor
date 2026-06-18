// GreenGuard — Phone Utilities
// Validates and formats Indian mobile numbers to +91XXXXXXXXXX

/**
 * Validates that the phone number is a valid Indian mobile number.
 * Accepts: +91XXXXXXXXXX or 91XXXXXXXXXX or 0XXXXXXXXXX or XXXXXXXXXX (10 digits)
 */
const isValidIndianPhone = (phone) => {
  const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  return /^(\+91|91|0)?[6-9]\d{9}$/.test(cleaned);
};

/**
 * Formats any Indian phone number to +91XXXXXXXXXX
 */
const formatIndianPhone = (phone) => {
  const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (cleaned.startsWith('+91')) return cleaned;
  if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.startsWith('0') && cleaned.length === 11) return `+91${cleaned.slice(1)}`;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return cleaned; // return as-is if unrecognized
};

module.exports = { isValidIndianPhone, formatIndianPhone };
