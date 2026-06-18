// GreenGuard — Collector Dashboard
// Shows assigned tasks (Complaints and Pickups) and allows resolving them with image upload

import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { timeAgo, getPriorityClass } from '../utils/format';

const WASTE_ICONS = { RECYCLABLE: '♻️', ORGANIC: '🌿', HAZARDOUS: '⚠️', E_WASTE: '💻', MIXED: '🗑️' };

export default function CollectorDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [tasks, setTasks] = useState({ complaints: [], pickups: [] });
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchTasks = async () => {
    try {
      const res = await api.get('/collector/tasks');
      setTasks(res.data.data);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('task_assigned', () => { fetchTasks(); toast.success('New task assigned!'); });
    return () => socket?.off('task_assigned');
  }, [socket]);

  const handleResolve = async (taskId, type) => {
    if (!selectedImage) {
      toast.error('Please upload a photo of the cleaned area first!');
      return;
    }
    
    setResolvingId(taskId);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedImage);
      reader.onloadend = async () => {
        const resolvedImageUrl = reader.result;
        try {
          await api.post(`/collector/tasks/resolve`, { taskId, type, resolvedImageUrl });
          toast.success('Task resolved successfully! Worker credits awarded. ✅');
          setSelectedImage(null);
          fetchTasks();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to resolve task');
        } finally {
          setResolvingId(null);
        }
      };
    } catch (err) { 
      toast.error(err.message || 'Failed to read image'); 
      setResolvingId(null);
    }
  };

  if (loading) return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  const pendingComplaints = tasks.complaints.filter(c => c.status === 'IN_PROGRESS');
  const completedComplaints = tasks.complaints.filter(c => c.status === 'RESOLVED');
  
  const pendingPickups = tasks.pickups.filter(p => p.status === 'ASSIGNED');
  const completedPickups = tasks.pickups.filter(p => p.status === 'COMPLETED');

  const totalPending = pendingComplaints.length + pendingPickups.length;
  const totalCompleted = completedComplaints.length + completedPickups.length;

  return (
    <>
      <div className="app-content">
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: 'var(--color-gray-900)' }}>Hello, {user?.name || 'Collector'} 👋</h2>
          <span style={{ fontSize: '14px', background: 'var(--color-primary-100)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
            {user?.greenguardId || user?.id}
          </span>
        </div>

        {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Pending Tasks', value: totalPending, color: '#f97316' },
              { label: 'Completed Today', value: totalCompleted, color: '#16a34a' },
              { label: 'Total Assigned', value: totalPending + totalCompleted, color: '#3b82f6' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ '--accent-color': s.color }}>
                <div className="stat-number">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Pending Tasks */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>📋 My Tasks ({totalPending})</h3>
            {totalPending === 0 ? (
              <p style={{ color: 'var(--color-gray-400)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No pending tasks!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Pending Complaints */}
                {pendingComplaints.map(c => (
                  <div key={c.id} style={{ border: '1px solid var(--color-gray-200)', borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ fontSize: 32 }}>🗑️</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>Complaint: {c.aiCategory || 'General'}</div>
                          <div style={{ fontSize: 13, color: 'var(--color-gray-600)', marginTop: 2 }}>📍 {c.ward}, {c.city}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-gray-400)', marginTop: 4 }}>Priority: <span className={`badge ${getPriorityClass(c.priority)}`}>{c.priority}</span></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, width: '100%', maxWidth: '250px' }}>
                          <input type="file" accept="image/*" onChange={e => setSelectedImage(e.target.files[0])} className="form-input" style={{fontSize: 11, padding: 4}} />
                          <button className="btn btn-primary btn-sm" disabled={resolvingId === c.id} onClick={() => handleResolve(c.id, 'complaint')}>
                            {resolvingId === c.id ? 'Uploading...' : '✅ Upload Photo & Resolve'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pending Pickups */}
                {pendingPickups.map(p => (
                  <div key={p.id} style={{ border: '1px solid var(--color-gray-200)', borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ fontSize: 32 }}>{WASTE_ICONS[p.wasteType] || '🗑️'}</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>Pickup: {p.wasteType} · {p.quantity} kg</div>
                          <div style={{ fontSize: 13, color: 'var(--color-gray-600)', marginTop: 2 }}>📍 {p.address}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-gray-400)', marginTop: 4 }}>Contact: {p.user?.name} ({p.user?.phone})</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, width: '100%', maxWidth: '250px' }}>
                          <input type="file" accept="image/*" onChange={e => setSelectedImage(e.target.files[0])} className="form-input" style={{fontSize: 11, padding: 4}} />
                          <button className="btn btn-primary btn-sm" disabled={resolvingId === p.id} onClick={() => handleResolve(p.id, 'pickup')}>
                            {resolvingId === p.id ? 'Uploading...' : '✅ Upload Photo & Resolve'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

              </div>
            )}
          </div>

          {/* Completed */}
          {totalCompleted > 0 && (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>✅ Completed Recently ({totalCompleted})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                
                {completedComplaints.map(c => (
                  <div key={c.id} style={{ padding: '10px 12px', background: 'var(--color-primary-50)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      {c.resolvedImageUrl && <img src={c.resolvedImageUrl} style={{width: 32, height: 32, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--color-primary)'}} alt="resolved" />}
                      <span style={{ fontSize: 13, color: 'var(--color-gray-700)' }}>Complaint in {c.ward}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--color-primary)' }}>✅ {timeAgo(c.updatedAt)}</span>
                  </div>
                ))}

                {completedPickups.map(p => (
                  <div key={p.id} style={{ padding: '10px 12px', background: 'var(--color-primary-50)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      {p.resolvedImageUrl && <img src={p.resolvedImageUrl} style={{width: 32, height: 32, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--color-primary)'}} alt="resolved" />}
                      <span style={{ fontSize: 13, color: 'var(--color-gray-700)' }}>{WASTE_ICONS[p.wasteType]} {p.wasteType} Pickup</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--color-primary)' }}>✅ {timeAgo(p.updatedAt)}</span>
                  </div>
                ))}

              </div>
            </div>
          )}
      </div>
    </>
  );
}
