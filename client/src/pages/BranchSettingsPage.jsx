import React, { useState, useEffect } from 'react';
import { Wifi, Building2, MapPin, Save, Loader2, Trash2, Plus, Zap, MapPinned, Globe, Shield, Clock } from 'lucide-react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

const DEFAULT_DEPARTMENTS = [
  { name: 'IT Department',       note: 'Software & technical staff' },
  { name: 'HR Department',       note: 'Human resources team' },
  { name: 'Manager Head',        note: 'Directors & management (always full-day present)' },
  { name: 'Accounts Department', note: 'Accounts & finance team' },
  { name: 'Pharmacy',            note: 'Pharmacy staff' },
];

export default function BranchSettingsPage() {
  const { user } = useAuthStore();
  const canEdit = ['SUPER_ADMIN', 'DIRECTOR', 'HR'].includes(user?.role);
  const canEditTiming = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const canManageDepartments = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const [tab, setTab] = useState('network');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Office Settings</h1>
          <p className="page-subtitle">Main Branch · A-62, Sector 2, First Floor — network, departments &amp; attendance rules</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'network' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('network')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Wifi size={15} strokeWidth={2} /> WiFi & Location
        </button>
        <button className={`btn ${tab === 'departments' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('departments')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={15} strokeWidth={2} /> Departments
        </button>
        {canEditTiming && (
          <button className={`btn ${tab === 'attendance' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('attendance')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={15} strokeWidth={2} /> Attendance rules
          </button>
        )}
      </div>

      {tab === 'network'     && <NetworkTab canEdit={canEdit} />}
      {tab === 'departments' && <DepartmentsTab canEdit={canEdit} canManageDepartments={canManageDepartments} />}
      {tab === 'attendance'  && canEditTiming && <AttendanceTimingTab />}
    </div>
  );
}

