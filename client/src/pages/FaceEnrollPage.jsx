import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const MIN_SAMPLES = 3;
const MAX_SAMPLES = 5;

export default function FaceEnrollPage() {
  const { empId } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee]           = useState(null);
  const [loadingEmp, setLoadingEmp]       = useState(true);

  const [modelStatus, setModelStatus]     = useState('idle'); // idle | loading | ready | error
  const [modelMsg, setModelMsg]           = useState('');

  const [cameraOn, setCameraOn]           = useState(false);
  const [descriptors, setDescriptors]     = useState([]);
  const [capturing, setCapturing]         = useState(false);
  const [captureMsg, setCaptureMsg]       = useState('');

  const [submitting, setSubmitting]       = useState(false);
  const [result, setResult]               = useState(null);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fapiRef   = useRef(null);

  useEffect(() => {
    fetchEmployee();
    return () => stopCamera();
  }, [empId]);

  const fetchEmployee = async () => {
    setLoadingEmp(true);
    try {
      const { data } = await api.get(`/face/status/${empId}`);
      setEmployee(data.data);
    } catch {
      setEmployee(null);
    } finally {
      setLoadingEmp(false);
    }
  };

  /* ── Model & Camera ─────────────────────────────────── */
  const loadModels = async () => {
    setModelStatus('loading');
    setModelMsg('Loading face recognition models...');
    setResult(null);
    try {
      const faceapi = window.faceapi;
      if (!faceapi) throw new Error('face-api.js script not loaded. Refresh the page and try again.');
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      fapiRef.current = faceapi;
      setModelStatus('ready');
      setModelMsg('Models loaded. Starting camera...');
      await startCamera();
    } catch (err) {
      setModelStatus('error');
      setModelMsg(`Failed to load models: ${err.message}`);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      streamRef.current = stream;
      // Make video element visible BEFORE assigning srcObject so the browser
      // can decode frames (browsers silently drop frames for hidden elements).
      setCameraOn(true);
      setModelMsg('Camera ready.');
      setCaptureMsg("Position the employee's face in the frame, then click Capture Sample.");
      await new Promise(r => setTimeout(r, 50)); // wait for React to paint
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (playErr) {
          console.warn('[FaceEnroll] play() failed:', playErr);
        }
      }
    } catch (err) {
      setModelStatus('error');
      setModelMsg('Camera access denied. Allow camera permission and try again.');
      console.error('[FaceEnroll] startCamera error:', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  };

  /* ── Capture ────────────────────────────────────────── */
  const captureDescriptor = async () => {
    const faceapi = fapiRef.current;
    if (!faceapi || !videoRef.current) return;
    setCapturing(true);
    setCaptureMsg('Detecting face...');
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setCaptureMsg('No face detected. Center the face clearly in the frame and try again.');
        setCapturing(false);
        return;
      }

      // Draw bounding box
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const { x, y, width, height } = detection.detection.box;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 800);
      }

      const descriptor = Array.from(detection.descriptor);
      setDescriptors(prev => {
        const updated = [...prev, descriptor];
        const remaining = MIN_SAMPLES - updated.length;
        if (remaining > 0) {
          setCaptureMsg(`Sample ${updated.length} captured. Need ${remaining} more minimum. Ask the employee to slightly turn their head.`);
        } else {
          setCaptureMsg(`${updated.length} samples captured. You can enroll now or capture up to ${MAX_SAMPLES} for better accuracy.`);
        }
        return updated;
      });
    } catch (err) {
      console.error('[FaceEnroll] capture error:', err);
      setCaptureMsg('Capture failed. Try again.');
    }
    setCapturing(false);
  };

  /* ── Enroll / Remove ────────────────────────────────── */
  const handleEnroll = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      await api.post(`/face/enroll/${empId}`, { descriptors });
      setResult({ success: true, message: `Face enrolled successfully with ${descriptors.length} samples.` });
      stopCamera();
      setDescriptors([]);
      setModelStatus('idle');
      setModelMsg('');
      setCaptureMsg('');
      fetchEmployee();
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Enrollment failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove face enrollment for ${employee?.name}? They will not be able to check in until re-enrolled.`)) return;
    setSubmitting(true);
    setResult(null);
    try {
      await api.delete(`/face/enroll/${empId}`);
      setResult({ success: true, message: 'Face enrollment removed.' });
      fetchEmployee();
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Failed to remove enrollment.' });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render ─────────────────────────────────────────── */
  if (loadingEmp) {
    return <div className="page"><div className="page-loading">Loading employee...</div></div>;
  }

  if (!employee) {
    return (
      <div className="page">
        <div className="alert alert--error">Employee not found.</div>
        <button className="btn btn--secondary" onClick={() => navigate('/employees')}>← Back to Employees</button>
      </div>
    );
  }

  const canEnroll  = descriptors.length >= MIN_SAMPLES && !submitting;
  const canCapture = cameraOn && !capturing && descriptors.length < MAX_SAMPLES;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn--secondary" onClick={() => { stopCamera(); navigate('/employees'); }}>
            ← Back
          </button>
          <div>
            <h1 className="page-title">Face Enrollment</h1>
            <p className="page-subtitle">Register employee face for attendance verification</p>
          </div>
        </div>
      </div>

      {result && (
        <div className={`alert ${result.success ? 'alert--success' : 'alert--error'}`}>
          {result.message}
        </div>
      )}

      {/* Employee info bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: '1rem', margin: 0 }}>
              {employee.name} &nbsp;
              <span className="role-badge">{employee.employeeId}</span>
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: employee.faceEnrolled ? '#16a34a' : '#dc2626' }}>
              {employee.faceEnrolled
                ? `Face enrolled on ${new Date(employee.faceEnrolledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'No face enrolled yet'}
            </p>
          </div>
          {employee.faceEnrolled && (
            <button className="btn btn--danger" onClick={handleRemove} disabled={submitting}>
              Remove Enrollment
            </button>
          )}
        </div>
      </div>

      <div className="checkin-grid">
        {/* Step 1 — Camera */}
        <div className="checkin-step-card">
          <div className="checkin-step-header">
            <div className="checkin-step-num">1</div>
            <h3>Start Camera</h3>
          </div>
          <p className="checkin-step-desc">
            Load AI models and open the camera. Make sure the employee is present in front of the screen.
          </p>

          {modelStatus !== 'idle' && (
            <div className={`status-indicator status-indicator--${
              modelStatus === 'ready' ? 'success' : modelStatus === 'error' ? 'error' : 'checking'
            }`}>
              {modelStatus === 'loading' && '⏳ '}{modelStatus === 'error' && '❌ '}{modelStatus === 'ready' && '✅ '}
              {modelMsg}
            </div>
          )}

          <div className="face-video-wrapper" style={{ position: 'relative', marginTop: '12px', display: cameraOn ? 'block' : 'none' }}>
            <video ref={videoRef} className="face-video" muted playsInline autoPlay />
            <canvas ref={canvasRef} className="face-canvas" width={320} height={240} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {(modelStatus === 'idle' || modelStatus === 'error') && (
              <button className="btn btn--secondary" onClick={loadModels}>
                {modelStatus === 'error' ? '🔄 Retry' : '📷 Start Camera'}
              </button>
            )}
            {cameraOn && (
              <button className="btn btn--secondary" onClick={stopCamera}>Stop Camera</button>
            )}
          </div>
        </div>

        {/* Step 2 — Capture */}
        <div className="checkin-step-card">
          <div className="checkin-step-header">
            <div className="checkin-step-num">2</div>
            <h3>Capture Samples</h3>
          </div>
          <p className="checkin-step-desc">
            Capture <strong>{MIN_SAMPLES}–{MAX_SAMPLES} samples</strong> from slightly different angles for better accuracy.
          </p>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '10px', margin: '12px 0' }}>
            {Array.from({ length: MAX_SAMPLES }, (_, i) => (
              <div
                key={i}
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: descriptors.length > i ? '#22c55e' : '#e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: descriptors.length > i ? '#fff' : '#9ca3af',
                  fontSize: 14, fontWeight: 700,
                  border: i === MIN_SAMPLES - 1 ? '2px dashed #6b7280' : 'none',
                  transition: 'background 0.2s',
                }}
              >
                {descriptors.length > i ? '✓' : i + 1}
              </div>
            ))}
          </div>

          {captureMsg && (
            <div className={`status-indicator status-indicator--${descriptors.length >= MIN_SAMPLES ? 'success' : 'checking'}`}>
              {captureMsg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            <button
              className="btn btn--secondary"
              onClick={captureDescriptor}
              disabled={!canCapture}
            >
              {capturing ? '⏳ Detecting...' : `📸 Capture Sample (${descriptors.length}/${MAX_SAMPLES})`}
            </button>

            {descriptors.length > 0 && (
              <button
                className="btn btn--secondary"
                onClick={() => { setDescriptors([]); setCaptureMsg('Samples cleared. Start capturing again.'); }}
                disabled={capturing || submitting}
              >
                Clear Samples
              </button>
            )}

            <button
              className="btn btn--primary"
              onClick={handleEnroll}
              disabled={!canEnroll}
            >
              {submitting ? 'Enrolling...' : `Enroll Face (${descriptors.length} samples)`}
            </button>

            {descriptors.length < MIN_SAMPLES && (
              <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: 0, textAlign: 'center' }}>
                Need at least {MIN_SAMPLES} samples to enroll
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
