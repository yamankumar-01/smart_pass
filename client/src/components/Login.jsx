import React, { useState } from 'react';
import { QrCode, Lock, User, KeyRound, LogIn, AlertCircle, X, Shield, Users, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import api from '../api/axios';
import { useTheme } from '../context/ThemeContext';

export default function Login({ onLoginSuccess, onClose, isModal = false }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { theme, toggleTheme } = useTheme();

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();
    if (!cleanUser || !cleanPass) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/token/', { username: cleanUser, password: cleanPass });
      if (res.data.access) {
        const userRole = res.data.role || (cleanUser.toLowerCase() === 'adminpass' || cleanUser.toLowerCase() === 'admin' ? 'admin' : 'volunteer');
        const finalUsername = res.data.username || cleanUser;

        sessionStorage.setItem('accessToken', res.data.access);
        sessionStorage.setItem('refreshToken', res.data.refresh);
        sessionStorage.setItem('username', finalUsername);
        sessionStorage.setItem('role', userRole);

        // Clean legacy local storage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        
        onLoginSuccess(userRole);
      }
    } catch (err) {
      console.error('JWT Auth login failed:', err);
      setError(err.response?.data?.detail || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  const content = (
    <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '2.25rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', position: 'relative', background: 'var(--bg-card)' }}>
      {/* Theme Toggle Button on Login Screen */}
      <button
        type="button"
        className="theme-toggle-btn"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          padding: '5px 10px',
          fontSize: '0.78rem'
        }}
      >
        <span className="theme-toggle-icon">
          {theme === 'dark' ? <Sun size={14} color="#fbbf24" /> : <Moon size={14} color="#4f46e5" />}
        </span>
        <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>

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
          <QrCode size={30} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800 }}>SmartPass Portal</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          Sign in to access Attendance Scanning & Management
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
              placeholder="Username"
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
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              style={{ paddingLeft: '38px', paddingRight: '38px', width: '100%' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px'
              }}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
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
