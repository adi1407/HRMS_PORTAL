import { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

const CATEGORIES = [
  { value: 'DOCUMENTS',       label: 'Documents',       bg: '#dbeafe', color: '#2563eb', icon: '📄' },
  { value: 'IT_SETUP',        label: 'IT Setup',        bg: '#f3e8ff', color: '#7c3aed', icon: '💻' },
  { value: 'HR_FORMALITIES',  label: 'HR Formalities',  bg: '#fef3c7', color: '#b45309', icon: '📋' },
  { value: 'TRAINING',        label: 'Training',        bg: '#dcfce7', color: '#15803d', icon: '🎓' },
  { value: 'OTHER',           label: 'Other',           bg: '#f3f4f6', color: '#6b7280', icon: '📌' },
];

function CatBadge({ category }) {
  const c = CATEGORIES.find(x => x.value === category) || CATEGORIES[4];
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {c.icon} {c.label}
    </span>
  );
}

function ProgressBar({ percent }) {
  const color = percent === 100 ? '#15803d' : percent >= 50 ? '#2563eb' : '#b45309';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color, minWidth: 40, textAlign: 'right' }}>{percent}%</span>
    </div>
  );
}

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

/* ── Employee: My onboarding checklist ────────────────────── */
function EmployeeOnboarding() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const fetch = useCallback(async () => {
    try {
      const { data: res } = await api.get('/onboarding/my');
      setData(res.data);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const toggle = async (itemId, currentState) => {
    setToggling(itemId);
    try {
      const { data: res } = await api.patch(`/onboarding/${data._id}/item/${itemId}`, { isCompleted: !currentState });
      setData(res.data);
    } catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setToggling(null); }
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  if (!data) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Onboarding</h1>
        </div>
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#9989;</div>
          <h3>No onboarding checklist</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>You don't have an active onboarding checklist. Contact HR if you're a new joinee.</p>
        </div>
      </div>
    );
  }

  const sorted = [...data.checklist].sort((a, b) => a.order - b.order);
  const grouped = {};
  for (const item of sorted) {
    const cat = item.category || 'OTHER';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  const isOverdue = data.dueDate && new Date(data.dueDate) < new Date() && data.status !== 'COMPLETED';

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Onboarding</h1>
        <p className="page-subtitle">Complete your onboarding checklist to get started</p>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: data.status === 'COMPLETED' ? '#15803d' : '#111827' }}>
              {data.status === 'COMPLETED' ? '✅ Onboarding Complete!' : 'Onboarding In Progress'}
            </span>
            {isOverdue && <span style={{ marginLeft: 10, fontSize: '0.78rem', fontWeight: 700, color: '#dc2626' }}>OVERDUE</span>}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
            Due: {fmt(data.dueDate)} &middot; {data.checklist.filter(i => i.isCompleted).length}/{data.checklist.length} done
          </div>
        </div>
        <ProgressBar percent={data.completionPercent} />
      </div>

      {Object.entries(grouped).map(([cat, items]) => {
        const catInfo = CATEGORIES.find(c => c.value === cat) || CATEGORIES[4];
        return (
          <div key={cat} style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: catInfo.color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{catInfo.icon}</span> {catInfo.label}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(item => (
                <div key={item._id} className="card" style={{
                  padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14,
                  opacity: item.isCompleted ? 0.75 : 1,
                  borderLeft: `4px solid ${item.isCompleted ? '#15803d' : '#e2e8f0'}`,
                }}>
                  <button
                    onClick={() => toggle(item._id, item.isCompleted)}
                    disabled={toggling === item._id}
                    style={{
                      width: 28, height: 28, borderRadius: 8, border: `2px solid ${item.isCompleted ? '#15803d' : '#cbd5e1'}`,
                      background: item.isCompleted ? '#dcfce7' : '#fff', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: 'all 0.2s',
                    }}>
                    {item.isCompleted ? '✓' : ''}
                  </button>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: item.isCompleted ? '#6b7280' : '#111827', textDecoration: item.isCompleted ? 'line-through' : 'none' }}>
                      {item.title}
                    </p>
                    {item.description && <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>{item.description}</p>}
                    {item.isCompleted && item.completedAt && (
                      <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#15803d' }}>
                        Done {fmt(item.completedAt)}{item.completedBy?.name ? ` by ${item.completedBy.name}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── HR: create onboarding ────────────────────────────────── */
function CreateOnboardingForm({ onCreated, onCancel }) {
  const [empId, setEmpId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [useDefault, setUseDefault] = useState(true);
  const [customItems, setCustomItems] = useState([{ title: '', category: 'OTHER' }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const addItem = () => setCustomItems(p => [...p, { title: '', category: 'OTHER' }]);
  const removeItem = (i) => setCustomItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setCustomItems(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const submit = async () => {
    if (!empId.trim()) return setMsg('Employee ID is required.');
    setBusy(true); setMsg('');
    try {
      const payload = { employeeId: empId.trim(), dueDate: dueDate || undefined, notes };
      if (!useDefault) {
        const items = customItems.filter(i => i.title.trim());
        if (items.length === 0) return setMsg('Add at least one checklist item.');
        payload.checklist = items;
      }
      await api.post('/onboarding', payload);
      setMsg('Onboarding created!');
      setTimeout(onCreated, 500);
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <h4 style={{ margin: 0, fontWeight: 600 }}>Create Onboarding Checklist</h4>
        {onCancel && <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cancel</button>}
      </div>
      {msg && <div className={`alert ${msg.includes('!') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Employee ID *</label>
          <input className="form-input" value={empId} onChange={e => setEmpId(e.target.value)} placeholder="e.g. EMP-0005" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Due Date</label>
          <input className="form-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label">Notes (optional)</label>
        <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special instructions..." maxLength={1000} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>
          <input type="checkbox" checked={useDefault} onChange={e => setUseDefault(e.target.checked)} style={{ width: 16, height: 16 }} />
          Use default checklist (12 items covering Documents, IT Setup, HR, Training)
        </label>
      </div>

      {!useDefault && (
        <div style={{ marginBottom: 14 }}>
          <h5 style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>Custom Checklist Items</h5>
          {customItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input className="form-input" value={item.title} onChange={e => updateItem(i, 'title', e.target.value)} placeholder="Task title" style={{ flex: 1 }} />
              <select className="form-input" value={item.category} onChange={e => updateItem(i, 'category', e.target.value)} style={{ width: 140 }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {customItems.length > 1 && (
                <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem' }}>×</button>
              )}
            </div>
          ))}
          <button className="btn btn--secondary" style={{ fontSize: '0.82rem' }} onClick={addItem}>+ Add Item</button>
        </div>
      )}

      <button className="btn btn--primary" onClick={submit} disabled={busy}>{busy ? 'Creating...' : 'Create Onboarding'}</button>
    </div>
  );
}

/* ── HR: employee detail view ─────────────────────────────── */
function OnboardingDetail({ record, onBack, onUpdated }) {
  const [toggling, setToggling] = useState(null);
  const [addTitle, setAddTitle] = useState('');
  const [addCat, setAddCat] = useState('OTHER');
  const [adding, setAdding] = useState(false);

  const toggle = async (itemId, currentState) => {
    setToggling(itemId);
    try {
      await api.patch(`/onboarding/${record._id}/item/${itemId}`, { isCompleted: !currentState });
      onUpdated();
    } catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setToggling(null); }
  };

  const addItem = async () => {
    if (!addTitle.trim()) return;
    setAdding(true);
    try {
      await api.post(`/onboarding/${record._id}/item`, { title: addTitle, category: addCat });
      setAddTitle(''); onUpdated();
    } catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setAdding(false); }
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm('Remove this item?')) return;
    try { await api.delete(`/onboarding/${record._id}/item/${itemId}`); onUpdated(); }
    catch (err) { alert(err.response?.data?.message || 'Failed.'); }
  };

  const sorted = [...record.checklist].sort((a, b) => a.order - b.order);
  const isOverdue = record.dueDate && new Date(record.dueDate) < new Date() && record.status !== 'COMPLETED';

  return (
    <div>
      <button className="btn btn--secondary" style={{ marginBottom: 14, fontSize: '0.85rem' }} onClick={onBack}>&larr; Back</button>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontWeight: 700 }}>{record.employee?.name}</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
              {record.employee?.employeeId} &middot; {record.employee?.designation || '—'} &middot; Joined {fmt(record.employee?.joiningDate)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: record.status === 'COMPLETED' ? '#15803d' : '#b45309' }}>
              {record.status === 'COMPLETED' ? '✅ Completed' : 'In Progress'}
            </span>
            {isOverdue && <span style={{ marginLeft: 8, fontSize: '0.78rem', fontWeight: 700, color: '#dc2626' }}>OVERDUE</span>}
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>Due: {fmt(record.dueDate)}</p>
          </div>
        </div>
        <ProgressBar percent={record.completionPercent} />
      </div>

      {/* Checklist items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {sorted.map(item => (
          <div key={item._id} className="card" style={{
            padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14,
            borderLeft: `4px solid ${item.isCompleted ? '#15803d' : '#e2e8f0'}`,
          }}>
            <button onClick={() => toggle(item._id, item.isCompleted)} disabled={toggling === item._id}
              style={{
                width: 28, height: 28, borderRadius: 8, border: `2px solid ${item.isCompleted ? '#15803d' : '#cbd5e1'}`,
                background: item.isCompleted ? '#dcfce7' : '#fff', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
              }}>
              {item.isCompleted ? '✓' : ''}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: item.isCompleted ? '#6b7280' : '#111827', textDecoration: item.isCompleted ? 'line-through' : 'none' }}>
                  {item.title}
                </span>
                <CatBadge category={item.category} />
              </div>
              {item.isCompleted && item.completedAt && (
                <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#15803d' }}>
                  Done {fmt(item.completedAt)}{item.completedBy?.name ? ` by ${item.completedBy.name}` : ''}
                </p>
              )}
            </div>
            <button onClick={() => deleteItem(item._id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, flexShrink: 0 }} title="Remove">×</button>
          </div>
        ))}
      </div>

      {/* Add item */}
      <div className="card" style={{ padding: 16 }}>
        <h5 style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.88rem' }}>Add Checklist Item</h5>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="form-input" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="New item title..." style={{ flex: 1, minWidth: 180 }} maxLength={200} />
          <select className="form-input" value={addCat} onChange={e => setAddCat(e.target.value)} style={{ width: 140 }}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button className="btn btn--primary" onClick={addItem} disabled={adding || !addTitle.trim()}>{adding ? '...' : 'Add'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── HR: admin view ───────────────────────────────────────── */
function AdminOnboarding() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const [rRes, sRes] = await Promise.all([
        api.get(`/onboarding?${params.toString()}`),
        api.get('/onboarding/stats'),
      ]);
      setRecords(rRes.data.data); setStats(sRes.data.data);
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => {
    const timer = setTimeout(fetchAll, 300);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this onboarding record?')) return;
    setDeleting(id);
    try { await api.delete(`/onboarding/${id}`); fetchAll(); }
    catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setDeleting(null); }
  };

  if (selected) {
    const fresh = records.find(r => r._id === selected._id) || selected;
    return (
      <div className="page">
        <OnboardingDetail record={fresh} onBack={() => { setSelected(null); fetchAll(); }} onUpdated={fetchAll} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Employee Onboarding</h1>
          <p className="page-subtitle">Track new joinee onboarding progress and checklist completion</p>
        </div>
        {!showCreate && <button className="btn btn--primary" onClick={() => setShowCreate(true)}>+ New Onboarding</button>}
      </div>

      {showCreate && <CreateOnboardingForm onCreated={() => { setShowCreate(false); fetchAll(); }} onCancel={() => setShowCreate(false)} />}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: stats.total, bg: '#dbeafe', color: '#2563eb' },
          { label: 'In Progress', value: stats.inProgress, bg: '#fef3c7', color: '#b45309' },
          { label: 'Completed', value: stats.completed, bg: '#dcfce7', color: '#15803d' },
          { label: 'Overdue', value: stats.overdue, bg: '#fee2e2', color: '#b91c1c' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 18px', borderRadius: 10, background: s.bg, minWidth: 90, textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value ?? '—'}</div>
            <div style={{ fontSize: '0.72rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID..." style={{ width: 220 }} />
        <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
          <option value="">All Statuses</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : records.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#128640;</div>
          <h3>No onboarding records</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Create an onboarding checklist for new joinees</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {records.map(r => {
            const isOverdue = r.dueDate && new Date(r.dueDate) < new Date() && r.status !== 'COMPLETED';
            return (
              <div key={r._id} className="card" style={{ padding: '16px 20px', borderLeft: `4px solid ${r.status === 'COMPLETED' ? '#15803d' : isOverdue ? '#dc2626' : '#2563eb'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{r.employee?.name}</span>
                      <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.employee?.employeeId}</span>
                      <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: r.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7', color: r.status === 'COMPLETED' ? '#15803d' : '#b45309' }}>
                        {r.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
                      </span>
                      {isOverdue && <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: '#fee2e2', color: '#b91c1c' }}>Overdue</span>}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <ProgressBar percent={r.completionPercent} />
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                      {r.employee?.designation || '—'} &middot; Joined {fmt(r.employee?.joiningDate)} &middot; Due {fmt(r.dueDate)}
                      &middot; {r.checklist.filter(i => i.isCompleted).length}/{r.checklist.length} tasks
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button className="btn btn--primary" style={{ fontSize: '0.82rem', padding: '6px 14px' }} onClick={() => setSelected(r)}>View</button>
                    <button className="btn btn--danger" style={{ fontSize: '0.82rem', padding: '6px 14px' }} onClick={() => handleDelete(r._id)} disabled={deleting === r._id}>
                      {deleting === r._id ? '...' : 'Delete'}
                    </button>
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

export default function OnboardingPage() {
  const { user } = useAuthStore();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  return isAdmin ? <AdminOnboarding /> : <EmployeeOnboarding />;
}
