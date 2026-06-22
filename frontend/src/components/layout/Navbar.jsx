// GreenGuard — App Header
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import NotificationBell from './NotificationBell';

export default function Navbar({ title = 'GreenGuard' }) {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: '20px' }}>🌿</div>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-gray-900)' }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user && (
          <span style={{ fontSize: 13, color: 'var(--color-gray-500)' }}>
            {user.city}
          </span>
        )}
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
