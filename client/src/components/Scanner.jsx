import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, Play, Square, RefreshCw, UploadCloud, CheckCircle2, AlertTriangle, XCircle, Users, Keyboard, Sparkles, Zap, ZapOff, ZoomIn } from 'lucide-react';
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

  // Hardware Camera Capabilities (Torch & Zoom)
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomLevels, setZoomLevels] = useState([1]);
  const [currentZoom, setCurrentZoom] = useState(1);

  // Auto-stop camera after successful scan (Volunteer clarity & power efficiency)
  const [autoStopOnScan, setAutoStopOnScan] = useState(() => {
    try {
      const saved = localStorage.getItem('auto_stop_scanner_on_scan');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Resilient Offline-to-Online Sync Queue (dual storage in session & local storage)
  const [syncQueue, setSyncQueue] = useState(() => {
    try {
      const saved = sessionStorage.getItem('attendance_scan_queue') || localStorage.getItem('attendance_scan_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem('attendance_scan_queue', JSON.stringify(syncQueue));
      localStorage.setItem('attendance_scan_queue', JSON.stringify(syncQueue));
    } catch {}
  }, [syncQueue]);

  const flushSyncQueue = async () => {
    if (syncQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);
    try {
      const remaining = [];
      for (const item of syncQueue) {
        try {
          await api.post('/attendance/scan/', {
            token: item.token,
            session_id: item.sessionId
          });
        } catch (err) {
          if (!err.response || err.response.status >= 500 || err.code === 'ECONNABORTED') {
            remaining.push(item);
          }
        }
      }
      setSyncQueue(remaining);
      try {
        sessionStorage.setItem('attendance_scan_queue', JSON.stringify(remaining));
        localStorage.setItem('attendance_scan_queue', JSON.stringify(remaining));
      } catch (e) {}

      if (activeSession) {
        loadSessionStats(activeSession.id);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (syncQueue.length > 0) {
      const timer = setTimeout(flushSyncQueue, 2500);
      return () => clearTimeout(timer);
    }
  }, [syncQueue]);

  useEffect(() => {
    const handleOnline = () => {
      if (syncQueue.length > 0) {
        flushSyncQueue();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncQueue]);

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

  // Helper to access underlying video stream track for hardware controls
  const getVideoTrack = () => {
    try {
      const videoElem = document.querySelector('#qr-reader video');
      if (videoElem && videoElem.srcObject) {
        const tracks = videoElem.srcObject.getVideoTracks();
        if (tracks && tracks.length > 0) return tracks[0];
      }
    } catch (e) {}
    return null;
  };

  // Inspect hardware camera capabilities (autofocus, torch, zoom)
  const detectCameraFeatures = () => {
    try {
      const track = getVideoTrack();
      if (!track) return;
      const caps = track.getCapabilities ? track.getCapabilities() : {};

      // 1. Continuous autofocus, auto-exposure, and white-balance for razor-sharp QR readability
      const advanced = [];
      if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }
      if (caps.exposureMode && Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
        advanced.push({ exposureMode: 'continuous' });
      }
      if (caps.whiteBalanceMode && Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
        advanced.push({ whiteBalanceMode: 'continuous' });
      }
      if (advanced.length > 0) {
        track.applyConstraints({ advanced }).catch(() => {});
      }

      // 2. Hardware Torch / Flashlight
      if (caps.torch) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
        setTorchOn(false);
      }

      // 3. Hardware Zoom
      if (caps.zoom) {
        setHasZoom(true);
        const maxZ = Math.min(caps.zoom.max || 3, 3);
        const levels = [1];
        if (maxZ >= 1.5) levels.push(1.5);
        if (maxZ >= 2) levels.push(2);
        setZoomLevels(levels);
        setCurrentZoom(1);
      } else {
        setHasZoom(false);
      }
    } catch (err) {
      console.warn('Camera feature detection warning:', err);
    }
  };

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    const track = getVideoTrack();
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  // Adjust Camera Zoom
  const handleZoomChange = async (targetZoom) => {
    const track = getVideoTrack();
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: Number(targetZoom) }]
      });
      setCurrentZoom(Number(targetZoom));
    } catch (err) {
      console.warn('Zoom change failed:', err);
    }
  };

  // Helper to stop scanner
  const stopScanner = async () => {
    if (torchOn) {
      try {
        const track = getVideoTrack();
        if (track) {
          await track.applyConstraints({ advanced: [{ torch: false }] });
        }
      } catch (e) {}
    }
    setTorchOn(false);
    setHasTorch(false);
    setHasZoom(false);

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

      // If instance doesn't exist, create it with QR_CODE ONLY & native barcode detector support
      // Restricting to QR_CODE only makes decoding up to 5x faster!
      if (!qrCodeInstanceRef.current) {
        qrCodeInstanceRef.current = new Html5Qrcode('qr-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          },
          verbose: false
        });
      } else if (qrCodeInstanceRef.current.isScanning) {
        await qrCodeInstanceRef.current.stop();
      }

      // ⚡ High-speed full-field scanning (no artificial crop box!)
      // Omitting qrbox lets decoder scan 100% of the camera stream for instant detection anywhere on screen
      const qrConfig = {
        fps: 24, // 24 scans per second (instant <45ms detection upon seeing pass)
        disableFlip: facing === 'environment'
      };

      // Camera constraints: Request sharp HD 720p stream
      const cameraConstraints = {
        facingMode: facing,
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 }
      };

      try {
        await qrCodeInstanceRef.current.start(
          cameraConstraints,
          qrConfig,
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {
            // Ignore frame non-matches
          }
        );
      } catch (startErr) {
        // Graceful fallback if device browser rejects width/height hints
        console.warn('HD camera constraints rejected, falling back to default:', startErr);
        await qrCodeInstanceRef.current.start(
          { facingMode: facing },
          qrConfig,
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        );
      }

      setCameraFacing(facing);

      // Inspect hardware capabilities once stream begins
      setTimeout(detectCameraFeatures, 250);
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
        qrCodeInstanceRef.current = new Html5Qrcode('qr-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          },
          verbose: false
        });
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

  const handleScanSuccess = async (token) => {
    const now = Date.now();
    // Debounce duplicate camera trigger within 2.5 seconds for same token
    if (lastScannedTokenRef.current === token && now - lastScannedTimeRef.current < 2500) {
      return;
    }

    // Immediate tactile feedback: short sharp vibration
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(80);
      } catch (e) {}
    }

    lastScannedTokenRef.current = token;
    lastScannedTimeRef.current = now;

    // Automatically turn off camera on scan so volunteer gets clear confirmation
    if (autoStopOnScan) {
      await stopScanner();
    }

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
    setScanResult({
      type: 'loading',
      status_label: '⏳ Verifying Pass...',
      message: 'Processing scan with server...'
    });

    try {
      const res = await api.post('/attendance/scan/', {
        token: token.trim(),
        session_id: activeSession.id
      });

      const data = res.data;

      if (data.success) {
        setScanResult({
          type: 'success',
          status_label: '✅ Attendance Marked Successfully',
          message: `${data.student.name} marked present for this session!`,
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
          status_label: '⚠️ Already Marked Present',
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
      console.warn('Scan API call failed:', err);
      const isNetworkError = !err.response || err.response.status >= 500 || err.code === 'ECONNABORTED';
      if (isNetworkError) {
        const trimmed = token.trim();
        setSyncQueue(prev => {
          if (prev.some(q => q.token === trimmed && q.sessionId === activeSession.id)) return prev;
          const nextQ = [...prev, { token: trimmed, sessionId: activeSession.id, timestamp: Date.now() }];
          try {
            localStorage.setItem('attendance_scan_queue', JSON.stringify(nextQ));
            sessionStorage.setItem('attendance_scan_queue', JSON.stringify(nextQ));
          } catch (e) {}
          return nextQ;
        });
        setScanResult({
          type: 'duplicate',
          status_label: '⚡ Saved Offline (Auto-Syncing)',
          message: 'Network is slow or interrupted. Scan is safely saved in offline queue and will sync automatically to database.',
          marked_at: new Date().toISOString()
        });
        playSound('success');
      } else {
        const errMsg = err.response?.data?.message || 'Network error verifying QR code.';
        setScanResult({
          type: 'error',
          status_label: '❌ Scan Error',
          message: errMsg
        });
        playSound('error');
      }
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
                📅 Step 2: Lecture Day
              </span>
              <div style={{ marginTop: '4px' }}>
                <select
                  className="form-select"
                  style={{ width: '100%', fontWeight: 600, fontSize: '0.88rem', borderColor: activeSession ? 'var(--primary)' : 'var(--border)' }}
                  value={activeSession ? activeSession.id : ''}
                  onChange={(e) => {
                    const sessId = e.target.value;
                    const sess = availableDays.find(s => String(s.id) === String(sessId));
                    setActiveSession(sess || null);
                    setScanResult(null);
                  }}
                >
                  {availableDays.length === 0 ? (
                    <option value="">No days added yet for this event</option>
                  ) : (
                    availableDays.map(sess => (
                      <option key={sess.id} value={sess.id}>
                        {sess.day_label || 'Day'} ({sess.date}) {sess.topic ? `- ${sess.topic}` : ''} {sess.is_active ? '🟢 (Active)' : '🔴 (Closed)'}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

          </div>

          {/* Right Counters: Present + Sync Health Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Sync Health Badge */}
            {syncQueue.length > 0 ? (
              <div
                style={{
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  borderRadius: '12px',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <RefreshCw size={18} className={isSyncing ? 'spin' : ''} color="#eab308" />
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#eab308', fontWeight: 700, textTransform: 'uppercase' }}>
                    Offline Queue
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fef08a' }}>
                    {syncQueue.length} pending
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={flushSyncQueue}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '3px 8px', fontSize: '0.72rem', marginLeft: '6px' }}
                >
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckCircle2 size={16} color="var(--success)" />
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Sync Status
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>
                    Real-Time
                  </div>
                </div>
              </div>
            )}

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
      </div>

      {/* Camera QR Scanner Card */}
      <div className="card" style={{ marginBottom: '1.25rem', overflow: 'hidden' }}>
        <div className="card-header" style={{ paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '10px' }}>
          <div className="card-title">
            <Camera size={20} color="var(--primary)" />
            <span>Live Camera QR Scanner</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)', userSelect: 'none' }} title="Automatically turn off camera as soon as a pass is scanned">
              <input
                type="checkbox"
                checked={autoStopOnScan}
                onChange={(e) => {
                  setAutoStopOnScan(e.target.checked);
                  try {
                    localStorage.setItem('auto_stop_scanner_on_scan', JSON.stringify(e.target.checked));
                  } catch (err) {}
                }}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 600 }}>Auto-stop on scan</span>
            </label>
            {isScanning ? (
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className="live-dot"></span> Camera Active
              </span>
            ) : (
              <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <CameraOff size={13} /> Camera Standby
              </span>
            )}
          </div>
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
              display: isScanning ? 'block' : 'none',
              position: 'relative'
            }}
          ></div>

          {/* Futuristic Aiming Reticle & Sweeping Laser Guide */}
          {isScanning && (
            <div className="scanner-targeting-overlay">
              <div className="scanner-target-box">
                <div className="scanner-laser-line"></div>
                <div className="corner-tl"></div>
                <div className="corner-tr"></div>
                <div className="corner-bl"></div>
                <div className="corner-br"></div>
              </div>
            </div>
          )}

          {/* Real-time scanning guidance */}
          {isScanning && (
            <div style={{ textAlign: 'center', padding: '8px 12px 2px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              ⚡ <strong>Instant QR Detection:</strong> Point camera at QR code. Scans instantly with zero delay!
            </div>
          )}

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
                Camera Scanner Standby
              </h3>
              <p style={{ fontSize: '0.88rem', maxWidth: '360px', margin: 0, color: 'var(--text-muted)' }}>
                Click <strong style={{ color: '#34d399' }}>"▶ Start Camera Scanner"</strong> below to open camera.
              </p>
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
                <span>⏹ Close</span>
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
                <span>Flip ({cameraFacing === 'environment' ? 'Back' : 'Front'})</span>
              </button>

              {/* Torch (Flashlight) Toggle Button */}
              {hasTorch && (
                <button
                  type="button"
                  className={`btn ${torchOn ? 'btn-warning' : 'btn-secondary'}`}
                  onClick={toggleTorch}
                  style={{
                    padding: '12px 16px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: torchOn ? '#eab308' : undefined,
                    color: torchOn ? '#0f172a' : undefined
                  }}
                  title="Turn flashlight on/off for dim light scanning"
                >
                  {torchOn ? <Zap size={16} fill="#0f172a" /> : <ZapOff size={16} />}
                  <span>{torchOn ? 'Flash ON' : 'Flashlight'}</span>
                </button>
              )}

              {/* Hardware Zoom Selector */}
              {hasZoom && zoomLevels.length > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)'
                  }}
                >
                  <ZoomIn size={15} style={{ color: 'var(--text-muted)' }} />
                  {zoomLevels.map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleZoomChange(lvl)}
                      className={`btn btn-sm ${currentZoom === lvl ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.78rem',
                        fontWeight: currentZoom === lvl ? 700 : 500,
                        minWidth: '36px'
                      }}
                    >
                      {lvl}x
                    </button>
                  ))}
                </div>
              )}

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
                <span>Upload Image</span>
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
            <div className={`scan-feedback-banner ${scanResult.type}`} style={{ margin: 0, flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                {scanResult.type === 'loading' && <RefreshCw size={28} className="spin" color="var(--primary)" style={{ shrink: 0 }} />}
                {scanResult.type === 'success' && <CheckCircle2 size={28} color="#34d399" style={{ shrink: 0 }} />}
                {scanResult.type === 'duplicate' && <AlertTriangle size={28} color="#f87171" style={{ shrink: 0 }} />}
                {scanResult.type === 'error' && <XCircle size={28} color="#f87171" style={{ shrink: 0 }} />}

                <div style={{ flex: 1 }}>
                  <h4 style={{ color: scanResult.type === 'success' ? '#34d399' : (scanResult.type === 'loading' ? 'var(--primary)' : '#f87171'), fontSize: '1.15rem', margin: '0 0 4px', fontWeight: 800 }}>
                    {scanResult.status_label}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-main)' }}>{scanResult.message}</p>
                  
                  {scanResult.student && (
                    <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        👤 {scanResult.student.name}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {scanResult.student.roll_number ? `Roll: ${scanResult.student.roll_number} • ` : ''}
                        {scanResult.student.branch} • Year {scanResult.student.year} (Sec {scanResult.student.section})
                      </div>
                      {scanResult.marked_at && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          🕒 Marked at: {new Date(scanResult.marked_at).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Prominent "Scan Next Student" button when camera is stopped */}
              {!isScanning && !loading && (
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setScanResult(null);
                      startScanner(cameraFacing);
                    }}
                    style={{
                      padding: '12px 24px',
                      fontSize: '1rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                      borderRadius: '10px'
                    }}
                  >
                    <Play size={18} />
                    <span>📸 Scan Next Pass (Camera On)</span>
                  </button>
                </div>
              )}
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

