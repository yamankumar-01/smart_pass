import React, { useState, useEffect } from 'react';
import { Download, Users, CheckCircle2, XCircle, Percent, Search, Lock, Layers, Calendar, FileSpreadsheet, RefreshCw } from 'lucide-react';
import api from '../api/axios';

export default function AttendanceReports({ activeSession, selectedEventForReport, setSelectedEventForReport }) {
  const [viewMode, setViewMode] = useState('event_matrix'); // 'event_matrix' or 'single_session'

  // Events & Matrix State
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [matrixData, setMatrixData] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixSearch, setMatrixSearch] = useState('');

  // Single Session State
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState('present');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Load Events
  const loadEvents = async () => {
    try {
      const res = await api.get('/events/');
      setEvents(res.data);
      if (res.data.length > 0 && !selectedEventId) {
        if (selectedEventForReport) {
          setSelectedEventId(selectedEventForReport.id);
        } else {
          setSelectedEventId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  // Load Matrix Data for Selected Event
  const loadMatrixData = async (eventId) => {
    if (!eventId) return;
    setMatrixLoading(true);
    try {
      const res = await api.get(`/events/${eventId}/matrix-report/`);
      setMatrixData(res.data);
    } catch (err) {
      console.error('Failed to load event matrix report:', err);
    } finally {
      setMatrixLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventForReport) {
      setSelectedEventId(selectedEventForReport.id);
      setViewMode('event_matrix');
    }
  }, [selectedEventForReport]);

  useEffect(() => {
    if (selectedEventId) {
      loadMatrixData(selectedEventId);
    }
  }, [selectedEventId]);

  // Load Single Sessions
  useEffect(() => {
    api.get('/sessions/')
      .then(res => {
        setSessions(res.data);
        if (res.data.length > 0 && !selectedSessionId) {
          const initialId = activeSession ? activeSession.id : res.data[0].id;
          setSelectedSessionId(initialId);
        }
      })
      .catch(console.error);
  }, [activeSession]);

  useEffect(() => {
    if (!selectedSessionId) return;
    setLoading(true);
    api.get(`/attendance/session/${selectedSessionId}`)
      .then(res => {
        setReportData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load attendance report:', err);
        setLoading(false);
      });
  }, [selectedSessionId]);

  const handleCloseSession = async () => {
    if (!selectedSessionId) return;
    if (!window.confirm('Are you sure you want to close this session? Further scans for this session will be blocked.')) return;

    try {
      await api.put(`/sessions/${selectedSessionId}/close/`);
      const res = await api.get(`/attendance/session/${selectedSessionId}`);
      setReportData(res.data);
    } catch (err) {
      alert('Failed to close session.');
    }
  };

  const filteredMatrix = matrixData ? matrixData.matrix.filter(row => {
    const s = row.student;
    return (
      s.name.toLowerCase().includes(matrixSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(matrixSearch.toLowerCase()) ||
      s.branch.toLowerCase().includes(matrixSearch.toLowerCase())
    );
  }) : [];

  const filteredSingleList = reportData ? (
    activeTab === 'present' ? reportData.present : reportData.absent
  ).filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.branch.toLowerCase().includes(search.toLowerCase())
  ) : [];

  return (
    <div className="attendance-reports">
      <div className="page-header">
        <div className="page-title">
          <h2>Attendance Reports & Multi-Day Analytics</h2>
          <p>Analyze multi-day event attendance matrices and export Excel/CSV sheets.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${viewMode === 'event_matrix' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('event_matrix')}
          >
            <Layers size={16} /> Multi-Day Event Matrix
          </button>
          <button
            className={`btn ${viewMode === 'single_session' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('single_session')}
          >
            <Calendar size={16} /> Single Session View
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: MULTI-DAY EVENT MATRIX VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'event_matrix' && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: '1 1 280px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  Select Event:
                </label>
                <select
                  className="form-select"
                  style={{ flex: '1 1 200px', minWidth: '180px', fontWeight: 600 }}
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                >
                  {events.length === 0 ? (
                    <option value="">No events created yet</option>
                  ) : (
                    events.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.sessions?.length || 0} Days)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedEventId && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-start' }}>
                  <a
                    href={`/api/events/${selectedEventId}/export-excel/`}
                    download
                    className="btn btn-success"
                    style={{ background: '#10b981', color: 'white', flex: '1 1 auto', justifyContent: 'center' }}
                  >
                    <FileSpreadsheet size={16} /> Download Excel (.xls)
                  </a>
                  <a
                    href={`/api/events/${selectedEventId}/export-csv/`}
                    download
                    className="btn btn-secondary"
                    style={{ flex: '1 1 auto', justifyContent: 'center' }}
                  >
                    <Download size={16} /> Export CSV
                  </a>
                </div>
              )}
            </div>
          </div>

          {matrixLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Calculating multi-day attendance matrix...
            </div>
          ) : !matrixData || !matrixData.sessions || matrixData.sessions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <Layers size={40} color="var(--primary)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
              <h3>No Lecture Days Added to this Event</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
                Go to the <strong>Events & Days</strong> tab to add Day 1, Day 2, Day 3 lecture sessions.
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              {/* Event Matrix Header & Search */}
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-main)' }}>
                    {matrixData.event.title} • Consolidated Matrix ({matrixData.sessions.length} Days)
                  </h4>
                </div>

                <div style={{ position: 'relative', width: '260px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
                    placeholder="Search student in matrix..."
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Matrix Table */}
              <div className="table-container" style={{ border: 'none', overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: '160px' }}>Student Name</th>
                      <th>Email Address</th>
                      <th>Branch & Year</th>
                      {matrixData.sessions.map((sess) => (
                        <th key={sess.id} style={{ textAlign: 'center', minWidth: '130px' }}>
                          <div>{sess.day_label || 'Day'}</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>
                            {sess.topic || sess.date}
                          </div>
                        </th>
                      ))}
                      <th style={{ textAlign: 'center' }}>Attended</th>
                      <th style={{ textAlign: 'center' }}>Overall %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatrix.length === 0 ? (
                      <tr>
                        <td colSpan={5 + matrixData.sessions.length} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          No students enrolled.
                        </td>
                      </tr>
                    ) : (
                      filteredMatrix.map((row) => (
                        <tr key={row.student.id}>
                          <td><strong>{row.student.name}</strong></td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.student.email}</td>
                          <td>
                            <span className="badge badge-info" style={{ marginRight: '6px' }}>{row.student.branch}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Y{row.student.year}</span>
                          </td>

                          {/* Day Columns */}
                          {matrixData.sessions.map((sess) => {
                            const isPresent = row.attendance[sess.id] === 'PRESENT';
                            return (
                              <td key={sess.id} style={{ textAlign: 'center' }}>
                                <span className={`badge badge-${isPresent ? 'success' : 'danger'}`} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                                  {isPresent ? '✅ PRESENT' : '❌ ABSENT'}
                                </span>
                              </td>
                            );
                          })}

                          {/* Summary Stats */}
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {row.total_present} / {row.total_days}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className="badge"
                              style={{
                                background: row.percentage >= 75 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: row.percentage >= 75 ? 'var(--success)' : '#ef4444',
                                fontWeight: 700
                              }}
                            >
                              {row.percentage}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: SINGLE SESSION VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'single_session' && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Select Session:</label>
                <select
                  className="form-select"
                  style={{ width: 'auto', minWidth: '320px', fontWeight: 600 }}
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                >
                  {sessions.map(s => {
                    const label = s.event_title
                      ? `[${s.event_title}] ${s.day_label || 'Day'}: ${s.topic || s.title} (${s.date})`
                      : `${s.title || s.name} (${s.date})`;
                    return (
                      <option key={s.id} value={s.id}>
                        {label} {s.status === 'CLOSED' ? '🔒 [CLOSED]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {reportData && reportData.session && reportData.session.status === 'ACTIVE' && (
                  <button className="btn btn-secondary btn-sm" onClick={handleCloseSession}>
                    <Lock size={14} /> Close Session
                  </button>
                )}

                {selectedSessionId && (
                  <a
                    href={`/api/attendance/export/${selectedSessionId}`}
                    download
                    className="btn btn-primary"
                  >
                    <Download size={16} /> Export Session CSV
                  </a>
                )}
              </div>
            </div>
          </div>

          {reportData && reportData.stats && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon primary">
                  <Users size={24} />
                </div>
                <div className="stat-info">
                  <h4>Total Enrolled</h4>
                  <div className="value">{reportData.stats.total}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon success">
                  <CheckCircle2 size={24} />
                </div>
                <div className="stat-info">
                  <h4>Present Students</h4>
                  <div className="value" style={{ color: 'var(--success)' }}>{reportData.stats.present}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon warning">
                  <XCircle size={24} />
                </div>
                <div className="stat-info">
                  <h4>Absent Students</h4>
                  <div className="value" style={{ color: 'var(--warning)' }}>{reportData.stats.absent}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon purple">
                  <Percent size={24} />
                </div>
                <div className="stat-info">
                  <h4>Attendance Rate</h4>
                  <div className="value" style={{ color: '#c084fc' }}>{reportData.stats.percentage}%</div>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`btn ${activeTab === 'present' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setActiveTab('present')}
                >
                  <CheckCircle2 size={14} /> Present ({reportData ? reportData.stats.present : 0})
                </button>

                <button
                  className={`btn ${activeTab === 'absent' ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                  onClick={() => setActiveTab('absent')}
                >
                  <XCircle size={14} /> Absent ({reportData ? reportData.stats.absent : 0})
                </button>
              </div>

              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
                  placeholder="Search in session report..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Email Address</th>
                    <th>Branch</th>
                    <th>Year & Section</th>
                    <th>Status</th>
                    <th>Time Marked</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSingleList.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No records found in this category.
                      </td>
                    </tr>
                  ) : (
                    filteredSingleList.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.name}</strong></td>
                        <td style={{ color: 'var(--text-muted)' }}>{item.email}</td>
                        <td><span className="badge badge-info">{item.branch}</span></td>
                        <td>Year {item.year} - Sec {item.section}</td>
                        <td>
                          <span className={`badge badge-${activeTab === 'present' ? 'success' : 'warning'}`}>
                            {activeTab === 'present' ? 'PRESENT' : 'ABSENT'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {item.marked_at ? new Date(item.marked_at).toLocaleTimeString() : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
