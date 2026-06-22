import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ta' ? 'en' : 'ta';
    i18n.changeLanguage(newLang);
  };

  if (!user) return null;

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '20px', background: 'white', borderRadius: '16px', border: '1px solid var(--color-gray-200)' }}>
        <div style={{
          width: 60, height: 60, background: 'var(--color-primary-100)',
          borderRadius: '50%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--color-primary-700)', fontWeight: 700, fontSize: 24,
        }}>
          {user.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 2 }}>{user.name}</h2>
          <p style={{ color: 'var(--color-gray-500)', fontSize: 13 }}>{user.email} · {user.city}</p>
        </div>
      </div>

      {user.role === 'CITIZEN' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>{t('points')} & Badges</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 32 }}>⭐</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)' }}>{user.totalPoints} {t('points')}</div>
              {user.currentBadge && <div style={{ fontSize: 13, color: 'var(--color-gray-600)' }}>Current Badge: <strong>{user.currentBadge}</strong></div>}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
        {user.role === 'CITIZEN' && (
          <>
            <Link to="/collection/new" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--color-gray-100)' }}>
              <span style={{ fontSize: 20 }}>♻️</span>
              <span style={{ fontWeight: 500 }}>{t('request_pickup', 'Request Pickup')}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--color-gray-400)' }}>→</span>
            </Link>
            <Link to="/upcycle" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--color-gray-100)' }}>
              <span style={{ fontSize: 20 }}>🛋️</span>
              <span style={{ fontWeight: 500 }}>{t('nav_upcycle', 'Upcycle Furniture')}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--color-gray-400)' }}>→</span>
            </Link>
          </>
        )}
        <div 
          onClick={toggleLanguage}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--color-gray-100)', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 20 }}>🌐</span>
          <span style={{ fontWeight: 500 }}>{t('toggle_lang', 'Toggle Language')}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--color-gray-400)', fontSize: 13 }}>{i18n.language === 'ta' ? 'தமிழ்' : 'English'}</span>
        </div>
      </div>

      <button 
        onClick={handleLogout}
        className="btn btn-outline btn-full"
        style={{ padding: '14px', color: 'var(--color-red)', borderColor: 'var(--color-red)' }}
      >
        <span style={{ fontSize: 18 }}>🚪</span>
        {t('nav_logout', 'Logout')}
      </button>
      
      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--color-gray-400)' }}>
        GreenGuard v1.0.0
      </div>
    </div>
  );
}
