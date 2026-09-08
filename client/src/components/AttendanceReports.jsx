import React, { useState, useEffect } from 'react';
import { Download, Users, CheckCircle2, XCircle, Percent, Search, Lock, Layers, Calendar, FileSpreadsheet, RefreshCw } from 'lucide-react';
import api from '../api/axios';

export default function AttendanceReports({ activeSession, selectedEventForReport, setSelectedEventForReport }) {
  const [viewMode, setViewMode] = useState('event_matrix'); // 'event_matrix' or 'single_session'

  // Events & Matrix State
  const [events, setEvents] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_events_list');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [selectedEventId, setSelectedEventId] = useState(() => {
    if (selectedEventForReport) return String(selectedEventForReport.id);
    try {
      const saved = localStorage.getItem('smartpass_selected_event_id');
      if (saved) return String(saved);
      const cached = localStorage.getItem('cached_events_list');
      if (cached) {
        const list = JSON.parse(cached);
        const active = list.find(e => (e.total_enrolled || 0) > 0);
        if (active) return String(active.id);
        if (list.length > 0) return String(list[0].id);
      }
    } catch {}
    return '';
  });

  const [matrixData, setMatrixData] = useState(() => {
    try {
      const initId = (selectedEventForReport && selectedEventForReport.id)
        || localStorage.getItem('smartpass_selected_event_id')
        || (JSON.parse(localStorage.getItem('cached_events_list') || '[]')[0]?.id);
      if (initId) {
        const cached = localStorage.getItem(`smartpass_matrix_data_${initId}`);
        if (cached) return JSON.parse(cached);
      }
    } catch {}
    return null;
  });

  const [matrixLoading, setMatrixLoading] = useState(false);
  const [isMatrixSyncing, setIsMatrixSyncing] = useState(false);
  const [matrixSearch, setMatrixSearch] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  // Toggle attendance in multi-day matrix view
  const toggleMatrixAttendance = async (sessionId, studentId, studentName) => {
    const key = `${sessionId}_${studentId}`;
    setTogglingId(key);
    try {
      const res = await api.post('/attendance/toggle/', {
        session_id: sessionId,
        student_id: studentId
      });
      const newStatus = res.data.status; // 'PRESENT' or 'ABSENT'

      setMatrixData(prev => {
        if (!prev) return prev;
        const newMatrix = prev.matrix.map(row => {
          if (row.student.id !== studentId) return row;
          const newAtt = { ...row.attendance, [sessionId]: newStatus };
          const totalPresent = Object.values(newAtt).filter(v => v === 'PRESENT').length;
          const pct = row.total_days > 0 ? Math.round((totalPresent / row.total_days) * 100) : 0;
          return {
            ...row,
            attendance: newAtt,
            total_present: totalPresent,
            percentage: pct
          };
        });
        const updated = { ...prev, matrix: newMatrix };
        if (selectedEventId) {
          try {
            localStorage.setItem(`smartpass_matrix_data_${selectedEventId}`, JSON.stringify(updated));
          } catch (e) {}
        }
        return updated;
      });
    } catch (err) {
      console.error('Failed to toggle attendance:', err);
      alert('Failed to update attendance status.');
    } finally {
      setTogglingId(null);
    }
  };

  // Bulk mark all enrolled students present for a session
  const handleBulkMarkAll = async (sessionId, dayLabel) => {
    if (!sessionId) return;
    if (!window.confirm(`Are you sure you want to mark ALL enrolled students as PRESENT for ${dayLabel}?`)) return;
    try {
      setMatrixLoading(true);
      await api.post('/attendance/bulk-mark/', {
        session_id: sessionId,
        all_enrolled: true
      });
      if (selectedEventId) {
        await loadMatrixData(selectedEventId);
      }
      if (selectedSessionId) {
        const sRes = await api.get(`/attendance/session/${selectedSessionId}`);
        setReportData(sRes.data);
      }
      alert(`Success! All students have been marked PRESENT for ${dayLabel}.`);
    } catch (err) {
      console.error(err);
      alert('Failed to bulk mark students.');
    } finally {
      setMatrixLoading(false);
    }
  };

  // Toggle in Single Session view
  const toggleSingleSessionAttendance = async (studentId, studentName, currentStatus) => {
    if (!selectedSessionId) return;
    try {
      await api.post('/attendance/toggle/', {
        session_id: selectedSessionId,
        student_id: studentId,
        status: currentStatus === 'present' ? 'ABSENT' : 'PRESENT'
      });
      const res = await api.get(`/attendance/session/${selectedSessionId}`);
      setReportData(res.data);
      if (selectedEventId) {
        loadMatrixData(selectedEventId);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update attendance.');
    }
  };

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
      const data = res.data || [];
      setEvents(data);
      try {
        localStorage.setItem('cached_events_list', JSON.stringify(data));
      } catch (e) {}
      if (data.length > 0 && !selectedEventId) {
        if (selectedEventForReport) {
          setSelectedEventId(selectedEventForReport.id);
        } else {
          setSelectedEventId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  // Load Matrix Data for Selected Event with instant pre-hydration and background sync
  const loadMatrixData = async (eventId, forceSync = false) => {
    if (!eventId) return;

    let hasCached = false;
    try {
      const cached = localStorage.getItem(`smartpass_matrix_data_${eventId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.matrix && parsed.matrix.length > 0) {
          hasCached = true;
          setMatrixData(parsed);
        }
      }
    } catch (e) {}

    if (!hasCached) {
      setMatrixLoading(true);
    } else {
      setIsMatrixSyncing(true);
    }

    try {
      const res = await api.get(`/events/${eventId}/matrix-report/`);
      setMatrixData(res.data);
      try {
        localStorage.setItem(`smartpass_matrix_data_${eventId}`, JSON.stringify(res.data));
      } catch (e) {}
    } catch (err) {
      console.error('Failed to load event matrix report:', err);
    } finally {
      setMatrixLoading(false);
      setIsMatrixSyncing(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventForReport) {
      const newId = String(selectedEventForReport.id);
      setSelectedEventId(newId);
      setViewMode('event_matrix');
      try {
        localStorage.setItem('smartpass_selected_event_id', newId);
      } catch (e) {}
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

  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingSessionCsv, setDownloadingSessionCsv] = useState(false);

  const handleDownloadExcel = async () => {
    if (!selectedEventId) return;
    setDownloadingExcel(true);
    try {
      const res = await api.get(`/events/${selectedEventId}/export-excel/`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const targetEvent = events.find(e => String(e.id) === String(selectedEventId));
      const evTitle = targetEvent?.title || 'Event';
      link.download = `${evTitle.replace(/\s+/g, '_')}_Attendance.xls`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);
    } catch (err) {
      console.error('Failed to download excel:', err);
      alert('Failed to download Excel file. Please try again.');
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (!selectedEventId) return;
    setDownloadingCsv(true);
    try {
      const res = await api.get(`/events/${selectedEventId}/export-csv/`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const targetEvent = events.find(e => String(e.id) === String(selectedEventId));
      const evTitle = targetEvent?.title || 'Event';
      link.download = `${evTitle.replace(/\s+/g, '_')}_Attendance.csv`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);
    } catch (err) {
      console.error('Failed to download csv:', err);
      alert('Failed to download CSV file. Please try again.');
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handleDownloadSessionCsv = async () => {
    if (!selectedSessionId) return;
    setDownloadingSessionCsv(true);
    try {
      const res = await api.get(`/attendance/export/${selectedSessionId}/`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sTitle = reportData?.session?.title || 'Session';
      link.download = `Attendance_${sTitle.replace(/\s+/g, '_')}.csv`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);
    } catch (err) {
      console.error('Failed to download session csv:', err);
      alert('Failed to download session CSV.');
    } finally {
      setDownloadingSessionCsv(false);
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
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedEventId(newId);
                    try {
                      localStorage.setItem('smartpass_selected_event_id', newId);
                      const cached = localStorage.getItem(`smartpass_matrix_data_${newId}`);
                      if (cached) {
                        setMatrixData(JSON.parse(cached));
                      }
                    } catch (err) {}
                  }}
                >
                  {events.length === 0 ? (
                    <option value="">No events created yet</option>
                  ) : (
                    events.map(ev => (
                      <option key={ev.id} value={String(ev.id)}>
                        {ev.title} ({ev.total_enrolled || 0} Enrolled • {ev.sessions?.length || 0} Days)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedEventId && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => loadMatrixData(selectedEventId, true)}
                    disabled={isMatrixSyncing}
                    style={{ flex: '1 1 auto', justifyContent: 'center' }}
                    title="Re-calculate and sync latest attendance matrix from database"
                  >
                    <RefreshCw size={16} className={isMatrixSyncing ? 'spin' : ''} /> {isMatrixSyncing ? 'Syncing...' : 'Refresh Matrix'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    disabled={downloadingExcel}
                    className="btn btn-success"
                    style={{ background: '#10b981', color: 'white', flex: '1 1 auto', justifyContent: 'center' }}
                  >
                    {downloadingExcel ? (
                      <><RefreshCw size={16} className="spin" /> Generating Excel...</>
                    ) : (
                      <><FileSpreadsheet size={16} /> Download Excel (.xls)</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    disabled={downloadingCsv}
                    className="btn btn-secondary"
                    style={{ flex: '1 1 auto', justifyContent: 'center' }}
                  >
                    {downloadingCsv ? (
                      <><RefreshCw size={16} className="spin" /> Exporting CSV...</>
                    ) : (
                      <><Download size={16} /> Export CSV</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {matrixLoading && (!matrixData || !matrixData.matrix || matrixData.matrix.length === 0) ? (
            <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <RefreshCw size={32} className="spin" color="var(--primary)" />
                <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem' }}>
                  Calculating Consolidated Attendance Matrix...
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Aggregating multi-day lecture records for {events.find(e => String(e.id) === String(selectedEventId))?.title || 'event'}
                </p>
              </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-main)' }}>
                    {matrixData.event.title} • Consolidated Matrix ({matrixData.sessions.length} Days)
                  </h4>
                  {matrixData.sessions.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.8rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)' }}
                      onClick={() => handleBulkMarkAll(matrixData.sessions[0].id, matrixData.sessions[0].day_label || 'Day 1')}
                      title="Bulk mark all 591 students present for Day 1"
                    >
                      <CheckCircle2 size={14} /> Bulk Mark All Present ({matrixData.sessions[0].day_label || 'Day 1'})
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    💡 <em>Click any badge below to toggle Present/Absent</em>
                  </span>
                  <div style={{ position: 'relative', width: '240px' }}>
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

                          {/* Day Columns (Interactive Toggle) */}
                          {matrixData.sessions.map((sess) => {
                            const isPresent = row.attendance[sess.id] === 'PRESENT';
                            const isToggling = togglingId === `${sess.id}_${row.student.id}`;
                            return (
                              <td key={sess.id} style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  disabled={isToggling}
                                  onClick={() => toggleMatrixAttendance(sess.id, row.student.id, row.student.name)}
                                  className={`badge badge-${isPresent ? 'success' : 'danger'}`}
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '4px 10px',
                                    cursor: 'pointer',
                                    border: '1px solid transparent',
                                    transition: 'all 0.15s ease',
                                    opacity: isToggling ? 0.6 : 1,
                                    outline: 'none'
                                  }}
                                  title="Click to toggle Present / Absent"
                                >
                                  {isToggling ? '⏳ ...' : (isPresent ? '✅ PRESENT' : '❌ ABSENT')}
                                </button>
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
                  <button
                    type="button"
                    onClick={handleDownloadSessionCsv}
                    disabled={downloadingSessionCsv}
                    className="btn btn-primary"
                  >
                    {downloadingSessionCsv ? (
                      <><RefreshCw size={14} className="spin" /> Exporting...</>
                    ) : (
                      <><Download size={14} /> Export Session CSV</>
                    )}
                  </button>
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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

                {selectedSessionId && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleBulkMarkAll(selectedSessionId, reportData?.session?.title || 'This Session')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                    title="Mark all enrolled students present for this session"
                  >
                    <CheckCircle2 size={14} /> Bulk Mark All Present
                  </button>
                )}
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
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSingleList.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
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
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => toggleSingleSessionAttendance(item.id, item.name, activeTab)}
                            className={`btn btn-${activeTab === 'present' ? 'danger' : 'success'} btn-sm`}
                            style={{ padding: '3px 10px', fontSize: '0.78rem' }}
                          >
                            {activeTab === 'present' ? 'Mark Absent' : 'Mark Present'}
                          </button>
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
