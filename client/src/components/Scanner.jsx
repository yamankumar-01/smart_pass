import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, CheckCircle2, AlertTriangle, XCircle, Users, Keyboard, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../api/axios';

function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'duplicate') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.warn('Audio feedback unavailable:', e);
  }
}

export default function Scanner({ activeSession, setActiveSession }) {
  const [sessions, setSessions] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [sessionStats, setSessionStats] = useState({ present: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  const html5QrcodeScannerRef = useRef(null);
  const lastScannedTokenRef = useRef(null);
  const lastScannedTimeRef = useRef(0);

  const loadSessions = async () => {
    try {
      const res = await api.get('/sessions/');
      setSessions(res.data);

      if (res.data.length > 0 && !activeSession) {
        const active = res.data.find(s => s.is_active || s.status === 'ACTIVE') || res.data[0];
        setActiveSession(active);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const loadSessionStats = async (sessionId) => {
    if (!sessionId) return;
    try {
      const res = await api.get(`/attendance/session/${sessionId}/`);
      if (res.data.stats) {
        setSessionStats({
          present: res.data.stats.present,
          total: res.data.stats.total
        });
      }
    } catch (err) {
      console.error('Error fetching session stats:', err);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSession) {
      loadSessionStats(activeSession.id);
    }
  }, [activeSession]);

  // Initialize Html5QrcodeScanner
  useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(() => {
      const readerElem = document.getElementById('qr-reader');
      if (!readerElem) return;

      if (!html5QrcodeScannerRef.current) {
        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            rememberLastUsedCamera: true
          },
          false
        );

        scanner.render(
          (decodedText) => {
            if (isMounted) {
              handleScanSuccess(decodedText);
            }
          },
          (errorMessage) => {
            // Ignore ongoing scan frame misses
          }
        );

        html5QrcodeScannerRef.current = scanner;
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrcodeScannerRef.current) {
        try {
          html5QrcodeScannerRef.current.clear().catch(console.error);
        } catch (e) {
          console.error('Error clearing QR scanner:', e);
        }
        html5QrcodeScannerRef.current = null;
      }
    };
  }, [activeSession]);

  const handleScanSuccess = (token) => {
    const now = Date.now();
    // Debounce duplicate camera trigger within 2.5 seconds for same token
    if (lastScannedTokenRef.current === token && now - lastScannedTimeRef.current < 2500) {
      return;
    }

    lastScannedTokenRef.current = token;
    lastScannedTimeRef.current = now;
    processTokenScan(token);
  };

  const processTokenScan = async (token) => {
    if (!activeSession) {
      setScanResult({
        type: 'error',
        status_label: '⚠️ No Active Session',
        message: 'Please create or select an active lecture session above before scanning.'
      });
      playSound('error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/attendance/scan/', {
        token: token.trim(),
        session_id: activeSession.id
      });

      const data = res.data;

      if (data.success) {
        setScanResult({
          type: 'success',
          status_label: '✅ Marked Present',
          message: `${data.student.name} marked present successfully!`,
          student: data.student,
          marked_at: data.marked_at
        });

        playSound('success');

        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 }
          });
        } catch (e) {}

        loadSessionStats(activeSession.id);
      } else if (data.duplicate) {
        setScanResult({
          type: 'duplicate',
          status_label: '⚠️ Already Marked',
          message: data.message || `Already marked present previously.`,
          student: data.student,
          marked_at: data.marked_at
        });

        playSound('duplicate');
      } else {
        setScanResult({
          type: 'error',
          status_label: '❌ Scan Rejected',
          message: data.message || 'Invalid QR Code scanned.'
        });
        playSound('error');
      }
    } catch (err) {
      console.error('Scan API call failed:', err);
      const errMsg = err.response?.data?.message || 'Network error verifying QR code.';
      setScanResult({
        type: 'error',
        status_label: '❌ Scan Error',
        message: errMsg
      });
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualToken.trim()) {
      processTokenScan(manualToken);
      setManualToken('');
    }
  };

  return (
    <div className="scanner-page" style={{ maxWidth: '850px', margin: '0 auto' }}>
      {/* Session Selection & Live Counter Banner */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              Active Lecture / Event Day
            </span>
            <div style={{ marginTop: '4px' }}>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '320px', fontWeight: 600 }}
                value={activeSession ? activeSession.id : ''}
                onChange={(e) => {
                  const selected = sessions.find(s => s.id === parseInt(e.target.value));
                  setActiveSession(selected);
                  setScanResult(null);
                }}
              >
                {(() => {
                  const eventSessions = sessions.filter(s => s.event && s.event_title);
                  if (eventSessions.length === 0) {
                    return <option value="">No event lecture days added yet (Add in "Events & Days")</option>;
                  }
                  const grouped = eventSessions.reduce((acc, s) => {
                    const groupName = s.event_title;
                    if (!acc[groupName]) acc[groupName] = [];
                    acc[groupName].push(s);
                    return acc;
                  }, {});

                  return Object.entries(grouped).map(([groupName, groupList]) => (
                    <optgroup key={groupName} label={`📌 Event: ${groupName}`}>
                      {groupList.map(s => {
                        const isClosed = !s.is_active || s.status === 'CLOSED';
                        const prefix = s.day_label ? `${s.day_label} - ` : '';
                        const name = s.topic || s.title || s.name || 'Lecture Session';
                        return (
                          <option key={s.id} value={s.id}>
                            {prefix}{name} ({s.date}) {isClosed ? '🔒 [CLOSED]' : '⚡ [ACTIVE]'}
                          </option>
                        );
                      })}
                    </optgroup>
                  ));
                })()}
              </select>
            </div>
          </div>

          {/* Prominent Present Student Counter */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.25))',
              border: '1.5px solid rgba(16, 185, 129, 0.4)',
              padding: '10px 20px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Users size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Present Students
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success)', lineHeight: 1.1 }}>
                {sessionStats.present} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {sessionStats.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Camera QR Scanner Card */}
      <div className="card" style={{ marginBottom: '1.25rem', overflow: 'hidden' }}>
        <div className="card-header" style={{ paddingBottom: '0.75rem' }}>
          <div className="card-title">
            <Camera size={20} color="var(--primary)" />
            <span>Live Camera QR Scanner</span>
          </div>
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            ● Camera Active
          </span>
        </div>

        <div className="scanner-container" style={{ padding: '0.5rem 0' }}>
          <div id="qr-reader" style={{ width: '100%', maxWidth: '420px', margin: '0 auto', borderRadius: '12px', overflow: 'hidden' }}></div>
        </div>

        {/* Scan Result Feedback Card */}
        {scanResult && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <div className={`scan-feedback-banner ${scanResult.type}`} style={{ margin: 0 }}>
              {scanResult.type === 'success' && <CheckCircle2 size={28} color="#34d399" style={{ shrink: 0 }} />}
              {scanResult.type === 'duplicate' && <AlertTriangle size={28} color="#f87171" style={{ shrink: 0 }} />}
              {scanResult.type === 'error' && <XCircle size={28} color="#f87171" style={{ shrink: 0 }} />}

              <div style={{ flex: 1 }}>
                <h4 style={{ color: scanResult.type === 'success' ? '#34d399' : '#f87171', fontSize: '1.1rem', margin: '0 0 4px' }}>
                  {scanResult.status_label}
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{scanResult.message}</p>
                {scanResult.student && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    👤 {scanResult.student.name} • {scanResult.student.branch} (Year {scanResult.student.year} - Sec {scanResult.student.section})
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Manual UUID Input Fallback */}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Or type/paste Student Token UUID..."
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
            <button type="submit" className="btn btn-secondary" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
              <Keyboard size={15} /> Verify Token
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