function minsToTimeStr(m) {
  const h = Math.floor(m / 60) % 24;
  const mi = Math.floor(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

function timeStrToMins(s) {
  if (!s || typeof s !== 'string') return 0;
  const p = s.split(':');
  const h = parseInt(p[0], 10);
  const mi = parseInt(p[1], 10);
  if (Number.isNaN(h) || Number.isNaN(mi)) return 0;
  return Math.min(1439, Math.max(0, h * 60 + mi));
}

function AttendanceTimingTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [onTime, setOnTime] = useState('10:00');
  const [graceMin, setGraceMin] = useState(10);
  const [halfAfter, setHalfAfter] = useState('13:00');
  const [earlyOut, setEarlyOut] = useState('16:00');
  const [fullH, setFullH] = useState(8);

  const load = async () => {
    setLoading(true);
    setMsg('');
    try {
      const { data } = await api.get('/attendance/timing-config');
      const d = data.data;
      setOnTime(minsToTimeStr(d.onTimeCheckInMinutes));
      setGraceMin(d.gracePeriodMinutes);
      setHalfAfter(minsToTimeStr(d.halfDayCheckInAfterMinutes));
      setEarlyOut(minsToTimeStr(d.earlyCheckoutBeforeMinutes));
      setFullH(d.fullDayHours);
    } catch {
      setMsg('❌ Failed to load attendance timing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.patch('/attendance/timing-config', {
        onTimeCheckInMinutes: timeStrToMins(onTime),
        gracePeriodMinutes: Number(graceMin),
        halfDayCheckInAfterMinutes: timeStrToMins(halfAfter),
        earlyCheckoutBeforeMinutes: timeStrToMins(earlyOut),
        fullDayHours: Number(fullH),
      });
      setMsg('✅ Attendance timing saved. Applies to new check-ins and end-of-day evaluation.');
      load();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  const graceEnd = timeStrToMins(onTime) + Number(graceMin) || 0;

  return (
    <>
      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`}>{msg}</div>}

      <div className="card" style={{ marginBottom: 20, padding: '16px 20px', background: '#fffbeb', border: '1px solid #fde68a' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e', lineHeight: 1.6 }}>
          <strong><Clock size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 4 }} /> IST only (Asia/Kolkata)</strong>
          — Full day is always at least <strong>{fullH} hours</strong> worked between check-in and check-out. Check-in after the half-day threshold marks a tentative half day unless those hours are met. Checkout before the early threshold with fewer hours counts as half day.
        </p>
      </div>

      {loading ? (
        <div className="page-loading">Loading attendance rules…</div>
      ) : (
        <form className="card" style={{ padding: '22px 24px' }} onSubmit={save}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>Clock thresholds</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">On-time check-in (by)</label>
              <input className="form-input" type="time" required value={onTime} onChange={(e) => setOnTime(e.target.value)} />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>At or before this = on time.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Grace period (minutes)</label>
              <input className="form-input" type="number" min={0} max={180} required value={graceMin} onChange={(e) => setGraceMin(e.target.value)} />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>After on-time through {minsToTimeStr(graceEnd)} → still counted as grace (not late).</p>
            </div>
            <div className="form-group">
              <label className="form-label">Half-day if check-in after</label>
              <input className="form-input" type="time" required value={halfAfter} onChange={(e) => setHalfAfter(e.target.value)} />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Strictly after this minute = tentative half day (unless hours met).</p>
            </div>
            <div className="form-group">
              <label className="form-label">Early checkout (before)</label>
              <input className="form-input" type="time" required value={earlyOut} onChange={(e) => setEarlyOut(e.target.value)} />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Leaving before this with &lt; full hours → half day.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Full day (hours worked)</label>
              <input className="form-input" type="number" min={0.5} max={16} step={0.25} required value={fullH} onChange={(e) => setFullH(parseFloat(e.target.value) || 8)} />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Minimum hours for full day regardless of clock times.</p>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <button type="submit" className="btn btn--primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {saving ? <><Loader2 size={16} className="spin" /> Saving…</> : <><Save size={16} strokeWidth={2} /> Save attendance rules</>}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

/* ─── WiFi & Location Tab ──────────────────────────────────── */
function NetworkTab({ canEdit }) {
  const [branches, setBranches] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState('');
  const [working,  setWorking]  = useState(null);

  useEffect(() => { fetchBranches(); }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/branches');
      setBranches(data.data);
    } catch { setMsg('❌ Failed to load settings.'); }
    finally { setLoading(false); }
  };

  const addSSID = async (branchId, ssid) => {
    setWorking(branchId); setMsg('');
    try {
      const { data } = await api.post(`/branches/${branchId}/wifi-ssid`, { ssid });
      setBranches(prev => prev.map(b => b._id === branchId ? data.data : b));
      setMsg(`✅ WiFi "${ssid}" added.`);
    } catch (err) { setMsg('❌ ' + (err.response?.data?.message || 'Failed to add WiFi.')); }
    finally { setWorking(null); }
  };

  const removeSSID = async (branchId, ssid) => {
    setWorking(branchId + ssid); setMsg('');
    try {
      const { data } = await api.delete(`/branches/${branchId}/wifi-ssid`, { data: { ssid } });
      setBranches(prev => prev.map(b => b._id === branchId ? data.data : b));
      setMsg(`✅ WiFi "${ssid}" removed.`);
    } catch (err) { setMsg('❌ ' + (err.response?.data?.message || 'Failed to remove WiFi.')); }
    finally { setWorking(null); }
  };

  const saveGeoFence = async (branchId, geo) => {
    setWorking('geo-' + branchId); setMsg('');
    try {
      const { data } = await api.patch(`/branches/${branchId}`, geo);
      setBranches(prev => prev.map(b => b._id === branchId ? data.data : b));
      setMsg('✅ Geo-fence saved. GPS check is now active.');
    } catch (err) { setMsg('❌ ' + (err.response?.data?.message || 'Failed to save geo-fence.')); }
    finally { setWorking(null); }
  };

  const clearGeoFence = async (branchId) => {
    setWorking('geo-' + branchId); setMsg('');
    try {
      const { data } = await api.patch(`/branches/${branchId}`, { latitude: 0, longitude: 0, radiusMeters: 30 });
      setBranches(prev => prev.map(b => b._id === branchId ? data.data : b));
      setMsg('✅ Geo-fence cleared. GPS check disabled.');
    } catch { setMsg('❌ Failed to clear geo-fence.'); }
    finally { setWorking(null); }
  };

  const addIP = async (branchId, ip) => {
    setWorking('ip-' + branchId); setMsg('');
    try {
      const { data } = await api.post(`/branches/${branchId}/allowip`, { ip: ip.trim() });
      setBranches(prev => prev.map(b => b._id === branchId ? data.data : b));
      setMsg(`✅ IP "${ip.trim()}" added. Check-in now restricted to office network.`);
    } catch (err) { setMsg('❌ ' + (err.response?.data?.message || 'Failed to add IP.')); }
    finally { setWorking(null); }
  };

  const removeIP = async (branchId, ip) => {
    setWorking('ip-' + branchId + ip); setMsg('');
    try {
      const { data } = await api.delete(`/branches/${branchId}/allowip`, { data: { ip } });
      setBranches(prev => prev.map(b => b._id === branchId ? data.data : b));
      setMsg(`✅ IP "${ip}" removed.`);
    } catch (err) { setMsg('❌ ' + (err.response?.data?.message || 'Failed to remove IP.')); }
    finally { setWorking(null); }
  };

  const fetchMyIP = async () => {
    try {
      const { data } = await api.get('/branches/myip');
      return data?.ip || null;
    } catch { return null; }
  };

  return (
    <>
      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`}>{msg}</div>}

      <div className="card" style={{ marginBottom: 24, padding: '16px 20px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e40af' }}>
          <strong><Wifi size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Network verification for check-in:</strong>
        </p>
        <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.85rem', color: '#1e40af', lineHeight: 1.8 }}>
          <li><strong>Allowed IPs</strong> (recommended): Add your office public IP below. The server verifies the request comes from that IP — this is reliable and blocks check-in from home/other WiFi.</li>
          <li><strong>WiFi names</strong>: Add office WiFi SSIDs. Browsers cannot read the real WiFi name, so this is a soft check. Use <strong>Allowed IPs</strong> for real enforcement.</li>
          <li>Get your office IP by clicking &quot;Add My Current IP&quot; while connected to office WiFi.</li>
        </ol>
        <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#1e40af' }}>
          Leave both empty to allow check-in from any network.
        </p>
      </div>

      {loading && <div className="page-loading">Loading settings…</div>}

      {!loading && branches.map(branch => (
        <div key={branch._id} className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={16} strokeWidth={2} color="#2563eb" /> {branch.name}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
              {branch.address || 'No address set'}
            </p>
          </div>

          {/* WiFi SSIDs Section */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>
              <Wifi size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 2 }} /> Allowed WiFi Networks ({(branch.wifiSSIDs || []).length})
              {(branch.wifiSSIDs || []).length === 0 && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>— No restriction (all networks allowed)</span>}
            </p>
            {(branch.wifiSSIDs || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {branch.wifiSSIDs.map(ssid => (
                  <div key={ssid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                    <span style={{ display: 'flex', alignItems: 'center' }}><Wifi size={16} strokeWidth={2} color="#16a34a" /></span>
                    <span style={{ fontSize: '0.92rem', flex: 1, fontWeight: 600, color: '#111827' }}>{ssid}</span>
                    {canEdit && (
                      <button onClick={() => removeSSID(branch._id, ssid)} disabled={working === branch._id + ssid}
                        style={{ background: '#fee2e2', border: '1px solid #fca5a5', cursor: 'pointer', color: '#dc2626', fontSize: '0.78rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, lineHeight: 1 }}>Remove</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && <AddSSIDForm branchId={branch._id} onAdd={addSSID} working={working} existingSSIDs={branch.wifiSSIDs || []} />}
          </div>

          {/* Allowed IPs Section — server-side verification */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Globe size={14} strokeWidth={2} color="#059669" /> Allowed IPs ({(branch.allowedIPs || []).length})
              {(branch.allowedIPs || []).length > 0 && <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#059669', background: '#dcfce7', padding: '2px 8px', borderRadius: 8 }}>Enforced — blocks check-in from other networks</span>}
              {(branch.allowedIPs || []).length === 0 && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>— Add office IP for reliable verification</span>}
            </p>
            {(branch.allowedIPs || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(branch.allowedIPs || []).map(ip => (
                  <div key={ip} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#ecfdf5', borderRadius: 10, border: '1px solid #a7f3d0' }}>
                    <Shield size={16} strokeWidth={2} color="#059669" />
                    <span style={{ fontSize: '0.92rem', flex: 1, fontWeight: 600, fontFamily: 'monospace', color: '#111827' }}>{ip}</span>
                    {canEdit && (
                      <button onClick={() => removeIP(branch._id, ip)} disabled={working === 'ip-' + branch._id + ip}
                        style={{ background: '#fee2e2', border: '1px solid #fca5a5', cursor: 'pointer', color: '#dc2626', fontSize: '0.78rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, lineHeight: 1 }}>Remove</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {canEdit && <AddIPForm branchId={branch._id} onAdd={addIP} onFetchMyIP={fetchMyIP} working={working} existingIPs={branch.allowedIPs || []} />}
          </div>

          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
          <GeoFenceForm branch={branch} canEdit={canEdit}
            onSave={(geo) => saveGeoFence(branch._id, geo)}
            onClear={() => clearGeoFence(branch._id)}
            saving={working === 'geo-' + branch._id}
          />
        </div>
      ))}
    </>
  );
}

/* ─── Departments Tab ───────────────────────────────────────── */
function DepartmentsTab({ canEdit, canManageDepartments }) {
  const [depts,    setDepts]    = useState([]);
  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newName,  setNewName]  = useState('');
  const [newCode,  setNewCode]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [headSaving, setHeadSaving] = useState(null);

  useEffect(() => { fetchDepts(); }, []);
  useEffect(() => {
    if (!canManageDepartments) return;
    api.get('/users').then(({ data }) => setStaff(data.data || [])).catch(() => setStaff([]));
  }, [canManageDepartments]);

  const fetchDepts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/departments');
      setDepts(data.data);
    } catch { setMsg('❌ Failed to load departments.'); }
    finally { setLoading(false); }
  };

  const seedDefaults = async () => {
    setSaving(true); setMsg('');
    let created = 0;
    for (const dept of DEFAULT_DEPARTMENTS) {
      const exists = depts.find(d => d.name.toLowerCase() === dept.name.toLowerCase());
      if (!exists) {
        try { await api.post('/departments', { name: dept.name }); created++; } catch {}
      }
    }
    setMsg(created > 0 ? `✅ ${created} default department(s) created.` : '✅ All default departments already exist.');
    setSaving(false);
    fetchDepts();
  };

  const createDept = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true); setMsg('');
    try {
      await api.post('/departments', {
        name: newName.trim(),
        ...(newCode.trim() ? { code: newCode.trim().toUpperCase() } : {}),
      });
      setMsg(`✅ Department "${newName.trim()}" created.`);
      setNewName(''); setNewCode(''); setShowForm(false);
      fetchDepts();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to create department.'));
    } finally { setSaving(false); }
  };

  const deleteDept = async (dept) => {
    if (!window.confirm(`Deactivate department "${dept.name}"?`)) return;
    setDeleting(dept._id);
    try {
      await api.delete(`/departments/${dept._id}`);
      setMsg(`✅ "${dept.name}" deactivated.`);
      fetchDepts();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed.'));
    } finally { setDeleting(null); }
  };

  const missingDefaults = DEFAULT_DEPARTMENTS.filter(d => !depts.find(x => x.name.toLowerCase() === d.name.toLowerCase()));

  const saveHead = async (dept, headId) => {
    setHeadSaving(dept._id);
    setMsg('');
    try {
      await api.patch(`/departments/${dept._id}`, { head: headId || null });
      setMsg('✅ Head of department updated. They can assign daily tasks to their team.');
      fetchDepts();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to set head.'));
    } finally {
      setHeadSaving(null);
    }
  };

  const membersForDept = (deptId) => staff.filter((u) => {
    const did = u.department?._id || u.department;
    return did && String(did) === String(deptId);
  });

  return (
    <>
      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`}>{msg}</div>}

      {!canManageDepartments && canEdit && (
        <div className="card" style={{ marginBottom: 16, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.85rem', color: '#92400e' }}>
          Only <strong>Director</strong> and <strong>Super Admin</strong> can create departments and assign heads. HR can use WiFi &amp; Location here.
        </div>
      )}

      {/* Role mapping info */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <p style={{ margin: '0 0 10px', fontSize: '0.875rem', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={15} strokeWidth={2} color="#166534" /> Department → System Role Mapping</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))', gap: 8 }}>
          {DEFAULT_DEPARTMENTS.map(d => (
            <div key={d.name} style={{ padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #d1fae5' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#065f46' }}>{d.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>{d.note}</p>
            </div>
          ))}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#166534' }}>
          <strong>Manager Head</strong> employees use the <code>DIRECTOR</code> role — salary auto-calculated as full-present every month (no attendance required).
        </p>
        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#166534' }}>
          Set a <strong>Head of department</strong> below (must be an employee already assigned to that department). Heads assign daily tasks and view team progress under <strong>Daily Tasks</strong>.
        </p>
      </div>

      {canManageDepartments && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn btn--primary" onClick={() => { setShowForm(!showForm); setMsg(''); }}>
            {showForm ? '✕ Cancel' : '+ Add Department'}
          </button>
          {missingDefaults.length > 0 && (
            <button className="btn btn--secondary" onClick={seedDefaults} disabled={saving}>
              {saving ? 'Creating…' : `⚡ Add ${missingDefaults.length} Missing Default Dept${missingDefaults.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}

      {showForm && canManageDepartments && (
        <div className="card" style={{ marginBottom: 20, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 700 }}>New Department</h3>
          <form onSubmit={createDept} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Department Name *</label>
              <input className="form-input" required placeholder="e.g. Operations" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: '0 1 140px', minWidth: 100 }}>
              <label className="form-label">Code (optional)</label>
              <input className="form-input" placeholder="e.g. OPS" maxLength={12} value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} />
            </div>
            <button type="submit" className="btn btn--primary" disabled={saving || !newName.trim()}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </form>
        </div>
      )}

      {loading && <div className="page-loading">Loading departments…</div>}

      {!loading && depts.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Building2 size={40} strokeWidth={1.5} color="#9ca3af" /></div>
          <h3>No departments yet</h3>
          <p>Click below to set up IT, HR, Accounts, Pharmacy &amp; Manager Head departments.</p>
          {canManageDepartments && (
            <button className="btn btn--primary" onClick={seedDefaults} disabled={saving}>
              {saving ? 'Creating…' : '⚡ Create Default Departments'}
            </button>
          )}
        </div>
      )}

      {!loading && depts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 14 }}>
          {depts.map(dept => {
            const meta = DEFAULT_DEPARTMENTS.find(d => d.name.toLowerCase() === dept.name.toLowerCase());
            return (
              <div key={dept._id} className="card" style={{ padding: '16px 18px', marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--gray-900)' }}>
                      {dept.name}
                      {dept.code && (
                        <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 6 }}>{dept.code}</span>
                      )}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                      {meta?.note || 'Custom department'}
                    </p>
                    {canManageDepartments && (
                      <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Head of department</label>
                        <select
                          className="form-input"
                          style={{ fontSize: '0.88rem' }}
                          disabled={headSaving === dept._id}
                          value={dept.head?._id || ''}
                          onChange={(e) => saveHead(dept, e.target.value)}
                        >
                          <option value="">— None —</option>
                          {membersForDept(dept._id).map((u) => (
                            <option key={u._id} value={u._id}>{u.name} ({u.employeeId})</option>
                          ))}
                        </select>
                        {membersForDept(dept._id).length === 0 && (
                          <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: '#b45309' }}>Assign employees to this department in Employees first.</p>
                        )}
                      </div>
                    )}
                  </div>
                  {meta
                    ? <span style={{ fontSize: '0.7rem', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap' }}>Default</span>
                    : canManageDepartments && (
                      <button className="btn-tiny btn-tiny--red" disabled={deleting === dept._id} onClick={() => deleteDept(dept)}>
                        {deleting === dept._id ? '…' : 'Remove'}
                      </button>
                    )
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ─── Geo-fence Form ────────────────────────────────────────── */
function GeoFenceForm({ branch, canEdit, onSave, onClear, saving }) {
  const hasGeo = branch.latitude || branch.longitude;
  const [lat,    setLat]    = useState(hasGeo ? String(branch.latitude)  : '');
  const [lon,    setLon]    = useState(hasGeo ? String(branch.longitude) : '');
  const [radius, setRadius] = useState(String(branch.radiusMeters || 25));
  const [gpsMsg, setGpsMsg] = useState('');

  const useMyLocation = () => {
    if (!navigator.geolocation) { setGpsMsg('Geolocation not supported.'); return; }
    setGpsMsg('Getting location…');
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(8)); setLon(pos.coords.longitude.toFixed(8)); setGpsMsg(`Got location (±${Math.round(pos.coords.accuracy)}m accuracy)`); },
      () => setGpsMsg('Location denied. Enter coordinates manually.'),
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div>
      <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MapPin size={14} strokeWidth={2} style={{ flexShrink: 0 }} /> GPS Geo-fence
        {hasGeo
          ? <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 12 }}>Active — {branch.radiusMeters}m radius</span>
          : <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#6b7280' }}>— Not configured (GPS check disabled)</span>
        }
      </p>
      {hasGeo && (
        <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#6b7280', fontFamily: 'monospace' }}>
          Current: {branch.latitude?.toFixed(6)}, {branch.longitude?.toFixed(6)} · radius {branch.radiusMeters}m
        </p>
      )}
      {canEdit && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>Latitude</label>
              <input className="form-input" style={{ fontFamily: 'monospace', width: '100%', maxWidth: 160 }} placeholder="e.g. 28.58712734" value={lat} onChange={e => setLat(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>Longitude</label>
              <input className="form-input" style={{ fontFamily: 'monospace', width: '100%', maxWidth: 160 }} placeholder="e.g. 77.31566815" value={lon} onChange={e => setLon(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>Radius (m)</label>
              <input className="form-input" style={{ width: '100%', maxWidth: 90 }} type="number" min="10" max="500" value={radius} onChange={e => setRadius(e.target.value)} />
            </div>
            <button className="btn btn--secondary" onClick={useMyLocation} style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}><MapPinned size={14} strokeWidth={2} /> Use My GPS</button>
            <button className="btn btn--primary" onClick={() => onSave({ latitude: parseFloat(lat), longitude: parseFloat(lon), radiusMeters: parseInt(radius) })} disabled={!lat || !lon || saving} style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              {saving ? <><Loader2 size={14} className="spin" /> Saving…</> : <><Save size={14} strokeWidth={2} /> Save Geo-fence</>}
            </button>
            {hasGeo && <button className="btn btn--danger" onClick={onClear} disabled={saving} style={{ fontSize: '0.82rem' }}>✕ Disable</button>}
          </div>
          {gpsMsg && <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#374151' }}>{gpsMsg}</p>}
        </>
      )}
      <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
        For indoor offices, 25–30m radius is recommended. GPS accuracy in buildings is typically ±10–20m.
      </p>
    </div>
  );
}

/* ─── Add WiFi SSID Form ───────────────────────────────────── */
function AddSSIDForm({ branchId, onAdd, working, existingSSIDs }) {
  const [showForm,  setShowForm]  = useState(false);
  const [ssidInput, setSsidInput] = useState('');

  const handleAdd = () => {
    const trimmed = ssidInput.trim();
    if (!trimmed) return;
    if (existingSSIDs.some(s => s.toLowerCase() === trimmed.toLowerCase())) return;
    onAdd(branchId, trimmed);
    setSsidInput(''); setShowForm(false);
  };

  if (!showForm) return (
    <button className="btn btn--primary" style={{ marginTop: 12, fontSize: '0.82rem' }} onClick={() => setShowForm(true)}>
      + Add WiFi Network
    </button>
  );

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        className="form-input" style={{ maxWidth: 260 }}
        placeholder="Enter WiFi name (SSID) e.g. OfficeWiFi-5G"
        value={ssidInput} onChange={e => setSsidInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
      />
      <button className="btn btn--primary" onClick={handleAdd} disabled={!ssidInput.trim() || working === branchId}>Add</button>
      <button className="btn btn--secondary" onClick={() => { setShowForm(false); setSsidInput(''); }}>Cancel</button>
    </div>
  );
}

/* ─── Add IP Form ───────────────────────────────────────────── */
function AddIPForm({ branchId, onAdd, onFetchMyIP, working, existingIPs }) {
  const [showForm, setShowForm] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [fetching, setFetching] = useState(false);

  const handleAddMyIP = async () => {
    setFetching(true);
    try {
      const ip = await onFetchMyIP();
      if (ip && !existingIPs.includes(ip)) {
        onAdd(branchId, ip);
        setShowForm(false);
      } else if (ip && existingIPs.includes(ip)) {
        alert('This IP is already in the list.');
      } else {
        alert('Could not fetch your IP.');
      }
    } finally { setFetching(false); }
  };

  const handleAdd = () => {
    const trimmed = ipInput.trim();
    if (!trimmed) return;
    if (existingIPs.includes(trimmed)) return;
    onAdd(branchId, trimmed);
    setIpInput(''); setShowForm(false);
  };

  if (!showForm) return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
      <button className="btn btn--primary" style={{ fontSize: '0.82rem' }} onClick={handleAddMyIP} disabled={fetching}>
        {fetching ? <><Loader2 size={14} className="spin" /> Getting IP…</> : <><Globe size={14} strokeWidth={2} /> Add My Current IP</>}
      </button>
      <button className="btn btn--secondary" style={{ fontSize: '0.82rem' }} onClick={() => setShowForm(true)}>+ Add IP manually</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        className="form-input" style={{ maxWidth: 180, fontFamily: 'monospace' }}
        placeholder="e.g. 203.0.113.45"
        value={ipInput} onChange={e => setIpInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
      />
      <button className="btn btn--primary" onClick={handleAdd} disabled={!ipInput.trim() || working === 'ip-' + branchId}>Add</button>
      <button className="btn btn--secondary" onClick={() => { setShowForm(false); setIpInput(''); }}>Cancel</button>
    </div>
  );
}
