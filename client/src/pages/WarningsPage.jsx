import { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

const TYPES = ['VERBAL', 'WRITTEN', 'FINAL_WRITTEN', 'SUSPENSION', 'TERMINATION'];
const CATEGORIES = ['ATTENDANCE', 'PERFORMANCE', 'CONDUCT', 'POLICY_VIOLATION', 'INSUBORDINATION', 'OTHER'];
const STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'APPEALED', 'RESOLVED', 'ESCALATED'];

const TYPE_COLORS = {
  VERBAL: { bg: '#dbeafe', color: '#2563eb' },
  WRITTEN: { bg: '#fef3c7', color: '#b45309' },
  FINAL_WRITTEN: { bg: '#fed7aa', color: '#c2410c' },
  SUSPENSION: { bg: '#fecaca', color: '#b91c1c' },
  TERMINATION: { bg: '#7f1d1d', color: '#fff' },
};
const STATUS_COLORS = {
  ACTIVE: { bg: '#fee2e2', color: '#b91c1c' },
  ACKNOWLEDGED: { bg: '#dbeafe', color: '#2563eb' },
  APPEALED: { bg: '#fef3c7', color: '#b45309' },
  RESOLVED: { bg: '#dcfce7', color: '#15803d' },
  ESCALATED: { bg: '#7f1d1d', color: '#fff' },
};

function Badge({ text, bg, color }) {
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
      background: bg, color, whiteSpace: 'nowrap',
    }}>
      {text.replace(/_/g, ' ')}
    </span>
  );
}

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

