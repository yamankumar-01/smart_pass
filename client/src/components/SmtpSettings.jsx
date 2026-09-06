import React, { useState, useEffect } from 'react';
import { Server, Save, Send, ShieldCheck, CheckCircle2, AlertCircle, HelpCircle, Mail } from 'lucide-react';
import api from '../api/axios';

export default function SmtpSettings() {
  const [config, setConfig] = useState({
    host: 'smtp.gmail.com',
    port: 587,
    use_tls: true,
    user: '',
    password: '',
    from_name: 'Campus Attendance System',
    from_email: '',
    is_active: false
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Test Email State
  const [testEmail, setTestEmail] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    api.get('/settings/smtp/')
      .then(res => {
        if (res.data) {
          setConfig({
            host: res.data.host || 'smtp.gmail.com',
            port: res.data.port || 587,
            use_tls: res.data.use_tls !== undefined ? res.data.use_tls : true,
            user: res.data.user || '',
            password: '',
            from_name: res.data.from_name || 'Campus Attendance System',
            from_email: res.data.from_email || '',
            is_active: Boolean(res.data.is_active)
          });
          if (res.data.user && !testEmail) {
            setTestEmail(res.data.user);
          }
        }
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await api.post('/settings/smtp/', config);
      setMessage({ type: 'success', text: res.data.message || 'SMTP Configuration saved and activated!' });
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to save SMTP settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (e) => {
    e.preventDefault();
    if (!testEmail.trim()) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const res = await api.post('/settings/test-email/', { email: testEmail.trim() });
      setTestResult({
        type: 'success',
        text: res.data.message
      });
    } catch (err) {
      setTestResult({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to send test email. Please check your SMTP password / App Password.'
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="smtp-settings" style={{ maxWidth: '850px' }}>
      <div className="page-header">
        <div className="page-title">
          <h2>Real SMTP Email Gateway & Credentials</h2>
          <p>Configure your Gmail or SMTP mail server to send real QR code passes to students' inboxes.</p>
        </div>
      </div>

      {/* Gmail Instructions Banner */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <HelpCircle size={24} color="var(--primary)" style={{ shrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ color: 'var(--text-main)', fontSize: '1rem', marginBottom: '4px' }}>How to send real emails with Gmail:</h4>
            <ol style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', lineHeight: '1.6' }}>
              <li>Enter Host: <code>smtp.gmail.com</code> | Port: <code>587</code></li>
              <li>Enter User Email: <code>your_email@gmail.com</code></li>
              <li>Enter Password: Use a 16-character <strong>Gmail App Password</strong> (Generate via Google Account → Security → App Passwords). <em>Note: Do NOT use your normal login password.</em></li>
              <li>Check <strong>"Enable Live SMTP Delivery"</strong> and click Save. Then test with your own email address!</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <Server size={20} color="var(--primary)" />
            <span>SMTP Mail Server Settings</span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={config.is_active}
              onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
            />
            Enable Live SMTP Delivery
          </label>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>SMTP Host Server *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. smtp.gmail.com or smtp.mailtrap.io"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Port *</label>
              <input
                type="number"
                className="form-input"
                placeholder="587"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 587 })}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>SMTP Username / Sender Email *</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. your_name@gmail.com"
                value={config.user}
                onChange={(e) => setConfig({ ...config, user: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>SMTP App Password *</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••••••••••"
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Sender Display Name</label>
              <input
                type="text"
                className="form-input"
                value={config.from_name}
                onChange={(e) => setConfig({ ...config, from_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>From Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. noreply@school.edu"
                value={config.from_email}
                onChange={(e) => setConfig({ ...config, from_email: e.target.value })}
              />
            </div>
          </div>

          {message && (
            <div className={`scan-feedback-banner ${message.type}`} style={{ marginTop: '1rem' }}>
              <p>{message.text}</p>
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save & Activate SMTP Server'}
            </button>
          </div>
        </form>
      </div>

      {/* Test Email Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Send size={20} color="var(--success)" />
            <span>Send Real Test Email Pass</span>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Test sending a real QR code pass to your email address to confirm delivery.
        </p>

        <form onSubmit={handleTestSend} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="email"
            className="form-input"
            placeholder="Enter your personal email address..."
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-success" disabled={testLoading}>
            <Mail size={16} /> {testLoading ? 'Sending Real Email...' : 'Send Test QR Email'}
          </button>
        </form>

        {testResult && (
          <div className={`scan-feedback-banner ${testResult.type}`} style={{ marginTop: '1rem' }}>
            {testResult.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <p style={{ fontWeight: 600 }}>{testResult.text}</p>
          </div>
        )}
      </div>
    </div>
  );
}
