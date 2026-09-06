import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Scanner from './components/Scanner';
import EventManager from './components/EventManager';
import StudentManager from './components/StudentManager';
import QrDispatch from './components/QrDispatch';
import AttendanceReports from './components/AttendanceReports';
import EmailInbox from './components/EmailInbox';
import SmtpSettings from './components/SmtpSettings';
import Login from './components/Login';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Persist active tab across browser reloads
  const validTabs = ['scanner', 'events', 'students', 'dispatch', 'reports', 'emails', 'settings'];
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    if (validTabs.includes(hash)) {
      return hash;
    }
    const saved = localStorage.getItem('activeTab');
    if (saved && validTabs.includes(saved)) {
      return saved;
    }
    return 'scanner';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const [activeSession, setActiveSession] = useState(null);
  const [selectedEventForReport, setSelectedEventForReport] = useState(null);
  const [selectedEventForDispatch, setSelectedEventForDispatch] = useState(null);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    localStorage.setItem('activeTab', tab);
    window.location.hash = tab;
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      setIsAuthenticated(true);
    }

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (validTabs.includes(hash)) {
        setActiveTabState(hash);
        localStorage.setItem('activeTab', hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('activeTab');
    setIsAuthenticated(false);
  };

  const handleSelectSessionForScan = (session) => {
    setActiveSession(session);
    setActiveTab('scanner');
  };

  const handleSelectEventForReport = (eventObj) => {
    setSelectedEventForReport(eventObj);
    setActiveTab('reports');
  };

  const handleSelectEventForDispatch = (eventObj) => {
    setSelectedEventForDispatch(eventObj);
    setActiveTab('dispatch');
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-layout">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {activeTab === 'scanner' && (
          <Scanner activeSession={activeSession} setActiveSession={setActiveSession} />
        )}
        {activeTab === 'events' && (
          <EventManager
            onSelectSessionForScan={handleSelectSessionForScan}
            onSelectEventForReport={handleSelectEventForReport}
            onSelectEventForDispatch={handleSelectEventForDispatch}
          />
        )}
        {activeTab === 'students' && (
          <StudentManager />
        )}
        {activeTab === 'dispatch' && (
          <QrDispatch selectedEventForDispatch={selectedEventForDispatch} />
        )}
        {activeTab === 'reports' && (
          <AttendanceReports
            activeSession={activeSession}
            selectedEventForReport={selectedEventForReport}
            setSelectedEventForReport={setSelectedEventForReport}
          />
        )}
        {activeTab === 'emails' && (
          <EmailInbox />
        )}
        {activeTab === 'settings' && (
          <SmtpSettings />
        )}
      </main>
    </div>
  );
}
