import React, { useState, useEffect } from 'react';
import { QrCode, Calendar, Users, Send, FileSpreadsheet, Mail, Settings, LogOut, Shield, Menu, X } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    </>
  );
}


