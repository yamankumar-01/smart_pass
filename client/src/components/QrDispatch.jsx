import React, { useState, useEffect } from 'react';
import { Send, QrCode, Mail, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Layers, Calendar, Search, Users, Upload } from 'lucide-react';
import api from '../api/axios';

export default function QrDispatch({ selectedEventForDispatch, onNavigateToStudents }) {
  const [events, setEvents] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_events_list');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [eventsLoading, setEventsLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_events_list');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });

  const [selectedEventId, setSelectedEventId] = useState(() => {
    if (selectedEventForDispatch) return String(selectedEventForDispatch.id);
    try {
      const saved = localStorage.getItem('smartpass_selected_event_id');
      if (saved) return String(saved);
      const cached = localStorage.getItem('cached_events_list');
      if (cached) {
        const list = JSON.parse(cached);
        if (list.length > 0) return String(list[0].id);
      }
    } catch {}
    return '';
  });

  const [passes, setPasses] = useState(() => {
    try {
      const initId = (selectedEventForDispatch && selectedEventForDispatch.id)
        || localStorage.getItem('smartpass_selected_event_id')
        || (JSON.parse(localStorage.getItem('cached_events_list') || '[]')[0]?.id);
      if (initId) {
        const cached = localStorage.getItem(`smartpass_event_passes_${initId}`);
        if (cached) return JSON.parse(cached);
      }
    } catch {}
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAutoPolling, setIsAutoPolling] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tableSearch, setTableSearch] = useState('');
  const [sendingPassId, setSendingPassId] = useState(null);

  const loadEvents = async (forceSync = false) => {
    if (forceSync) setIsSyncing(true);
    try {
      const res = await api.get('/events/');
      const data = res.data || [];
      setEvents(data);
      try {
        localStorage.setItem('cached_events_list', JSON.stringify(data));
      } catch (e) {}
      if (data.length > 0 && !selectedEventId) {
        const defaultId = selectedEventForDispatch ? String(selectedEventForDispatch.id) : String(data[0].id);
        setSelectedEventId(defaultId);
        try {
          localStorage.setItem('smartpass_selected_event_id', defaultId);
        } catch (e) {}
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setEventsLoading(false);
      if (forceSync) setIsSyncing(false);
    }
  };

  const loadEventPasses = async (eventId, showBlockingSpinner = false, silent = false) => {
    if (!eventId) return null;

    if (!silent) {
      let hasCached = false;
      try {
        const cached = localStorage.getItem(`smartpass_event_passes_${eventId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) {
            hasCached = true;
            setPasses(parsed);
          }
        }
      } catch (e) {}

      if (!hasCached && showBlockingSpinner) {
        setLoading(true);
      } else {
        setIsSyncing(true);
      }
    }

    try {
      const res = await api.get(`/events/${eventId}/passes/`);
      const list = res.data || [];
      setPasses(list);
      try {
        localStorage.setItem(`smartpass_event_passes_${eventId}`, JSON.stringify(list));
      } catch (e) {}
      return list;
    } catch (err) {
      if (!silent) {
        console.error('Failed to load event passes:', err);
      }
      return null;
    } finally {
      if (!silent) {
        setLoading(false);
        setIsSyncing(false);
      }
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventForDispatch) {
      const newId = String(selectedEventForDispatch.id);
      setSelectedEventId(newId);
      try {
        localStorage.setItem('smartpass_selected_event_id', newId);
      } catch (e) {}
    }
  }, [selectedEventForDispatch]);

  useEffect(() => {
    if (selectedEventId) {
      loadEventPasses(selectedEventId, passes.length === 0);
    }
  }, [selectedEventId]);

  const handleEventChange = (newId) => {
    setSelectedEventId(newId);
    setDispatchStatus(null);
    try {
      localStorage.setItem('smartpass_selected_event_id', newId);
      const cached = localStorage.getItem(`smartpass_event_passes_${newId}`);
      if (cached) {
        setPasses(JSON.parse(cached));
      }
    } catch (e) {}
  };

  const selectedEvent = events.find(e => String(e.id) === String(selectedEventId));
  const totalPasses = passes.length > 0 ? passes.length : (selectedEvent?.total_enrolled || 0);
  const qrSentCount = passes.length > 0 
    ? passes.filter(p => p.qr_sent).length 
    : (selectedEvent?.passes_sent_count || 0);
  const pendingCount = Math.max(0, totalPasses - qrSentCount);

  // Intelligent Live Auto-Polling: automatically syncs pending passes in real time
  // without user needing to manually hit "Refresh Passes". Auto-pauses when pending reaches 0.
  useEffect(() => {
    if (!selectedEventId || pendingCount === 0) {
      setIsAutoPolling(false);
      return;
    }

    setIsAutoPolling(true);
    const pollInterval = setInterval(async () => {
      const updatedList = await loadEventPasses(selectedEventId, false, true);
      if (updatedList) {
        const remaining = updatedList.filter(p => !p.qr_sent).length;
        if (remaining === 0) {
          setIsAutoPolling(false);
          setDispatchStatus({
            type: 'success',
            message: `🎉 All ${updatedList.length} passes for "${selectedEvent?.title || 'this event'}" have been successfully delivered!`
          });
          loadEvents(); // sync header & event stats
        }
      }
    }, 2500);

    return () => {
      clearInterval(pollInterval);
    };
  }, [selectedEventId, pendingCount, selectedEvent?.title]);

  // Trigger Event Pass Generation
  const handleGeneratePasses = async () => {
    if (!selectedEventId) return;
    setLoading(true);
    setDispatchStatus(null);
    try {
      const res = await api.post(`/events/${selectedEventId}/generate-passes/`);
      setDispatchStatus({
        type: 'success',
        message: res.data.message || `Generated unique event passes!`
      });
      loadEventPasses(selectedEventId);
      loadEvents();
    } catch (err) {
      setDispatchStatus({
        type: 'danger',
        message: 'Failed to generate event passes.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Trigger Event Pass Email Dispatch
  const handleSendEmails = async () => {
    if (!selectedEventId) return;
    setLoading(true);
    setProgress(35);
    setDispatchStatus({
      type: 'info',
      message: `⚡ Fast Dispatching ${selectedEvent?.title || 'Event'} pass emails in background...`
    });

    const timer = setInterval(() => {
      setProgress((prev) => (prev >= 92 ? 92 : prev + 18));
    }, 70);

    try {
      const res = await api.post(`/events/${selectedEventId}/send-emails/`);
      clearInterval(timer);
      setProgress(100);

      const successMsg = res.data.message || `Pass dispatch started in background!`;
      setDispatchStatus({
        type: 'info',
        message: `${successMsg} ⚡ Live auto-updating delivery status below...`
      });
      await loadEventPasses(selectedEventId, false, false);
      loadEvents();
    } catch (err) {
      clearInterval(timer);
      setProgress(0);
      setDispatchStatus({
        type: 'danger',
        message: err.response?.data?.error || err.response?.data?.message || 'Failed to dispatch pass emails.'
      });
    } finally {
      setLoading(false);
      setTimeout(() => {
        setProgress(0);
      }, 2500);
    }
  };

  const handleSendSinglePass = async (passItem) => {
    if (!selectedEventId) return;
    setSendingPassId(passItem.id);
    try {
      const res = await api.post(`/events/${selectedEventId}/send-single-pass/`, {
        pass_id: passItem.id
      });
      alert(res.data.message || `QR Event Pass sent to ${passItem.student.email}!`);
      setPasses(prev => prev.map(p => p.id === passItem.id ? { ...p, qr_sent: true } : p));
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to dispatch pass email.');
    } finally {
      setSendingPassId(null);
    }
  };

  const filteredPasses = passes.filter(p => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      p.student?.name?.toLowerCase().includes(term) ||
      p.student?.email?.toLowerCase().includes(term) ||
      p.student?.branch?.toLowerCase().includes(term) ||
      (p.event_token && p.event_token.toLowerCase().includes(term))
    );
  });

  return (
    <div className="qr-dispatch-page">
      <div className="page-header">
        <div className="page-title">
          <h2>Event-Specific QR Pass Generation & Email Dispatch</h2>
          <p>Generate isolated QR passes for each event. Each pass is valid across all days of that event only.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {isAutoPolling && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 12px', 
              borderRadius: '20px', 
              background: 'rgba(245, 158, 11, 0.12)', 
              border: '1px solid rgba(245, 158, 11, 0.3)', 
              fontSize: '0.8rem', 
              fontWeight: 600, 
              color: '#d97706' 
            }}>
              <span className="live-dot warning" />
              <span>Auto-Updating ({pendingCount} pending)</span>
            </div>
          )}
          {selectedEvent && (
            <button
              className="btn btn-secondary"
              onClick={() => onNavigateToStudents && onNavigateToStudents(selectedEvent)}
            >
              <Users size={16} /> Manage Event Students
            </button>
          )}
          <button 
            className="btn btn-secondary" 
            onClick={() => { 
              loadEvents(true); 
              if (selectedEventId) loadEventPasses(selectedEventId, false, false); 
            }}
            disabled={isSyncing}
          >
            <RefreshCw size={16} className={isSyncing ? 'spin' : ''} /> {isSyncing ? 'Syncing...' : 'Refresh Passes'}
          </button>
        </div>
      </div>

      {/* Event Selection Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: '1 1 280px' }}>
            <label style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              🎯 Target Event:
            </label>
            <select
              className="form-select"
              style={{ flex: '1 1 220px', minWidth: '180px', fontWeight: 600 }}
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
            >
              {events.length === 0 ? (
                <option value="">{eventsLoading ? '⏳ Loading events...' : 'No events created yet'}</option>
              ) : (
                events.map(ev => (
                  <option key={ev.id} value={String(ev.id)}>
                    {ev.title} ({ev.total_enrolled || 0} Students)
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedEvent && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              📅 Valid: <strong>{selectedEvent.start_date}</strong> to <strong>{selectedEvent.end_date}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon primary">
            <QrCode size={24} />
          </div>
          <div className="stat-info">
            <h4>Enrolled Students</h4>
            <div className="value">{eventsLoading && events.length === 0 ? '...' : totalPasses}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-info">
            <h4>Event Passes Sent</h4>
            <div className="value" style={{ color: 'var(--success)' }}>{eventsLoading && events.length === 0 ? '...' : qrSentCount}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <Mail size={24} />
          </div>
          <div className="stat-info">
            <h4>Pending Delivery</h4>
            <div className="value" style={{ color: 'var(--warning)' }}>{eventsLoading && events.length === 0 ? '...' : pendingCount}</div>
            {pendingCount > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#d97706' }}>
                <span className="live-dot warning" />
                <span>Live auto-updating...</span>
              </div>
            ) : totalPasses > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)' }}>
                <CheckCircle2 size={13} />
                <span>All delivered</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Control Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <Sparkles size={20} color="var(--primary)" />
            <span>{selectedEvent ? selectedEvent.title : 'Event'} Dispatch Console</span>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Each student will receive a unique QR pass specific to <strong>{selectedEvent?.title || 'this event'}</strong>. This pass is reusable across Day 1, Day 2, Day 3 of this event, but will automatically be rejected if presented for any other event.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleGeneratePasses}
            disabled={loading || !selectedEventId}
            style={{ padding: '12px 20px' }}
          >
            <QrCode size={18} /> Generate Passes for All Enrolled
          </button>

          <button
            className="btn btn-primary"
            onClick={handleSendEmails}
            disabled={loading || !selectedEventId || totalPasses === 0}
            style={{ padding: '12px 24px' }}
          >
            <Send size={18} /> 🚀 Dispatch {selectedEvent?.title ? `"${selectedEvent.title}"` : 'Event'} Passes via Email
          </button>
        </div>

        {/* Progress Bar Indicator */}
        {loading && progress > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              <span>Sending Event Passes via Email...</span>
              <span>{progress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {/* Status Indicator Banner */}
        {dispatchStatus && (
          <div className={`scan-feedback-banner ${dispatchStatus.type}`} style={{ marginTop: '1.5rem' }}>
            {dispatchStatus.type === 'success' && <CheckCircle2 size={20} color="#34d399" />}
            {dispatchStatus.type === 'danger' && <AlertCircle size={20} color="#f87171" />}
            {dispatchStatus.type === 'info' && <Mail size={20} color="#818cf8" />}
            <p style={{ fontWeight: 600 }}>{dispatchStatus.message}</p>
          </div>
        )}
      </div>

      {/* Event Pass Table */}
      <div className="table-container card" style={{ padding: 0 }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{selectedEvent ? `Passes for: ${selectedEvent.title}` : 'Event Passes'}</span>
              {isAutoPolling && (
                <span className="badge badge-warning" style={{ fontSize: '0.7rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span className="live-dot warning" style={{ width: '6px', height: '6px' }} /> LIVE
                </span>
              )}
            </h4>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {passes.length} Student Passes Registered ({passes.filter(p => p.qr_sent).length} Sent, {passes.filter(p => !p.qr_sent).length} Pending)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '0.85rem', height: '36px' }}
                placeholder="Search student / email..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSendEmails}
              disabled={loading || !selectedEventId || totalPasses === 0}
              style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Send size={15} /> 🚀 Dispatch Event Passes
            </button>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Email Address</th>
              <th>Branch / Year</th>
              <th>Event Pass UUID Token</th>
              <th>Delivery Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && passes.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw size={28} className="spin" color="var(--primary)" />
                    <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', margin: 0 }}>
                      Loading passes for {selectedEvent?.title || 'event'}...
                    </p>
                  </div>
                </td>
              </tr>
            ) : filteredPasses.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  {passes.length === 0 ? (
                    <div>
                      <QrCode size={36} color="var(--primary)" style={{ opacity: 0.7, margin: '0 auto 8px' }} />
                      <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)', margin: '0 0 4px' }}>
                        No passes registered for "{selectedEvent?.title || 'this event'}" yet.
                      </p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
                        Upload students for this event or generate passes from existing students.
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => onNavigateToStudents && onNavigateToStudents(selectedEvent)}>
                          <Upload size={14} /> Upload / Enroll Students for this Event
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={handleGeneratePasses}>
                          <QrCode size={14} /> Generate Passes for All
                        </button>
                      </div>
                    </div>
                  ) : (
                    'No students match your search.'
                  )}
                </td>
              </tr>
            ) : (
              filteredPasses.map((passItem) => (
                <tr key={passItem.id}>
                  <td><strong>{passItem.student?.name}</strong></td>
                  <td style={{ color: 'var(--text-muted)' }}>{passItem.student?.email}</td>
                  <td>{passItem.student?.branch} - Y{passItem.student?.year} Sec {passItem.student?.section}</td>
                  <td><span className="token-code">{passItem.event_token || passItem.token}</span></td>
                  <td>
                    <span className={`badge badge-${passItem.qr_sent ? 'success' : 'warning'}`}>
                      {passItem.qr_sent ? '✅ PASS SENT' : '⏳ PENDING'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleSendSinglePass(passItem)}
                      disabled={sendingPassId === passItem.id}
                      style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      title={`Dispatch QR pass to ${passItem.student?.email}`}
                    >
                      <Mail size={13} />
                      {sendingPassId === passItem.id ? 'Sending...' : (passItem.qr_sent ? 'Resend Pass' : 'Dispatch Pass')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
