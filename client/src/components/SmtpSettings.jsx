import React, { useState, useEffect } from 'react';
import { 
  Mail, Save, Send, ShieldCheck, CheckCircle2, AlertCircle, 
  HelpCircle, Plus, Trash2, Edit3, Power, RefreshCw, Key, Users
} from 'lucide-react';
import api from '../api/axios';

export default function SmtpSettings() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    user: '',
    password: '',
    from_name: 'Aarambh Attendance System',
    is_active: true
  });
  const [editingId, setEditingId] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Test Email State
  const [testEmail, setTestEmail] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/smtp/');
      if (res.data) {
        const accList = res.data.accounts || [];
        setAccounts(accList);

        // Pre-fill form with active account or first account
        const activeAcc = accList.find(a => a.is_active) || accList[0];
        if (activeAcc && !isAddingNew) {
          setEditingId(activeAcc.id);
          setFormData({
            user: activeAcc.user || activeAcc.from_email || '',
            password: '',
            from_name: activeAcc.from_name || 'Aarambh Attendance System',
            is_active: activeAcc.is_active !== undefined ? activeAcc.is_active : true
          });
          if (!testEmail) {
            setTestEmail(activeAcc.user || activeAcc.from_email || '');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load email settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        provider: 'smtp',
        host: 'smtp.gmail.com',
        port: 587,
        use_tls: true,
        user: formData.user.trim(),
        from_email: formData.user.trim(),
        from_name: formData.from_name.trim() || 'Aarambh Attendance System',
        password: formData.password.trim(),
        is_active: formData.is_active,
        action: isAddingNew ? 'create' : 'update',
        id: isAddingNew ? null : editingId
      };

      const res = await api.post('/settings/smtp/', payload);
      setMessage({ 
        type: 'success', 
        text: res.data.message || '✅ Email successfully connected and activated!' 
      });
      setIsAddingNew(false);
      fetchSettings();
    } catch (err) {
      setMessage({ 
        type: 'danger', 
        text: err.response?.data?.error || 'Failed to save email settings.' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (accId, email) => {
    if (!window.confirm(`Delete ${email}?`)) return;
    try {
      await api.delete(`/settings/smtp/${accId}/`);
      fetchSettings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestSend = async (e) => {
    e.preventDefault();
    if (!testEmail.trim()) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const res = await api.post('/settings/test-email/', { 
        email: testEmail.trim(),
        account_id: editingId 
      });
      setTestResult({
        type: 'success',
        text: res.data.message
      });
    } catch (err) {
      setTestResult({
        type: 'danger',
        text: err.response?.data?.message || 'Email dispatch failed. Please check password or run on localhost.'
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="smtp-settings" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h2>Email Pass Delivery Setup</h2>
          <p>Apna Gmail ya College Email ID connect karein jisse sabhi students ko automated QR passes jayenge.</p>
        </div>
      </div>

      {/* Main Simple Form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
          <div className="card-title">
            <Mail size={20} color="var(--primary, #6366f1)" />
            <span>{isAddingNew ? 'Add Another Email Account' : 'Connect Your Email (Gmail / College Mail)'}</span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
            />
            Active
          </label>
        </div>

        <form onSubmit={handleSave} style={{ marginTop: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={15} color="#6366f1" /> Aapka Gmail / College Email Address *
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. yunush.mech27@jecrc.ac.in ya yourname@gmail.com"
              value={formData.user}
              onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              required
              style={{ fontSize: '0.95rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={15} color="#6366f1" /> Google App Password (16 akshar ka) *
            </label>
            <input
              type="password"
              className="form-input"
              placeholder={editingId && !isAddingNew ? '•••••••••••••••• (Leave blank to keep existing)' : 'abcd efgh ijkl mnop'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!editingId || isAddingNew}
              style={{ fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '1px' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
              Normal Gmail password nahi, balki Google ka 16-letter App Password daalein (niche step-by-step diya hai).
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              Sender Display Name (Students ko kis naam se email dikhe)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Aarambh Attendance System"
              value={formData.from_name}
              onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
            />
          </div>

          {message && (
            <div className={`scan-feedback-banner ${message.type}`} style={{ marginBottom: '1rem' }}>
              <p style={{ fontWeight: 600 }}>{message.text}</p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {accounts.length > 0 && !isAddingNew && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsAddingNew(true);
                  setFormData({ user: '', password: '', from_name: 'Aarambh Attendance System', is_active: true });
                }}
                style={{ fontSize: '0.85rem' }}
              >
                <Plus size={14} /> + Add Another Email Account
              </button>
            )}

            {isAddingNew && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsAddingNew(false);
                  fetchSettings();
                }}
              >
                Cancel
              </button>
            )}

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginLeft: 'auto', padding: '10px 24px', fontWeight: 700 }}>
              <Save size={16} /> {saving ? 'Connecting...' : 'Save & Connect Email'}
            </button>
          </div>
        </form>
      </div>

      {/* Connected Accounts List (if multiple) */}
      {accounts.length > 1 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>Configured Accounts ({accounts.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {accounts.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <div>
                  <strong>{a.user || a.from_email}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({a.from_name})</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                    onClick={() => {
                      setEditingId(a.id);
                      setIsAddingNew(false);
                      setFormData({ user: a.user || a.from_email, password: '', from_name: a.from_name, is_active: a.is_active });
                    }}
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                    onClick={() => handleDelete(a.id, a.user || a.from_email)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 16-Letter Password Help Card */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <HelpCircle size={22} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 700 }}>
              16-Letter Google App Password Kaise Banayein (1 Minute Ka Kaam):
            </h4>
            <ol style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, paddingLeft: '1.2rem', lineHeight: '1.7' }}>
              <li>Apne Google Account par jayein: <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontWeight: 600 }}>myaccount.google.com/security</a></li>
              <li><strong>2-Step Verification</strong> ko ON karein (agar pehle se ON nahi hai).</li>
              <li>Wahi Security page par search bar me <strong>"App passwords"</strong> search karein.</li>
              <li>App name me kuch bhi daalein (jaise <code>SmartPass</code>) aur <strong>Create</strong> dabayein.</li>
              <li>Google aapko 16 akshar ka password dega (jaise: <code>abcd efgh ijkl mnop</code>). Use copy karke yahan paste kar dein!</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Test Pass Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Send size={20} color="#10b981" />
            <span>Send Real Test QR Pass</span>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Apne kisi bhi email par test pass bhej kar check karein ki QR code sahi deliver ho raha hai:
        </p>

        <form onSubmit={handleTestSend} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="email"
            className="form-input"
            placeholder="Recipient email address..."
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-success" disabled={testLoading} style={{ padding: '10px 20px', fontWeight: 700 }}>
            <Send size={16} /> {testLoading ? 'Sending...' : 'Send Test QR Pass'}
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
