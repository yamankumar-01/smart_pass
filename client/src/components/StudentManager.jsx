import React, { useState, useEffect } from 'react';
import { UserPlus, Upload, Download, Search, Mail, QrCode, Trash2, FileText, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import api from '../api/axios';

export default function StudentManager() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [selectedStudentQr, setSelectedStudentQr] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    branch: 'Computer Science',
    year: '1',
    section: 'A'
  });

  const [csvFile, setCsvFile] = useState(null);
  const [csvMessage, setCsvMessage] = useState(null);
  const [uploadRowReport, setUploadRowReport] = useState(null);
  const [duplicatesList, setDuplicatesList] = useState([]);
  const [duplicateActionLoading, setDuplicateActionLoading] = useState(false);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (branchFilter) queryParams.append('branch', branchFilter);
      if (yearFilter) queryParams.append('year', yearFilter);

      const res = await api.get(`/students/?${queryParams.toString()}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setStudents(list);
    } catch (err) {
      console.error('Failed to load students:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [search, branchFilter, yearFilter]);

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/students/', formData);
      setShowAddModal(false);
      setFormData({ name: '', email: '', branch: 'Computer Science', year: '1', section: 'A' });
      loadStudents();
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
        skipped: res.data.skippedCount
      });
      if (res.data.duplicates && res.data.duplicates.length > 0) {
        setDuplicatesList(res.data.duplicates);
      }
      loadStudents();
    } catch (err) {
      setCsvMessage({ type: 'danger', text: err.response?.data?.error || 'Upload failed' });
    } finally {
      setLoading(false);
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
    } catch (err) {
      alert('Failed to clear students.');
    } finally {
      setLoading(false);
    }
  };

  const availableBranches = Array.from(new Set(students.map(s => s.branch).filter(Boolean))).sort();
  const availableYears = Array.from(new Set(students.map(s => String(s.year)).filter(Boolean))).sort();

  return (
    <div className="student-manager">
      <div className="page-header">
        <div className="page-title">
          <h2>Student Upload & Management</h2>
          <p>
            Import student records via CSV / Excel upload or manual form input.
            {students.length > 0 && (
              <span className="badge badge-success" style={{ marginLeft: '10px', fontSize: '0.85rem' }}>
                {students.length} Students Enrolled
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {students.length > 0 && (
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

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.85rem' }}>
          <div style={{ position: 'relative', gridColumn: 'span 1' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '38px' }}
              placeholder="Search student name, email or token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="form-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
            <option value="">All Branches ({availableBranches.length})</option>
            {availableBranches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select className="form-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">All Years ({availableYears.length})</option>
            {availableYears.map(y => (
              <option key={y} value={y}>Year {y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-container card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Student Name</th>
              <th>Email Address</th>
              <th>Branch / Department</th>
              <th>Year & Sec</th>
              <th>UUID Token</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No student records found. Add students manually or import a CSV file.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id}>
                  <td>#{student.id}</td>
                  <td>
                    <strong style={{ fontSize: '0.95rem' }}>{student.name}</strong>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{student.email}</td>
                  <td>
                    <span className="badge badge-info">{student.branch}</span>
                  </td>
                  <td>Year {student.year} - Sec {student.section}</td>
                  <td>
                    <span className="token-code">{student.unique_token || student.token}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedStudentQr(student)}
                        title="View / Download QR Pass"
                      >
                        <QrCode size={14} /> View Pass
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleResendEmail(student.id, student.name)}
                        title="Send / Resend Email with QR Code"
                      >
                        <Mail size={14} /> Email Pass
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

      {/* Manual Add Student Form */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>Manual Add Student</h3>
            <form onSubmit={handleSingleSubmit}>
              <div className="form-group">
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

              <div className="form-group">
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

              <div className="form-row">
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Pass & Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV & Excel Upload UI */}
      {showCsvModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: duplicatesList.length > 0 ? '920px' : '600px', width: '100%', transition: 'max-width 0.2s ease' }}>
            <button className="modal-close" onClick={() => setShowCsvModal(false)}>×</button>
            <h3 style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>Bulk CSV / Excel Student Upload</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Upload a <strong>.csv</strong> or <strong>.xlsx / .xls</strong> spreadsheet. Columns in order: <strong>Student Name, Email, Branch, Year, Section</strong> (or auto-detected from headers).
            </p>

            <form onSubmit={handleCsvSubmit}>
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

              {/* Upload Status (Success/Failure Row Report) */}
              {uploadRowReport && (
                <div style={{ marginTop: '1.25rem', padding: '14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <h4 style={{ fontSize: '0.9rem', color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> File Processing Completed!
                  </h4>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                      ✅ {uploadRowReport.added} New Student(s) Enrolled
                    </span>
                    <span style={{ color: uploadRowReport.skipped > 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600 }}>
                      ⚠️ {uploadRowReport.skipped} Existing / Duplicate Email(s) Skipped
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
                            <td>#{dup.row_number}</td>
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
                      {loading ? 'Processing Upload...' : 'Upload & Process File'}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedStudentQr && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <button className="modal-close" onClick={() => setSelectedStudentQr(null)}>×</button>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>{selectedStudentQr.name}</h3>
            <p style={{ color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{selectedStudentQr.email}</p>

            <div style={{ background: 'white', padding: '16px', borderRadius: '16px', display: 'inline-block', border: '4px solid var(--border)' }}>
              <img
                src={selectedStudentQr.qr_code_image || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${selectedStudentQr.unique_token || selectedStudentQr.token}`}
                alt="Student QR Code"
                style={{ width: '220px', height: '220px', display: 'block' }}
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
