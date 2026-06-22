// GreenGuard — Admin Dashboard
// Stats cards, AI insight, live complaint feed, complaint management table

import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { timeAgo, getStatusClass, getPriorityClass, getCategoryClass, formatConfidence, formatDateTime } from '../utils/format';
import { CITIES } from '../utils/constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7', '#ef4444'];

const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DUPLICATE'];

export default function AdminDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [stats, setStats] = useState(null);
  const [insight, setInsight] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [liveFeed, setLiveFeed] = useState([]);
  const [filters, setFilters] = useState({ status: '', city: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [collectors, setCollectors] = useState([]);
  const [activeComparison, setActiveComparison] = useState(null);
  const [drives, setDrives] = useState([]);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveForm, setDriveForm] = useState({ title: '', description: '', location: '', city: CITIES[0], ward: 'Ward 1', date: '', image: null });
  const [isSubmittingDrive, setIsSubmittingDrive] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes, insightRes, cRes, colRes, dRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/ai-insight'),
        api.get('/complaints?' + new URLSearchParams(filters).toString() + '&limit=50'),
        api.get('/admin/collectors'),
        api.get('/drives')
      ]);
      setStats(statsRes.data.data);
      setInsight(insightRes.data.data.insight);
      setComplaints(cRes.data.data.complaints);
      setCollectors(colRes.data.data.collectors);
      setDrives(dRes.data.data.drives || []);
    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filters]);

  // Socket.io — live feed
  useEffect(() => {
    if (!socket) return;
    socket.on('new_complaint', (data) => {
      setLiveFeed(prev => [{ ...data, timestamp: new Date() }, ...prev].slice(0, 10));
      setComplaints(prev => [{ id: data.complaintId, status: 'NEW', aiCategory: data.category, aiConfidence: data.confidence, priority: data.priority, aiSummary: data.summary, city: data.city, createdAt: new Date() }, ...prev]);
      toast(`🔔 New complaint in ${data.city}: ${data.category}`, { icon: '🗑️' });
    });
    socket.on('critical_alert', (data) => {
      toast.error(`🚨 CRITICAL complaint #${data.complaintId?.slice(-6)} — ${data.category}`, { duration: 8000 });
    });
    return () => { socket?.off('new_complaint'); socket?.off('critical_alert'); };
  }, [socket]);

  const handleStatusChange = async (complaintId, newStatus) => {
    try {
      await api.put(`/complaints/${complaintId}`, { status: newStatus });
      setComplaints(prev => prev.map(c => c.id === complaintId ? { ...c, status: newStatus } : c));
      toast.success(`Status updated → ${newStatus}`);
    } catch { toast.error('Failed to update status'); }
  };

  const handleAssignTask = async (taskId, collectorId) => {
    try {
      await api.post('/admin/assign-task', { taskId, type: 'complaint', collectorId });
      setComplaints(prev => prev.map(c => c.id === taskId ? { ...c, collectorId, status: 'IN_PROGRESS' } : c));
      toast.success('Assigned to collector successfully!');
    } catch { toast.error('Failed to assign task'); }
  };

  const handleRefreshInsight = async () => {
    setInsightLoading(true);
    try {
      const res = await api.post('/admin/ai-insight/refresh');
      setInsight(res.data.data.insight);
      toast.success('AI insight refreshed!');
    } catch { toast.error('Insight refresh failed'); }
    setInsightLoading(false);
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/admin/export/complaints', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `greenguard_complaints_${Date.now()}.csv`;
      a.click();
    } catch { toast.error('Export failed'); }
  };

  const handleCreateDrive = async (e) => {
    e.preventDefault();
    setIsSubmittingDrive(true);
    try {
      const formData = new FormData();
      Object.entries(driveForm).forEach(([k, v]) => formData.append(k, v));
      const res = await api.post('/drives', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDrives(prev => [res.data.data, ...prev]);
      setShowDriveModal(false);
      setDriveForm({ title: '', description: '', location: '', city: CITIES[0], ward: 'Ward 1', date: '', image: null });
      toast.success('Drive created and users notified!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create drive');
    }
    setIsSubmittingDrive(false);
  };

  if (loading) return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  const trendIcon = insight?.weeklyTrend === 'improving' ? '↑' : insight?.weeklyTrend === 'worsening' ? '↓' : '→';
  const trendColor = insight?.weeklyTrend === 'improving' ? 'var(--color-primary)' : insight?.weeklyTrend === 'worsening' ? 'var(--color-red)' : 'var(--color-gray-500)';

  return (
    <>
      <div className="app-content">
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: 'var(--color-gray-900)' }}>Hello, {user?.name || 'Admin'} 👋</h2>
          <span style={{ fontSize: '14px', background: 'var(--color-primary-100)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
            {user?.greenguardId || user?.id}
          </span>
        </div>

        {/* Stat Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Complaints Today', value: stats?.totalComplaintsToday ?? 0, accent: '#3b82f6' },
              { label: 'Resolved Today', value: stats?.resolvedToday ?? 0, accent: '#16a34a' },
              { label: 'Critical Open', value: stats?.criticalOpen ?? 0, accent: '#ef4444' },
              { label: 'Active Users (7d)', value: stats?.activeUsersThisWeek ?? 0, accent: '#8b5cf6' },
              { label: 'SMS Sent Today', value: stats?.smsSentToday ?? 0, accent: '#f97316' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ '--accent-color': s.accent }}>
                <div className="stat-number">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
            {/* Severity Pie Chart */}
            <div className="card">
              <h3 className="card-title">Severity Distribution</h3>
              <div style={{ height: 200 }}>
                {stats?.severityData && stats.severityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.severityData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} dataKey="value" paddingAngle={5}>
                        {stats.severityData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p style={{ textAlign: 'center', marginTop: 80, color: '#aaa', fontSize: 12 }}>No data</p>}
              </div>
            </div>

            {/* Category Bar Chart */}
            <div className="card">
              <h3 className="card-title">Top Categories</h3>
              <div style={{ height: 200 }}>
                {stats?.categoryData && stats.categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.categoryData} layout="vertical" margin={{ left: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p style={{ textAlign: 'center', marginTop: 80, color: '#aaa', fontSize: 12 }}>No data</p>}
              </div>
            </div>

            {/* Trend Line Chart */}
            <div className="card">
              <h3 className="card-title">7-Day Trend</h3>
              <div style={{ height: 200 }}>
                {stats?.trendData && stats.trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="complaints" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p style={{ textAlign: 'center', marginTop: 80, color: '#aaa', fontSize: 12 }}>No data</p>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
            {/* AI Insight Card */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 className="card-title">🤖 AI Weekly Insight</h3>
                <button className="btn btn-outline btn-sm" onClick={handleRefreshInsight} disabled={insightLoading}>
                  {insightLoading ? <span className="spinner" /> : '🔄 Refresh'}
                </button>
              </div>
              {insight ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: '12px', background: 'var(--color-gray-50)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-gray-500)' }}>Top Issue</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{insight.topIssue}</div>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--color-gray-50)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-gray-500)' }}>Hotspot</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{insight.hotspot}</div>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--color-gray-50)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-gray-500)' }}>Avg Resolution</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{insight.avgResolutionTime}</div>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--color-gray-50)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-gray-500)' }}>Weekly Trend</div>
                    <div style={{ fontWeight: 700, color: trendColor, marginTop: 2 }}>{trendIcon} {insight.weeklyTrend}</div>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--color-primary-50)', borderRadius: 8, gridColumn: '1/-1', border: '1px solid var(--color-primary-200)' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-primary)', marginBottom: 4 }}>💡 Recommendation</div>
                    <div style={{ fontSize: 13 }}>{insight.recommendation}</div>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--color-gray-400)', fontSize: 13 }}>No insight yet — will be generated at midnight or click Refresh.</p>
              )}
            </div>

            {/* Live Feed */}
            <div className="live-feed">
              <div className="live-feed-header">
                <span className="live-dot" />
                Live Feed ({liveFeed.length})
              </div>
              {liveFeed.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-gray-400)', fontSize: 12 }}>
                  Waiting for new complaints...
                </div>
              ) : (
                liveFeed.map((item, i) => (
                  <div key={i} className="live-feed-item">
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <span className={`badge ${getCategoryClass(item.category)}`}>{item.category}</span>
                      <span className={`badge ${getPriorityClass(item.priority)}`}>{item.priority}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-gray-600)' }}>{item.city} · {timeAgo(item.timestamp)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Complaint Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="card-title">Complaint Management</h3>
              <button className="btn btn-outline btn-sm" onClick={handleExport}>📥 Export CSV</button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              {['status', 'city', 'priority'].map(f => (
                <select key={f} className="form-input" style={{ width: 'auto' }}
                  value={filters[f]} onChange={e => setFilters(p => ({ ...p, [f]: e.target.value }))}>
                  <option value="">All {f}s</option>
                  {f === 'status' && STATUSES.map(s => <option key={s}>{s}</option>)}
                  {f === 'city' && CITIES.map(c => <option key={c}>{c}</option>)}
                  {f === 'priority' && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <option key={p}>{p}</option>)}
                </select>
              ))}
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>City/Ward</th>
                    <th>AI Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assign Collector</th>
                    <th>Images (Before / After)</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>#{c.id.slice(-6).toUpperCase()}</td>
                      <td>{c.user?.name || '—'}</td>
                      <td style={{ fontSize: 12 }}>{c.city}</td>
                      <td>
                        <span className={`badge ${getCategoryClass(c.aiCategory)}`}>{c.aiCategory || '—'}</span>
                        {c.aiConfidence && <span style={{ fontSize: 10, color: 'var(--color-gray-400)', marginLeft: 4 }}>{formatConfidence(c.aiConfidence)}</span>}
                      </td>
                      <td><span className={`badge ${getPriorityClass(c.priority)}`}>{c.priority}</span></td>
                      <td>
                        <select
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                          value={c.status}
                          onChange={e => handleStatusChange(c.id, e.target.value)}
                        >
                          {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: 12, width: '130px' }}
                          value={c.collectorId || ''}
                          onChange={e => handleAssignTask(c.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {collectors.map(col => (
                            <option key={col.id} value={col.id}>
                              {col.name} ({col.phone})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxWidth: '140px' }}>
                        {c.imageUrl ? (
                          <img 
                            src={c.imageUrl} 
                            alt="Before" 
                            onClick={() => setActiveComparison({ before: c.imageUrl, after: c.resolvedImageUrl, landmark: c.landmarkImageUrl })}
                            style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', cursor: 'pointer' }} 
                            title="Before" 
                          />
                        ) : '—'}
                        {c.landmarkImageUrl ? (
                          <img 
                            src={c.landmarkImageUrl} 
                            alt="Landmark" 
                            onClick={() => setActiveComparison({ before: c.imageUrl, after: c.resolvedImageUrl, landmark: c.landmarkImageUrl })}
                            style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: '2px solid var(--color-primary-light)', cursor: 'pointer' }} 
                            title="Landmark" 
                          />
                        ) : null}
                        {c.resolvedImageUrl ? (
                          <img 
                            src={c.resolvedImageUrl} 
                            alt="After" 
                            onClick={() => setActiveComparison({ before: c.imageUrl, after: c.resolvedImageUrl, landmark: c.landmarkImageUrl })}
                            style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: '2px solid var(--color-primary)', cursor: 'pointer' }} 
                            title="After" 
                          />
                        ) : null}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>{timeAgo(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {complaints.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-gray-400)' }}>No complaints found</div>
              )}
            </div>
          </div>

          {/* Local Drives Table */}
          <div className="card" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="card-title">Local Drives Management</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowDriveModal(true)}>+ Create Drive</button>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Drive</th>
                    <th>Date</th>
                    <th>City/Ward</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Participants</th>
                  </tr>
                </thead>
                <tbody>
                  {drives.map(d => (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{d.title}</div>
                      </td>
                      <td>{formatDateTime(d.date)}</td>
                      <td>{d.city} / {d.ward}</td>
                      <td>{d.location}</td>
                      <td><span className={`badge`} style={{ background: d.status === 'COMPLETED' ? 'var(--color-primary-100)' : 'var(--color-gray-100)', color: d.status === 'COMPLETED' ? 'var(--color-primary)' : 'var(--color-gray-700)' }}>{d.status}</span></td>
                      <td>{d._count?.participants || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {drives.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-gray-400)' }}>No active drives</div>
              )}
            </div>
          </div>
      </div>

      {/* Before / After Comparison Modal */}
      {activeComparison && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 24 }} onClick={() => setActiveComparison(null)}>
          <div style={{ backgroundColor: 'var(--color-surface)', padding: 24, borderRadius: 16, maxWidth: 800, width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Photo Evidence</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveComparison(null)}>Close</button>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              {activeComparison.before && (
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>Before</span>
                  <img src={activeComparison.before} alt="Before" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 8, border: '2px solid #ef4444' }} />
                </div>
              )}
              {activeComparison.landmark && (
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Landmark Reference</span>
                  <img src={activeComparison.landmark} alt="Landmark" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 8, border: '2px solid var(--color-primary)' }} />
                </div>
              )}
              {activeComparison.after && (
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>After</span>
                  <img src={activeComparison.after} alt="After" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 8, border: '2px solid #10b981' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Drive Modal */}
      {showDriveModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }} onClick={() => setShowDriveModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Create Local Drive</h3>
            <form onSubmit={handleCreateDrive} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Title</label>
                <input required type="text" className="form-input" value={driveForm.title} onChange={e => setDriveForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Sunday Lake Cleanup" />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea required className="form-input" rows={3} value={driveForm.description} onChange={e => setDriveForm(p => ({ ...p, description: e.target.value }))} placeholder="Details about the drive..." />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">City</label>
                  <select required className="form-input" value={driveForm.city} onChange={e => setDriveForm(p => ({ ...p, city: e.target.value }))}>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Ward</label>
                  <input required type="text" className="form-input" value={driveForm.ward} onChange={e => setDriveForm(p => ({ ...p, ward: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Location (Address/Landmark)</label>
                <input required type="text" className="form-input" value={driveForm.location} onChange={e => setDriveForm(p => ({ ...p, location: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Date & Time</label>
                <input required type="datetime-local" className="form-input" value={driveForm.date} onChange={e => setDriveForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Banner Image</label>
                <input type="file" accept="image/*" className="form-input" onChange={e => setDriveForm(p => ({ ...p, image: e.target.files[0] }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDriveModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingDrive}>
                  {isSubmittingDrive ? 'Creating...' : 'Create Drive & Notify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
