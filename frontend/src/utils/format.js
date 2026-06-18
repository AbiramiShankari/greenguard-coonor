// GreenGuard — Format Utilities
import { formatDistanceToNow, format } from 'date-fns';

/** Returns "2 hours ago", "5 minutes ago" etc. */
export const timeAgo = (date) => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return 'unknown';
  }
};

/** Truncate a string to maxLen characters */
export const truncate = (str, maxLen = 60) => {
  if (!str) return '';
  return str.length > maxLen ? `${str.slice(0, maxLen)}...` : str;
};

/** Format date to Indian style: "17 May 2026" */
export const formatDate = (date) => {
  try {
    return format(new Date(date), 'd MMM yyyy');
  } catch {
    return 'N/A';
  }
};

/** Format date + time */
export const formatDateTime = (date) => {
  try {
    return format(new Date(date), 'd MMM yyyy, h:mm a');
  } catch {
    return 'N/A';
  }
};

/** Capitalize first letter */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/** Get badge CSS class for status */
export const getStatusClass = (status) => {
  const map = {
    NEW: 'badge-new',
    IN_PROGRESS: 'badge-in-progress',
    RESOLVED: 'badge-resolved',
    CLOSED: 'badge-closed',
    DUPLICATE: 'badge-duplicate',
  };
  return map[status] || 'badge-closed';
};

/** Get badge CSS class for priority */
export const getPriorityClass = (priority) => {
  const map = {
    LOW: 'badge-low',
    MEDIUM: 'badge-medium',
    HIGH: 'badge-high',
    CRITICAL: 'badge-critical',
  };
  return map[priority] || 'badge-medium';
};

/** Get badge CSS class for AI category */
export const getCategoryClass = (category) => `badge-${category || 'other'}`;

/** Confidence % formatted string */
export const formatConfidence = (confidence) => {
  if (!confidence) return 'N/A';
  return `${Math.round(confidence * 100)}%`;
};
