// GreenGuard — App Header
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import NotificationBell from './NotificationBell';

export default function Navbar({ title = 'GreenGuard', onMenuToggle }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ta' ? 'en' : 'ta';
    i18n.changeLanguage(newLang);
  };

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuToggle}
          style={{ display: 'none', background: 'none', fontSize: 20, padding: 4 }}
          className="mobile-menu-btn"
        >
          ☰
        </button>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-gray-900)' }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user && (
          <span style={{ fontSize: 13, color: 'var(--color-gray-500)' }}>
            {user.city}
          </span>
        )}
        <button 
          onClick={toggleLanguage}
          className="btn btn-ghost btn-sm"
          style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--color-gray-200)' }}
        >
          {t('toggle_lang')}
        </button>
        <NotificationBell />
        <div style={{
          width: 32, height: 32, background: 'var(--color-primary)',
          borderRadius: '50%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13,
        }}>
          {user?.name?.[0]?.toUpperCase() || '?'}
        </div>
      </div>
    </header>
  );
}