/* ── Employee View ───────────────────────────────────────── */
function EmployeeWarnings() {
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [msg, setMsg] = useState('');

  const fetch = useCallback(async () => {
    try {
      const { data } = await api.get('/warnings/my');
      setWarnings(data.data);
    } catch { setWarnings([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const respond = async (id, appeal = false) => {
    setMsg('');
    try {
      await api.patch(`/warnings/${id}/respond`, { response: responseText, appeal });
      setMsg(appeal ? 'Appeal submitted.' : 'Warning acknowledged.');
      setResponding(null); setResponseText('');
      fetch();
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Warnings</h1>
        <p className="page-subtitle">View and respond to warnings issued to you</p>
      </div>
      {msg && <div className="alert alert--info" style={{ marginBottom: 14 }}>{msg}</div>}

      {warnings.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#9989;</div>
          <h3>No warnings</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>You have a clean record. Keep it up!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {warnings.map(w => {
            const tc = TYPE_COLORS[w.type] || TYPE_COLORS.VERBAL;
            const sc = STATUS_COLORS[w.status] || STATUS_COLORS.ACTIVE;
            return (
              <div key={w._id} className="card" style={{ padding: '18px 20px', borderLeft: `4px solid ${tc.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#6b7280' }}>{w.warningId}</span>
                    <Badge text={w.type} {...tc} />
                    <Badge text={w.category} bg="#f3f4f6" color="#374151" />
                    <Badge text={w.status} {...sc} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{fmt(w.createdAt)}</span>
                </div>

                <h4 style={{ margin: '0 0 6px', fontWeight: 700, color: '#111827' }}>{w.subject}</h4>
                <p style={{ margin: '0 0 8px', fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.5 }}>{w.description}</p>

                {w.actionRequired && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef3c7', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#92400e' }}>Action Required: </span>
                    <span style={{ fontSize: '0.82rem', color: '#78350f' }}>{w.actionRequired}</span>
                  </div>
                )}

                {w.responseDeadline && (
                  <p style={{ fontSize: '0.78rem', color: new Date(w.responseDeadline) < new Date() ? '#dc2626' : '#6b7280', marginBottom: 8 }}>
                    Response deadline: {fmt(w.responseDeadline)}
                    {new Date(w.responseDeadline) < new Date() && ' (OVERDUE)'}
                  </p>
                )}

                <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 8 }}>Issued by: {w.issuedBy?.name || '—'}</p>

                {w.employeeResponse && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f0f7ff', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1e40af' }}>Your Response: </span>
                    <span style={{ fontSize: '0.82rem', color: '#1e3a8a' }}>{w.employeeResponse}</span>
                    <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '4px 0 0' }}>Responded: {fmt(w.respondedAt)}</p>
                  </div>
                )}

                {w.status === 'ACTIVE' && (
                  responding === w._id ? (
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={responseText}
                        onChange={e => setResponseText(e.target.value)}
                        placeholder="Write your response..."
                        maxLength={2000}
                        style={{ marginBottom: 8 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn--primary" style={{ fontSize: '0.82rem' }} onClick={() => respond(w._id, false)}>Acknowledge</button>
                        <button className="btn btn--secondary" style={{ fontSize: '0.82rem', borderColor: '#b45309', color: '#b45309' }} onClick={() => respond(w._id, true)}>Appeal</button>
                        <button className="btn btn--secondary" style={{ fontSize: '0.82rem' }} onClick={() => { setResponding(null); setResponseText(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn--primary" style={{ fontSize: '0.82rem', marginTop: 8 }} onClick={() => setResponding(w._id)}>Respond</button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── HR: Issue Warning Form ──────────────────────────────── */
function IssueWarningForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ employeeId: '', type: 'VERBAL', category: 'CONDUCT', subject: '', description: '', actionRequired: '', responseDeadline: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.employeeId || !form.subject || !form.description) return setMsg('Fill required fields.');
    setBusy(true); setMsg('');
    try {
      await api.post('/warnings', { ...form, responseDeadline: form.responseDeadline || undefined });
      setMsg('Warning issued!');
      setTimeout(onCreated, 500);
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <h4 style={{ margin: 0, fontWeight: 600 }}>Issue Warning</h4>
        {onCancel && <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cancel</button>}
      </div>
      {msg && <div className={`alert ${msg.includes('!') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12, marginBottom: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Employee ID *</label>
          <input className="form-input" value={form.employeeId} onChange={e => set('employeeId', e.target.value)} placeholder="EMP-0005" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Warning Type *</label>
          <select className="form-input" value={form.type} onChange={e => set('type', e.target.value)}>
            {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Category *</label>
          <select className="form-input" value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Response Deadline</label>
          <input className="form-input" type="date" value={form.responseDeadline} onChange={e => set('responseDeadline', e.target.value)} />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label">Subject *</label>
        <input className="form-input" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Brief subject of the warning" maxLength={200} />
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label">Description *</label>
        <textarea className="form-input" rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Detailed description of the incident or behavior..." maxLength={3000} />
      </div>
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label className="form-label">Action Required</label>
        <input className="form-input" value={form.actionRequired} onChange={e => set('actionRequired', e.target.value)} placeholder="What the employee must do..." maxLength={1000} />
      </div>

      <button className="btn btn--primary" onClick={submit} disabled={busy}>{busy ? 'Issuing...' : 'Issue Warning'}</button>
    </div>
  );
}

/* ── HR: Admin View ──────────────────────────────────────── */
function AdminWarnings() {
  const [warnings, setWarnings] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({ status: '', type: '', category: '', search: '', flagged: false });
  const [updating, setUpdating] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.type) params.set('type', filters.type);
      if (filters.category) params.set('category', filters.category);
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.flagged) params.set('flagged', 'true');

      const [wRes, sRes] = await Promise.all([
        api.get(`/warnings?${params.toString()}`),
        api.get('/warnings/stats'),
      ]);
      setWarnings(wRes.data.data);
      setStats(sRes.data.data);
    } catch { setWarnings([]); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(fetchAll, 300);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.patch(`/warnings/${id}/status`, { status });
      fetchAll();
    } catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setUpdating(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this warning?')) return;
    setDeleting(id);
    try { await api.delete(`/warnings/${id}`); fetchAll(); }
    catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setDeleting(null); }
  };

  const setFilter = (k, v) => setFilters(p => ({ ...p, [k]: v }));

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Warnings & Disciplinary</h1>
          <p className="page-subtitle">Issue and track employee warnings, auto-flag repeat offenders</p>
        </div>
        {!showCreate && <button className="btn btn--primary" onClick={() => setShowCreate(true)}>+ Issue Warning</button>}
      </div>

      {showCreate && <IssueWarningForm onCreated={() => { setShowCreate(false); fetchAll(); }} onCancel={() => setShowCreate(false)} />}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: stats.total, bg: '#dbeafe', color: '#2563eb' },
          { label: 'Active', value: stats.active, bg: '#fee2e2', color: '#b91c1c' },
          { label: 'Acknowledged', value: stats.acknowledged, bg: '#dbeafe', color: '#2563eb' },
          { label: 'Escalated', value: stats.escalated, bg: '#7f1d1d', color: '#fff' },
          { label: 'Flagged (3+)', value: stats.flaggedEmployees, bg: '#fecaca', color: '#991b1b' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 18px', borderRadius: 10, background: s.bg, minWidth: 80, textAlign: 'center', cursor: s.label === 'Flagged (3+)' ? 'pointer' : 'default' }}
            onClick={s.label === 'Flagged (3+)' ? () => setFilter('flagged', !filters.flagged) : undefined}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value ?? '—'}</div>
            <div style={{ fontSize: '0.72rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Search name or ID..." style={{ flex: '1 1 200px', minWidth: 0 }} />
        <select className="form-input" value={filters.status} onChange={e => setFilter('status', e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="form-input" value={filters.type} onChange={e => setFilter('type', e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="form-input" value={filters.category} onChange={e => setFilter('category', e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        {filters.flagged && (
          <button className="btn btn--secondary" style={{ fontSize: '0.82rem', borderColor: '#dc2626', color: '#dc2626' }} onClick={() => setFilter('flagged', false)}>
            Clear Flagged Filter
          </button>
        )}
      </div>

      {loading ? <div className="page-loading">Loading...</div> : warnings.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#128274;</div>
          <h3>No warnings found</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Issue a warning when disciplinary action is needed</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {warnings.map(w => {
            const tc = TYPE_COLORS[w.type] || TYPE_COLORS.VERBAL;
            const sc = STATUS_COLORS[w.status] || STATUS_COLORS.ACTIVE;
            return (
              <div key={w._id} className="card" style={{ padding: '16px 20px', borderLeft: `4px solid ${tc.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111827' }}>{w.employee?.name}</span>
                    <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{w.employee?.employeeId}</span>
                    <Badge text={w.warningId} bg="#f3f4f6" color="#374151" />
                    <Badge text={w.type} {...tc} />
                    <Badge text={w.category} bg="#f3f4f6" color="#374151" />
                    <Badge text={w.status} {...sc} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{fmt(w.createdAt)}</span>
                </div>

                <h4 style={{ margin: '0 0 4px', fontWeight: 600, color: '#111827', fontSize: '0.95rem' }}>{w.subject}</h4>
                <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5 }}>{w.description}</p>

                {w.actionRequired && (
                  <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#92400e' }}>
                    <strong>Action Required:</strong> {w.actionRequired}
                  </p>
                )}

                {w.employeeResponse && (
                  <div style={{ padding: '6px 10px', borderRadius: 6, background: '#f0f7ff', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.78rem', color: '#1e40af' }}>Employee Response: </span>
                    <span style={{ fontSize: '0.78rem', color: '#1e3a8a' }}>{w.employeeResponse}</span>
                  </div>
                )}

                {w.escalatedTo && (
                  <p style={{ fontSize: '0.78rem', color: '#b91c1c', fontWeight: 700, marginBottom: 6 }}>
                    Escalated to: {w.escalatedTo.replace(/_/g, ' ')}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <span style={{ fontSize: '0.78rem', color: '#9ca3af', lineHeight: '32px' }}>Issued by: {w.issuedBy?.name || '—'}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {w.status !== 'RESOLVED' && w.status !== 'ESCALATED' && (
                      <button className="btn btn--secondary" style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        onClick={() => updateStatus(w._id, 'RESOLVED')} disabled={updating === w._id}>Resolve</button>
                    )}
                    {w.status !== 'ESCALATED' && w.status !== 'RESOLVED' && (
                      <button className="btn btn--secondary" style={{ fontSize: '0.78rem', padding: '4px 10px', borderColor: '#b91c1c', color: '#b91c1c' }}
                        onClick={() => updateStatus(w._id, 'ESCALATED')} disabled={updating === w._id}>Escalate</button>
                    )}
                    <button className="btn btn--danger" style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                      onClick={() => handleDelete(w._id)} disabled={deleting === w._id}>{deleting === w._id ? '...' : 'Delete'}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function WarningsPage() {
  const { user } = useAuthStore();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  return isAdmin ? <AdminWarnings /> : <EmployeeWarnings />;
}
