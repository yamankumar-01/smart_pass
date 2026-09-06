import React, { useState } from 'react';
import { QrCode, Lock, User, KeyRound, LogIn, AlertCircle } from 'lucide-react';
import api from '../api/axios';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/token/', { username, password });
      if (res.data.access) {
        localStorage.setItem('accessToken', res.data.access);
        localStorage.setItem('refreshToken', res.data.refresh);
        localStorage.setItem('username', username);
        onLoginSuccess();
      }
    } catch (err) {
      console.error('JWT Auth login failed:', err);
      setError(err.response?.data?.detail || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '2.25rem', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="nav-logo-icon" style={{ width: '56px', height: '56px', margin: '0 auto 12px auto', borderRadius: '14px' }}>
            <QrCode size={32} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800 }}>Admin Portal Login</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Sign in with JWT credentials to access the Attendance Dashboard
          </p>
        </div>

        {error && (
          <div className="scan-feedback-banner error" style={{ marginBottom: '1.25rem', padding: '10px 14px' }}>
            <AlertCircle size={18} />
            <p style={{ fontSize: '0.85rem' }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label>Admin Username</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
            <LogIn size={18} /> {loading ? 'Authenticating...' : 'Sign In (JWT)'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          Default Credentials: <code>admin</code> / <code>admin123</code>
        </div>
      </div>
    </div>
  );
}
