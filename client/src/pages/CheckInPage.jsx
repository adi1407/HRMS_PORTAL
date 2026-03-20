import React, { useState, useEffect, useRef } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';
import {
  MapPin, Wifi, CheckCircle2, XCircle, RotateCcw,
  Loader2, AlertTriangle, Timer, LogIn, LogOut,
} from 'lucide-react';

export default function CheckInPage() {
  const { user } = useAuthStore();
  const isHR = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);

  const [todayRecord, setTodayRecord] = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [result,      setResult]      = useState(null);

  // GPS state
  const [geoCoords,  setGeoCoords]  = useState(null);
  const [geoStatus,  setGeoStatus]  = useState('getting');
  const [geoMessage, setGeoMessage] = useState('Getting your location...');

  // WiFi state
  const [wifiSSID,        setWifiSSID]        = useState('');
  const [wifiStatus,      setWifiStatus]      = useState('pending');
  const [branchSSIDs,     setBranchSSIDs]     = useState([]);
  const [isOnWifi,        setIsOnWifi]        = useState(null);

  // Attendance request state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestMsg,      setRequestMsg]      = useState('');
  const [requestSending,  setRequestSending]  = useState(false);
  const [requestSent,     setRequestSent]     = useState(false);

  // HR view
  const [pendingRequests, setPendingRequests] = useState([]);
  const [overrideForm,    setOverrideForm]    = useState({});
  const [resolving,       setResolving]       = useState({});

  // Refs that mirror state — used inside async callbacks to avoid stale closures
  const todayRecordRef = useRef(null);
  const geoCoordsRef   = useRef(null);
  const wifiSSIDRef    = useRef('');
  const userRef        = useRef(user);

  useEffect(() => { todayRecordRef.current = todayRecord; }, [todayRecord]);
  useEffect(() => { geoCoordsRef.current   = geoCoords;   }, [geoCoords]);
  useEffect(() => { wifiSSIDRef.current    = wifiSSID;    }, [wifiSSID]);
  useEffect(() => { userRef.current        = user;        }, [user]);

  useEffect(() => {
    fetchTodayRecord();
    startGeoCheck();
    loadBranchWifi();
    detectWifiConnection();
    if (isHR) fetchPendingRequests();
  }, []);

  /* ── GPS ──────────────────────────────────────────────────── */
  const startGeoCheck = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      setGeoMessage('Geolocation not supported by your browser.');
      return;
    }
    setGeoStatus('getting');
    setGeoMessage('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoStatus('success');
        setGeoMessage(`Location obtained (±${Math.round(pos.coords.accuracy)}m accuracy)`);
      },
      (err) => {
        setGeoStatus(err.code === 1 ? 'denied' : 'error');
        setGeoMessage(err.code === 1
          ? 'Location access denied. Enable GPS in browser settings.'
          : 'Could not get location. Check GPS signal and retry.');
      },
      { timeout: 15000, maximumAge: 30000, enableHighAccuracy: true }
    );
  };

  const loadBranchWifi = async () => {
    try {
      const branchId = user?.branch?._id || user?.branch;
      if (!branchId) return;
      const { data } = await api.get('/branches');
      const branch = (data.data || []).find(b => b._id === branchId);
      if (branch?.wifiSSIDs?.length > 0) {
        setBranchSSIDs(branch.wifiSSIDs);
        // Do NOT auto-fill — user must explicitly select (browsers can't verify real SSID)
        setWifiStatus(branch.wifiSSIDs.length === 1 ? 'choose' : 'choose');
      } else {
        setWifiStatus('none');
      }
    } catch {}
  };

  const detectWifiConnection = () => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      setIsOnWifi(conn.type === 'wifi');
    }
  };

  const fetchTodayRecord = async () => {
    try {
      const { data } = await api.get('/attendance/today');
      setTodayRecord(data.data);
    } catch {}
  };

  /* ── Attendance Requests ─────────────────────────────────── */
  const fetchPendingRequests = async () => {
    try {
      const { data } = await api.get('/attendance/requests');
      setPendingRequests(data.data || []);
    } catch {}
  };

  const submitRequest = async () => {
    if (!requestMsg.trim()) return;
    setRequestSending(true);
    try {
      await api.post('/attendance/request', { message: requestMsg.trim() });
      setRequestSent(true);
      setShowRequestForm(false);
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Failed to send request to HR.' });
    } finally { setRequestSending(false); }
  };

  const resolveRequest = async (req) => {
    const form   = overrideForm[req._id] || {};
    const status = form.status || 'FULL_DAY';
    const note   = form.note?.trim() || 'Resolved via attendance request';
    setResolving(r => ({ ...r, [req._id]: true }));
    try {
      await api.post('/attendance/manual', { employeeId: req.employee._id, date: req.date, status, notes: note });
      await api.patch(`/attendance/requests/${req._id}/resolve`, { note });
      setPendingRequests(prev => prev.filter(r => r._id !== req._id));
      setResult({ success: true, message: `Attendance marked as ${status.replace(/_/g, ' ')} for ${req.employee.name}.` });
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Failed to resolve request.' });
    } finally { setResolving(r => ({ ...r, [req._id]: false })); }
  };

  const dismissRequest = async (reqId) => {
    try {
      await api.patch(`/attendance/requests/${reqId}/resolve`, { note: 'Dismissed by HR' });
      setPendingRequests(prev => prev.filter(r => r._id !== reqId));
    } catch {}
  };

  const handleSubmitAttendance = async () => {
    setSubmitting(true);
    const record   = todayRecordRef.current;
    const coords   = geoCoordsRef.current;
    const ssid     = wifiSSIDRef.current;
    const currentUser = userRef.current;
    const action   = record?.checkInTime ? 'checkout' : 'checkin';
    const endpoint = action === 'checkin' ? '/attendance/checkin' : '/attendance/checkout';
    try {
      const { data } = await api.post(endpoint, {
        branchId:       currentUser?.branch?._id || currentUser?.branch,
        lat: coords?.lat ?? null,
        lon: coords?.lon ?? null,
        wifiSSID: ssid || undefined,
      });
      setResult({ success: true, message: data.data?.message, action });
      fetchTodayRecord();
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Request failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const alreadyCheckedIn  = todayRecord?.checkInTime;
  const alreadyCheckedOut = todayRecord?.checkOutTime;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Attendance Check In / Out</h1>
        <p className="page-subtitle">
          {alreadyCheckedIn && !alreadyCheckedOut
            ? 'Look at the camera to check out'
            : alreadyCheckedIn && alreadyCheckedOut
              ? 'Attendance complete for today'
              : 'Look at the camera to check in'}
        </p>
      </div>

      {result && (
        <div className={`alert ${result.success ? 'alert--success' : 'alert--error'}`}>
          {result.success
            ? <CheckCircle2 size={15} strokeWidth={2.5} />
            : <AlertTriangle size={15} strokeWidth={2.5} />}
          {result.message}
        </div>
      )}

      {todayRecord && (
        <div className="today-summary-bar">
          <span>Today: <strong>{todayRecord.displayStatus?.replace(/_/g, ' ')}</strong></span>
          {todayRecord.checkInTime && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle2 size={13} color="#059669" strokeWidth={2.5} />
              In: <strong>{todayRecord.checkInTime}</strong>
            </span>
          )}
          {todayRecord.checkOutTime && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <XCircle size={13} color="#dc2626" strokeWidth={2.5} />
              Out: <strong>{todayRecord.checkOutTime}</strong>
            </span>
          )}
          {todayRecord.workingHours > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Timer size={13} strokeWidth={2.5} />
              {todayRecord.workingHours}h worked
            </span>
          )}
        </div>
      )}

      {!(alreadyCheckedIn && alreadyCheckedOut) && (
        <div className="checkin-grid">

          {/* Step 1: GPS Location */}
          <div className="checkin-step-card">
            <div className="checkin-step-header">
              <div className="checkin-step-num">1</div>
              <h3>GPS Location</h3>
            </div>
            <p className="checkin-step-desc">
              Your location is verified to confirm you are <strong>at the office</strong>.
            </p>
            <div
              className={`status-indicator status-indicator--${
                geoStatus === 'success' ? 'success' : geoStatus === 'getting' ? 'checking' : 'error'
              }`}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              {geoStatus === 'getting' && <><Loader2 size={14} className="spin-icon" /> {geoMessage}</>}
              {geoStatus === 'success' && <><MapPin size={14} /> {geoMessage}</>}
              {(geoStatus === 'denied' || geoStatus === 'error') && <><XCircle size={14} /> {geoMessage}</>}
            </div>
            {(geoStatus === 'denied' || geoStatus === 'error') && (
              <button className="btn btn--secondary" style={{ marginTop: 10 }} onClick={startGeoCheck}>
                <RotateCcw size={14} strokeWidth={2.5} /> Retry Location
              </button>
            )}
          </div>

          {/* Step 2: Office WiFi */}
          <div className="checkin-step-card">
            <div className="checkin-step-header">
              <div className="checkin-step-num">2</div>
              <h3>Office WiFi</h3>
            </div>
            <p className="checkin-step-desc">
              Connect to the <strong>office WiFi</strong> and select the network below.
            </p>

            {wifiStatus === 'none' && (
              <div className="status-indicator status-indicator--success" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Wifi size={14} /> No WiFi restriction configured — you can check in from any network.
              </div>
            )}

            {branchSSIDs.length > 0 && (
              <>
                {isOnWifi === false && (
                  <div className="status-indicator status-indicator--error" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <XCircle size={14} /> You appear to be on mobile data. Switch to the office WiFi.
                  </div>
                )}

                {branchSSIDs.length === 1 ? (
                  <div>
                    <p style={{ fontSize: '0.82rem', color: '#374151', marginBottom: 8 }}>Connect to office WiFi, then tap below:</p>
                    <button
                      type="button"
                      onClick={() => { setWifiSSID(branchSSIDs[0]); setWifiStatus('selected'); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10,
                        border: wifiSSID === branchSSIDs[0] ? '2px solid #059669' : '1px solid #e5e7eb',
                        background: wifiSSID === branchSSIDs[0] ? '#f0fdf4' : '#fff',
                        cursor: 'pointer', textAlign: 'left', fontSize: '0.88rem', fontWeight: 600, width: '100%',
                      }}
                    >
                      <Wifi size={18} color={wifiSSID === branchSSIDs[0] ? '#059669' : '#94a3b8'} />
                      {branchSSIDs[0]}
                      {wifiSSID === branchSSIDs[0] && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', background: '#dcfce7', color: '#059669', padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>Selected</span>}
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.82rem', color: '#374151', fontWeight: 600, marginBottom: 8 }}>Select the WiFi you're connected to:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {branchSSIDs.map(ssid => (
                        <button
                          key={ssid}
                          type="button"
                          onClick={() => { setWifiSSID(ssid); setWifiStatus('selected'); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', borderRadius: 10,
                            border: wifiSSID === ssid ? '2px solid #059669' : '1px solid #e5e7eb',
                            background: wifiSSID === ssid ? '#f0fdf4' : '#fff',
                            cursor: 'pointer', textAlign: 'left', fontSize: '0.88rem', fontWeight: 600,
                          }}
                        >
                          <Wifi size={16} color={wifiSSID === ssid ? '#059669' : '#94a3b8'} />
                          {ssid}
                          {wifiSSID === ssid && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', background: '#dcfce7', color: '#059669', padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>Connected</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 8 }}>
                  If rejected, switch from mobile data to office WiFi and try again.
                </p>
              </>
            )}
          </div>

          {/* Step 3: Confirm attendance */}
          <div className="checkin-step-card">
            <div className="checkin-step-header">
              <div className="checkin-step-num">3</div>
              <h3>Confirm Attendance</h3>
            </div>
            <p className="checkin-step-desc">
              Face recognition is disabled. Attendance is now verified using office WiFi and GPS.
            </p>
            {branchSSIDs.length > 0 && !wifiSSID && (
              <p className="checkin-warning" style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                <AlertTriangle size={13} strokeWidth={2.5} /> Select your office WiFi above before checking in.
              </p>
            )}
            {geoStatus !== 'success' && (
              <p className="checkin-warning" style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                <AlertTriangle size={13} strokeWidth={2.5} /> Enable GPS and retry location before checking in.
              </p>
            )}
            <button
              className="btn btn--primary"
              onClick={handleSubmitAttendance}
              disabled={submitting || (branchSSIDs.length > 0 && !wifiSSID) || geoStatus !== 'success'}
            >
              {submitting ? <Loader2 size={15} className="spin-icon" /> : null}
              {alreadyCheckedIn ? 'Check Out Now' : 'Check In Now'}
            </button>
          </div>
        </div>
      )}

      {/* Completed state */}
      {alreadyCheckedIn && alreadyCheckedOut && (
        <div className="checkin-actions">
          <div className="checkin-done">
            <CheckCircle2 size={36} color="#059669" strokeWidth={2} style={{ marginBottom: 10 }} />
            <p>Attendance complete for today.</p>
            <p style={{ marginTop: 6 }}>
              <LogIn size={13} style={{ verticalAlign: 'middle' }} /> Checked in: <strong>{todayRecord.checkInTime}</strong>
              &nbsp;&nbsp;
              <LogOut size={13} style={{ verticalAlign: 'middle' }} /> Checked out: <strong>{todayRecord.checkOutTime}</strong>
            </p>
          </div>
        </div>
      )}

      {/* ── Employee: Report issue to HR ── */}
      {!isHR && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <h3 className="card-title" style={{ margin: 0 }}>Having trouble checking in?</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
                Send a message to HR — they will mark your attendance manually.
              </p>
            </div>
            {!requestSent && (
              <button className="btn btn--secondary" onClick={() => setShowRequestForm(f => !f)}>
                {showRequestForm ? 'Cancel' : 'Report to HR'}
              </button>
            )}
          </div>

          {requestSent && (
            <div className="alert alert--success" style={{ marginTop: 12 }}>
              <CheckCircle2 size={15} strokeWidth={2.5} /> Your message was sent to HR.
            </div>
          )}

          {showRequestForm && !requestSent && (
            <div style={{ marginTop: 14 }}>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Describe the issue — e.g. camera not detecting face, etc."
                value={requestMsg}
                onChange={e => setRequestMsg(e.target.value)}
                style={{ resize: 'vertical', width: '100%' }}
              />
              <button
                className="btn btn--primary"
                style={{ marginTop: 8 }}
                onClick={submitRequest}
                disabled={requestSending || !requestMsg.trim()}
              >
                {requestSending ? 'Sending...' : 'Send to HR'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── HR: Pending attendance requests ── */}
      {isHR && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              Attendance Requests
              {pendingRequests.length > 0 && (
                <span style={{ marginLeft: 8, background: '#ef4444', color: '#fff', fontSize: '0.72rem', padding: '1px 8px', borderRadius: 99, fontWeight: 700 }}>
                  {pendingRequests.length}
                </span>
              )}
            </h3>
            <button className="btn btn--secondary" style={{ fontSize: '0.8rem', padding: '5px 12px' }} onClick={fetchPendingRequests}>
              <RotateCcw size={13} strokeWidth={2.5} /> Refresh
            </button>
          </div>

          {pendingRequests.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.88rem' }}>No pending requests.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pendingRequests.map(req => (
                <div key={req._id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <p style={{ fontWeight: 600, margin: 0 }}>
                        {req.employee.name}
                        <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.82rem', marginLeft: 6 }}>
                          ({req.employee.employeeId})
                        </span>
                      </p>
                      {req.employee.designation && (
                        <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '2px 0 0' }}>{req.employee.designation}</p>
                      )}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                      {new Date(req.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </div>

                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#f1f5f9', borderRadius: 8, fontSize: '0.88rem', color: '#374151', borderLeft: '3px solid #3b82f6' }}>
                    {req.message}
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      className="form-select"
                      style={{ width: 'auto', flex: '0 0 auto' }}
                      value={overrideForm[req._id]?.status || 'FULL_DAY'}
                      onChange={e => setOverrideForm(f => ({ ...f, [req._id]: { ...f[req._id], status: e.target.value } }))}
                    >
                      <option value="FULL_DAY">Full Day</option>
                      <option value="HALF_DAY">Half Day</option>
                      <option value="ABSENT">Absent</option>
                      <option value="ON_LEAVE">On Leave</option>
                    </select>
                    <input
                      className="form-input"
                      style={{ flex: 1, minWidth: 160 }}
                      placeholder="Reason / note (required)"
                      value={overrideForm[req._id]?.note || ''}
                      onChange={e => setOverrideForm(f => ({ ...f, [req._id]: { ...f[req._id], note: e.target.value } }))}
                    />
                    <button
                      className="btn btn--primary"
                      style={{ flex: '0 0 auto' }}
                      disabled={resolving[req._id] || !overrideForm[req._id]?.note?.trim()}
                      onClick={() => resolveRequest(req)}
                    >
                      {resolving[req._id] ? 'Saving...' : 'Mark & Resolve'}
                    </button>
                    <button
                      className="btn btn--secondary"
                      style={{ flex: '0 0 auto' }}
                      disabled={resolving[req._id]}
                      onClick={() => dismissRequest(req._id)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
