// GreenGuard — SMS Panel (Admin Only)
// SMS log table, delivery stats, global toggle, and resend actions

import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/format';

export default function SmsPanel() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [filters, setFilters] = useState({ event: '', status: '' });
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...filters, page: pagination.page });
      const [logsRes, statsRes] = await Promise.all([
        api.get(`/admin/sms-logs?${params}`),
        api.get('/admin/sms-stats'),
      ]);
      setLogs(logsRes.data.data.logs);
      setPagination(logsRes.data.data.pagination);
      setStats(statsRes.data.data);
    } catch { toast.error('Failed to load SMS data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [filters, pagination.page]);

  const handleToggle = async () => {
    try {
      const res = await api.put('/admin/sms-toggle');
      setSmsEnabled(res.data.data.smsEnabled);
      toast.success(`SMS ${res.data.data.smsEnabled ? 'enabled ✅' : 'paused ⏸️'}`);
    } catch { toast.error('Toggle failed'); }
  };

  const handleResend = async (logId) => {
    try {
      await api.post(`/admin/sms-resend/${logId}`);
      toast.success('SMS resent!');
      fetchData();
    } catch { toast.error('Resend failed'); }
  };

  return (
    <>
      <div className="app-content">
        {/* Stats + Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24, alignItems: 'stretch' }}>
            {stats && [
              { label: 'Sent Today', value: stats.sentToday, color: '#16a34a' },
              { label: 'Failed Today', value: stats.failedToday, color: '#ef4444' },
              { label: 'Delivery Rate', value: `${stats.deliveryRate}%`, color: '#3b82f6' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ '--accent-color': s.color }}>
                <div className="stat-number">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}

            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Global SMS</div>
              <button
                onClick={handleToggle}
                className={`btn ${smsEnabled ? 'btn-primary' : 'btn-danger'} btn-sm`}
                id="sms-toggle"
              >
                {smsEnabled ? '✅ Enabled' : '⏸️ Paused'}
              </button>
              <div style={{ fontSize: 11, color: 'var(--color-gray-400)', marginTop: 6 }}>Click to toggle</div>
            </div>
          </div>

          {/* Filters */}
          <div className="card">
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <select className="form-input" style={{ width: 'auto' }} value={filters.event} onChange={e => setFilters(p => ({ ...p, event: e.target.value }))}>
                <option value="">All Events</option>
                {['complaint_submitted', 'status_updated', 'collection_assigned', 'daily_summary'].map(e => <option key={e}>{e}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto' }} value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
                <option value="">All Statuses</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
                <option value="QUEUED">Queued</option>
              </select>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>To</th><th>Event</th><th>Message</th><th>Status</th><th>Twilio SID</th><th>Time</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{log.user?.name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>{log.phone}</div>
                      </td>
                      <td><span style={{ fontSize: 12, fontFamily: 'monospace', background: 'var(--color-gray-100)', padding: '2px 6px', borderRadius: 4 }}>{log.event}</span></td>
                      <td>
                        <div style={{ fontSize: 12, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.message}>{log.message}</div>
                        {log.error && <div style={{ fontSize: 11, color: 'var(--color-red)', marginTop: 2 }}>{log.error}</div>}
                      </td>
                      <td><span className={`badge badge-${log.status.toLowerCase()}`}>{log.status}</span></td>
                      <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-gray-400)' }}>{log.twilioSid ? log.twilioSid.slice(-12) : '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>{formatDateTime(log.createdAt)}</td>
                      <td>
                        {log.status === 'FAILED' && (
                          <button className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleResend(log.id)}>
                            🔄 Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-gray-400)' }}>No SMS logs found</div>
              )}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page <= 1}>← Prev</button>
                <span style={{ fontSize: 13, color: 'var(--color-gray-500)', alignSelf: 'center' }}>Page {pagination.page} of {pagination.pages}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page >= pagination.pages}>Next →</button>
              </div>
            )}
          </div>
      </div>
    </>
  );
}
