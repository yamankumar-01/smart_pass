import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Layers, Play, CheckCircle2, FileSpreadsheet, Trash2, Clock, Sparkles, BookOpen, Send, Users } from 'lucide-react';
import api from '../api/axios';

export default function EventManager({ onSelectSessionForScan, onSelectEventForReport, onSelectEventForDispatch, onSelectEventForStudents }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // New Event Form State
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
  });

  // New Day/Session Form State
  const [dayForm, setDayForm] = useState({
    day_label: '',
    topic: '',
    date: new Date().toISOString().split('T')[0]
  });

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/events/');
      setEvents(res.data);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title.trim()) return;

    try {
      await api.post('/events/', eventForm);
      setShowEventModal(false);
      setEventForm({
        title: '',
        description: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
      });
      loadEvents();
    } catch (err) {
      console.error('Failed to create event:', err);
      alert('Failed to create event.');
    }
  };

  const handleOpenAddDay = (eventObj) => {
    setSelectedEvent(eventObj);
    const nextDayNum = (eventObj.sessions ? eventObj.sessions.length : 0) + 1;
    setDayForm({
      day_label: `Day ${nextDayNum}`,
      topic: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowDayModal(true);
  };

  const handleAddDay = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;

    try {
      await api.post(`/events/${selectedEvent.id}/add-session/`, {
        day_label: dayForm.day_label.trim() || `Day ${(selectedEvent.sessions?.length || 0) + 1}`,
        topic: dayForm.topic.trim(),
        title: dayForm.topic.trim() ? `${dayForm.day_label}: ${dayForm.topic}` : `${selectedEvent.title} - ${dayForm.day_label}`,
        date: dayForm.date
      });
      setShowDayModal(false);
      loadEvents();
    } catch (err) {
      console.error('Failed to add day:', err);
      alert('Failed to add day.');
    }
  };

  const handleDeleteEvent = async (eventId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this event and all its day sessions?')) return;
    try {
      await api.delete(`/events/${eventId}/`);
      loadEvents();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const handleDeleteSession = async (sessionId, dayLabel, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${dayLabel || 'this day'}? All attendance records for this day will also be removed.`)) return;
    try {
      await api.delete(`/sessions/${sessionId}/`);
      loadEvents();
    } catch (err) {
      console.error('Failed to delete day session:', err);
      alert('Failed to delete day.');
    }
  };

  return (
    <div className="event-manager-page">
      <div className="page-header">
        <div className="page-title">
          <h2>Events & Multi-Day Lecture Management</h2>
          <p>Organize academic bootcamps, conferences, and workshops into Day 1, Day 2, Day 3 lecture series.</p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowEventModal(true)}>
          <Plus size={16} /> Create New Event / Bootcamp
        </button>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
          <Calendar size={48} color="var(--primary)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
          <h3 style={{ marginBottom: '8px' }}>No Multi-Day Events Created Yet</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '450px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            Create an event (e.g. "3-Day AI Bootcamp" or "TechFest 2026") and easily add Day 1, Day 2, and Day 3 lecture sessions.
          </p>
          <button className="btn btn-primary" onClick={() => setShowEventModal(true)}>
            <Plus size={16} /> Create Your First Event
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1.25rem' }}>
          {events.map((eventObj) => (
            <div key={eventObj.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Layers size={12} /> {eventObj.sessions?.length || 0} Lecture Days
                      </span>
                      <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={12} /> {eventObj.total_enrolled || 0} Enrolled
                      </span>
                      <span className="badge badge-success">Active Event</span>
                    </div>
                    <h3 style={{ margin: '8px 0 4px', fontSize: '1.2rem', color: 'var(--text-main)', wordBreak: 'break-word' }}>{eventObj.title}</h3>
                    {eventObj.description && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                        {eventObj.description}
                      </p>
                    )}
                  </div>

                  <button
                    className="btn btn-ghost"
                    style={{ color: '#ef4444', padding: '6px', shrink: 0 }}
                    onClick={(e) => handleDeleteEvent(eventObj.id, e)}
                    title="Delete Event"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: '6px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} /> {eventObj.start_date} to {eventObj.end_date}
                  </div>
                </div>

                {/* Days / Sessions Timeline */}
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={16} color="var(--primary)" /> Scheduled Days & Lectures:
                </h4>

                {(!eventObj.sessions || eventObj.sessions.length === 0) ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                    No lecture days added yet. Click "+ Add Day" below.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                    {eventObj.sessions.map((sess) => (
                      <div
                        key={sess.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}
                      >
                        <div style={{ flex: '1 1 180px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem' }}>
                              {sess.day_label || 'Day'}
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              {sess.topic || sess.title}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            📅 {sess.date} • 👥 <strong>{sess.present_count || 0}</strong> present
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => onSelectSessionForScan && onSelectSessionForScan(sess)}
                            title="Open Live Scanner for this Day"
                          >
                            <Play size={12} /> Scan
                          </button>

                          <button
                            className="btn btn-danger"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={(e) => handleDeleteSession(sess.id, sess.day_label, e)}
                            title={`Delete ${sess.day_label || 'Day'}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: '1 1 90px', padding: '8px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  onClick={() => handleOpenAddDay(eventObj)}
                >
                  <Plus size={14} /> Add Day
                </button>

                <button
                  className="btn btn-secondary"
                  style={{ flex: '1 1 110px', padding: '8px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  onClick={() => onSelectEventForStudents && onSelectEventForStudents(eventObj)}
                  title="View & Upload Students enrolled in this Event"
                >
                  <Users size={14} /> Students
                </button>

                <button
                  className="btn btn-secondary"
                  style={{ flex: '1 1 110px', padding: '8px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                  onClick={() => onSelectEventForDispatch && onSelectEventForDispatch(eventObj)}
                  title="Dispatch QR Passes for this Event via Email"
                >
                  <Send size={14} /> Passes
                </button>

                <button
                  className="btn btn-primary"
                  style={{ flex: '1 1 110px', padding: '8px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  onClick={() => onSelectEventForReport && onSelectEventForReport(eventObj)}
                >
                  <FileSpreadsheet size={14} /> Matrix Report
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Event */}
      {showEventModal && (
        <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.15rem' }}>
                <Sparkles size={20} color="var(--primary)" /> Create New Multi-Day Event
              </h3>
              <button className="modal-close" onClick={() => setShowEventModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateEvent} style={{ marginTop: '0.5rem' }}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Event / Bootcamp Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 3-Day AI & Cloud Workshop"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Description / Objective (Optional)</label>
                <textarea
                  className="form-input"
                  rows="2"
                  placeholder="Hands-on training, industry projects, certification..."
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                />
              </div>

              <div className="form-row" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={eventForm.start_date}
                    onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={eventForm.end_date}
                    onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEventModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} /> Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Day / Lecture Slot */}
      {showDayModal && selectedEvent && (
        <div className="modal-overlay" onClick={() => setShowDayModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.15rem' }}>
                <Plus size={20} color="var(--primary)" /> Add Lecture Day
              </h3>
              <button className="modal-close" onClick={() => setShowDayModal(false)}>×</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Target Event: <strong>{selectedEvent.title}</strong>
            </p>

            <form onSubmit={handleAddDay} style={{ marginTop: '0.5rem' }}>
              <div className="form-row" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label>Day Label *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Day 1 or Morning Slot"
                    value={dayForm.day_label}
                    onChange={(e) => setDayForm({ ...dayForm, day_label: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dayForm.date}
                    onChange={(e) => setDayForm({ ...dayForm, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Lecture Topic / Speaker (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Intro to Neural Networks & Setup"
                  value={dayForm.topic}
                  onChange={(e) => setDayForm({ ...dayForm, topic: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDayModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} /> Add Day Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
