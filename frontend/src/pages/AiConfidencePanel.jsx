import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/format';

export default function AiConfidencePanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ avgConfidence: 0, totalCalls: 0 });

  const fetchData = async () => {
    try {
      const res = await api.get('/admin/ai-logs');
      setLogs(res.data.data.logs);
      
      // Calculate avg confidence from logs (if available in outputJson)
      let totalConf = 0;
      let count = 0;
      res.data.data.logs.forEach(log => {
        if (log.outputJson) {
          try {
            const parsed = JSON.parse(log.outputJson);
            if (parsed.confidence) {
              totalConf += parsed.confidence;
              count++;
            }
          } catch (e) {}
        }
      });
      setStats({
        avgConfidence: count > 0 ? (totalConf / count) * 100 : 0,
        totalCalls: res.data.data.logs.length
      });
    } catch {
      toast.error('Failed to load AI logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="spinner" style={{ margin: 'auto', display: 'block', marginTop: 100 }} />;

  return (
    <div className="app-content">
      <h2 style={{ marginBottom: 24 }}>🧠 AI Confidence & Agent Logs</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <h3 className="card-title">Average AI Confidence</h3>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-primary)' }}>
            {stats.avgConfidence.toFixed(1)}%
          </div>
          <p style={{ color: 'var(--color-gray-500)', fontSize: 13, marginTop: 4 }}>Across recent categorization tasks</p>
        </div>
        <div className="card">
          <h3 className="card-title">Total AI Agent Operations</h3>
          <div style={{ fontSize: 32, fontWeight: 700 }}>
            {stats.totalCalls}
          </div>
          <p style={{ color: 'var(--color-gray-500)', fontSize: 13, marginTop: 4 }}>Logged Gemini API requests</p>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 16 }}>Raw AI Action Log</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Function</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Details (JSON)</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: 11, color: 'var(--color-gray-500)' }}>{formatDateTime(log.createdAt)}</td>
                  <td style={{ fontWeight: 600 }}>{log.function}</td>
                  <td>
                    <span className="badge" style={{ background: log.success ? '#dcfce7' : '#fee2e2', color: log.success ? '#16a34a' : '#ef4444' }}>
                      {log.success ? 'SUCCESS' : 'FAILED'}
                    </span>
                  </td>
                  <td>{log.durationMs ? `${log.durationMs}ms` : '—'}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontFamily: 'monospace' }}>
                    {log.outputJson || log.error || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: '#aaa' }}>No AI logs found</p>}
        </div>
      </div>
    </div>
  );
}
