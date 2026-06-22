import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

const adminNav = [
  { to: '/admin', icon: '📊', labelKey: 'nav_dashboard', end: true },
  { to: '/map', icon: '🗺️', labelKey: 'nav_map' },
  { to: '/admin/sms', icon: '📱', labelKey: 'nav_sms' },
  { to: '/admin/ai-confidence', icon: '🧠', labelKey: 'nav_ai_confidence' },
  { to: '/profile', icon: '👤', labelKey: 'Profile' },
];

const citizenNav = [
  { to: '/dashboard', icon: '🏠', labelKey: 'nav_dashboard', end: true },
  { to: '/complaint/new', icon: '📸', labelKey: 'report_complaint' },
  { to: '/store', icon: '🎁', labelKey: 'nav_store' },
  { to: '/map', icon: '🗺️', labelKey: 'nav_map' },
  { to: '/profile', icon: '👤', labelKey: 'Profile' },
];

const collectorNav = [
  { to: '/collector', icon: '📦', labelKey: 'nav_collections', end: true },
  { to: '/map', icon: '🗺️', labelKey: 'nav_map' },
  { to: '/profile', icon: '👤', labelKey: 'Profile' },
];

export default function BottomNav() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const navItems = user?.role === 'ADMIN' ? adminNav
    : user?.role === 'COLLECTOR' ? collectorNav
    : citizenNav;

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          {t(item.labelKey, item.labelKey)} {/* Fallback to labelKey if missing in translation */}
        </NavLink>
      ))}
    </nav>
  );
}
