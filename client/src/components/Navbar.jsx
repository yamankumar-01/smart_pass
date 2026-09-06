import React, { useState, useEffect } from 'react';
import { QrCode, Calendar, Users, Send, FileSpreadsheet, Mail, Settings, LogOut, Shield, Menu, X, LogIn } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, isAuthenticated, onOpenLogin, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const adminNavItems = [
    { id: 'scanner', label: 'Live Scanner', icon: QrCode },
    { id: 'events', label: 'Events & Days', icon: Calendar },
    { id: 'students', label: 'Student Upload', icon: Users },
    { id: 'dispatch', label: 'QR Pass Dispatch', icon: Send },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { id: 'emails', label: 'Email Logs', icon: Mail },
    { id: 'settings', label: 'SMTP Config', icon: Settings }
  ];

  const adminName = sessionStorage.getItem('username') || localStorage.getItem('username') || 'admin';

  const handleSelectTab = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
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
        <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => handleSelectTab('scanner')}>
          <div className="nav-logo-icon">
            <QrCode size={22} />
          </div>
          <div>
            <h1>SmartPass <span>Attendance</span></h1>
          </div>
        </div>

        {/* Desktop Navigation */}
        {isAuthenticated ? (
          <nav className="desktop-nav">
            <ul className="nav-links">
              {adminNavItems.map((item) => {
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
        ) : (
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-success" style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <QrCode size={14} /> Scanner Mode
            </span>
          </div>
        )}

        {/* Desktop Admin & Logout / Login Toggle */}
        <div className="desktop-user-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAuthenticated ? (
            <>
              <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                <Shield size={14} color="var(--success)" />
                <span style={{ fontWeight: 600 }}>{adminName}</span>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={onLogout}
                title="Sign out of Admin Session"
              >
                <LogOut size={13} /> Exit Admin
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={onOpenLogin}
              style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px' }}
              title="Open Admin Portal"
            >
              <LogIn size={15} /> Admin Portal
            </button>
          )}
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
              {isAuthenticated ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={16} color="var(--success)" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{adminName}</span>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Admin</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <QrCode size={16} color="var(--primary)" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Scanner Mode</span>
                </div>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '4px 8px' }}
              >
                <X size={18} />
              </button>
            </div>

            {isAuthenticated ? (
              <ul className="mobile-nav-list">
                {adminNavItems.map((item) => {
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
            ) : (
              <div style={{ padding: '1rem 0' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Currently running in direct Scanner Mode for scanning student QR passes.
                </p>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenLogin();
                  }}
                >
                  <LogIn size={18} /> Admin Portal Login
                </button>
              </div>
            )}

            {isAuthenticated && (
              <div style={{ marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  className="btn btn-danger"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut size={16} /> Exit Admin
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
