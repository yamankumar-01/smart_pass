import React, { useState, useEffect } from 'react';
import { QrCode, Calendar, Users, Send, FileSpreadsheet, Mail, Settings, LogOut, Shield, Menu, X, UserCheck, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ activeTab, setActiveTab, userRole, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const allNavItems = [
    { id: 'scanner', label: 'Live Scanner', icon: QrCode, roles: ['admin', 'volunteer'] },
    { id: 'events', label: 'Events & Days', icon: Calendar, roles: ['admin'] },
    { id: 'students', label: 'Student Upload', icon: Users, roles: ['admin'] },
    { id: 'dispatch', label: 'QR Pass Dispatch', icon: Send, roles: ['admin'] },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet, roles: ['admin'] },
    { id: 'emails', label: 'Email Logs', icon: Mail, roles: ['admin'] },
    { id: 'settings', label: 'SMTP Config', icon: Settings, roles: ['admin'] }
  ];

  const visibleNavItems = allNavItems.filter((item) => item.roles.includes(userRole));
  const currentUsername = sessionStorage.getItem('username') || (userRole === 'admin' ? 'adminpass' : 'smartpass');
  const isAdmin = userRole === 'admin';

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
        <nav className="desktop-nav">
          <ul className="nav-links">
            {visibleNavItems.map((item) => {
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

        {/* Desktop User Info & Actions */}
        <div className="desktop-user-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Light / Dark Mode Toggle */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle theme mode"
          >
            <span className="theme-toggle-icon">
              {theme === 'dark' ? <Sun size={15} color="#fbbf24" /> : <Moon size={15} color="#4f46e5" />}
            </span>
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isAdmin ? (
              <>
                <Shield size={15} color="var(--success)" />
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>Admin: {currentUsername}</span>
                <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Full Access</span>
              </>
            ) : (
              <>
                <UserCheck size={15} color="var(--primary)" />
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Volunteer: {currentUsername}</span>
                <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(79, 70, 229, 0.2)', color: '#818cf8' }}>Scanner Only</span>
              </>
            )}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onLogout}
            title="Sign out and return to Login"
            style={{ fontWeight: 600 }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>

        {/* Mobile Header Actions (Theme Toggle + Hamburger) */}
        <div className="mobile-header-actions" style={{ display: 'none', alignItems: 'center', gap: '8px' }}>
          <button
            className="theme-toggle-btn"
            style={{ padding: '6px 10px' }}
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle theme mode"
          >
            {theme === 'dark' ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#4f46e5" />}
          </button>

          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Mobile Navigation"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Backdrop & Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isAdmin ? (
                  <>
                    <Shield size={16} color="var(--success)" />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{currentUsername}</span>
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Super Admin</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={16} color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{currentUsername}</span>
                    <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(79, 70, 229, 0.2)', color: '#818cf8' }}>Volunteer</span>
                  </>
                )}
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
              {visibleNavItems.map((item) => {
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

            <div style={{ marginTop: 'auto', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', gap: '8px', fontWeight: 600 }}
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <Sun size={17} color="#fbbf24" /> : <Moon size={17} color="#4f46e5" />}
                <span>{theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}</span>
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
    </>
  );
}
