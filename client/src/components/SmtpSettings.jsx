import React, { useState, useEffect } from 'react';
import { 
  Server, Save, Send, ShieldCheck, CheckCircle2, AlertCircle, 
  HelpCircle, Mail, Zap, Key, Plus, Trash2, Edit3, Power, 
  RefreshCw, Layers, Users, Info, ArrowRight, Check
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
    setIsFormOpen(true);
    setMessage(null);
  };

  const openEditForm = (acc) => {
    setEditingId(acc.id);
    setFormData({
      provider: acc.provider || 'resend',
      resend_api_key: acc.resend_api_key || '',
      host: acc.host || 'smtp.gmail.com',
      port: acc.port || 587,
      use_tls: acc.use_tls !== undefined ? acc.use_tls : true,
      user: acc.user || '',
      password: '', // leave empty unless changing
      from_name: acc.from_name || 'Aarambh Attendance System',
      from_email: acc.from_email || (acc.provider === 'resend' ? 'onboarding@resend.dev' : ''),
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
          <h2>Email Gateway & Multi-Sender Load Balancing</h2>
          <p>Deliver official QR event passes using multiple sender accounts rotated in Round-Robin mode to bypass daily limits.</p>
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
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #6366f1', background: 'var(--card-bg, #1e293b)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Senders</span>
            <Users size={20} color="#6366f1" />
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
            (500 emails / active account)
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b', background: 'var(--card-bg, #1e293b)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Dispatch Algorithm</span>
            <Layers size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main, #f8fafc)', marginTop: '6px' }}>
            Round-Robin Rotation
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Evenly splits batches across all active accounts
          </div>
        </div>
      </div>

      {/* Daily Limits FAQ Guide */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <Info size={22} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main, #f8fafc)' }}>
              Ek Email Se Kitne Mail Bhej Sakte Hain? (Daily Limits Explained)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginTop: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.85rem' }}>📧 Personal Gmail (@gmail.com)</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Strict limit: <strong>500 emails / 24 hours</strong> (rolling limit). If exceeded, account is paused for 24h.
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.85rem' }}>🎓 Google Workspace / College Email</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Limit: <strong>2,000 emails / 24 hours</strong> for custom domain / institutional accounts.
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.85rem' }}>⚡ Resend HTTPS API (Free Tier)</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <strong>100 emails/day</strong> (3,000 emails/month free). Operates over Port 443 (ideal for Render Cloud).
                </div>
              </div>
            </div>

            <div style={{ marginTop: '10px', fontSize: '0.82rem', color: '#10b981', fontWeight: 600 }}>
              💡 <strong>Pro Tip:</strong> Agar aapko 1,500 students ko passes bhejne hain, toh bas 3 Gmail accounts ya multiple Resend keys yahan add kar dein — system batch ko 500-500 mein divide karke automatically bhej dega!
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Form Modal / Accordion */}
      {isFormOpen && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid #6366f1', background: 'var(--card-bg, #1e293b)' }}>
          <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
            <div className="card-title">
              <ShieldCheck size={20} color="#6366f1" />
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
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className={`btn ${formData.provider === 'resend' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                onClick={() => setFormData({ ...formData, provider: 'resend', from_email: formData.from_email || 'onboarding@resend.dev' })}
              >
                <Zap size={18} /> Resend API (Port 443 - Recommended for Cloud)
              </button>

              <button
                type="button"
                className={`btn ${formData.provider === 'smtp' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
                onClick={() => setFormData({ ...formData, provider: 'smtp' })}
              >
                <Server size={18} /> Gmail SMTP (Port 587 - Localhost / VPS)
              </button>
            </div>

            {formData.provider === 'resend' ? (
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Free API key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>resend.com/api-keys</a>
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
                    <label>From Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="onboarding@resend.dev"
                      value={formData.from_email}
                      onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                    />
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Generated from myaccount.google.com ➡️ Security ➡️ 2-Step Verification ➡️ App Passwords.
                    </span>
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
                  style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
                />
                Active (Include in round-robin dispatch pool)
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
            <Layers size={20} color="#6366f1" />
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
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Add your first Resend API Key or Gmail SMTP account to start sending automated QR passes.</p>
            <button type="button" className="btn btn-primary" onClick={openAddForm}>
              <Plus size={16} /> Add First Sender Account
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '1rem' }}>
            {accounts.map((acc, index) => {
              const userDisplay = acc.user || acc.from_email || (acc.provider === 'resend' ? 'Resend Free Key' : 'SMTP Server');
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
                    border: `1px solid ${acc.is_active ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.08)'}`,
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      background: acc.provider === 'resend' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: acc.provider === 'resend' ? '#6366f1' : '#10b981',
                      fontWeight: 800,
                      fontSize: '0.85rem'
                    }}>
                      {acc.provider === 'resend' ? <Zap size={22} /> : <Mail size={22} />}
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
                          background: acc.provider === 'resend' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: acc.provider === 'resend' ? '#818cf8' : '#34d399'
                        }}>
                          {acc.provider === 'resend' ? 'Resend API' : 'Gmail SMTP'}
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
          Test sending a real QR pass to your email address to confirm gateway delivery and check sender headers.
        </p>

        <form onSubmit={handleTestSend} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              type="email"
              className="form-input"
              placeholder="Enter target recipient email..."
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
                  {a.user || a.from_email} ({a.provider.toUpperCase()})
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
