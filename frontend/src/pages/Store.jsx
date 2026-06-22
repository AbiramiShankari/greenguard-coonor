import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Store() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [currentPoints, setCurrentPoints] = useState(user?.totalPoints || 0);

  // OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [selectedRewardId, setSelectedRewardId] = useState(null);

  useEffect(() => {
    fetchStore();
  }, []);

  const fetchStore = async () => {
    try {
      const res = await api.get('/store');
      setItems(res.data.data.items);
      // Also fetch latest user points to be safe
      const meRes = await api.get('/auth/me');
      setCurrentPoints(meRes.data.data.user.totalPoints);
    } catch (err) {
      toast.error(t('failed_to_load_store'));
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemClick = async (itemId, cost) => {
    if (currentPoints < cost) {
      toast.error(t('insufficient_points'));
      return;
    }
    setRedeeming(true);
    try {
      await api.post('/store/redeem/send-otp');
      setSelectedRewardId(itemId);
      setShowOtpModal(true);
      toast.success(t('otp_sent'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('failed_to_send_otp'));
    } finally {
      setRedeeming(false);
    }
  };

  const confirmRedemption = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast.error(t('invalid_otp'));
      return;
    }
    setRedeeming(true);
    try {
      const res = await api.post('/store/redeem', { rewardItemId: selectedRewardId, otp: otpCode });
      toast.success(t('reward_redeemed_successfully'));
      setCurrentPoints(res.data.data.pointsRemaining);
      setShowOtpModal(false);
      setOtpCode('');
      setSelectedRewardId(null);
    } catch (err) {
      toast.error(err.response?.data?.message || t('failed_to_redeem_reward'));
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <>
      <div className="app-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>{t('rewards_store_title')}</h2>
              <p style={{ color: 'var(--color-gray-500)', fontSize: 14 }}>
                {t('redeem_points_desc')}
              </p>
            </div>
            <div style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', padding: '12px 20px', borderRadius: 20, fontWeight: 700, fontSize: 18 }}>
              {currentPoints} {t('pts')}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {items.map(item => (
                <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <img src={item.imageUrl || 'https://via.placeholder.com/300x150?text=Reward'} alt={item.name} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                  <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600, marginBottom: 4 }}>{item.partnerName}</div>
                    <h3 style={{ fontSize: 18, marginBottom: 8, lineHeight: 1.3 }}>{item.name}</h3>
                    <p style={{ color: 'var(--color-gray-500)', fontSize: 13, flex: 1, marginBottom: 16 }}>{item.description}</p>
                    <button 
                      className="btn btn-primary btn-full"
                      disabled={redeeming || currentPoints < item.pointCost}
                      onClick={() => handleRedeemClick(item.id, item.pointCost)}
                    >
                      {currentPoints >= item.pointCost ? `${t('redeem_for')} ${item.pointCost} ${t('pts')}` : `${t('need')} ${item.pointCost - currentPoints} ${t('more_pts')}`}
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-gray-500)', gridColumn: '1 / -1' }}>
                  {t('no_rewards')}
                </div>
              )}
            </div>
          )}

          {/* OTP Modal */}
          {showOtpModal && (
            <div className="modal-overlay">
              <div className="modal" style={{ maxWidth: 400 }}>
                <h3 style={{ marginBottom: 12 }}>{t('verify_redemption')}</h3>
                <p style={{ color: 'var(--color-gray-500)', fontSize: 14, marginBottom: 20 }}>
                  {t('otp_sent_desc')}
                </p>
                <div className="form-group">
                  <label>{t('otp_code')}</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder={t('enter_6_digit_otp')}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="form-input"
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button 
                    className="btn btn-secondary btn-full"
                    onClick={() => {
                      setShowOtpModal(false);
                      setOtpCode('');
                    }}
                    disabled={redeeming}
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    className="btn btn-primary btn-full"
                    onClick={confirmRedemption}
                    disabled={redeeming || otpCode.length !== 6}
                  >
                    {redeeming ? 'Verifying...' : 'Verify & Redeem'}
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </>
  );
}
