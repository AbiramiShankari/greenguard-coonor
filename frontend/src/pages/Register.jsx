// GreenGuard — Register Page
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CITIES } from '../utils/constants';
import toast from 'react-hot-toast';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', city: '', role: 'CITIZEN' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(form);
      toast.success(`Welcome to GreenGuard, ${user.name}! 🌿`);
      navigate('/dashboard');
    } catch (err) {
      if (!err.response) {
        setError('Cannot connect to server. Please check your internet connection or try again later.');
      } else {
        const msgs = err.response?.data?.errors?.map(e => e.msg).join(', ');
        setError(msgs || err.response?.data?.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">🌿</div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join GreenGuard · Tamil Nadu</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="Your full name" value={form.name} onChange={set('name')} required id="reg-name" />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="your@email.com" value={form.email} onChange={set('email')} required id="reg-email" />
            </div>

            <div className="form-group">
              <label className="form-label">Phone (+91)</label>
              <input className="form-input" type="tel" placeholder="9XXXXXXXXX" value={form.phone} onChange={set('phone')} required id="reg-phone" />
              <span className="form-hint">Indian mobile number</span>
            </div>

            <div className="form-group">
              <label className="form-label">City</label>
              <select className="form-input" value={form.city} onChange={set('city')} required id="reg-city">
                <option value="">Select city...</option>
                {CITIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={set('role')} id="reg-role">
                <option value="CITIZEN">Citizen</option>
                <option value="COLLECTOR">Waste Collector</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} required id="reg-password" />
            </div>
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} id="reg-submit">
            {loading ? <><span className="spinner" /> Creating account...</> : 'Create Account →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--color-gray-500)' }}>
          Already registered? <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Login</Link>
        </p>
      </div>
    </div>
  );
}
