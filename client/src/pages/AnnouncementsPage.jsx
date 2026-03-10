import { useState, useEffect } from 'react';
import api from '../utils/api';

const PRIORITY_OPTIONS = [
  { value: 'NORMAL',    label: 'Normal',    bg: '#dbeafe', color: '#2563eb' },
  { value: 'IMPORTANT', label: 'Important', bg: '#fef3c7', color: '#b45309' },
  { value: 'URGENT',    label: 'Urgent',    bg: '#fee2e2', color: '#b91c1c' },
];

const AUDIENCE_OPTIONS = [
  { value: 'ALL',        label: 'All Employees' },
  { value: 'DEPARTMENT', label: 'Specific Department' },
  { value: 'BRANCH',     label: 'Specific Branch' },
];

function PriorityBadge({ priority }) {
  const opt = PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[0];
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: opt.bg, color: opt.color, whiteSpace: 'nowrap' }}>
      {opt.label}
    </span>
  );
}

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Create/Edit announcement form ────────────────────────── */
function AnnouncementForm({ editing, departments, branches, onSaved, onCancel }) {
  const [title, setTitle]       = useState(editing?.title || '');
  const [content, setContent]   = useState(editing?.content || '');
  const [priority, setPriority] = useState(editing?.priority || 'NORMAL');
  const [audience, setAudience] = useState(editing?.audience || 'ALL');
  const [dept, setDept]         = useState(editing?.department?._id || editing?.department || '');
  const [branch, setBranch]     = useState(editing?.branch?._id || editing?.branch || '');
  const [expiresAt, setExpiresAt] = useState(editing?.expiresAt ? new Date(editing.expiresAt).toISOString().split('T')[0] : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState('');

  const submit = async () => {
    if (!title.trim()) return setMsg('Title is required.');
    if (!content.trim()) return setMsg('Content is required.');
    setBusy(true); setMsg('');
    try {
      const payload = { title, content, priority, audience };
      if (audience === 'DEPARTMENT') payload.department = dept;
      if (audience === 'BRANCH') payload.branch = branch;
      if (expiresAt) payload.expiresAt = expiresAt;

      if (editing) {
        await api.patch(`/announcements/${editing._id}`, payload);
        setMsg('Announcement updated!');
      } else {
        await api.post('/announcements', payload);
        setMsg('Announcement created!');
      }
      setTimeout(() => onSaved(), 500);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h4 style={{ margin: 0, fontWeight: 600 }}>{editing ? 'Edit Announcement' : 'Create Announcement'}</h4>
        {onCancel && (
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
            Cancel
          </button>
        )}
      </div>
      {msg && (
        <div className={`alert ${msg.includes('!') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label">Title *</label>
        <input className="form-input" value={title} placeholder="Announcement title"
          onChange={e => setTitle(e.target.value)} maxLength={200} />
      </div>

      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label">Content *</label>
        <textarea className="form-input" rows={3} value={content} placeholder="Write the announcement details..."
          onChange={e => setContent(e.target.value)} maxLength={2000} style={{ resize: 'vertical' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Priority</label>
          <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
            {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Audience</label>
          <select className="form-input" value={audience} onChange={e => setAudience(e.target.value)}>
            {AUDIENCE_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        {audience === 'DEPARTMENT' && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Department</label>
            <select className="form-input" value={dept} onChange={e => setDept(e.target.value)}>
              <option value="">Select...</option>
              {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
        )}

        {audience === 'BRANCH' && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Branch</label>
            <select className="form-input" value={branch} onChange={e => setBranch(e.target.value)}>
              <option value="">Select...</option>
              {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
        )}

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Expires On (optional)</label>
          <input className="form-input" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
        </div>
      </div>

      <button className="btn btn--primary" onClick={submit} disabled={busy} style={{ marginTop: 4 }}>
        {busy ? 'Saving...' : editing ? 'Update Announcement' : 'Publish Announcement'}
      </button>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */
export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [departments, setDepartments]     = useState([]);
  const [branches, setBranches]           = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toggling, setToggling] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [annRes, deptRes, branchRes] = await Promise.all([
        api.get('/announcements'),
        api.get('/departments'),
        api.get('/branches'),
      ]);
      setAnnouncements(annRes.data.data || []);
      setDepartments(deptRes.data.data || []);
      setBranches(branchRes.data.data || []);
    } catch { setAnnouncements([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    setDeleting(id);
    try {
      await api.delete(`/announcements/${id}`);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally { setDeleting(null); }
  };

  const handleToggle = async (ann) => {
    setToggling(ann._id);
    try {
      await api.patch(`/announcements/${ann._id}`, { isActive: !ann.isActive });
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed.');
    } finally { setToggling(null); }
  };

  const handleEdit = (ann) => {
    setEditing(ann);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditing(null);
    fetchAll();
  };

  const now = new Date();
  const active = announcements.filter(a => a.isActive && (!a.expiresAt || new Date(a.expiresAt) > now));
  const inactive = announcements.filter(a => !a.isActive || (a.expiresAt && new Date(a.expiresAt) <= now));

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-subtitle">Create and manage company announcements visible on the dashboard</p>
        </div>
        {!showForm && (
          <button className="btn btn--primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            + New Announcement
          </button>
        )}
      </div>

      {showForm && (
        <AnnouncementForm
          editing={editing}
          departments={departments}
          branches={branches}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {loading ? <div className="page-loading">Loading...</div> : (
        <>
          {/* Active announcements */}
          {active.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#15803d', marginBottom: 12 }}>
                Active ({active.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {active.map(ann => (
                  <div key={ann._id} className="card" style={{ padding: '16px 20px', borderLeft: `4px solid ${ann.priority === 'URGENT' ? '#dc2626' : ann.priority === 'IMPORTANT' ? '#d97706' : '#2563eb'}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{ann.title}</span>
                          <PriorityBadge priority={ann.priority} />
                          {ann.audience !== 'ALL' && (
                            <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: '#f3e8ff', color: '#7c3aed' }}>
                              {ann.audience === 'DEPARTMENT' ? ann.department?.name : ann.branch?.name}
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '0.88rem', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{ann.content}</p>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          By {ann.createdBy?.name} &middot; {fmt(ann.createdAt)}
                          {ann.expiresAt && <> &middot; Expires: {fmtDate(ann.expiresAt)}</>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                        <button className="btn btn--secondary" style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                          onClick={() => handleEdit(ann)}>Edit</button>
                        <button className="btn btn--secondary" style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                          onClick={() => handleToggle(ann)} disabled={toggling === ann._id}>
                          {toggling === ann._id ? '...' : 'Deactivate'}
                        </button>
                        <button className="btn btn--danger" style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                          onClick={() => handleDelete(ann._id)} disabled={deleting === ann._id}>
                          {deleting === ann._id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inactive / Expired */}
          {inactive.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#6b7280', marginBottom: 12 }}>
                Inactive / Expired ({inactive.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {inactive.map(ann => (
                  <div key={ann._id} className="card" style={{ padding: '14px 18px', opacity: 0.7 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#6b7280' }}>{ann.title}</span>
                          <PriorityBadge priority={ann.priority} />
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: '#f3f4f6', color: '#9ca3af' }}>
                            {!ann.isActive ? 'Deactivated' : 'Expired'}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#9ca3af' }}>{ann.content}</p>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          By {ann.createdBy?.name} &middot; {fmt(ann.createdAt)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn--secondary" style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                          onClick={() => handleToggle(ann)} disabled={toggling === ann._id}>
                          {toggling === ann._id ? '...' : 'Reactivate'}
                        </button>
                        <button className="btn btn--danger" style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                          onClick={() => handleDelete(ann._id)} disabled={deleting === ann._id}>
                          {deleting === ann._id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {announcements.length === 0 && (
            <div className="empty-state" style={{ paddingTop: 24 }}>
              <div className="empty-state-icon">&#128227;</div>
              <h3>No announcements yet</h3>
              <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Click "New Announcement" to create your first one</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
