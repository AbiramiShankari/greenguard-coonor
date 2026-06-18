// GreenGuard — Citizen Dashboard
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { timeAgo, truncate, getStatusClass, getPriorityClass, getCategoryClass, formatConfidence } from '../utils/format';
import { BADGE_THRESHOLDS } from '../utils/constants';

export default function Dashboard() {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();
  const [complaints, setComplaints] = useState([]);
  const [collections, setCollections] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [nearbyReports, setNearbyReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleRedeem = async (rewardId, cost) => {
    if ((user.totalPoints || 0) < cost) {
      toast.error('Insufficient points to redeem this reward!');
      return;
    }
    try {
      const res = await api.post('/rewards/redeem', { rewardId, cost });
      updateUser({ totalPoints: res.data.data.totalPoints, currentBadge: res.data.data.currentBadge });
      toast.success(`🎉 Redeemed successfully! Enjoy your ${rewardId.toUpperCase()}!`);
      const rRes = await api.get('/rewards/me');
      setRewards(rRes.data.data.history);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Redemption failed');
    }
  };

  // Fetch all dashboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cRes, colRes, rRes, lRes, nRes] = await Promise.all([
          api.get('/complaints?limit=5'),
          api.get('/collections?limit=3'),
          api.get('/rewards/me'),
          api.get(`/rewards/leaderboard?city=${user.city}&limit=5`),
          api.get('/complaints/nearby')
        ]);
        setComplaints(cRes.data.data.complaints);
        setCollections(colRes.data.data.collections);
        setRewards(rRes.data.data.history);
        setLeaderboard(lRes.data.data.leaderboard);
        setNearbyReports(nRes.data.data.nearby);
      } catch (err) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.city]);

  // Live updates via Socket.io
  useEffect(() => {
    if (!socket) return;
    socket.on('status_updated', ({ complaintId, newStatus, earnedPoints }) => {
      setComplaints(prev => prev.map(c =>
        c.id === complaintId ? { ...c, status: newStatus } : c
      ));
      if (earnedPoints > 0) {
        updateUser({ totalPoints: (user.totalPoints || 0) + earnedPoints });
        toast.success(`🎉 Status updated! +${earnedPoints} pts earned`);
      } else {
        toast(`🔄 Complaint status updated to ${newStatus}`);
      }
    });

    socket.on('points_awarded', ({ points, newTotal, badge }) => {
      updateUser({ totalPoints: newTotal, currentBadge: badge || user.currentBadge });
      toast.success(`⭐ +${points} points! Total: ${newTotal}`);
      if (badge) toast.success(`🏆 New badge: ${badge}!`, { duration: 6000 });
    });

    return () => {
      socket?.off('status_updated');
      socket?.off('points_awarded');
    };
  }, [socket, user, updateUser]);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      {/* Hero Header */}
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
            borderRadius: 'var(--radius-xl)', padding: '24px 28px', color: 'white', marginBottom: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <h2 style={{ color: 'white', marginBottom: 4, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                Hello, {user.name} 👋 
                <span style={{fontSize: '14px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px', fontWeight: 500}}>
                  {user.greenguardId || user.id}
                </span>
              </h2>
              <p style={{ opacity: 0.85, fontSize: 14 }}>{user.city} · Keep Tamil Nadu green!</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{user.totalPoints || 0} pts</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{user.currentBadge || 'Start earning badges!'}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            <Link to="/complaint/new" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ textAlign: 'center', cursor: 'pointer', border: '2px solid var(--color-primary-200)', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-primary-200)'}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>🗑️</div>
                <div style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>Report Waste</div>
                <div style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 4 }}>+10 pts on submit</div>
              </div>
            </Link>
            <Link to="/collection/new" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ textAlign: 'center', cursor: 'pointer', border: '2px solid var(--color-primary-200)', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-primary-200)'}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>♻️</div>
                <div style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>Request Pickup</div>
                <div style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 4 }}>+5 pts on submit</div>
              </div>
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div>
              {/* My Complaints */}
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="card-title">My Complaints</h3>
                  <Link to="/map" style={{ fontSize: 12, color: 'var(--color-primary)' }}>View Map →</Link>
                </div>
                {complaints.length === 0 ? (
                  <p style={{ color: 'var(--color-gray-400)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                    No complaints yet. <Link to="/complaint/new" style={{ color: 'var(--color-primary)' }}>Report one →</Link>
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {complaints.map(c => (
                      <div key={c.id} style={{ padding: '12px 16px', border: '1px solid var(--color-gray-100)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        {c.imageUrl && <img src={c.imageUrl} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span className={`badge ${getCategoryClass(c.aiCategory)}`}>{c.aiCategory || 'unknown'}</span>
                            <span className={`badge ${getStatusClass(c.status)}`}>{c.status}</span>
                            <span className={`badge ${getPriorityClass(c.priority)}`}>{c.priority}</span>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--color-gray-700)', marginBottom: 4 }}>{truncate(c.description, 60)}</p>
                          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-gray-400)' }}>
                            <span>👍 {c.upvoteCount}</span>
                            {c.aiConfidence && <span>AI: {formatConfidence(c.aiConfidence)}</span>}
                            <span>{timeAgo(c.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nearby Reports */}
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="card-title">Nearby Reports ({user.city})</h3>
                  <Link to="/map" style={{ fontSize: 12, color: 'var(--color-primary)' }}>View on Map →</Link>
                </div>
                {nearbyReports.length === 0 ? (
                  <p style={{ color: 'var(--color-gray-400)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                    No other reports in your area recently.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {nearbyReports.map(c => (
                      <div key={c.id} style={{ padding: '12px 16px', border: '1px solid var(--color-gray-100)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        {c.imageUrl && <img src={c.imageUrl} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span className={`badge ${getCategoryClass(c.aiCategory)}`}>{c.aiCategory || 'unknown'}</span>
                            <span className={`badge ${getStatusClass(c.status)}`}>{c.status}</span>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--color-gray-700)', marginBottom: 4 }}>{truncate(c.description, 60)}</p>
                          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-gray-400)' }}>
                            <span>👍 {c._count?.upvotes || 0}</span>
                            <span>{timeAgo(c.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* My Pickup Requests */}
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="card-title">My Pickup Requests</h3>
                  <Link to="/collection/new" style={{ fontSize: 12, color: 'var(--color-primary)' }}>Request Pickup →</Link>
                </div>
                {collections.length === 0 ? (
                  <p style={{ color: 'var(--color-gray-400)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                    No pickup requests yet. <Link to="/collection/new" style={{ color: 'var(--color-primary)' }}>Request one →</Link>
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {collections.map(c => (
                      <div key={c.id} style={{ padding: '12px 16px', border: '1px solid var(--color-gray-100)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 12, alignItems: 'center' }}>
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ fontSize: 24, width: 52, height: 52, background: 'var(--color-gray-100)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>♻️</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span className="badge badge-low" style={{ textTransform: 'capitalize' }}>{c.wasteType.toLowerCase()}</span>
                            <span className={`badge ${c.status === 'COMPLETED' ? 'badge-resolved' : c.status === 'ASSIGNED' ? 'badge-in-progress' : 'badge-new'}`}>{c.status}</span>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--color-gray-700)', marginBottom: 2 }}>{c.quantity} kg estimated</p>
                          <div style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>📍 {c.address}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Points History */}
              <div className="card" style={{ marginBottom: 24 }}>
                <h3 className="card-title card-header">Points History</h3>
                {rewards.length === 0 ? (
                  <p style={{ color: 'var(--color-gray-400)', fontSize: 13 }}>No rewards yet</p>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Reason</th><th>Points</th><th>Date</th></tr></thead>
                    <tbody>
                      {rewards.map(r => (
                        <tr key={r.id}>
                          <td>{r.badge ? `🏆 ${r.badge}` : r.reason.replace(/_/g, ' ')}</td>
                          <td style={{ color: r.points > 0 ? 'var(--color-primary)' : 'var(--color-gray-400)', fontWeight: 600 }}>
                            {r.points > 0 ? `+${r.points}` : '—'}
                          </td>
                          <td style={{ color: 'var(--color-gray-400)' }}>{timeAgo(r.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Claim & Redeem Rewards */}
              <div className="card">
                <h3 className="card-title card-header">🎁 Claim & Redeem Rewards</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { id: 'tea', label: '🍵 Nilgiris Organic Tea Packet', cost: 100 },
                    { id: 'mug', label: '🥛 Eco-Friendly Bamboo Mug', cost: 200 },
                    { id: 'train', label: '🚂 Coonoor Toy Train Ticket Discount', cost: 300 },
                  ].map(item => {
                    const canRedeem = (user.totalPoints || 0) >= item.cost;
                    return (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--color-gray-100)', borderRadius: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>Cost: {item.cost} points</div>
                        </div>
                        <button
                          className={`btn ${canRedeem ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                          disabled={!canRedeem}
                          onClick={() => handleRedeem(item.id, item.cost)}
                          style={{ minWidth: 80 }}
                        >
                          {canRedeem ? 'Redeem' : 'Locked 🔒'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Leaderboard */}
            <div>
              <div className="card">
                <h3 className="card-title card-header">🏆 {user.city} Leaderboard</h3>
                {leaderboard.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                    borderBottom: '1px solid var(--color-gray-100)',
                  }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>
                      {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `${item.rank}.`}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: item.id === user.id ? 'var(--color-primary)' : 'var(--color-gray-800)' }}>
                        {item.name} {item.id === user.id && '(You)'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>{item.badge}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>{item.points}</span>
                  </div>
                ))}
              </div>

              {/* Badge Unlocks */}
              <div className="card" style={{ marginTop: 20 }}>
                <h3 className="card-title card-header">🎖️ Badge Unlocking</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {BADGE_THRESHOLDS.map(b => {
                    const unlocked = (user.totalPoints || 0) >= b.minPoints;
                    return (
                      <div key={b.badge} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: unlocked ? 1 : 0.6 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: unlocked ? 'var(--color-primary)' : 'var(--color-gray-700)' }}>
                            {b.badge} {unlocked && '✅'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>Requires {b.minPoints} pts</span>
                        </div>
                        {!unlocked && (
                          <span style={{ fontSize: 11, background: 'var(--color-gray-100)', padding: '2px 6px', borderRadius: 4 }}>
                            {b.minPoints - (user.totalPoints || 0)} pts left
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
    </>
  );
}
