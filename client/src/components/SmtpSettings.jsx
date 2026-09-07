import React, { useState, useEffect } from 'react';
import { 
  Server, Save, Send, ShieldCheck, CheckCircle2, AlertCircle, 
  HelpCircle, Mail, Zap, Key, Plus, Trash2, Edit3, Power, 
  RefreshCw, Layers, Users, Info, Sparkles, ExternalLink
} from 'lucide-react';
import api from '../api/axios';

export default function SmtpSettings() {
  const [accounts, setAccounts] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [loading, setLoading] = useState(true);

  // Form State (for adding or editing)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null means creating new
  const [formData, setFormData] = useState({
    provider: 'brevo',
    brevo_api_key: '',
    resend_api_key: '',
    host: 'smtp.gmail.com',
    port: 587,
    use_tls: true,
    user: '',
    password: '',
    from_name: 'Aarambh Attendance System',
    from_email: '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Test Email State
  const [testEmail, setTestEmail] = useState('');
  const [testAccountId, setTestAccountId] = useState('auto');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/smtp/');
      if (res.data) {
        const accList = res.data.accounts || [];
        setAccounts(accList);
        setActiveCount(res.data.active_senders_count || 0);
        setTotalCapacity(res.data.estimated_daily_capacity || 0);

        if (!testEmail && accList.length > 0) {
          const firstWithEmail = accList.find(a => a.user || a.from_email);
          if (firstWithEmail) {
            setTestEmail(firstWithEmail.user || firstWithEmail.from_email);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load SMTP accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openAddForm = () => {
    setEditingId(null);
    setFormData({
      provider: 'brevo',
      brevo_api_key: '',
      resend_api_key: '',
      host: 'smtp.gmail.com',
      port: 587,
      use_tls: true,
      user: '',
      password: '',
      from_name: 'Aarambh Attendance System',
      from_email: '',
      is_active: true
    });
    setIsFormOpen(true);
    setMessage(null);
  };

  const openEditForm = (acc) => {
    setEditingId(acc.id);
    setFormData({
      provider: acc.provider || 'brevo',
      brevo_api_key: acc.brevo_api_key || '',
      resend_api_key: acc.resend_api_key || '',
      host: acc.host || 'smtp.gmail.com',
      port: acc.port || 587,
      use_tls: acc.use_tls !== undefined ? acc.use_tls : true,
      user: acc.user || '',
      password: '', // leave empty unless changing
      from_name: acc.from_name || 'Aarambh Attendance System',
      from_email: acc.from_email || '',
      is_active: acc.is_active !== undefined ? acc.is_active : true
    });
    setIsFormOpen(true);
    setMessage(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        ...formData,
        action: editingId ? 'update' : 'create',
        id: editingId
      };
      const res = await api.post('/settings/smtp/', payload);
      setMessage({ type: 'success', text: res.data.message || 'Sender account saved successfully!' });
      setIsFormOpen(false);
      fetchAccounts();
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.error || 'Failed to save email account.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (accId) => {
    try {
      await api.post(`/settings/smtp/${accId}/toggle/`);
      fetchAccounts();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleDelete = async (accId, userLabel) => {
    if (!window.confirm(`Are you sure you want to remove sender account "${userLabel}"?`)) return;
    try {
      await api.delete(`/settings/smtp/${accId}/`);
      fetchAccounts();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleTestSend = async (e) => {
    e.preventDefault();
    if (!testEmail.trim()) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const payload = { email: testEmail.trim() };
      if (testAccountId && testAccountId !== 'auto') {
        payload.account_id = parseInt(testAccountId);
      }
      const res = await api.post('/settings/test-email/', payload);
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
    <div className="smtp-settings" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="page-title">
          <h2>Email Gateway & Multi-Sender Setup</h2>
          <p>Send QR passes from Render Cloud using Brevo (300 free emails/day, no domain required) or Gmail SMTP.</p>
        </div>

        <button 
          type="button" 
          className="btn btn-primary"
          onClick={openAddForm}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600 }}
        >
          <Plus size={18} /> Add Sender Account
        </button>
      </div>

      {/* Multi-Account Capacity Dashboard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #0284c7', background: 'var(--card-bg, #1e293b)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Senders</span>
            <Users size={20} color="#0284c7" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main, #f8fafc)' }}>
            {activeCount} <span style={{ fontSize: '0.9rem', fontWeight: 500, opacity: 0.7 }}>/ {accounts.length} total</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
            {activeCount > 0 ? '● Gateway Ready for Dispatch' : '⚠️ No active accounts'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981', background: 'var(--card-bg, #1e293b)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Combined Daily Capacity</span>
            <Mail size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
            ~{totalCapacity.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>emails / 24h</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Multi-Account Round-Robin Rotation Active
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #6366f1', background: 'var(--card-bg, #1e293b)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Recommended for Cloud</span>
            <Sparkles size={20} color="#6366f1" />
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main, #f8fafc)', marginTop: '6px' }}>
            Brevo (Port 443 HTTPS)
          </div>
          <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '4px', fontWeight: 600 }}>
            ✓ No domain needed • Sends to any student
          </div>
        </div>
      </div>

      {/* Guide Banner */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(2, 132, 199, 0.06)', border: '1px solid rgba(2, 132, 199, 0.3)' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <Sparkles size={22} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main, #f8fafc)' }}>
              Render Cloud Par Email Bhejne Ka 100% Free Tareeqa (Brevo)
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 8px 0', lineHeight: '1.5' }}>
              Render cloud par Gmail ke ports (25, 465, 587) block rehte hain aur Resend sandbox me domain verification mangta hai. Isliye <strong>Brevo (Sendinblue)</strong> sabse best hai — ye HTTPS Port 443 par chalta hai aur isme <strong>bina kisi domain ke</strong> sabhi students ko 300 free emails/day bheje ja sakte hain!
            </p>
            <div style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
              📌 Setup in 2 mins: brevo.com par free sign up karein ➔ Senders me apna email verify karein ➔ SMTP & API me API Key banakar yahan daalein!
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Form Modal / Accordion */}
      {isFormOpen && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid #0284c7', background: 'var(--card-bg, #1e293b)' }}>
          <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
            <div className="card-title">
              <ShieldCheck size={20} color="#0284c7" />
              <span>{editingId ? `Edit Sender Account (#${editingId})` : 'Add New Sender Account'}</span>
            </div>

            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setIsFormOpen(false)}
              style={{ fontSize: '0.85rem', padding: '4px 12px' }}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSave} style={{ marginTop: '1rem' }}>
            {/* Provider Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn ${formData.provider === 'brevo' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                onClick={() => setFormData({ ...formData, provider: 'brevo' })}
              >
                <Sparkles size={18} /> Brevo API (⭐ Recommended - No Domain Needed)
              </button>

              <button
                type="button"
                className={`btn ${formData.provider === 'resend' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                onClick={() => setFormData({ ...formData, provider: 'resend', from_email: formData.from_email || 'onboarding@resend.dev' })}
              >
                <Zap size={18} /> Resend API (Requires Domain)
              </button>

              <button
                type="button"
                className={`btn ${formData.provider === 'smtp' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                onClick={() => setFormData({ ...formData, provider: 'smtp' })}
              >
                <Server size={18} /> Gmail SMTP (Localhost Only)
              </button>
            </div>

            {formData.provider === 'brevo' && (
              <div>
                <div className="card" style={{ marginBottom: '1rem', background: 'rgba(2, 132, 199, 0.08)', padding: '12px 16px', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#38bdf8', marginBottom: '4px' }}>
                    Brevo Free Setup (300 emails/day):
                  </div>
                  <ol style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, paddingLeft: '1.2rem', lineHeight: '1.6' }}>
                    <li><a href="https://onboarding.brevo.com/account/register" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontWeight: 600 }}>brevo.com</a> par free account banayein.</li>
                    <li>Brevo me <strong>"Senders & IP"</strong> par jayein ➔ <strong>"Add a sender"</strong> dabayein ➔ Apna email daalein aur inbox me aayi link se verify karein.</li>
                    <li>Upar profile menu me <strong>"SMTP & API"</strong> ➔ <strong>"API Keys"</strong> ➔ <strong>"Generate a new API key"</strong> dabayein.</li>
                    <li>Key copy karke niche <strong>Brevo API Key</strong> me daalein!</li>
                  </ol>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={14} color="#0284c7" /> Brevo API Key *
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="xkeysib-..."
                    value={formData.brevo_api_key}
                    onChange={(e) => setFormData({ ...formData, brevo_api_key: e.target.value })}
                    required={formData.provider === 'brevo'}
                    style={{ fontFamily: 'monospace' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Generate free key at <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noopener noreferrer" style={{ color: '#0284c7' }}>app.brevo.com/settings/keys/api</a>
                  </span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Sender Display Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Aarambh Attendance System"
                      value={formData.from_name}
                      onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Verified Sender Email Address in Brevo *</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. yunush.mech27@jecrc.ac.in (or your personal gmail)"
                      value={formData.from_email}
                      onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                      required={formData.provider === 'brevo'}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Must be the email you verified under Brevo ➔ Senders & IP.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {formData.provider === 'resend' && (
              <div>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={14} color="#6366f1" /> Resend API Key *
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="re_123456789abcdef..."
                    value={formData.resend_api_key}
                    onChange={(e) => setFormData({ ...formData, resend_api_key: e.target.value })}
                    required={formData.provider === 'resend'}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Sender Display Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Aarambh Attendance System"
                      value={formData.from_name}
                      onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>From Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="onboarding@resend.dev (or verified domain)"
                      value={formData.from_email}
                      onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.provider === 'smtp' && (
              <div>
                <div className="card" style={{ marginBottom: '1rem', background: 'rgba(234, 179, 8, 0.08)', padding: '10px 14px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--warning)', margin: 0 }}>
                    ⚠️ Note: Render Cloud blocks SMTP port 587. Use Gmail SMTP only when running the project locally on your laptop.
                  </p>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>SMTP Host Server *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="smtp.gmail.com"
                      value={formData.host}
                      onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                      required={formData.provider === 'smtp'}
                    />
                  </div>

                  <div className="form-group">
                    <label>Port *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 587 })}
                      required={formData.provider === 'smtp'}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Gmail / Sender Email Address *</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="your_email@gmail.com"
                      value={formData.user}
                      onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                      required={formData.provider === 'smtp'}
                    />
                  </div>

                  <div className="form-group">
                    <label>Google App Password (16 characters) *</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder={editingId ? 'Leave blank to keep existing password' : '••••••••••••••••'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingId && formData.provider === 'smtp'}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Sender Display Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.from_name}
                      onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>From Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. noreply@school.edu"
                      value={formData.from_email}
                      onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#0284c7' }}
                />
                Active (Include in dispatch pool)
              </label>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={16} /> {saving ? 'Saving...' : editingId ? 'Update Account' : 'Add Account to Pool'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Configured Sender Accounts List */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">
            <Layers size={20} color="#0284c7" />
            <span>Configured Sender Accounts ({accounts.length})</span>
          </div>

          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={fetchAccounts}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh
          </button>
        </div>

        {accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <Mail size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-main)' }}>No Email Senders Configured Yet</h4>
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Add a Brevo API Key or Gmail SMTP account to start sending automated QR passes.</p>
            <button type="button" className="btn btn-primary" onClick={openAddForm}>
              <Plus size={16} /> Add First Sender Account
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '1rem' }}>
            {accounts.map((acc, index) => {
              const userDisplay = acc.from_email || acc.user || (acc.provider === 'brevo' ? 'Brevo API' : acc.provider === 'resend' ? 'Resend Key' : 'Gmail SMTP');
              const isBrevo = acc.provider === 'brevo';
              const isResend = acc.provider === 'resend';
              return (
                <div 
                  key={acc.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    background: acc.is_active ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${acc.is_active ? (isBrevo ? 'rgba(2, 132, 199, 0.4)' : isResend ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)') : 'rgba(255,255,255,0.08)'}`,
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      background: isBrevo ? 'rgba(2, 132, 199, 0.2)' : isResend ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isBrevo ? '#38bdf8' : isResend ? '#6366f1' : '#10b981',
                      fontWeight: 800
                    }}>
                      {isBrevo ? <Sparkles size={22} /> : isResend ? <Zap size={22} /> : <Mail size={22} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main, #f8fafc)' }}>
                          {userDisplay}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          background: isBrevo ? 'rgba(2, 132, 199, 0.25)' : isResend ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: isBrevo ? '#38bdf8' : isResend ? '#818cf8' : '#34d399'
                        }}>
                          {isBrevo ? 'BREVO API (HTTPS)' : isResend ? 'RESEND API' : 'GMAIL SMTP'}
                        </span>
                        {acc.is_active ? (
                          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span> Active
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            Disabled
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        From: <strong>{acc.from_name}</strong> &lt;{acc.from_email || acc.user}&gt; • Slot #{index + 1}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleToggle(acc.id)}
                      title={acc.is_active ? 'Disable this sender' : 'Enable this sender'}
                      style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Power size={14} color={acc.is_active ? '#10b981' : '#64748b'} />
                      {acc.is_active ? 'Active' : 'Disabled'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openEditForm(acc)}
                      title="Edit Account"
                      style={{ padding: '6px 10px' }}
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => handleDelete(acc.id, userDisplay)}
                      title="Remove Account"
                      style={{ padding: '6px 10px' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Test Pass Delivery Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Send size={20} color="#10b981" />
            <span>Send Real Test Pass Email</span>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          Test sending a real QR pass to any recipient address to confirm gateway delivery.
        </p>

        <form onSubmit={handleTestSend} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              type="email"
              className="form-input"
              placeholder="Enter target student recipient email (e.g. alizaimran.it27@jecrc.ac.in)..."
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ minWidth: '200px' }}>
            <select
              className="form-input"
              value={testAccountId}
              onChange={(e) => setTestAccountId(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="auto">Auto (First Active Sender)</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.from_email || a.user} ({a.provider.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-success" disabled={testLoading || accounts.length === 0} style={{ padding: '10px 18px', fontWeight: 600 }}>
            <Mail size={16} /> {testLoading ? 'Sending...' : 'Send Test QR Pass'}
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
