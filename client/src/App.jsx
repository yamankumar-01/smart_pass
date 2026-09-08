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
import api from './api/axios';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(sessionStorage.getItem('accessToken'));
  });

  const [userRole, setUserRole] = useState(() => {
    const savedRole = sessionStorage.getItem('role');
    if (savedRole) return savedRole;
    const user = (sessionStorage.getItem('username') || '').toLowerCase();
    return (user === 'adminpass' || user === 'admin') ? 'admin' : 'volunteer';
  });
  
  // Persist active tab across browser reloads with role-protection
  const validTabs = ['scanner', 'events', 'students', 'dispatch', 'reports', 'emails', 'settings'];
  const getInitialTab = () => {
    const savedRole = sessionStorage.getItem('role') || ((sessionStorage.getItem('username') || '').toLowerCase() === 'adminpass' ? 'admin' : 'volunteer');
    const hash = window.location.hash.replace('#', '');
    if (validTabs.includes(hash)) {
      if (savedRole !== 'admin' && hash !== 'scanner') return 'scanner';
      return hash;
    }
    const saved = sessionStorage.getItem('activeTab');
    if (saved && validTabs.includes(saved)) {
      if (savedRole !== 'admin' && saved !== 'scanner') return 'scanner';
      return saved;
    }
    return 'scanner';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const [activeSession, setActiveSessionState] = useState(() => {
    try {
      const raw = sessionStorage.getItem('smartpass_active_session') || localStorage.getItem('smartpass_active_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setActiveSession = (sess) => {
    setActiveSessionState(sess);
    try {
      if (sess) {
        sessionStorage.setItem('smartpass_active_session', JSON.stringify(sess));
        localStorage.setItem('smartpass_active_session', JSON.stringify(sess));
      } else {
        sessionStorage.removeItem('smartpass_active_session');
        localStorage.removeItem('smartpass_active_session');
      }
    } catch (e) {}
  };

  const [selectedEventForReport, setSelectedEventForReport] = useState(null);
  const [selectedEventForDispatch, setSelectedEventForDispatch] = useState(null);
  const [selectedEventForStudents, setSelectedEventForStudents] = useState(null);

  const setActiveTab = (tab) => {
    // If volunteer, only scanner is allowed
    if (userRole !== 'admin' && tab !== 'scanner') {
      setActiveTabState('scanner');
      sessionStorage.setItem('activeTab', 'scanner');
      window.location.hash = 'scanner';
      return;
    }
    setActiveTabState(tab);
    sessionStorage.setItem('activeTab', tab);
    window.location.hash = tab;
  };

  useEffect(() => {
    // Clean any legacy persistent tokens from localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('role');

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (validTabs.includes(hash)) {
        if (userRole !== 'admin' && hash !== 'scanner') {
          setActiveTabState('scanner');
          sessionStorage.setItem('activeTab', 'scanner');
          return;
        }
        setActiveTabState(hash);
        sessionStorage.setItem('activeTab', hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [userRole]);

  // Eager background prefetch of events to keep localStorage cache warm for instant 0ms tab transitions
  useEffect(() => {
    if (isAuthenticated) {
      api.get('/events/')
        .then((res) => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            try {
              localStorage.setItem('cached_events_list', JSON.stringify(res.data));
            } catch (e) {}
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('activeTab');
    setIsAuthenticated(false);
    setUserRole('volunteer');
    setActiveTabState('scanner');
    window.location.hash = 'scanner';
  };

  const handleLoginSuccess = (detectedRole) => {
    const finalRole = detectedRole || (sessionStorage.getItem('username') === 'adminpass' || sessionStorage.getItem('username') === 'admin' ? 'admin' : 'volunteer');
    setUserRole(finalRole);
    setIsAuthenticated(true);
    setActiveTabState('scanner');
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

  // If not logged in, show Unified Login Portal
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} isModal={false} />;
  }

  return (
    <div className="app-layout">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {activeTab === 'scanner' && (
          <Scanner activeSession={activeSession} setActiveSession={setActiveSession} />
        )}
        
        {userRole === 'admin' && activeTab === 'events' && (
          <EventManager
            onSelectSessionForScan={handleSelectSessionForScan}
            onSelectEventForReport={handleSelectEventForReport}
            onSelectEventForDispatch={handleSelectEventForDispatch}
            onSelectEventForStudents={handleSelectEventForStudents}
          />
        )}
        
        {userRole === 'admin' && activeTab === 'students' && (
          <StudentManager initialEventFilter={selectedEventForStudents} />
        )}
        
        {userRole === 'admin' && activeTab === 'dispatch' && (
          <QrDispatch
            selectedEventForDispatch={selectedEventForDispatch}
            onNavigateToStudents={handleSelectEventForStudents}
          />
        )}
        
        {userRole === 'admin' && activeTab === 'reports' && (
          <AttendanceReports
            activeSession={activeSession}
            selectedEventForReport={selectedEventForReport}
            setSelectedEventForReport={setSelectedEventForReport}
          />
        )}
        
        {userRole === 'admin' && activeTab === 'emails' && (
          <EmailInbox />
        )}
        
        {userRole === 'admin' && activeTab === 'settings' && (
          <SmtpSettings />
        )}
      </main>
    </div>
  );
}
