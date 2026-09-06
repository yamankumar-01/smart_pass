import React, { useState } from 'react';
import { QrCode, Lock, User, KeyRound, LogIn, AlertCircle, X, Shield } from 'lucide-react';
import api from '../api/axios';

export default function Login({ onLoginSuccess, onClose, isModal = false }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/token/', { username: username.trim(), password });
      if (res.data.access) {
        sessionStorage.setItem('accessToken', res.data.access);
        sessionStorage.setItem('refreshToken', res.data.refresh);
        sessionStorage.setItem('username', username.trim());
        // Clean legacy local storage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('username');
        onLoginSuccess();
      }
    } catch (err) {
      console.error('JWT Auth login failed:', err);
      setError(err.response?.data?.detail || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '2.25rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', position: 'relative', background: 'var(--bg-card)' }}>
      {isModal && onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255,255,255,0.06)',
            border: 'none',
            color: 'var(--text-muted)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Close Modal"
        >
          <X size={18} />
        </button>
      )}

      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div className="nav-logo-icon" style={{ width: '56px', height: '56px', margin: '0 auto 12px auto', borderRadius: '14px' }}>
          <Shield size={30} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800 }}>Admin Portal Login</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          Sign in to manage Events, Upload Students, and Export Reports
        </p>
      </div>

      {error && (
        <div className="scan-feedback-banner error" style={{ marginBottom: '1.25rem', padding: '10px 14px' }}>
          <AlertCircle size={18} />
          <p style={{ fontSize: '0.85rem' }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleLogin} autoComplete="off">
        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Username</label>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '38px', width: '100%' }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              required
              autoFocus
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="password"
              className="form-input"
              style={{ paddingLeft: '38px', width: '100%' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {isModal && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px', fontWeight: 600 }}
              onClick={onClose}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ flex: 2, padding: '12px', fontWeight: 700 }}
            disabled={loading}
          >
            <LogIn size={18} /> {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </div>
      </form>
    </div>
  );

  if (isModal) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}
        onClick={onClose}
      >
        <div onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)', padding: '1rem' }}>
      {content}
    </div>
  );
}
