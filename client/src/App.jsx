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
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(localStorage.getItem('accessToken'));
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  
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
  const [selectedEventForStudents, setSelectedEventForStudents] = useState(null);

  const setActiveTab = (tab) => {
    if (!isAuthenticated && tab !== 'scanner') {
      setShowLoginModal(true);
      return;
    }
    setActiveTabState(tab);
    localStorage.setItem('activeTab', tab);
    window.location.hash = tab;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (validTabs.includes(hash)) {
        if (!isAuthenticated && hash !== 'scanner') {
          setShowLoginModal(true);
          return;
        }
        setActiveTabState(hash);
        localStorage.setItem('activeTab', hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('activeTab');
    setIsAuthenticated(false);
    setActiveTabState('scanner');
    window.location.hash = 'scanner';
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setShowLoginModal(false);
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

  const handleSelectEventForStudents = (eventObj) => {
    setSelectedEventForStudents(eventObj);
    setActiveTab('students');
  };

  return (
    <div className="app-layout">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAuthenticated={isAuthenticated}
        onOpenLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {(!isAuthenticated || activeTab === 'scanner') && (
          <Scanner activeSession={activeSession} setActiveSession={setActiveSession} />
        )}
        
        {isAuthenticated && activeTab === 'events' && (
          <EventManager
            onSelectSessionForScan={handleSelectSessionForScan}
            onSelectEventForReport={handleSelectEventForReport}
            onSelectEventForDispatch={handleSelectEventForDispatch}
            onSelectEventForStudents={handleSelectEventForStudents}
          />
        )}
        
        {isAuthenticated && activeTab === 'students' && (
          <StudentManager initialEventFilter={selectedEventForStudents} />
        )}
        
        {isAuthenticated && activeTab === 'dispatch' && (
          <QrDispatch
            selectedEventForDispatch={selectedEventForDispatch}
            onNavigateToStudents={handleSelectEventForStudents}
          />
        )}
        
        {isAuthenticated && activeTab === 'reports' && (
          <AttendanceReports
            activeSession={activeSession}
            selectedEventForReport={selectedEventForReport}
            setSelectedEventForReport={setSelectedEventForReport}
          />
        )}
        
        {isAuthenticated && activeTab === 'emails' && (
          <EmailInbox />
        )}
        
        {isAuthenticated && activeTab === 'settings' && (
          <SmtpSettings />
        )}
      </main>

      {/* Admin Login Modal Overlay */}
      {showLoginModal && (
        <Login
          isModal={true}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
