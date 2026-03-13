import { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';
import { FileText, Upload, Check, Clock, AlertTriangle, Eye, Users, X, ChevronDown, ChevronUp, Search } from 'lucide-react';

const CATEGORIES = ['LEAVE_POLICY', 'WFH_POLICY', 'CODE_OF_CONDUCT', 'IT_POLICY', 'SAFETY_POLICY', 'HR_POLICY', 'FINANCE_POLICY', 'OTHER'];
const CATEGORY_LABELS = {
  LEAVE_POLICY: 'Leave Policy', WFH_POLICY: 'WFH Policy', CODE_OF_CONDUCT: 'Code of Conduct',
  IT_POLICY: 'IT Policy', SAFETY_POLICY: 'Safety Policy', HR_POLICY: 'HR Policy',
  FINANCE_POLICY: 'Finance Policy', OTHER: 'Other',
};
const CATEGORY_COLORS = {
  LEAVE_POLICY: { bg: '#dbeafe', color: '#2563eb' }, WFH_POLICY: { bg: '#e0e7ff', color: '#4338ca' },
  CODE_OF_CONDUCT: { bg: '#fef3c7', color: '#b45309' }, IT_POLICY: { bg: '#d1fae5', color: '#047857' },
  SAFETY_POLICY: { bg: '#fed7aa', color: '#c2410c' }, HR_POLICY: { bg: '#ede9fe', color: '#6d28d9' },
  FINANCE_POLICY: { bg: '#cffafe', color: '#0e7490' }, OTHER: { bg: '#f3f4f6', color: '#4b5563' },
};

function Badge({ text, bg, color }) {
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: bg, color, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ── Employee View ──────────────────────────────────────────── */
function EmployeePolicies() {
  const { user } = useAuthStore();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [expanded, setExpanded] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/policies/active');
      setPolicies(data.data);
    } catch { setPolicies([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAck = async (id) => {
    setMsg('');
    try {
      await api.post(`/policies/${id}/acknowledge`);
      setMsg('Policy acknowledged successfully!');
      load();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to acknowledge.');
    }
  };

  const isAcked = (policy) => policy.acknowledgments?.some(a => {
    const empId = a.employee?._id || a.employee;
    return empId?.toString() === user?._id;
  });

  const filtered = filter === 'ALL' ? policies
    : filter === 'PENDING' ? policies.filter(p => p.isMandatory && !isAcked(p))
    : filter === 'ACKNOWLEDGED' ? policies.filter(p => isAcked(p))
    : policies;

  const pendingCount = policies.filter(p => p.isMandatory && !isAcked(p)).length;

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading policies...</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Company Policies</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.88rem' }}>Read and acknowledge company policy documents</p>
        </div>
        {pendingCount > 0 && (
          <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '6px 14px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={16} /> {pendingCount} pending acknowledgment{pendingCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {msg && <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, background: msg.includes('success') ? '#dcfce7' : '#fef2f2', color: msg.includes('success') ? '#15803d' : '#b91c1c', fontSize: '0.88rem', fontWeight: 500 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['ALL', 'PENDING', 'ACKNOWLEDGED'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
            background: filter === f ? '#2563eb' : '#fff', color: filter === f ? '#fff' : '#374151',
          }}>
            {f === 'ALL' ? `All (${policies.length})` : f === 'PENDING' ? `Pending (${pendingCount})` : `Acknowledged (${policies.filter(p => isAcked(p)).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <FileText size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>No policies found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(p => {
            const acked = isAcked(p);
            const isOpen = expanded === p._id;
            const catColor = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.OTHER;
            return (
              <div key={p._id} style={{ background: '#fff', borderRadius: 12, border: acked ? '2px solid #22c55e' : p.isMandatory ? '2px solid #f59e0b' : '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 12 }} onClick={() => setExpanded(isOpen ? null : p._id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: catColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={20} color={catColor.color} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{p.title}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Badge text={CATEGORY_LABELS[p.category] || p.category} bg={catColor.bg} color={catColor.color} />
                        {p.isMandatory && <Badge text="Mandatory" bg="#fef2f2" color="#b91c1c" />}
                        <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>v{p.version}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {acked ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#15803d', fontWeight: 600, fontSize: '0.82rem' }}>
                        <Check size={16} /> Acknowledged
                      </span>
                    ) : p.isMandatory ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#b45309', fontWeight: 600, fontSize: '0.82rem' }}>
                        <Clock size={16} /> Pending
                      </span>
                    ) : null}
                    {isOpen ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 20px 16px', borderTop: '1px solid #f3f4f6' }}>
                    {p.description && <p style={{ margin: '12px 0', color: '#4b5563', fontSize: '0.88rem', lineHeight: 1.6 }}>{p.description}</p>}
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.82rem', color: '#6b7280', margin: '8px 0 14px' }}>
                      <span>Effective: {fmt(p.effectiveDate)}</span>
                      {p.expiryDate && <span>Expires: {fmt(p.expiryDate)}</span>}
                      <span>Size: {formatBytes(p.fileSize)}</span>
                      <span>Uploaded by: {p.uploadedBy?.name || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <a href={p.fileUrl} target="_blank" rel="noreferrer" style={{
                        padding: '8px 18px', borderRadius: 8, background: '#2563eb', color: '#fff', textDecoration: 'none',
                        fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                        <Eye size={15} /> View Document
                      </a>
                      {!acked && (
                        <button onClick={() => handleAck(p._id)} style={{
                          padding: '8px 18px', borderRadius: 8, background: '#15803d', color: '#fff', border: 'none', cursor: 'pointer',
                          fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
                        }}>
                          <Check size={15} /> I have read & acknowledge this policy
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── HR / Admin View ────────────────────────────────────────── */
function AdminPolicies() {
  const [policies, setPolicies] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPending, setShowPending] = useState(null);
  const [pendingList, setPendingList] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState(null);

  const [form, setForm] = useState({ title: '', description: '', category: 'OTHER', version: '1.0', isMandatory: true, effectiveDate: '', expiryDate: '', targetAudience: 'ALL', file: null });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filterCat) params.category = filterCat;
      if (filterActive) params.isActive = filterActive;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      const [pRes, sRes] = await Promise.all([
        api.get('/policies', { params }),
        api.get('/policies/stats'),
      ]);
      setPolicies(pRes.data.data);
      setStats(sRes.data.data);
    } catch { setPolicies([]); }
    finally { setLoading(false); }
  }, [filterCat, filterActive, searchTerm]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.file) { setMsg('Please select a file.'); return; }
    setSubmitting(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('category', form.category);
      fd.append('version', form.version);
      fd.append('isMandatory', form.isMandatory);
      if (form.effectiveDate) fd.append('effectiveDate', form.effectiveDate);
      if (form.expiryDate) fd.append('expiryDate', form.expiryDate);
      fd.append('targetAudience', form.targetAudience);

      await api.post('/policies', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg('Policy uploaded successfully!');
      setShowForm(false);
      setForm({ title: '', description: '', category: 'OTHER', version: '1.0', isMandatory: true, effectiveDate: '', expiryDate: '', targetAudience: 'ALL', file: null });
      load();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Upload failed.');
    } finally { setSubmitting(false); }
  };

  const handleToggleActive = async (id, currentActive) => {
    try {
      await api.patch(`/policies/${id}`, { isActive: !currentActive });
      load();
    } catch (err) { setMsg(err.response?.data?.message || 'Update failed.'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this policy permanently?')) return;
    try {
      await api.delete(`/policies/${id}`);
      setMsg('Policy deleted.');
      load();
    } catch (err) { setMsg(err.response?.data?.message || 'Delete failed.'); }
  };

  const viewPending = async (id) => {
    if (showPending === id) { setShowPending(null); return; }
    setPendingLoading(true);
    setShowPending(id);
    try {
      const { data } = await api.get(`/policies/${id}/pending`);
      setPendingList(data.data);
    } catch { setPendingList([]); }
    finally { setPendingLoading(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading policies...</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Policy Document Manager</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.88rem' }}>Upload policies & track employee acknowledgments</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 20px', borderRadius: 8, background: showForm ? '#ef4444' : '#2563eb', color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {showForm ? <><X size={16} /> Cancel</> : <><Upload size={16} /> Upload Policy</>}
        </button>
      </div>

      {msg && <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, background: msg.includes('success') || msg.includes('deleted') ? '#dcfce7' : '#fef2f2', color: msg.includes('success') || msg.includes('deleted') ? '#15803d' : '#b91c1c', fontSize: '0.88rem', fontWeight: 500 }}>{msg}</div>}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Policies', value: stats.totalPolicies, bg: '#eff6ff', color: '#2563eb', icon: <FileText size={20} /> },
            { label: 'Active', value: stats.activePolicies, bg: '#f0fdf4', color: '#15803d', icon: <Check size={20} /> },
            { label: 'Mandatory', value: stats.mandatoryPolicies, bg: '#fefce8', color: '#b45309', icon: <AlertTriangle size={20} /> },
            { label: 'Compliance Rate', value: `${stats.overallComplianceRate}%`, bg: stats.overallComplianceRate >= 80 ? '#f0fdf4' : stats.overallComplianceRate >= 50 ? '#fefce8' : '#fef2f2', color: stats.overallComplianceRate >= 80 ? '#15803d' : stats.overallComplianceRate >= 50 ? '#b45309' : '#b91c1c', icon: <Users size={20} /> },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: s.color }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Upload New Policy</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle}>Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required maxLength={200} style={inputStyle} placeholder="e.g. Leave Policy 2025" />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Version</label>
              <input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} maxLength={20} style={inputStyle} placeholder="1.0" />
            </div>
            <div>
              <label style={labelStyle}>Target Audience</label>
              <select value={form.targetAudience} onChange={e => setForm({ ...form, targetAudience: e.target.value })} style={inputStyle}>
                <option value="ALL">All Employees</option>
                <option value="DEPARTMENT">Specific Department</option>
                <option value="BRANCH">Specific Branch</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Effective Date</label>
              <input type="date" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Expiry Date (optional)</label>
              <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>File (PDF, DOC, DOCX, JPG, PNG) *</label>
              <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => setForm({ ...form, file: e.target.files[0] })} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
              <input type="checkbox" id="mandatory-cb" checked={form.isMandatory} onChange={e => setForm({ ...form, isMandatory: e.target.checked })} />
              <label htmlFor="mandatory-cb" style={{ fontSize: '0.88rem', fontWeight: 500 }}>Mandatory acknowledgment required</label>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Description (optional)</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={1000} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Brief summary of this policy..." />
          </div>
          <button type="submit" disabled={submitting} style={{
            marginTop: 16, padding: '10px 24px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.88rem', fontWeight: 600, opacity: submitting ? 0.6 : 1,
          }}>
            {submitting ? 'Uploading…' : 'Upload Policy'}
          </button>
        </form>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search policies..." style={{ ...inputStyle, paddingLeft: 32, margin: 0, width: '100%' }} />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...inputStyle, margin: 0, minWidth: 140 }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value)} style={{ ...inputStyle, margin: 0, minWidth: 120 }}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Policy List */}
      {policies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <FileText size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>No policies found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {policies.map(p => {
            const catColor = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.OTHER;
            const ackCount = p.acknowledgmentCount || p.acknowledgments?.length || 0;
            const isOpen = expanded === p._id;
            return (
              <div key={p._id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', opacity: p.isActive ? 1 : 0.6 }}>
                <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 12 }} onClick={() => setExpanded(isOpen ? null : p._id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: catColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={20} color={catColor.color} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {p.title}
                        {!p.isActive && <Badge text="Inactive" bg="#f3f4f6" color="#6b7280" />}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Badge text={CATEGORY_LABELS[p.category] || p.category} bg={catColor.bg} color={catColor.color} />
                        {p.isMandatory && <Badge text="Mandatory" bg="#fef2f2" color="#b91c1c" />}
                        <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>v{p.version}</span>
                        <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>•</span>
                        <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{ackCount} acknowledged</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isOpen ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 20px 16px', borderTop: '1px solid #f3f4f6' }}>
                    {p.description && <p style={{ margin: '12px 0', color: '#4b5563', fontSize: '0.88rem', lineHeight: 1.6 }}>{p.description}</p>}
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.82rem', color: '#6b7280', margin: '8px 0 14px' }}>
                      <span>Effective: {fmt(p.effectiveDate)}</span>
                      {p.expiryDate && <span>Expires: {fmt(p.expiryDate)}</span>}
                      <span>Size: {formatBytes(p.fileSize)}</span>
                      <span>Uploaded: {fmt(p.createdAt)} by {p.uploadedBy?.name || '—'}</span>
                    </div>

                    {/* Acknowledgment Progress */}
                    {stats && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Acknowledgment Progress</span>
                          <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{ackCount} / {stats.activeEmployees}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 4, transition: 'width 0.3s',
                            width: `${stats.activeEmployees > 0 ? Math.round((ackCount / stats.activeEmployees) * 100) : 0}%`,
                            background: ackCount === stats.activeEmployees ? '#22c55e' : ackCount > stats.activeEmployees * 0.5 ? '#f59e0b' : '#ef4444',
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Acknowledged list */}
                    {p.acknowledgments && p.acknowledgments.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>Acknowledged by:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {p.acknowledgments.map((a, i) => (
                            <span key={i} style={{ padding: '3px 10px', borderRadius: 6, background: '#f0fdf4', color: '#15803d', fontSize: '0.78rem', fontWeight: 500 }}>
                              {a.employee?.name || '—'} ({a.employee?.employeeId || '—'}) — {fmt(a.acknowledgedAt)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a href={p.fileUrl} target="_blank" rel="noreferrer" style={{
                        padding: '7px 16px', borderRadius: 8, background: '#2563eb', color: '#fff', textDecoration: 'none',
                        fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                        <Eye size={14} /> View
                      </a>
                      <button onClick={() => viewPending(p._id)} style={{
                        padding: '7px 16px', borderRadius: 8, background: '#f59e0b', color: '#fff', border: 'none', cursor: 'pointer',
                        fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                        <Users size={14} /> {showPending === p._id ? 'Hide' : 'View'} Pending
                      </button>
                      <button onClick={() => handleToggleActive(p._id, p.isActive)} style={{
                        padding: '7px 16px', borderRadius: 8, background: p.isActive ? '#6b7280' : '#22c55e', color: '#fff', border: 'none', cursor: 'pointer',
                        fontSize: '0.82rem', fontWeight: 600,
                      }}>
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(p._id)} style={{
                        padding: '7px 16px', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer',
                        fontSize: '0.82rem', fontWeight: 600,
                      }}>
                        Delete
                      </button>
                    </div>

                    {/* Pending Employees List */}
                    {showPending === p._id && (
                      <div style={{ marginTop: 14, background: '#fffbeb', borderRadius: 10, padding: 14, border: '1px solid #fde68a' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 8, color: '#b45309' }}>Employees who haven't acknowledged:</div>
                        {pendingLoading ? <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Loading…</p> : pendingList.length === 0 ? (
                          <p style={{ color: '#15803d', fontSize: '0.85rem', fontWeight: 500 }}>All employees have acknowledged this policy!</p>
                        ) : (
                          <div style={{ maxHeight: 200, overflowY: 'auto', overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #fde68a' }}>
                                  <th style={{ textAlign: 'left', padding: '4px 8px', color: '#92400e' }}>Employee ID</th>
                                  <th style={{ textAlign: 'left', padding: '4px 8px', color: '#92400e' }}>Name</th>
                                  <th style={{ textAlign: 'left', padding: '4px 8px', color: '#92400e' }}>Designation</th>
                                  <th style={{ textAlign: 'left', padding: '4px 8px', color: '#92400e' }}>Department</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pendingList.map(e => (
                                  <tr key={e._id} style={{ borderBottom: '1px solid #fef3c7' }}>
                                    <td style={{ padding: '4px 8px' }}>{e.employeeId}</td>
                                    <td style={{ padding: '4px 8px', fontWeight: 500 }}>{e.name}</td>
                                    <td style={{ padding: '4px 8px' }}>{e.designation || '—'}</td>
                                    <td style={{ padding: '4px 8px' }}>{e.department?.name || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 };
const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' };

/* ── Main Export ─────────────────────────────────────────────── */
export default function PolicyDocumentsPage() {
  const { user } = useAuthStore();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {isAdmin ? <AdminPolicies /> : <EmployeePolicies />}
    </div>
  );
}
