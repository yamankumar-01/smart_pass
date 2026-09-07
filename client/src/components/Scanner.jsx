import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Play, Square, RefreshCw, UploadCloud, CheckCircle2, AlertTriangle, XCircle, Users, Keyboard, Sparkles } from 'lucide-react';
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
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [sessionStats, setSessionStats] = useState({ present: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' (back) or 'user' (front)
  const [cameraError, setCameraError] = useState(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  const qrCodeInstanceRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastScannedTokenRef = useRef(null);
  const lastScannedTimeRef = useRef(0);

  const loadEventsAndSessions = async () => {
    try {
      const res = await api.get('/events/');
      const eventList = res.data || [];
      setEvents(eventList);

      if (eventList.length > 0) {
        let initialEvent = eventList[0];
        if (activeSession && activeSession.event) {
          const match = eventList.find(e => e.id === activeSession.event || e.id === activeSession.event_id);
          if (match) initialEvent = match;
        }

        setSelectedEventId(String(initialEvent.id));

        if (initialEvent.sessions && initialEvent.sessions.length > 0) {
          if (!activeSession || (activeSession.event && activeSession.event !== initialEvent.id)) {
            const activeSess = initialEvent.sessions.find(s => s.is_active || s.status === 'ACTIVE') || initialEvent.sessions[0];
            setActiveSession(activeSess);
          }
        } else {
          setActiveSession(null);
        }
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  const loadSessionStats = async (sessionId) => {
    if (!sessionId) {
      setSessionStats({ present: 0, total: 0 });
      return;
    }
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
    loadEventsAndSessions();
  }, []);

  useEffect(() => {
    if (activeSession) {
      loadSessionStats(activeSession.id);
    } else {
      setSessionStats({ present: 0, total: 0 });
    }
  }, [activeSession]);

  // Helper to stop scanner
  const stopScanner = async () => {
    if (qrCodeInstanceRef.current) {
      try {
        if (qrCodeInstanceRef.current.isScanning) {
          await qrCodeInstanceRef.current.stop();
        }
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      setIsScanning(false);
    }
  };

  // Helper to start scanner
  const startScanner = async (facing = cameraFacing) => {
    setCameraError(null);
    setIsStartingCamera(true);
    setIsScanning(true); // Ensure DOM element is visible immediately so Html5Qrcode has non-zero dimensions!

    try {
      const readerElem = document.getElementById('qr-reader');
      if (!readerElem) {
        setIsStartingCamera(false);
        setIsScanning(false);
        return;
      }

      // If instance doesn't exist, create it with native barcode detector support
      if (!qrCodeInstanceRef.current) {
        qrCodeInstanceRef.current = new Html5Qrcode('qr-reader', {
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          },
          verbose: false
        });
      } else if (qrCodeInstanceRef.current.isScanning) {
        await qrCodeInstanceRef.current.stop();
      }

      const qrConfig = {
        fps: 20,
        aspectRatio: 1.0,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight);
          return { width: Math.max(220, Math.floor(edge * 0.85)), height: Math.max(220, Math.floor(edge * 0.85)) };
        }
      };

      await qrCodeInstanceRef.current.start(
        { facingMode: facing },
        qrConfig,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Ignore individual frame non-matches
        }
      );

      setCameraFacing(facing);
    } catch (err) {
      console.error('Failed to start camera:', err);
      let errorMsg = 'Could not access camera. Please allow camera permissions in your browser.';
      if (err?.name === 'NotAllowedError' || String(err).includes('Permission')) {
        errorMsg = 'Camera permission was denied. Please allow camera access in browser settings.';
      } else if (err?.name === 'NotFoundError' || String(err).includes('NotFound')) {
        errorMsg = 'No suitable camera found on this device.';
      }
      setCameraError(errorMsg);
      setIsScanning(false);
    } finally {
      setIsStartingCamera(false);
    }
  };

  // Toggle front/back camera
  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    if (isScanning) {
      await stopScanner();
      await startScanner(nextFacing);
    } else {
      setCameraFacing(nextFacing);
    }
  };

  // Scan from uploaded photo file
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!qrCodeInstanceRef.current) {
        qrCodeInstanceRef.current = new Html5Qrcode('qr-reader');
      }

      // If camera is currently streaming, pause it
      if (isScanning && qrCodeInstanceRef.current.isScanning) {
        await qrCodeInstanceRef.current.stop();
        setIsScanning(false);
      }

      const decodedText = await qrCodeInstanceRef.current.scanFile(file, true);
      handleScanSuccess(decodedText);
    } catch (err) {
      console.error('File scan error:', err);
      setScanResult({
        type: 'error',
        status_label: '❌ No QR Code Found',
        message: 'Could not detect a valid QR code in the uploaded image. Please try another photo.'
      });
      playSound('error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Cleanup camera stream on component unmount
  useEffect(() => {
    return () => {
      if (qrCodeInstanceRef.current) {
        try {
          if (qrCodeInstanceRef.current.isScanning) {
            qrCodeInstanceRef.current.stop().catch(console.warn);
          }
          qrCodeInstanceRef.current.clear();
        } catch (e) {
          console.warn('Scanner cleanup error:', e);
        }
        qrCodeInstanceRef.current = null;
      }
    };
  }, []);

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

  const currentEvent = events.find(e => String(e.id) === String(selectedEventId)) || (events.length > 0 ? events[0] : null);
  const availableDays = currentEvent?.sessions || [];

  return (
    <div className="scanner-page" style={{ maxWidth: '850px', margin: '0 auto' }}>
      {/* Session Selection & Live Counter Banner */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Two-Step Selector: Event First, then Day */}
          <div style={{ flex: '1 1 340px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '12px' }}>
            
            {/* STEP 1: SELECT EVENT */}
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                🎯 Step 1: Select Event
              </span>
              <div style={{ marginTop: '4px' }}>
                <select
                  className="form-select"
                  style={{ width: '100%', fontWeight: 600, fontSize: '0.88rem' }}
                  value={selectedEventId}
                  onChange={(e) => {
                    const newEventId = e.target.value;
                    setSelectedEventId(newEventId);
                    const ev = events.find(ev => String(ev.id) === String(newEventId));
                    if (ev && ev.sessions && ev.sessions.length > 0) {
                      const activeSess = ev.sessions.find(s => s.is_active || s.status === 'ACTIVE') || ev.sessions[0];
                      setActiveSession(activeSess);
                    } else {
                      setActiveSession(null);
                    }
                    setScanResult(null);
                  }}
                >
                  {events.length === 0 ? (
                    <option value="">No events created yet (Add in "Events & Days")</option>
                  ) : (
                    events.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* STEP 2: SELECT DAY */}
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📅 Step 2: Select Lecture Day
              </span>
              <div style={{ marginTop: '4px' }}>
                <select
                  className="form-select"
                  style={{ width: '100%', fontWeight: 600, fontSize: '0.88rem' }}
                  value={activeSession ? activeSession.id : ''}
                  onChange={(e) => {
                    const selected = availableDays.find(s => s.id === parseInt(e.target.value));
                    setActiveSession(selected);
                    setScanResult(null);
                  }}
                  disabled={availableDays.length === 0}
                >
                  {availableDays.length === 0 ? (
                    <option value="">No days added yet (Add in "Events & Days")</option>
                  ) : (
                    availableDays.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.day_label || `Day ${availableDays.indexOf(s) + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

          </div>

          {/* Prominent Present Student Counter */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.25))',
              border: '1.5px solid rgba(16, 185, 129, 0.4)',
              padding: '10px 18px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              flex: '0 0 auto'
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', shrink: 0 }}>
              <Users size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Present Students
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)', lineHeight: 1.1 }}>
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
          {isScanning ? (
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span className="live-dot"></span> Camera Active
            </span>
          ) : (
            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <CameraOff size={13} /> Camera Stopped
            </span>
          )}
        </div>

        {/* Viewfinder Area */}
        <div className="scanner-container" style={{ padding: '0.5rem 0', position: 'relative', minHeight: '320px' }}>
          <div
            id="qr-reader"
            style={{
              width: '100%',
              maxWidth: '420px',
              margin: '0 auto',
              borderRadius: '12px',
              overflow: 'hidden',
              display: isScanning ? 'block' : 'none'
            }}
          ></div>

          {/* Standby Placeholder when camera is stopped */}
          {!isScanning && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  color: 'var(--primary)'
                }}
              >
                <Camera size={32} />
              </div>
              <h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '6px' }}>
                Camera Scanner is Paused
              </h3>
              <p style={{ fontSize: '0.85rem', maxWidth: '320px', marginBottom: '1.25rem' }}>
                Click <strong>"Start Scan"</strong> below to open camera or upload a QR image file directly.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => startScanner(cameraFacing)}
                  disabled={isStartingCamera}
                  style={{ minWidth: '180px' }}
                >
                  <Play size={16} /> {isStartingCamera ? 'Opening Camera...' : 'Start Camera Scanner'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ minWidth: '160px' }}
                >
                  <UploadCloud size={16} /> Upload QR Image
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          )}

          {/* Error Message if permission denied */}
          {cameraError && (
            <div
              style={{
                margin: '1rem',
                padding: '12px 16px',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={18} style={{ shrink: 0 }} />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* SCANNER CONTROLS BAR */}
        <div
          className="scanner-controls-bar"
          style={{
            marginTop: '1rem',
            padding: '0.85rem',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          {isScanning ? (
            <>
              <button
                type="button"
                className="btn btn-danger"
                onClick={stopScanner}
                style={{
                  padding: '12px 20px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Square size={18} />
                <span>⏹ Close Camera</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={toggleCameraFacing}
                style={{
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <RefreshCw size={16} />
                <span>Flip Camera ({cameraFacing === 'environment' ? 'Back' : 'Front'})</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <UploadCloud size={16} />
                <span>Upload QR Image</span>
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => startScanner(cameraFacing)}
                disabled={isStartingCamera}
                style={{
                  padding: '12px 24px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Play size={18} />
                <span>{isStartingCamera ? 'Opening Camera...' : '▶ Start Camera Scanner'}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '12px 20px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <UploadCloud size={18} />
                <span>Upload QR Image File</span>
              </button>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleFileUpload}
          />
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
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Or type/paste Student Token UUID..."
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              style={{ fontSize: '0.85rem', flex: '1 1 220px' }}
            />
            <button type="submit" className="btn btn-secondary" disabled={loading} style={{ whiteSpace: 'nowrap', flex: '0 0 auto' }}>
              <Keyboard size={15} /> Verify Token
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

