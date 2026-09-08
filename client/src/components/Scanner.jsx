import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, Play, Square, RefreshCw, UploadCloud, CheckCircle2, AlertTriangle, XCircle, Users, Keyboard, Sparkles, Zap, ZapOff, ZoomIn } from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../api/axios';

function triggerVibration(type) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'success') {
        // Crisp, solid double pulse for attendance marked
        navigator.vibrate([120, 60, 120]);
      } else if (type === 'duplicate') {
        // Two long distinct warning buzzes for already marked
        navigator.vibrate([250, 100, 250]);
      } else {
        // Short triple buzz for invalid/error
        navigator.vibrate([100, 50, 100, 50, 100]);
      }
    }
  } catch (e) {
    console.warn('Vibration feedback not supported or blocked:', e);
  }
}

function playSound(type) {
  triggerVibration(type);
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

// Cache key for zero-latency instant hydration
const SCANNER_CACHE_KEY = 'smartpass_scanner_state';
const getInitialScannerCache = () => {
  try {
    const raw = localStorage.getItem(SCANNER_CACHE_KEY) || sessionStorage.getItem(SCANNER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function Scanner({ activeSession, setActiveSession }) {
  const cachedScannerState = getInitialScannerCache();

  // Instant pre-hydration: Render cached events, session and stats immediately (0ms delay!)
  const [events, setEvents] = useState(() => cachedScannerState?.events || []);
  const [selectedEventId, setSelectedEventId] = useState(() => {
    if (activeSession?.event_id || activeSession?.event) {
      return String(activeSession.event_id || activeSession.event);
    }
    return cachedScannerState?.selectedEventId ? String(cachedScannerState.selectedEventId) : '';
  });

  const [scanResult, setScanResult] = useState(null);
  const [manualToken, setManualToken] = useState('');
  
  // Instant stats from activeSession or cache
  const [sessionStats, setSessionStats] = useState(() => {
    if (activeSession && activeSession.present_count !== undefined) {
      return {
        present: activeSession.present_count,
        total: activeSession.total_students || 0
      };
    }
    return cachedScannerState?.sessionStats || { present: 0, total: 0 };
  });

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
        let initialEvent = null;
        if (activeSession && (activeSession.event || activeSession.event_id)) {
          const targetId = activeSession.event || activeSession.event_id;
          initialEvent = eventList.find(e => e.id === targetId);
        }
        if (!initialEvent) {
          const savedEventId = sessionStorage.getItem('smartpass_selected_event_id') || localStorage.getItem('smartpass_selected_event_id');
          if (savedEventId) {
            initialEvent = eventList.find(e => String(e.id) === String(savedEventId));
          }
        }
        if (!initialEvent) {
          // Prioritize main event (Aarambh) over secondary/volunteer events
          initialEvent = eventList.find(e => e.title.toLowerCase().includes('aarambh'))
            || [...eventList].sort((a, b) => (b.total_enrolled || 0) - (a.total_enrolled || 0))[0]
            || eventList[0];
        }

        setSelectedEventId(String(initialEvent.id));

        let initialSess = null;
        if (initialEvent.sessions && initialEvent.sessions.length > 0) {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`;

          const savedSessId = sessionStorage.getItem('selected_session_id');
          const activeSessions = initialEvent.sessions.filter(s => s.is_active || s.status === 'ACTIVE');

          if (savedSessId) {
            initialSess = initialEvent.sessions.find(s => String(s.id) === String(savedSessId));
          }
          if (!initialSess) {
            initialSess = activeSessions.find(s => s.date === todayStr);
          }
          if (!initialSess && activeSessions.length > 0) {
            initialSess = activeSessions[activeSessions.length - 1];
          }
          if (!initialSess) {
            initialSess = initialEvent.sessions[0];
          }

          if (!activeSession || activeSession.id !== initialSess.id) {
            setActiveSession(initialSess);
          }

          // Instantly populate stats from session serializer without waiting for network call
          if (initialSess && initialSess.present_count !== undefined) {
            setSessionStats({
              present: initialSess.present_count,
              total: initialSess.total_students || 0
            });
          }
        } else {
          setActiveSession(null);
        }

        // Cache state for instant 0ms hydration on next reload
        try {
          localStorage.setItem(SCANNER_CACHE_KEY, JSON.stringify({
            events: eventList,
            selectedEventId: initialEvent.id,
            sessionStats: initialSess ? { present: initialSess.present_count || 0, total: initialSess.total_students || 0 } : { present: 0, total: 0 }
          }));
        } catch (e) {}
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
      // Ultra-fast query with stats_only=1: runs 2ms DB count instead of serializing 500+ students!
      const res = await api.get(`/attendance/session/${sessionId}/?stats_only=1`);
      if (res.data && res.data.stats) {
        const nextStats = {
          present: res.data.stats.present,
          total: res.data.stats.total
        };
        setSessionStats(nextStats);

        // Update cached stats
        try {
          const current = getInitialScannerCache() || {};
          current.sessionStats = nextStats;
          localStorage.setItem(SCANNER_CACHE_KEY, JSON.stringify(current));
        } catch (e) {}
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
      // Immediately reflect present_count from activeSession if present
      if (activeSession.present_count !== undefined) {
        setSessionStats({
          present: activeSession.present_count,
          total: activeSession.total_students || 0
        });
      }
      loadSessionStats(activeSession.id);
    } else {
      setSessionStats({ present: 0, total: 0 });
    }
  }, [activeSession?.id]);

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
      const readerElem = document.getElementById('qr-reader');
      if (readerElem) {
        readerElem.style.display = 'none';
      }
    }
  };

  // Helper to start scanner
  const startScanner = async (facing = cameraFacing) => {
    setCameraError(null);
    setIsStartingCamera(true);

    try {
      // 1. Insecure Context Check (Browsers block camera on HTTP except localhost)
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (window.location.protocol !== 'https:' && !isLocal) {
        throw new Error('INSECURE_CONTEXT');
      }

      // 2. Check if getUserMedia is supported in browser
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MEDIA_DEVICES_UNSUPPORTED');
      }

      // 3. EXPLICITLY TRIGGER NATIVE BROWSER CAMERA PERMISSION PROMPT!
      // This forces the browser (Chrome / Safari) to immediately display:
      // "Allow SmartPass to access your camera? [Allow] [Block]"
      let testStream = null;
      try {
        testStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing === 'environment' ? 'environment' : 'user' }
        });
      } catch (permErr) {
        console.warn('Primary getUserMedia constraint attempt failed, trying basic video:', permErr);
        // Fallback to basic video constraint without facing mode
        try {
          testStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (fallbackErr) {
          console.error('All native getUserMedia attempts failed:', fallbackErr);
          throw fallbackErr;
        }
      }

      // Stop test stream immediately so Html5Qrcode gets full hardware control
      if (testStream) {
        testStream.getTracks().forEach((track) => track.stop());
      }

      // 4. Ensure DOM container is mounted and visible with computed layout dimensions
      setIsScanning(true);
      const readerElem = document.getElementById('qr-reader');
      if (readerElem) {
        readerElem.style.display = 'block';
      }
      // Give browser a short tick to layout the DOM element and compute dimensions
      await new Promise((resolve) => setTimeout(resolve, 80));

      // 5. Cleanly reset or create Html5Qrcode instance
      if (qrCodeInstanceRef.current) {
        try {
          if (qrCodeInstanceRef.current.isScanning) {
            await qrCodeInstanceRef.current.stop();
          }
          await qrCodeInstanceRef.current.clear();
        } catch (e) {
          console.warn('Resetting qrCodeInstance warning:', e);
        }
        qrCodeInstanceRef.current = null;
      }

      qrCodeInstanceRef.current = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        verbose: false
      });

      // 6. Camera selection: ALWAYS prioritize BACK camera by default for scanner
      let cameraIdOrConfig = { facingMode: facing };
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          if (facing === 'environment') {
            // Find back/rear camera explicitly by label
            const backCam = devices.find((d) =>
              /back|rear|environment|world|facing back|camera2 0|camera 0/i.test(d.label)
            );
            if (backCam) {
              cameraIdOrConfig = backCam.id;
            } else {
              // Exclude known front cameras
              const nonFront = devices.find((d) => !/front|user|selfie|facing front|camera2 1/i.test(d.label));
              cameraIdOrConfig = nonFront ? nonFront.id : { facingMode: 'environment' };
            }
          } else {
            // Front camera requested
            const frontCam = devices.find((d) =>
              /front|user|selfie|facing front|camera2 1/i.test(d.label)
            );
            cameraIdOrConfig = frontCam ? frontCam.id : { facingMode: 'user' };
          }
        }
      } catch (camErr) {
        console.warn('Html5Qrcode.getCameras notice (falling back to facingMode):', camErr);
        cameraIdOrConfig = { facingMode: facing };
      }

      // 7. High-speed scanning configuration with videoConstraints inside configuration
      const qrConfig = {
        fps: 24, // Instant <45ms detection
        disableFlip: facing === 'environment',
        videoConstraints: {
          facingMode: facing === 'environment' ? 'environment' : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      try {
        await qrCodeInstanceRef.current.start(
          cameraIdOrConfig,
          qrConfig,
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        );
      } catch (startErr) {
        console.warn('First start attempt failed, re-instantiating and retrying with basic facingMode:', startErr);
        try {
          await qrCodeInstanceRef.current.clear();
        } catch (e) {}
        qrCodeInstanceRef.current = new Html5Qrcode('qr-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false
        });
        await qrCodeInstanceRef.current.start(
          { facingMode: facing },
          { fps: 20 },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        );
      }

      setCameraFacing(facing);

      // Inspect hardware capabilities once stream begins
      setTimeout(detectCameraFeatures, 300);
    } catch (err) {
      console.error('Failed to start camera:', err);
      let errorMsg = `Could not access camera: ${err?.message || String(err)}`;
      const errStr = String(err).toLowerCase();

      if (err.message === 'INSECURE_CONTEXT') {
        errorMsg = '🔒 Camera permission requires HTTPS on mobile devices. Please open the secure HTTPS URL (https://smart-pass-ub9z.onrender.com).';
      } else if (
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        errStr.includes('denied') ||
        errStr.includes('permission') ||
        errStr.includes('notallowed')
      ) {
        errorMsg = '🚫 Camera permission was blocked. Please tap the lock icon 🔒 (or site settings) in your browser address bar, set Camera to "Allow", and refresh.';
      } else if (err.message === 'MEDIA_DEVICES_UNSUPPORTED') {
        errorMsg = 'Camera API is not supported in this browser. Please open in Google Chrome or Safari.';
      } else if (err.name === 'NotFoundError' || errStr.includes('notfound') || errStr.includes('no camera')) {
        errorMsg = 'No active camera was detected on this device.';
      } else if (err.name === 'NotReadableError' || errStr.includes('in use') || errStr.includes('not readable')) {
        errorMsg = 'Camera is in use by another application. Please close other camera apps and try again.';
      }

      setCameraError(errorMsg);
      setIsScanning(false);
      const readerElem = document.getElementById('qr-reader');
      if (readerElem) {
        readerElem.style.display = 'none';
      }
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

        // Instant local counter increment for 0ms lag-free feedback
        setSessionStats(prev => ({
          ...prev,
          present: (prev.present || 0) + 1
        }));

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
                    try {
                      sessionStorage.setItem('smartpass_selected_event_id', newEventId);
                      localStorage.setItem('smartpass_selected_event_id', newEventId);
                    } catch (err) {}
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
                    if (sess) {
                      sessionStorage.setItem('selected_session_id', String(sess.id));
                    }
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

      {/* Prominent Current Target Banner for Scanner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(129, 140, 248, 0.15))',
        border: '1.5px solid rgba(99, 102, 241, 0.35)',
        borderRadius: '12px',
        padding: '10px 16px',
        marginBottom: '1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.25rem' }}>🎯</span>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Currently Scanning For:
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {currentEvent?.title || 'No Event'} — <span style={{ color: 'var(--primary)' }}>{activeSession?.day_label || activeSession?.title || 'No Day Selected'}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, background: 'var(--bg-card)', padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            Present: <strong style={{ color: 'var(--success)' }}>{sessionStats.present}</strong> / {sessionStats.total}
          </span>
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
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'var(--bg-card-hover)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)', userSelect: 'none' }} title="Automatically turn off camera as soon as a pass is scanned">
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
        <div className={`scanner-container ${isScanning ? 'scanner-active' : 'scanner-standby'}`} style={{ padding: '0.5rem 0', position: 'relative', minHeight: '320px' }}>
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
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'var(--primary-glow)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  color: 'var(--primary)',
                  boxShadow: '0 4px 14px var(--primary-glow)'
                }}
              >
                <Camera size={34} />
              </div>
              <h3 style={{ color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
                Camera Scanner Standby
              </h3>
              <p style={{ fontSize: '0.88rem', maxWidth: '360px', margin: 0, color: 'var(--text-muted)' }}>
                Click <strong style={{ color: 'var(--success)' }}>"▶ Start Camera Scanner"</strong> below to open camera.
              </p>
            </div>
          )}

          {/* Error Message if permission denied */}
          {cameraError && (
            <div
              style={{
                margin: '1rem',
                padding: '14px 16px',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: '10px',
                color: 'var(--text-main)',
                fontSize: '0.88rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, color: 'var(--danger)' }} />
                <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.92rem' }}>Camera Access Required</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                {cameraError}
              </div>
              <div style={{ marginTop: '4px', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => startScanner(cameraFacing)}
                  style={{
                    fontSize: '0.82rem',
                    padding: '8px 16px',
                    fontWeight: 600,
                    borderRadius: '8px'
                  }}
                >
                  <Play size={14} /> Allow Permission & Start Camera
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SCANNER CONTROLS BAR */}
        <div className="scanner-controls-bar">
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
                    background: 'var(--bg-card)',
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
                onClick={() => {
                  if (scanResult) setScanResult(null);
                  startScanner(cameraFacing);
                }}
                disabled={isStartingCamera}
                style={{
                  padding: '12px 24px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: scanResult ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
                  boxShadow: scanResult ? '0 4px 14px rgba(16, 185, 129, 0.4)' : undefined
                }}
              >
                <Play size={18} />
                <span>
                  {isStartingCamera
                    ? 'Opening Camera...'
                    : scanResult
                      ? '📸 Scan Next Pass (Camera On)'
                      : '▶ Start Camera Scanner'}
                </span>
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
                {scanResult.type === 'success' && <CheckCircle2 size={28} color="var(--success)" style={{ shrink: 0 }} />}
                {scanResult.type === 'duplicate' && <AlertTriangle size={28} color="var(--danger)" style={{ shrink: 0 }} />}
                {scanResult.type === 'error' && <XCircle size={28} color="var(--danger)" style={{ shrink: 0 }} />}

                <div style={{ flex: 1 }}>
                  <h4 style={{ color: scanResult.type === 'success' ? 'var(--success)' : (scanResult.type === 'loading' ? 'var(--primary)' : 'var(--danger)'), fontSize: '1.15rem', margin: '0 0 4px', fontWeight: 800 }}>
                    {scanResult.status_label}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-main)' }}>{scanResult.message}</p>
                  
                  {scanResult.student && (
                    <div style={{ marginTop: '10px', padding: '10px 14px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
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

