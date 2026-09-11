import React, { useState, useEffect } from 'react';
import { UserPlus, Upload, Download, Search, Mail, QrCode, Trash2, FileText, CheckCircle2, AlertCircle, RefreshCw, Layers, Plus, X, Calendar, UserCheck } from 'lucide-react';
import api from '../api/axios';

export default function StudentManager({ initialEventFilter }) {
  const [students, setStudents] = useState(() => {
    try {
      const cached = sessionStorage.getItem('smartpass_students_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [events, setEvents] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_events_list') || sessionStorage.getItem('smartpass_events_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [eventFilter, setEventFilter] = useState(initialEventFilter ? String(initialEventFilter.id) : '');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [studentToEnroll, setStudentToEnroll] = useState(null);
  const [enrollEventId, setEnrollEventId] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);

  const [selectedStudentQr, setSelectedStudentQr] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    branch: 'Computer Science',
    year: '1',
    section: 'A',
    event_id: ''
  });

  const [csvFile, setCsvFile] = useState(null);
  const [uploadEventId, setUploadEventId] = useState(initialEventFilter ? String(initialEventFilter.id) : '');
  const [csvMessage, setCsvMessage] = useState(null);
  const [uploadRowReport, setUploadRowReport] = useState(null);
  const [duplicatesList, setDuplicatesList] = useState([]);
  const [duplicateActionLoading, setDuplicateActionLoading] = useState(false);

  const loadEvents = async () => {
    try {
      const res = await api.get('/events/');
      setEvents(res.data);
      try {
        sessionStorage.setItem('smartpass_events_cache', JSON.stringify(res.data));
        localStorage.setItem('cached_events_list', JSON.stringify(res.data));
      } catch {}
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (branchFilter) queryParams.append('branch', branchFilter);
      if (yearFilter) queryParams.append('year', yearFilter);
      if (eventFilter) queryParams.append('event_id', eventFilter);

      const res = await api.get(`/students/?${queryParams.toString()}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setStudents(list);
      if (!search && !branchFilter && !yearFilter && !eventFilter) {
        try {
          sessionStorage.setItem('smartpass_students_cache', JSON.stringify(list));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load students:', err);
      // Only reset if no cached students exist
      setStudents(prev => prev.length > 0 ? prev : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (initialEventFilter) {
      setEventFilter(String(initialEventFilter.id));
      setUploadEventId(String(initialEventFilter.id));
    }
  }, [initialEventFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, branchFilter, yearFilter, eventFilter]);

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        branch: formData.branch.trim(),
        year: formData.year,
        section: formData.section.trim(),
        event_id: formData.event_id || null
      };

      const res = await api.post('/students/', payload);
      setShowAddModal(false);
      setFormData({ name: '', email: '', branch: 'Computer Science', year: '1', section: 'A', event_id: '' });
      loadStudents();
      loadEvents();
      alert(`Student ${res.data.name} added & QR code generated!`);
    } catch (err) {
      alert(err.response?.data?.email?.[0] || 'Failed to add student');
    }
  };

  const handleCsvSubmit = async (e) => {
    e.preventDefault();
    if (!csvFile) return;

    const data = new FormData();
    data.append('file', csvFile);
    if (uploadEventId) {
      data.append('event_id', uploadEventId);
    }

    setLoading(true);
    setCsvMessage(null);
    setUploadRowReport(null);
    setDuplicatesList([]);

    try {
      const res = await api.post('/students/upload/', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setCsvMessage({ type: 'success', text: res.data.message });
      setUploadRowReport({
        added: res.data.addedCount,
        skipped: res.data.skippedCount,
        eventTitle: res.data.eventTitle
      });
      if (res.data.duplicates && res.data.duplicates.length > 0) {
        setDuplicatesList(res.data.duplicates);
      }
      loadStudents();
      loadEvents();
    } catch (err) {
      setCsvMessage({ type: 'danger', text: err.response?.data?.error || 'Upload failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEnrollModal = (student) => {
    setStudentToEnroll(student);
    setEnrollEventId(events.length > 0 ? String(events[0].id) : '');
    setShowEnrollModal(true);
  };

  const handleEnrollStudent = async (e) => {
    e.preventDefault();
    if (!studentToEnroll || !enrollEventId) return;

    setEnrollLoading(true);
    try {
      const res = await api.post('/students/enroll-event/', {
        event_id: parseInt(enrollEventId),
        student_ids: [studentToEnroll.id]
      });
      alert(res.data.message || 'Student enrolled successfully!');
      setShowEnrollModal(false);
      setStudentToEnroll(null);
      loadStudents();
      loadEvents();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to enroll student into event.');
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleUnenrollStudent = async (studentId, eventId, eventTitle, studentName) => {
    if (!window.confirm(`Remove ${studentName} from "${eventTitle}"?`)) return;
    try {
      await api.post('/students/unenroll-event/', {
        event_id: eventId,
        student_id: studentId
      });
      loadStudents();
      loadEvents();
    } catch (err) {
      alert('Failed to unenroll student.');
    }
  };

  const handleOverwriteAllDuplicates = async () => {
    if (duplicatesList.length === 0) return;
    if (!window.confirm(`Update all ${duplicatesList.length} duplicate student record(s) in the database with the data from the uploaded file?`)) return;
    setDuplicateActionLoading(true);
    try {
      const res = await api.post('/students/resolve-duplicates/', {
        action: 'overwrite_all',
        duplicates: duplicatesList
      });
      alert(res.data.message || 'Records updated successfully!');
      setDuplicatesList([]);
      loadStudents();
    } catch (err) {
      alert('Failed to update duplicate records.');
    } finally {
      setDuplicateActionLoading(false);
    }
  };

  const handleOverwriteSingleDuplicate = async (dup) => {
    setDuplicateActionLoading(true);
    try {
      await api.post('/students/resolve-duplicates/', {
        action: 'overwrite_selected',
        duplicates: [dup]
      });
      setDuplicatesList(prev => prev.filter(d => d.email !== dup.email));
      loadStudents();
    } catch (err) {
      alert('Failed to update record.');
    } finally {
      setDuplicateActionLoading(false);
    }
  };

  const handleDeleteExistingDuplicate = async (dup) => {
    if (!window.confirm(`Remove existing student record for ${dup.email} from the database?`)) return;
    setDuplicateActionLoading(true);
    try {
      await api.post('/students/resolve-duplicates/', {
        action: 'delete_selected',
        duplicates: [dup]
      });
      setDuplicatesList(prev => prev.filter(d => d.email !== dup.email));
      loadStudents();
    } catch (err) {
      alert('Failed to delete existing record.');
    } finally {
      setDuplicateActionLoading(false);
    }
  };

  const handleSkipSingleDuplicate = (dup) => {
    setDuplicatesList(prev => prev.filter(d => d.email !== dup.email));
  };

  const handleExportDuplicatesCsv = () => {
    if (duplicatesList.length === 0) return;
    const headers = ['Row Number', 'Student Name', 'Email Address', 'Branch', 'Year', 'Section', 'Conflict Type', 'Conflict Reason'];
    const rows = duplicatesList.map(d => [
      d.row_number,
      `"${(d.name || '').replace(/"/g, '""')}"`,
      `"${d.email}"`,
      `"${d.branch}"`,
      `"${d.year}"`,
      `"${d.section}"`,
      `"${d.conflict_type}"`,
      `"${(d.conflict_message || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `duplicate_emails_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResendEmail = async (studentId, studentName) => {
    try {
      await api.post(`/students/${studentId}/resend_email/`);
      alert(`QR Email sent to ${studentName}!`);
    } catch (err) {
      alert('Failed to resend email.');
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to delete student ${studentName}?`)) return;
    try {
      await api.delete(`/students/${studentId}/`);
      loadStudents();
      loadEvents();
    } catch (err) {
      alert('Failed to delete student.');
    }
  };

  const handleClearAllStudents = async () => {
    if (students.length === 0) return;
    if (!window.confirm(`⚠️ DANGER: Are you sure you want to delete ALL ${students.length} students? This will also remove their associated QR passes and attendance records. This cannot be undone.`)) return;
    try {
      setLoading(true);
      await api.post('/students/clear-all/');
      setStudents([]);
      alert('All student records have been deleted successfully.');
      loadStudents();
      loadEvents();
    } catch (err) {
      alert('Failed to clear students.');
    } finally {
      setLoading(false);
    }
  };

  const availableBranches = Array.from(new Set(students.map(s => s.branch).filter(Boolean))).sort();
  const availableYears = Array.from(new Set(students.map(s => String(s.year)).filter(Boolean))).sort();
  const currentFilteredEvent = events.find(e => String(e.id) === String(eventFilter));

  return (
    <div className="student-manager">
      <div className="page-header">
        <div className="page-title">
          <h2>Student Upload & Event Enrollment</h2>
          <p>
            {currentFilteredEvent ? (
              <span>
                Showing students registered for <strong>{currentFilteredEvent.title}</strong>
              </span>
            ) : (
              <span>Import and classify student records by specific Academic Events & Workshops.</span>
            )}
            {students.length > 0 ? (
              <span className="badge badge-success" style={{ marginLeft: '10px', fontSize: '0.85rem' }}>
                {students.length} {currentFilteredEvent ? `in ${currentFilteredEvent.title}` : 'Total Students'}
              </span>
            ) : loading ? (
              <span className="badge badge-info" style={{ marginLeft: '10px', fontSize: '0.85rem' }}>
                ⏳ Syncing...
              </span>
            ) : null}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {students.length > 0 && !eventFilter && (
            <button className="btn btn-danger" onClick={handleClearAllStudents} disabled={loading} style={{ flex: '1 1 auto' }}>
              <Trash2 size={16} /> Delete All Students
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowCsvModal(true)} style={{ flex: '1 1 auto' }}>
            <Upload size={16} /> Upload CSV / Excel
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ flex: '1 1 auto' }}>
            <UserPlus size={16} /> Add Student Manually
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.15rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '0.85rem' }}>
          
          {/* Event Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>🎯 Filter by Event</label>
            <select
              className="form-select"
              style={{ fontWeight: 600, borderColor: eventFilter ? 'var(--primary)' : 'var(--border)' }}
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
            >
              <option value="">All Events (Global Directory)</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.total_enrolled || 0} enrolled)
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>🔍 Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                placeholder="Name, email, token..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Branch Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>🏛️ Branch</label>
            <select className="form-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">All Branches {availableBranches.length > 0 ? `(${availableBranches.length})` : ''}</option>
              {availableBranches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>📅 Academic Year</label>
            <select className="form-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">All Years {availableYears.length > 0 ? `(${availableYears.length})` : ''}</option>
              {availableYears.map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student Table */}
      <div className="table-container card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '65px' }}>S.No.</th>
              <th>Student Name</th>
              <th>Email Address</th>
              <th>Branch / Dept</th>
              <th>Year & Sec</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && students.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      border: '3px solid rgba(255,255,255,0.1)',
                      borderTopColor: 'var(--primary)',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }}></div>
                    <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>
                      ⚡ Loading verified student records from cloud database...
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                      Your records are safe. Syncing latest data...
                    </p>
                  </div>
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  {eventFilter ? (
                    <div>
                      <Calendar size={36} color="var(--primary)" style={{ opacity: 0.7, margin: '0 auto 8px' }} />
                      <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)', margin: '0 0 4px' }}>
                        No students enrolled in "{currentFilteredEvent?.title}" yet.
                      </p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
                        Upload a spreadsheet or add students directly for this event.
                      </p>
                      <button className="btn btn-primary btn-sm" onClick={() => setShowCsvModal(true)}>
                        <Upload size={14} /> Upload Students for this Event
                      </button>
                    </div>
                  ) : (
                    'No student records found. Add students manually or import a CSV file.'
                  )}
                </td>
              </tr>
            ) : (
              students.map((student, index) => (
                <tr key={student.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{index + 1}</td>
                  <td>
                    <strong style={{ fontSize: '0.95rem' }}>{student.name}</strong>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{student.email}</td>
                  <td>
                    <span className="badge badge-info">{student.branch}</span>
                  </td>
                  <td>Year {student.year} - Sec {student.section}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedStudentQr(student)}
                        title="View / Download QR Pass"
                      >
                        <QrCode size={14} /> View
                      </button>

                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteStudent(student.id, student.name)}
                        title="Delete Student Record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Add Student Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="var(--primary)" /> Add Student
              </h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>

            <form onSubmit={handleSingleSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>🎯 Assign to Event (Optional)</label>
                <select
                  className="form-select"
                  value={formData.event_id}
                  onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                >
                  <option value="">General Student Pool (Not linked to specific event)</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      🎯 {ev.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Student Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Eleanor Vance"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Student Email Address *</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. eleanor.v@university.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-row" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label>Branch / Major *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Computer Science"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Year Level *</label>
                  <select
                    className="form-select"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Section *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. A"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Pass & Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV & Excel Upload Modal */}
      {showCsvModal && (
        <div className="modal-overlay" onClick={() => setShowCsvModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: duplicatesList.length > 0 ? '920px' : '620px', width: '100%', transition: 'max-width 0.2s ease' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={20} color="var(--primary)" /> Bulk CSV / Excel Student Upload
              </h3>
              <button className="modal-close" onClick={() => setShowCsvModal(false)}>×</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Upload a <strong>.csv</strong> or <strong>.xlsx / .xls</strong> spreadsheet. Columns: <strong>Student Name, Email, Branch, Year, Section</strong>.
            </p>

            <form onSubmit={handleCsvSubmit}>
              {/* Event Target Selector */}
              <div className="form-group" style={{ marginBottom: '1.25rem', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '4px', display: 'block' }}>
                  🎯 Target Event for this Upload:
                </label>
                <select
                  className="form-select"
                  style={{ fontWeight: 600 }}
                  value={uploadEventId}
                  onChange={(e) => setUploadEventId(e.target.value)}
                >
                  <option value="">General Student Directory (Not tied to single event)</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      🎯 {ev.title} ({ev.sessions?.length || 0} Lecture Days)
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                  {uploadEventId ? `Uploaded students will automatically be registered and issued passes for this event.` : 'Students will be stored in global directory.'}
                </span>
              </div>

              <div
                className="dropzone"
                onClick={() => document.getElementById('csvFileInput').click()}
              >
                <FileText className="dropzone-icon" />
                <h4>{csvFile ? csvFile.name : 'Click to browse or drag & drop CSV / Excel file'}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : 'Supports .csv, .xlsx, .xls spreadsheets'}
                </p>
                <input
                  id="csvFileInput"
                  type="file"
                  accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  style={{ display: 'none' }}
                  onChange={(e) => setCsvFile(e.target.files[0])}
                />
              </div>

              {/* Upload Status */}
              {uploadRowReport && (
                <div style={{ marginTop: '1.25rem', padding: '14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <h4 style={{ fontSize: '0.9rem', color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> File Processing Completed!
                  </h4>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                      ✅ {uploadRowReport.added} New Student(s) Enrolled {uploadRowReport.eventTitle ? `into "${uploadRowReport.eventTitle}"` : ''}
                    </span>
                    <span style={{ color: uploadRowReport.skipped > 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600 }}>
                      ⚠️ {uploadRowReport.skipped} Existing / Duplicate Email(s) Handled
                    </span>
                  </div>
                </div>
              )}

              {/* Duplicate Email Review & Resolution Section */}
              {duplicatesList.length > 0 && (
                <div style={{ marginTop: '1.25rem', padding: '16px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={16} /> Duplicate Emails Review & Resolution ({duplicatesList.length})
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Review duplicate records. You can update existing database entries with new spreadsheet details, remove old records, or skip them.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleExportDuplicatesCsv}
                        title="Export Duplicate Rows to CSV"
                      >
                        <Download size={14} /> Export CSV
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleOverwriteAllDuplicates}
                        disabled={duplicateActionLoading}
                        style={{ background: '#3b82f6', borderColor: '#3b82f6' }}
                        title="Update all existing records with the uploaded spreadsheet details"
                      >
                        <RefreshCw size={14} className={duplicateActionLoading ? 'spin' : ''} /> Update All in DB
                      </button>
                    </div>
                  </div>

                  <div style={{ maxHeight: '220px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <table className="data-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Row #</th>
                          <th>Uploaded Student</th>
                          <th>Email Address</th>
                          <th>Conflict Reason</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicatesList.map((dup, idx) => (
                          <tr key={`${dup.email}-${idx}`}>
                            <td>Row {dup.row_number}</td>
                            <td>
                              <strong>{dup.name}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                {dup.branch} • Yr {dup.year} - Sec {dup.section}
                              </div>
                            </td>
                            <td style={{ color: '#f87171', fontWeight: 600 }}>{dup.email}</td>
                            <td>
                              <span className={`badge ${dup.conflict_type === 'EXISTING_IN_DATABASE' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '0.75rem' }}>
                                {dup.conflict_type === 'EXISTING_IN_DATABASE' ? 'Already in Database' : 'Duplicate in File'}
                              </span>
                              {dup.existing_record?.name && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  DB Record: #{dup.existing_record.id || ''} {dup.existing_record.name}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                {dup.conflict_type === 'EXISTING_IN_DATABASE' && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                      onClick={() => handleOverwriteSingleDuplicate(dup)}
                                      disabled={duplicateActionLoading}
                                      title="Update existing DB student record with new branch/year/name"
                                    >
                                      Update
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                      onClick={() => handleDeleteExistingDuplicate(dup)}
                                      disabled={duplicateActionLoading}
                                      title="Delete existing student from database"
                                    >
                                      Remove DB
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                  onClick={() => handleSkipSingleDuplicate(dup)}
                                  title="Skip duplicate"
                                >
                                  Skip
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {csvMessage && (
                <div className={`scan-feedback-banner ${csvMessage.type}`} style={{ marginTop: '1rem', padding: '12px', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{csvMessage.text}</p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
                {uploadRowReport ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setShowCsvModal(false);
                      setCsvFile(null);
                      setUploadRowReport(null);
                      setDuplicatesList([]);
                      setCsvMessage(null);
                    }}
                  >
                    <CheckCircle2 size={16} /> Done & View Students
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCsvModal(false)}>Close</button>
                    <button type="submit" className="btn btn-primary" disabled={!csvFile || loading}>
                      {loading ? 'Processing Upload...' : 'Upload & Enroll Students'}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1-Click Enroll Student into Event Modal */}
      {showEnrollModal && studentToEnroll && (
        <div className="modal-overlay" onClick={() => setShowEnrollModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem' }}>
                <UserCheck size={20} color="var(--primary)" /> Enroll into Event
              </h3>
              <button className="modal-close" onClick={() => setShowEnrollModal(false)}>×</button>
            </div>

            <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
              Enrolling <strong>{studentToEnroll.name}</strong> ({studentToEnroll.email}):
            </p>

            <form onSubmit={handleEnrollStudent}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Select Target Event *</label>
                <select
                  className="form-select"
                  value={enrollEventId}
                  onChange={(e) => setEnrollEventId(e.target.value)}
                  required
                >
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      🎯 {ev.title} ({ev.sessions?.length || 0} Lecture Days)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEnrollModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={enrollLoading || !enrollEventId}>
                  {enrollLoading ? 'Enrolling...' : 'Confirm Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View QR Pass Modal */}
      {selectedStudentQr && (
        <div className="modal-overlay" onClick={() => setSelectedStudentQr(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <button className="modal-close" onClick={() => setSelectedStudentQr(null)}>×</button>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>{selectedStudentQr.name}</h3>
            <p style={{ color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{selectedStudentQr.email}</p>

            <div style={{ background: 'white', padding: '16px', borderRadius: '16px', display: 'inline-block', border: '4px solid var(--border)' }}>
              <img
                src={selectedStudentQr.qr_code_image || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${selectedStudentQr.unique_token || selectedStudentQr.token}`}
                alt="Student QR Code"
                onError={(e) => {
                  e.target.onerror = null;
                  const fallbackToken = selectedStudentQr.unique_token || selectedStudentQr.token;
                  e.target.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${fallbackToken}`;
                }}
                style={{ width: '220px', height: '220px', display: 'block', margin: '0 auto' }}
              />
            </div>

            <div style={{ margin: '1rem 0' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Encoded Unique Token (UUID):</p>
              <div className="token-code" style={{ fontSize: '0.95rem', display: 'inline-block', margin: '4px 0' }}>
                {selectedStudentQr.unique_token || selectedStudentQr.token}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Branch: {selectedStudentQr.branch} | Year {selectedStudentQr.year} - Sec {selectedStudentQr.section}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '1.25rem' }}>
              <a
                href={selectedStudentQr.qr_code_image || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${selectedStudentQr.unique_token || selectedStudentQr.token}`}
                download={`QR_${selectedStudentQr.name.replace(/\s+/g, '_')}.png`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
              >
                <Download size={16} /> Download PNG
              </a>
              <button
                className="btn btn-secondary"
                onClick={() => handleResendEmail(selectedStudentQr.id, selectedStudentQr.name)}
              >
                <Mail size={16} /> Send via Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
