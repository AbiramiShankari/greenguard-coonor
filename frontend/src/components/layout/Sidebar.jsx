// GreenGuard — Sidebar Navigation Component
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const adminNav = [
  { to: '/admin', icon: '📊', labelKey: 'nav_dashboard', end: true },
  { to: '/map', icon: '🗺️', labelKey: 'nav_map' },
  { to: '/admin/sms', icon: '📱', labelKey: 'nav_sms' },
  { to: '/admin/ai-confidence', icon: '🧠', labelKey: 'nav_ai_confidence' },
];

const citizenNav = [
  { to: '/dashboard', icon: '🏠', labelKey: 'nav_dashboard', end: true },
  { to: '/complaint/new', icon: '🗑️', labelKey: 'report_complaint' },
  { to: '/collection/new', icon: '♻️', labelKey: 'request_pickup' },
  { to: '/store', icon: '🎁', labelKey: 'nav_store' },
  { to: '/upcycle', icon: '🛋️', labelKey: 'nav_upcycle' },
  { to: '/map', icon: '🗺️', labelKey: 'nav_map' },
];

const collectorNav = [
  { to: '/collector', icon: '📦', labelKey: 'nav_collections', end: true },
  { to: '/map', icon: '🗺️', labelKey: 'nav_map' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const navItems = user?.role === 'ADMIN' ? adminNav
    : user?.role === 'COLLECTOR' ? collectorNav
    : citizenNav;

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🌿</div>
        <div>
          <div className="sidebar-logo-text">{t('app_title')}</div>
          <div className="sidebar-logo-sub">{t('logo_sub')}</div>
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-gray-100)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gray-800)' }}>{user.name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-gray-500)', marginTop: 2 }}>{user.city} · {user.role}</div>
          {user.totalPoints > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}>
              ⭐ {user.totalPoints} {t('points')} {user.currentBadge && `· ${user.currentBadge}`}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">{t('navigation')}</div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={handleNavClick}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {t(item.labelKey)}
          </NavLink>
        ))}

        {/* Logout */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--color-gray-100)', paddingTop: 12 }}>
          <button className="nav-item btn-ghost" style={{ width: '100%', background: 'none' }} onClick={handleLogout}>
            <span style={{ fontSize: 18 }}>🚪</span>
            {t('nav_logout')}
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 20px', marginTop: 'auto', fontSize: 10, color: 'var(--color-gray-400)', borderTop: '1px solid var(--color-gray-100)' }}>
        {t('footer_text')}
      </div>
    </aside>
  );
}
