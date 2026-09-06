import React, { useState, useEffect } from 'react';
import { Send, QrCode, Mail, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Layers, Calendar, Search } from 'lucide-react';
import api from '../api/axios';

export default function QrDispatch({ selectedEventForDispatch }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tableSearch, setTableSearch] = useState('');
  const [sendingPassId, setSendingPassId] = useState(null);

  const loadEvents = async () => {
    try {
      const res = await api.get('/events/');
      setEvents(res.data);
      if (res.data.length > 0 && !selectedEventId) {
        if (selectedEventForDispatch) {
          setSelectedEventId(selectedEventForDispatch.id);
        } else {
          setSelectedEventId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  const loadEventPasses = async (eventId) => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await api.get(`/events/${eventId}/passes/`);
      setPasses(res.data);
    } catch (err) {
      console.error('Failed to load event passes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventForDispatch) {
      setSelectedEventId(selectedEventForDispatch.id);
    }
  }, [selectedEventForDispatch]);

  useEffect(() => {
    if (selectedEventId) {
      loadEventPasses(selectedEventId);
    }
  }, [selectedEventId]);

  const selectedEvent = events.find(e => e.id === parseInt(selectedEventId));
  const totalPasses = passes.length;
  const qrSentCount = passes.filter(p => p.qr_sent).length;
  const pendingCount = totalPasses - qrSentCount;

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
      message: `⚡ Fast Dispatching ${selectedEvent?.title || 'Event'} pass emails in high-speed batch mode...`
    });

    const timer = setInterval(() => {
      setProgress((prev) => (prev >= 92 ? 92 : prev + 18));
    }, 70);

    try {
      const res = await api.post(`/events/${selectedEventId}/send-emails/`);
      clearInterval(timer);
      setProgress(100);

      setDispatchStatus({
        type: 'success',
        message: res.data.message || `Successfully dispatched event passes via email!`
      });
      loadEventPasses(selectedEventId);
      loadEvents();
    } catch (err) {
      clearInterval(timer);
      setProgress(0);
      setDispatchStatus({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to dispatch email passes.'
      });
    } finally {
      setLoading(false);
      setTimeout(() => {
        setProgress(0);
      }, 3500);
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

        <button className="btn btn-secondary" onClick={() => loadEventPasses(selectedEventId)}>
          <RefreshCw size={16} /> Refresh Passes
        </button>
      </div>

      {/* Event Selection Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              🎯 Target Event / Workshop:
            </label>
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '320px', fontWeight: 600 }}
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setDispatchStatus(null);
              }}
            >
              {events.length === 0 ? (
                <option value="">No events created yet</option>
              ) : (
                events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({ev.sessions?.length || 0} Lecture Days)
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
            <div className="value">{totalPasses}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-info">
            <h4>Event Passes Sent (qr_sent)</h4>
            <div className="value" style={{ color: 'var(--success)' }}>{qrSentCount}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <Mail size={24} />
          </div>
          <div className="stat-info">
            <h4>Pending Delivery</h4>
            <div className="value" style={{ color: 'var(--warning)' }}>{pendingCount}</div>
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
            <QrCode size={18} /> Generate Event Pass Tokens
          </button>

          <button
            className="btn btn-primary"
            onClick={handleSendEmails}
            disabled={loading || !selectedEventId}
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
            <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem' }}>
              {selectedEvent ? `Passes for: ${selectedEvent.title}` : 'Event Passes'}
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
              disabled={loading || !selectedEventId || passes.length === 0}
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
            {filteredPasses.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  {passes.length === 0 ? 'No event passes found. Click "Generate Event Pass Tokens" above.' : 'No students match your search.'}
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
