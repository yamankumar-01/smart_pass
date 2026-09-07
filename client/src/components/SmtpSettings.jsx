import React, { useState, useEffect } from 'react';
import { Server, Save, Send, ShieldCheck, CheckCircle2, AlertCircle, HelpCircle, Mail, Zap, Globe, Key } from 'lucide-react';
import api from '../api/axios';

export default function SmtpSettings() {
  const [config, setConfig] = useState({
    provider: 'resend',
    resend_api_key: '',
    host: 'smtp.gmail.com',
    port: 587,
    use_tls: true,
    user: '',
    password: '',
    from_name: 'Aarambh Attendance System',
    from_email: 'onboarding@resend.dev',
    is_active: true
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
            provider: res.data.provider || 'resend',
            resend_api_key: res.data.resend_api_key || '',
            host: res.data.host || 'smtp.gmail.com',
            port: res.data.port || 587,
            use_tls: res.data.use_tls !== undefined ? res.data.use_tls : true,
            user: res.data.user || '',
            password: '',
            from_name: res.data.from_name || 'Aarambh Attendance System',
            from_email: res.data.from_email || (res.data.provider === 'resend' ? 'onboarding@resend.dev' : ''),
            is_active: res.data.is_active !== undefined ? Boolean(res.data.is_active) : true
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
      setMessage({ type: 'success', text: res.data.message || 'Email Gateway Configuration saved and activated!' });
    } catch (err) {
      setMessage({ type: 'danger', text: 'Failed to save email settings.' });
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
        text: err.response?.data?.message || 'Failed to send test email. Please check your credentials.'
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="smtp-settings" style={{ maxWidth: '850px' }}>
      <div className="page-header">
        <div className="page-title">
          <h2>Email Gateway & Pass Delivery Setup</h2>
          <p>Configure Resend (HTTPS API over Port 443) or SMTP to deliver official QR event passes to student inboxes.</p>
        </div>
      </div>

      {/* Provider Selector Tabs */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${config.provider === 'resend' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
            onClick={() => setConfig({ ...config, provider: 'resend', from_email: config.from_email || 'onboarding@resend.dev' })}
          >
            <Zap size={18} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700 }}>Resend API (Port 443)</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Recommended for Render Cloud (100% Free)</div>
            </div>
          </button>

          <button
            type="button"
            className={`btn ${config.provider === 'smtp' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
            onClick={() => setConfig({ ...config, provider: 'smtp' })}
          >
            <Server size={18} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700 }}>Traditional SMTP (Port 587)</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Gmail / Yahoo (Localhost Only)</div>
            </div>
          </button>
        </div>
      </div>

      {/* Instructions Card */}
      {config.provider === 'resend' ? (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <Zap size={24} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ color: 'var(--text-main)', fontSize: '1rem', marginBottom: '4px' }}>How to setup Resend in 1 minute (Free 3,000 emails/mo):</h4>
              <ol style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', lineHeight: '1.6' }}>
                <li>Go to <a href="https://resend.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>resend.com</a> and sign up for free.</li>
                <li>In your Resend dashboard, click <strong>"API Keys"</strong> ➡️ <strong>"Create API Key"</strong>.</li>
                <li>Copy the key (starts with <code>re_...</code>) and paste it into the <strong>Resend API Key</strong> field below.</li>
                <li>Click <strong>Save & Activate</strong> and send a test pass email! <em>(Works 100% on Render without port blocks).</em></li>
              </ol>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <HelpCircle size={24} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ color: 'var(--text-main)', fontSize: '1rem', marginBottom: '4px' }}>Important Note regarding SMTP on Render:</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Render's Free Tier blocks ports 25, 465, and 587 to prevent spam (causing <code>Network is unreachable</code>). Use <strong>Resend API</strong> above for Render deployments, or use SMTP when running locally.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <ShieldCheck size={20} color="var(--primary)" />
            <span>{config.provider === 'resend' ? 'Resend API Configuration' : 'SMTP Server Configuration'}</span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={config.is_active}
              onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
            />
            Enable Live Email Dispatch
          </label>
        </div>

        <form onSubmit={handleSubmit}>
          {config.provider === 'resend' ? (
            <div>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} color="var(--primary)" /> Resend API Key *
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="re_123456789abcdef..."
                  value={config.resend_api_key}
                  onChange={(e) => setConfig({ ...config, resend_api_key: e.target.value })}
                  required={config.provider === 'resend'}
                  style={{ fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Generate your free API key at <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>resend.com/api-keys</a>
                </span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Sender Display Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Aarambh Attendance System"
                    value={config.from_name}
                    onChange={(e) => setConfig({ ...config, from_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>From Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="onboarding@resend.dev (or your verified domain)"
                    value={config.from_email}
                    onChange={(e) => setConfig({ ...config, from_email: e.target.value })}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Leave <code>onboarding@resend.dev</code> for instant free testing without domain setup.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="form-row">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>SMTP Host Server *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. smtp.gmail.com"
                    value={config.host}
                    onChange={(e) => setConfig({ ...config, host: e.target.value })}
                    required={config.provider === 'smtp'}
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
                    required={config.provider === 'smtp'}
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
                    required={config.provider === 'smtp'}
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
            </div>
          )}

          {message && (
            <div className={`scan-feedback-banner ${message.type}`} style={{ marginTop: '1rem' }}>
              <p>{message.text}</p>
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save & Activate Email Gateway'}
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
            placeholder="Enter recipient email address (e.g. your personal Gmail)..."
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
