import React, { useState, useEffect } from 'react';
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
  const [tab, setTab] = useState('network');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Office Settings</h1>
          <p className="page-subtitle">Main Branch · A-62, Sector 2, First Floor — network &amp; department configuration</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'network' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('network')}>
          📶 Network / IP Settings
        </button>
        <button className={`btn ${tab === 'departments' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('departments')}>
          🏢 Departments
        </button>
      </div>

      {tab === 'network'     && <NetworkTab canEdit={canEdit} />}
      {tab === 'departments' && <DepartmentsTab canEdit={canEdit} />}
    </div>
  );
}

/* ─── Network / IP Tab ──────────────────────────────────────── */
function NetworkTab({ canEdit }) {
  const [branches,   setBranches]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [myIP,       setMyIP]       = useState(null);
  const [mySubnet,   setMySubnet]   = useState(null);
  const [isLoopback, setIsLoopback] = useState(false);
  const [msg,        setMsg]        = useState('');
  const [working,    setWorking]    = useState(null);

  useEffect(() => { fetchBranches(); fetchMyIP(); }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/branches');
      setBranches(data.data);
    } catch { setMsg('❌ Failed to load office network settings.'); }
    finally { setLoading(false); }
  };

  const fetchMyIP = async () => {
    try {
      const { data } = await api.get('/branches/myip');
      setMyIP(data.ip); setMySubnet(data.subnet); setIsLoopback(data.isLoopback || false);
    } catch {}
  };

  const addIP = async (branchId, ip) => {
    setWorking(branchId); setMsg('');
    try {
      const { data } = await api.post(`/branches/${branchId}/allowip`, { ip });
      setBranches(prev => prev.map(b => b._id === branchId ? data.data : b));
      setMsg(`✅ IP ${ip} added to allowed list.`);
    } catch (err) { setMsg('❌ ' + (err.response?.data?.message || 'Failed to add IP.')); }
    finally { setWorking(null); }
  };

  const removeIP = async (branchId, ip) => {
    setWorking(branchId + ip); setMsg('');
    try {
      const { data } = await api.delete(`/branches/${branchId}/allowip`, { data: { ip } });
      setBranches(prev => prev.map(b => b._id === branchId ? data.data : b));
      setMsg(`✅ IP ${ip} removed.`);
    } catch (err) { setMsg('❌ ' + (err.response?.data?.message || 'Failed to remove IP.')); }
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

  return (
    <>
      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`}>{msg}</div>}

      <div className="card" style={{ marginBottom: 24, padding: '16px 20px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e40af' }}>
          <strong>📶 How WiFi-based check-in works:</strong> All devices on your office WiFi share the same local network (e.g.&nbsp;<code>192.168.0.x</code>).
          Add the <strong>network prefix</strong> (e.g.&nbsp;<code>192.168.0.</code>) to allow all office devices. Leave empty to allow from anywhere.
        </p>
        {myIP && !isLoopback && (
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#1e40af' }}>
            Your IP: <strong style={{ fontFamily: 'monospace' }}>{myIP}</strong>
            {mySubnet && <> · Office network prefix: <strong style={{ fontFamily: 'monospace' }}>{mySubnet}</strong></>}
          </p>
        )}
        {isLoopback && (
          <div style={{ marginTop: 10, padding: '10px 14px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8 }}>
            <strong style={{ color: '#92400e' }}>⚠️ You are accessing via localhost.</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#92400e' }}>
              Use <strong>"+ Add IP Manually"</strong> and type your office network prefix (e.g.&nbsp;<code>192.168.0.</code>) directly.
            </p>
          </div>
        )}
      </div>

      {loading && <div className="page-loading">Loading network settings…</div>}

      {!loading && branches.map(branch => (
        <div key={branch._id} className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>🏢 {branch.name}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
              {branch.address || 'A-62, Sector 2, First Floor'}
            </p>
          </div>

          {canEdit && mySubnet && (
            <button
              className="btn btn--primary"
              style={{ marginBottom: 16 }}
              onClick={() => addIP(branch._id, mySubnet)}
              disabled={working === branch._id || (branch.allowedIPs || []).includes(mySubnet)}
            >
              {working === branch._id ? 'Adding…' : (branch.allowedIPs || []).includes(mySubnet) ? '✅ Office network added' : '📶 Add Entire Office Network'}
            </button>
          )}

          <div>
            <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>
              Allowed IPs ({(branch.allowedIPs || []).length})
              {(branch.allowedIPs || []).length === 0 && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>— No restriction (all IPs allowed)</span>}
            </p>
            {(branch.allowedIPs || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {branch.allowedIPs.map(ip => (
                  <div key={ip} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', flex: 1, color: '#111827' }}>{ip}</span>
                    {myIP === ip && <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, padding: '2px 8px', background: '#dbeafe', borderRadius: 12 }}>My IP</span>}
                    {canEdit && (
                      <button onClick={() => removeIP(branch._id, ip)} disabled={working === branch._id + ip}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1rem', padding: '2px 6px', lineHeight: 1 }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {canEdit && <ManualIPForm branchId={branch._id} onAdd={addIP} working={working} />}

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
function DepartmentsTab({ canEdit }) {
  const [depts,    setDepts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newName,  setNewName]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { fetchDepts(); }, []);

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
      await api.post('/departments', { name: newName.trim() });
      setMsg(`✅ Department "${newName.trim()}" created.`);
      setNewName(''); setShowForm(false);
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

  return (
    <>
      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`}>{msg}</div>}

      {/* Role mapping info */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <p style={{ margin: '0 0 10px', fontSize: '0.875rem', color: '#166534', fontWeight: 600 }}>🏢 Department → System Role Mapping</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
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
      </div>

      {canEdit && (
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

      {showForm && canEdit && (
        <div className="card" style={{ marginBottom: 20, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 700 }}>New Department</h3>
          <form onSubmit={createDept} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Department Name *</label>
              <input className="form-input" required placeholder="e.g. Operations" value={newName} onChange={e => setNewName(e.target.value)} />
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
          <div className="empty-state-icon">🏢</div>
          <h3>No departments yet</h3>
          <p>Click below to set up IT, HR, Accounts, Pharmacy &amp; Manager Head departments.</p>
          {canEdit && (
            <button className="btn btn--primary" onClick={seedDefaults} disabled={saving}>
              {saving ? 'Creating…' : '⚡ Create Default Departments'}
            </button>
          )}
        </div>
      )}

      {!loading && depts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {depts.map(dept => {
            const meta = DEFAULT_DEPARTMENTS.find(d => d.name.toLowerCase() === dept.name.toLowerCase());
            return (
              <div key={dept._id} className="card" style={{ padding: '16px 18px', marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--gray-900)' }}>{dept.name}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                      {meta?.note || 'Custom department'}
                    </p>
                  </div>
                  {meta
                    ? <span style={{ fontSize: '0.7rem', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap' }}>Default</span>
                    : canEdit && (
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
    if (!navigator.geolocation) { setGpsMsg('❌ Geolocation not supported.'); return; }
    setGpsMsg('⏳ Getting location…');
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(8)); setLon(pos.coords.longitude.toFixed(8)); setGpsMsg(`📍 Got location (±${Math.round(pos.coords.accuracy)}m accuracy)`); },
      () => setGpsMsg('❌ Location denied. Enter coordinates manually.'),
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div>
      <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
        📍 GPS Geo-fence
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
              <input className="form-input" style={{ fontFamily: 'monospace', width: 160 }} placeholder="e.g. 28.58712734" value={lat} onChange={e => setLat(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>Longitude</label>
              <input className="form-input" style={{ fontFamily: 'monospace', width: 160 }} placeholder="e.g. 77.31566815" value={lon} onChange={e => setLon(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>Radius (m)</label>
              <input className="form-input" style={{ width: 90 }} type="number" min="10" max="500" value={radius} onChange={e => setRadius(e.target.value)} />
            </div>
            <button className="btn btn--secondary" onClick={useMyLocation} style={{ fontSize: '0.82rem' }}>📍 Use My GPS</button>
            <button className="btn btn--primary" onClick={() => onSave({ latitude: parseFloat(lat), longitude: parseFloat(lon), radiusMeters: parseInt(radius) })} disabled={!lat || !lon || saving} style={{ fontSize: '0.82rem' }}>
              {saving ? 'Saving…' : '💾 Save Geo-fence'}
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

/* ─── Manual IP Form ────────────────────────────────────────── */
function ManualIPForm({ branchId, onAdd, working }) {
  const [showForm, setShowForm] = useState(false);
  const [ipInput,  setIpInput]  = useState('');

  const handleAdd = () => {
    const trimmed = ipInput.trim();
    if (!trimmed) return;
    onAdd(branchId, trimmed);
    setIpInput(''); setShowForm(false);
  };

  if (!showForm) return (
    <button className="btn btn--secondary" style={{ marginTop: 12, fontSize: '0.82rem' }} onClick={() => setShowForm(true)}>
      + Add IP Manually
    </button>
  );

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        className="form-input" style={{ fontFamily: 'monospace', maxWidth: 200 }}
        placeholder="e.g. 192.168.0."
        value={ipInput} onChange={e => setIpInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
      />
      <button className="btn btn--primary" onClick={handleAdd} disabled={!ipInput.trim() || working === branchId}>Add</button>
      <button className="btn btn--secondary" onClick={() => { setShowForm(false); setIpInput(''); }}>Cancel</button>
    </div>
  );
}
