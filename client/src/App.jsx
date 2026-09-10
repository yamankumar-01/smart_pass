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
  
  // Persist active tab across browser reloads with role-protection & clean HTML5 paths (No '#')
  const validTabs = ['scanner', 'events', 'students', 'dispatch', 'reports', 'emails', 'settings'];

  const normalizeTab = (raw) => {
    if (!raw) return 'scanner';
    const clean = String(raw).toLowerCase().replace(/^[#/]+/, '').split('?')[0].split('#')[0];
    if (clean === 'student' || clean === 'students') return 'students';
    if (clean === 'event' || clean === 'events') return 'events';
    if (clean === 'report' || clean === 'reports') return 'reports';
    if (clean === 'email' || clean === 'emails') return 'emails';
    if (clean === 'setting' || clean === 'settings') return 'settings';
    if (clean === 'dispatch') return 'dispatch';
    if (clean === 'scanner') return 'scanner';
    return validTabs.includes(clean) ? clean : 'scanner';
  };

  const getInitialTab = () => {
    const savedRole = sessionStorage.getItem('role') || ((sessionStorage.getItem('username') || '').toLowerCase() === 'adminpass' ? 'admin' : 'volunteer');

    // 1. Check clean pathname first (e.g. /students or /student)
    const pathCandidate = window.location.pathname.replace(/^\/+/, '');
    if (pathCandidate) {
      const norm = normalizeTab(pathCandidate);
      if (norm) {
        if (savedRole !== 'admin' && norm !== 'scanner') return 'scanner';
        return norm;
      }
    }

    // 2. Check legacy hash fallback (e.g. #students)
    const hashCandidate = window.location.hash.replace(/^#+/, '');
    if (hashCandidate) {
      const norm = normalizeTab(hashCandidate);
      if (norm) {
        if (savedRole !== 'admin' && norm !== 'scanner') return 'scanner';
        return norm;
      }
    }

    // 3. Check saved session
    const saved = sessionStorage.getItem('activeTab');
    if (saved) {
      const norm = normalizeTab(saved);
      if (savedRole !== 'admin' && norm !== 'scanner') return 'scanner';
      return norm;
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
    const target = normalizeTab(tab);
    // If volunteer, only scanner is allowed
    const finalTab = (userRole !== 'admin' && target !== 'scanner') ? 'scanner' : target;

    setActiveTabState(finalTab);
    sessionStorage.setItem('activeTab', finalTab);

    // Clean URL without '#' (uses standard clean paths /students, /scanner, etc.)
    try {
      const newPath = `/${finalTab}`;
      if (window.location.pathname !== newPath || window.location.hash) {
        window.history.pushState({ tab: finalTab }, '', newPath);
      }
    } catch (e) {}
  };

  useEffect(() => {
    // Clean any legacy persistent tokens from localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('role');

    // On mount, if URL has legacy hash (e.g. #students or #student), replace it with clean /students
    if (window.location.hash) {
      const norm = normalizeTab(window.location.hash);
      const cleanPath = `/${norm}`;
      try {
        window.history.replaceState({ tab: norm }, '', cleanPath);
      } catch (e) {}
    }

    const handlePopState = () => {
      const pathCandidate = window.location.pathname.replace(/^\/+/, '');
      const hashCandidate = window.location.hash.replace(/^#+/, '');
      const tab = normalizeTab(pathCandidate || hashCandidate);
      const finalTab = (userRole !== 'admin' && tab !== 'scanner') ? 'scanner' : tab;
      setActiveTabState(finalTab);
      sessionStorage.setItem('activeTab', finalTab);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
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
    try {
      window.history.pushState(null, '', '/scanner');
    } catch (e) {}
  };

  useEffect(() => {
    const handleAuthLogout = () => {
      handleLogout();
    };
    window.addEventListener('smartpass:auth:logout', handleAuthLogout);
    return () => window.removeEventListener('smartpass:auth:logout', handleAuthLogout);
  }, []);

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
