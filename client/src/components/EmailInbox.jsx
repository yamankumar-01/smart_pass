import React, { useState, useEffect } from 'react';
import { Eye, RefreshCw, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';

export default function EmailInbox() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const res = await api.get('/emails/');
      setEmails(res.data);
    } catch (err) {
      console.error('Failed to load email logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const handleDeleteLog = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete this email log for ${name || 'student'}?`)) return;
    try {
      await api.delete(`/emails/${id}/`);
      setEmails(prev => prev.filter(e => e.id !== id));
      setStatusMessage({ type: 'success', text: 'Email log deleted successfully.' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({ type: 'danger', text: 'Failed to delete email log.' });
    }
  };

  const handleClearAll = async () => {
    if (emails.length === 0) return;
    if (!window.confirm(`⚠️ Are you sure you want to delete ALL ${emails.length} email logs? This action cannot be undone.`)) return;
    try {
      await api.post('/emails/clear-all/');
      setEmails([]);
      setStatusMessage({ type: 'success', text: 'All email logs cleared successfully!' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({ type: 'danger', text: 'Failed to clear email logs.' });
    }
  };

  return (
    <div className="email-inbox">
      <div className="page-header">
        <div className="page-title">
          <h2>Sent QR Code Emails Log (Django Email Engine)</h2>
          <p>Inspect dispatched email receipts, preview student QR passes, and manage email logs.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={loadEmails} disabled={loading} style={{ flex: '1 1 auto' }}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh Inbox
          </button>
          {emails.length > 0 && (
            <button className="btn btn-danger" onClick={handleClearAll} style={{ flex: '1 1 auto' }}>
              <Trash2 size={16} /> Clear All Logs
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`badge badge-${statusMessage.type}`}
          style={{
            padding: '10px 16px',
            fontSize: '0.9rem',
            width: '100%',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {statusMessage.text}
        </div>
      )}

      <div className="table-container card" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Log ID</th>
              <th>Recipient Name</th>
              <th>Destination Email</th>
              <th>Subject</th>
              <th>QR Pass Token</th>
              <th>Delivery Status</th>
              <th>Date Sent</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {emails.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No email logs found. Upload students or dispatch event passes to populate logs.
                </td>
              </tr>
            ) : (
              emails.map((log) => (
                <tr key={log.id}>
                  <td>#{log.id}</td>
                  <td><strong>{log.student_name || 'Student'}</strong></td>
                  <td style={{ color: 'var(--text-muted)' }}>{log.email}</td>
                  <td>{log.subject}</td>
                  <td><span className="token-code">{log.qr_token}</span></td>
                  <td>
                    <span className={`badge badge-${log.status === 'SENT' ? 'success' : log.status === 'DISPATCHED' ? 'info' : 'danger'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    {new Date(log.sent_at).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        title="Preview Email"
                        onClick={() => setSelectedEmail(log)}
                      >
                        <Eye size={14} /> Preview
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        title="Delete this log"
                        style={{ padding: '4px 8px' }}
                        onClick={() => handleDeleteLog(log.id, log.student_name)}
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

      {selectedEmail && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <button className="modal-close" onClick={() => setSelectedEmail(null)}>×</button>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <span className="badge badge-info" style={{ marginBottom: '8px' }}>Dispatched Email Preview</span>
              <h3 style={{ fontFamily: 'var(--font-heading)' }}>{selectedEmail.subject}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                To: <strong>{selectedEmail.student_name}</strong> &lt;{selectedEmail.email}&gt; | Sent: {new Date(selectedEmail.sent_at).toLocaleString()}
              </p>
            </div>

            <div
              style={{
                background: '#f8fafc',
                color: '#1e293b',
                padding: '16px',
                borderRadius: '8px',
                maxHeight: '500px',
                overflowY: 'auto',
                border: '1px solid var(--border)'
              }}
              dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  const id = selectedEmail.id;
                  const name = selectedEmail.student_name;
                  setSelectedEmail(null);
                  handleDeleteLog(id, name);
                }}
              >
                <Trash2 size={14} /> Delete This Log
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedEmail(null)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
