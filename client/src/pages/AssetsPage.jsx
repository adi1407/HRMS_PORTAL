import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

const ASSET_TYPES = [
  { value: 'LAPTOP',      label: 'Laptop' },
  { value: 'DESKTOP',     label: 'Desktop' },
  { value: 'PHONE',       label: 'Phone' },
  { value: 'TABLET',      label: 'Tablet' },
  { value: 'MONITOR',     label: 'Monitor' },
  { value: 'ACCESS_CARD', label: 'Access Card' },
  { value: 'HEADSET',     label: 'Headset' },
  { value: 'CHAIR',       label: 'Chair' },
  { value: 'OTHER',       label: 'Other' },
];

const STATUS_STYLES = {
  AVAILABLE:    { bg: '#dcfce7', color: '#15803d', label: 'Available' },
  ASSIGNED:     { bg: '#dbeafe', color: '#2563eb', label: 'Assigned' },
  UNDER_REPAIR: { bg: '#fef3c7', color: '#b45309', label: 'Under Repair' },
  RETIRED:      { bg: '#f3f4f6', color: '#6b7280', label: 'Retired' },
  LOST:         { bg: '#fee2e2', color: '#b91c1c', label: 'Lost' },
};

const CONDITION_STYLES = {
  NEW:  { bg: '#dcfce7', color: '#15803d' },
  GOOD: { bg: '#dbeafe', color: '#2563eb' },
  FAIR: { bg: '#fef3c7', color: '#b45309' },
  POOR: { bg: '#fee2e2', color: '#b91c1c' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.AVAILABLE;
  return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>;
}

function ConditionBadge({ condition }) {
  const c = CONDITION_STYLES[condition] || CONDITION_STYLES.GOOD;
  return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{condition}</span>;
}

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

/* ── Create asset form ────────────────────────────────────── */
function CreateAssetForm({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('LAPTOP');
  const [brand, setBrand] = useState('');
  const [modelName, setModelName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [condition, setCondition] = useState('NEW');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (!name.trim()) return setMsg('Asset name is required.');
    setBusy(true); setMsg('');
    try {
      await api.post('/assets', { name, type, brand, modelName, serialNumber, purchaseDate: purchaseDate || undefined, purchaseCost: purchaseCost || undefined, condition, notes });
      setMsg('Asset created!');
      setTimeout(onCreated, 500);
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <h4 style={{ margin: 0, fontWeight: 600 }}>Add New Asset</h4>
        {onCancel && <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cancel</button>}
      </div>
      {msg && <div className={`alert ${msg.includes('!') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12 }}>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Name *</label><input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. MacBook Pro 14" maxLength={200} /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Type *</label><select className="form-input" value={type} onChange={e => setType(e.target.value)}>{ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Brand</label><input className="form-input" value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Apple" /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Model</label><input className="form-input" value={modelName} onChange={e => setModelName(e.target.value)} placeholder="e.g. M3 Pro" /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Serial No.</label><input className="form-input" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Condition</label><select className="form-input" value={condition} onChange={e => setCondition(e.target.value)}>{['NEW','GOOD','FAIR','POOR'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Purchase Date</label><input className="form-input" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} /></div>
        <div className="form-group" style={{ margin: 0 }}><label className="form-label">Cost (Rs)</label><input className="form-input" type="number" value={purchaseCost} onChange={e => setPurchaseCost(e.target.value)} placeholder="Optional" /></div>
      </div>
      <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} style={{ resize: 'vertical' }} /></div>
      <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Add Asset'}</button>
    </div>
  );
}

/* ── Assign modal ─────────────────────────────────────────── */
function AssignModal({ asset, onDone, onCancel }) {
  const [empId, setEmpId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (!empId.trim()) return setMsg('Employee ID is required.');
    setBusy(true); setMsg('');
    try {
      await api.post(`/assets/${asset._id}/assign`, { employeeId: empId.trim() });
      onDone();
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        <h4 style={{ margin: '0 0 16px', fontWeight: 700 }}>Assign {asset.assetId}</h4>
        {msg && <div className="alert alert--error" style={{ marginBottom: 12 }}>{msg}</div>}
        <div className="form-group"><label className="form-label">Employee ID *</label><input className="form-input" value={empId} onChange={e => setEmpId(e.target.value)} placeholder="e.g. EMP-0002" /></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn--secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>{busy ? '...' : 'Assign'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Return modal ─────────────────────────────────────────── */
function ReturnModal({ asset, onDone, onCancel }) {
  const [returnCondition, setReturnCondition] = useState('GOOD');
  const [returnNote, setReturnNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    setBusy(true); setMsg('');
    try {
      await api.post(`/assets/${asset._id}/return`, { returnCondition, returnNote });
      onDone();
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        <h4 style={{ margin: '0 0 4px', fontWeight: 700 }}>Return {asset.assetId}</h4>
        <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#6b7280' }}>
          Currently assigned to {asset.currentAssignment?.employee?.name}
        </p>
        {msg && <div className="alert alert--error" style={{ marginBottom: 12 }}>{msg}</div>}
        <div className="form-group"><label className="form-label">Return Condition *</label>
          <select className="form-input" value={returnCondition} onChange={e => setReturnCondition(e.target.value)}>
            <option value="GOOD">Good</option><option value="DAMAGED">Damaged</option><option value="LOST">Lost</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Note (optional)</label><textarea className="form-input" rows={2} value={returnNote} onChange={e => setReturnNote(e.target.value)} style={{ resize: 'vertical' }} maxLength={500} /></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn--secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={`btn ${returnCondition === 'LOST' ? 'btn--danger' : 'btn--primary'}`} onClick={submit} disabled={busy}>{busy ? '...' : 'Process Return'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Employee: my assets ──────────────────────────────────── */
function EmployeeAssetsView() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/assets/my').then(({ data }) => setAssets(data.data)).catch(() => setAssets([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Assets</h1>
        <p className="page-subtitle">Company assets currently assigned to you</p>
      </div>
      {loading ? <div className="page-loading">Loading...</div> : assets.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#128187;</div>
          <h3>No assets assigned</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>You don't have any company assets currently assigned to you</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {assets.map(a => (
            <div key={a._id} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2563eb' }}>{a.assetId}</span>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{a.name}</span>
                <StatusBadge status={a.status} />
                <ConditionBadge condition={a.condition} />
              </div>
              <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                {ASSET_TYPES.find(t => t.value === a.type)?.label}
                {a.brand && <> &middot; {a.brand}</>}
                {a.modelName && <> {a.modelName}</>}
                {a.serialNumber && <> &middot; S/N: {a.serialNumber}</>}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>
                Assigned: {fmt(a.currentAssignment?.assignedDate)}
                {a.currentAssignment?.assignedBy?.name && <> by {a.currentAssignment.assignedBy.name}</>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── HR/Admin: full asset management ──────────────────────── */
function AdminAssetsView() {
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState(null);
  const [returning, setReturning] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (search.trim()) params.set('search', search.trim());
      const [aRes, sRes] = await Promise.all([
        api.get(`/assets?${params.toString()}`),
        api.get('/assets/stats'),
      ]);
      setAssets(aRes.data.data); setStats(sRes.data.data);
    } catch { setAssets([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(fetchAll, 300);
    return () => clearTimeout(timer);
  }, [statusFilter, typeFilter, search]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this asset?')) return;
    setDeleting(id);
    try { await api.delete(`/assets/${id}`); fetchAll(); }
    catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setDeleting(null); }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Asset Management</h1>
          <p className="page-subtitle">Track and manage company assets, assignments, and returns</p>
        </div>
        {!showCreate && <button className="btn btn--primary" onClick={() => setShowCreate(true)}>+ Add Asset</button>}
      </div>

      {showCreate && <CreateAssetForm onCreated={() => { setShowCreate(false); fetchAll(); }} onCancel={() => setShowCreate(false)} />}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: stats.total, ...STATUS_STYLES.ASSIGNED },
          { label: 'Available', value: stats.available, ...STATUS_STYLES.AVAILABLE },
          { label: 'Assigned', value: stats.assigned, ...STATUS_STYLES.ASSIGNED },
          { label: 'Repair', value: stats.underRepair, ...STATUS_STYLES.UNDER_REPAIR },
          { label: 'Retired', value: stats.retired, ...STATUS_STYLES.RETIRED },
          { label: 'Lost', value: stats.lost, ...STATUS_STYLES.LOST },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 18px', borderRadius: 10, background: s.bg, minWidth: 80, textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value ?? '—'}</div>
            <div style={{ fontSize: '0.72rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID, serial..." style={{ flex: '1 1 220px', minWidth: 0 }} />
        <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="form-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
          <option value="">All Types</option>
          {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {assigning && <AssignModal asset={assigning} onDone={() => { setAssigning(null); fetchAll(); }} onCancel={() => setAssigning(null)} />}
      {returning && <ReturnModal asset={returning} onDone={() => { setReturning(null); fetchAll(); }} onCancel={() => setReturning(null)} />}

      {loading ? <div className="page-loading">Loading...</div> : assets.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#128187;</div>
          <h3>No assets found</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Add assets or adjust filters</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {assets.map(a => (
            <div key={a._id} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2563eb' }}>{a.assetId}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{a.name}</span>
                    <StatusBadge status={a.status} />
                    <ConditionBadge condition={a.condition} />
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 2 }}>
                    {ASSET_TYPES.find(t => t.value === a.type)?.label}
                    {a.brand && <> &middot; {a.brand}</>}
                    {a.modelName && <> {a.modelName}</>}
                    {a.serialNumber && <> &middot; S/N: {a.serialNumber}</>}
                  </div>
                  {a.status === 'ASSIGNED' && a.currentAssignment?.employee && (
                    <div style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 600 }}>
                      Assigned to: {a.currentAssignment.employee.name} ({a.currentAssignment.employee.employeeId})
                      <span style={{ color: '#9ca3af', fontWeight: 400 }}> &middot; Since {fmt(a.currentAssignment.assignedDate)}</span>
                    </div>
                  )}
                  {a.purchaseCost && <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Cost: Rs {a.purchaseCost.toLocaleString('en-IN')} &middot; Purchased: {fmt(a.purchaseDate)}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                  {a.status === 'AVAILABLE' && (
                    <button className="btn btn--primary" style={{ fontSize: '0.82rem', padding: '6px 14px' }} onClick={() => setAssigning(a)}>Assign</button>
                  )}
                  {a.status === 'ASSIGNED' && (
                    <button className="btn btn--secondary" style={{ fontSize: '0.82rem', padding: '6px 14px' }} onClick={() => setReturning(a)}>Return</button>
                  )}
                  {a.status !== 'ASSIGNED' && (
                    <button className="btn btn--danger" style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                      onClick={() => handleDelete(a._id)} disabled={deleting === a._id}>
                      {deleting === a._id ? '...' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AssetsPage() {
  const { user } = useAuthStore();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  return isAdmin ? <AdminAssetsView /> : <EmployeeAssetsView />;
}
