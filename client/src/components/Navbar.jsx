import React, { useState, useEffect } from 'react';
import { QrCode, Calendar, Users, Send, FileSpreadsheet, Mail, Settings, LogOut, Shield, Menu, X, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../api/axios';

export default function Navbar({ activeTab, setActiveTab, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState(null);

  const navItems = [
    { id: 'scanner', label: 'Live Scanner', icon: QrCode },
    { id: 'events', label: 'Events & Days', icon: Calendar },
    { id: 'students', label: 'Student Upload', icon: Users },
    { id: 'dispatch', label: 'QR Pass Dispatch', icon: Send },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { id: 'emails', label: 'Email Logs', icon: Mail },
    { id: 'settings', label: 'SMTP Config', icon: Settings }
  ];

  const adminName = localStorage.getItem('username') || 'admin';

  const handleSelectTab = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordStatus({ type: 'danger', message: 'New password and Confirm password do not match!' });
      return;
    }

    if (passwordForm.new_password.length < 4) {
      setPasswordStatus({ type: 'danger', message: 'Password must be at least 4 characters long.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.post('/change-password/', {
        username: adminName,
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password
      });

      setPasswordStatus({ type: 'success', message: res.data.message || 'Password changed successfully!' });
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordStatus(null);
      }, 2000);
    } catch (err) {
      setPasswordStatus({
        type: 'danger',
        message: err.response?.data?.error || err.response?.data?.message || 'Failed to change password. Please check your current password.'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <header className="navbar">
        <div className="nav-brand">
          <div className="nav-logo-icon">
            <QrCode size={22} />
          </div>
          <div>
            <h1>SmartPass <span>Attendance</span></h1>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          <ul className="nav-links">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    className={`nav-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectTab(item.id)}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Desktop Admin & Logout */}
        <div className="desktop-user-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
            <Shield size={14} color="var(--success)" />
            <span>{adminName}</span>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowPasswordModal(true)}
            title="Change Admin Password"
          >
            <KeyRound size={13} /> Password
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onLogout}
            title="Sign out of Admin Session"
          >
            <LogOut size={13} /> Exit
          </button>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Mobile Navigation"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Backdrop & Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} color="var(--success)" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{adminName}</span>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Logged In</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '4px 8px' }}
              >
                <X size={18} />
              </button>
            </div>

            <ul className="mobile-nav-list">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectTab(item.id)}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div style={{ marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowPasswordModal(true);
                }}
              >
                <KeyRound size={16} /> Change Password
              </button>

              <button
                className="btn btn-danger"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.15rem' }}>
                <KeyRound size={20} color="var(--primary)" /> Change Admin Password
              </h3>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>

            {passwordStatus && (
              <div className={`scan-feedback-banner ${passwordStatus.type}`} style={{ marginBottom: '1rem', padding: '10px 14px' }}>
                {passwordStatus.type === 'success' ? <CheckCircle2 size={18} color="#34d399" /> : <AlertCircle size={18} color="#f87171" />}
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{passwordStatus.message}</p>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Current / Old Password (Optional)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter current password"
                  value={passwordForm.old_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>New Password *</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter new password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Confirm New Password *</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Re-type new password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={passwordLoading} style={{ fontWeight: 700 }}>
                  <KeyRound size={16} /> {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


