// GreenGuard — Constants
// Cities, waste types, badge thresholds, category colors

export const CITIES = [
  'Bedford',
  'Brooklands',
  'Grey Hills',
  'Church Hill',
  'Alwarpet',
  'Tiger Hill',
  'Mount Pleasant',
  "Walker's Hill",
  'Singara',
  'Springfield',
  'Yedapalli',
  'Wellington',
  'Ketti',
  'Adikaratti',
  'Huligal',
  'Bandishola',
  'Bearhatty',
  'Burliar',
  'Hubbathalai',
  'Melur'
];

export const WASTE_TYPES = [
  { id: 'RECYCLABLE', label: 'Recyclable', icon: '♻️' },
  { id: 'E_WASTE', label: 'E-Waste', icon: '💻' },
  { id: 'FABRIC', label: 'Fabric/Cloth', icon: '👕' },
  { id: 'PAPER', label: 'Paper', icon: '📰' },
  { id: 'BIODEGRADABLE', label: 'Biodegradable', icon: '🌿' },
];

export const CATEGORIES = [
  { id: 'overflow', label: 'Overflow', color: '#ef4444' },
  { id: 'illegal_dumping', label: 'Illegal Dumping', color: '#7c3aed' },
  { id: 'drainage', label: 'Drainage', color: '#3b82f6' },
  { id: 'litter', label: 'Litter', color: '#f97316' },
  { id: 'dead_animal', label: 'Dead Animal', color: '#6b7280' },
  { id: 'construction_waste', label: 'Construction Waste', color: '#d97706' },
  { id: 'other', label: 'Other', color: '#6b7280' },
];

export const STATUSES = [
  { id: 'NEW', label: 'New', className: 'badge-new' },
  { id: 'IN_PROGRESS', label: 'In Progress', className: 'badge-in-progress' },
  { id: 'RESOLVED', label: 'Resolved', className: 'badge-resolved' },
  { id: 'CLOSED', label: 'Closed', className: 'badge-closed' },
  { id: 'DUPLICATE', label: 'Duplicate', className: 'badge-duplicate' },
];

export const PRIORITIES = [
  { id: 'LOW', label: 'Low', className: 'badge-low' },
  { id: 'MEDIUM', label: 'Medium', className: 'badge-medium' },
  { id: 'HIGH', label: 'High', className: 'badge-high' },
  { id: 'CRITICAL', label: 'Critical', className: 'badge-critical' },
];

export const BADGE_THRESHOLDS = [
  { minPoints: 1000, badge: 'City Hero 🏆' },
  { minPoints: 500, badge: 'Eco Warrior 🌿' },
  { minPoints: 200, badge: 'Green Champion 🥇' },
  { minPoints: 100, badge: 'Silver Guardian 🥈' },
  { minPoints: 50, badge: 'Bronze Citizen 🥉' },
];

export const MARKER_COLORS = {
  NEW: '#ef4444',
  IN_PROGRESS: '#f97316',
  RESOLVED: '#16a34a',
  CLOSED: '#6b7280',
  DUPLICATE: '#6b7280',
};
