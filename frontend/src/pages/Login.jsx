// GreenGuard — Login Page
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}! 🌿`);
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'COLLECTOR') navigate('/collector');
      else navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed — please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🌿</div>
          <h1 className="auth-title">GreenGuard</h1>
          <p className="auth-subtitle">Civic Waste Management · Tamil Nadu</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
              id="login-email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
              id="login-password"
            />
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            id="login-submit"
          >
            {loading ? <><span className="spinner" /> Logging in...</> : 'Login →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--color-gray-500)' }}>
          New citizen?{' '}
          <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Create account
          </Link>
        </p>

        {/* Test credentials hint */}
        <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--color-gray-50)', borderRadius: 8, fontSize: 12, color: 'var(--color-gray-500)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Test Credentials:</div>
          <div>Admin: admin@greenguard.tn.gov.in / Admin@123</div>
          <div>Citizen: priya@example.com / Citizen@123</div>
          <div>Collector: karthik@greenguard.tn.gov.in / Collector@123</div>
        </div>
      </div>
    </div>
  );
}
