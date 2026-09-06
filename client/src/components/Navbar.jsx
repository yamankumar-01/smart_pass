import React from 'react';
import { QrCode, Calendar, Users, Send, FileSpreadsheet, Mail, Settings, LogOut, Shield } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onLogout }) {
  const navItems = [
    { id: 'scanner', label: 'Live Scanner', icon: QrCode },
    { id: 'events', label: 'Events & Days', icon: Calendar },
    { id: 'students', label: 'Student Upload', icon: Users },
    { id: 'dispatch', label: 'QR Pass Dispatch', icon: Send },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { id: 'emails', label: 'Email Logs', icon: Mail },
    { id: 'settings', label: 'SMTP Config', icon: Settings }
  ];

  const adminName = localStorage.getItem('username') || 'Admin';

  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="nav-logo-icon">
          <QrCode size={24} />
        </div>
        <div>
          <h1>SmartPass <span>Attendance</span></h1>
        </div>
      </div>

      <nav>
        <ul className="nav-links">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  className={`nav-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
          <Shield size={14} color="var(--success)" />
          <span>{adminName}</span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onLogout}
          title="Sign out of Admin Session"
        >
          <LogOut size={14} /> Exit
        </button>
      </div>
    </header>
  );
}
