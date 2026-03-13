import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

const CATEGORIES = [
  { value: 'IT',      label: 'IT Support' },
  { value: 'HR',      label: 'HR' },
  { value: 'ADMIN',   label: 'Admin' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'OTHER',   label: 'Other' },
];

const PRIORITIES = [
  { value: 'LOW',      label: 'Low',      bg: '#dbeafe', color: '#2563eb' },
  { value: 'MEDIUM',   label: 'Medium',   bg: '#dcfce7', color: '#15803d' },
  { value: 'HIGH',     label: 'High',     bg: '#fef3c7', color: '#b45309' },
  { value: 'CRITICAL', label: 'Critical', bg: '#fee2e2', color: '#b91c1c' },
];

const STATUSES = [
  { value: 'OPEN',        label: 'Open',        bg: '#dbeafe', color: '#2563eb' },
  { value: 'IN_PROGRESS', label: 'In Progress', bg: '#fef3c7', color: '#b45309' },
  { value: 'RESOLVED',    label: 'Resolved',    bg: '#dcfce7', color: '#15803d' },
  { value: 'CLOSED',      label: 'Closed',      bg: '#f3f4f6', color: '#6b7280' },
];

function Badge({ list, value }) {
  const opt = list.find(s => s.value === value) || list[0];
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: opt.bg, color: opt.color, whiteSpace: 'nowrap' }}>
      {opt.label}
    </span>
  );
}

function fmt(d) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function fmtShort(d) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }

function SLATag({ ticket }) {
  if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
    const resolved = ticket.resolvedAt || ticket.closedAt;
    const tookHrs = resolved ? Math.round((new Date(resolved) - new Date(ticket.createdAt)) / 3600000) : '—';
    return <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>Resolved in {tookHrs}h</span>;
  }
  if (ticket.slaBreached) {
    return <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626' }}>SLA BREACHED</span>;
  }
  const remaining = Math.max(0, Math.round((new Date(ticket.slaDueAt) - new Date()) / 3600000));
  return <span style={{ fontSize: '0.72rem', color: remaining < 8 ? '#b45309' : '#15803d', fontWeight: 600 }}>{remaining}h left</span>;
}

/* ── Create ticket form ───────────────────────────────────── */
function CreateTicketForm({ onCreated }) {
  const [category, setCategory] = useState('IT');
  const [subject, setSubject]   = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (!subject.trim()) return setMsg('Subject is required.');
    if (!description.trim()) return setMsg('Description is required.');
    setBusy(true); setMsg('');
    try {
      const { data } = await api.post('/tickets', { category, subject, description, priority });
      setMsg(`Ticket ${data.data.ticketId} created!`);
      setSubject(''); setDescription('');
      onCreated();
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <h4 style={{ margin: '0 0 14px', fontWeight: 600 }}>Raise a Ticket</h4>
      {msg && <div className={`alert ${msg.includes('!') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Category *</label>
          <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Priority</label>
          <select className="form-input" value={priority} onChange={e => setPriority(e.target.value)}>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
        <label className="form-label">Subject *</label>
        <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief summary of the issue" maxLength={200} />
      </div>
      <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
        <label className="form-label">Description *</label>
        <textarea className="form-input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Detailed description..." maxLength={3000} style={{ resize: 'vertical' }} />
      </div>
      <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={submit} disabled={busy}>
        {busy ? 'Submitting...' : 'Submit Ticket'}
      </button>
    </div>
  );
}

/* ── Ticket detail with comments ──────────────────────────── */
function TicketDetail({ ticket, onClose, onUpdated, isAdmin }) {
  const [comment, setComment] = useState('');
  const [status, setStatus]   = useState(ticket.status);
  const [busy, setBusy]       = useState(false);

  const addComment = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await api.post(`/tickets/${ticket._id}/comment`, { message: comment });
      setComment('');
      onUpdated();
    } catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  const updateStatus = async () => {
    setBusy(true);
    try {
      await api.patch(`/tickets/${ticket._id}/status`, { status });
      onUpdated();
    } catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <button className="btn btn--secondary" style={{ marginBottom: 14, fontSize: '0.85rem' }} onClick={onClose}>&larr; Back</button>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827' }}>{ticket.ticketId}</span>
          <Badge list={STATUSES} value={ticket.status} />
          <Badge list={PRIORITIES} value={ticket.priority} />
          <Badge list={CATEGORIES.map(c => ({ ...c, bg: '#f3e8ff', color: '#7c3aed' }))} value={ticket.category} />
          <SLATag ticket={ticket} />
        </div>
        <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: '#111827' }}>{ticket.subject}</h3>
        <p style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{ticket.description}</p>
        <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
          {ticket.employee?.name && <>By <strong>{ticket.employee.name}</strong> ({ticket.employee?.employeeId}) &middot; </>}
          Created {fmt(ticket.createdAt)}
          {ticket.assignedTo?.name && <> &middot; Assigned to <strong>{ticket.assignedTo.name}</strong></>}
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="form-input" value={status} onChange={e => setStatus(e.target.value)} style={{ flex: '1 1 160px', minWidth: 0 }}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button className="btn btn--primary" style={{ fontSize: '0.85rem' }} onClick={updateStatus} disabled={busy || status === ticket.status}>
              Update Status
            </button>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="card" style={{ padding: 20 }}>
        <h4 style={{ margin: '0 0 14px', fontWeight: 600 }}>Comments ({ticket.comments?.length || 0})</h4>
        {ticket.comments?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {ticket.comments.map((c, i) => (
              <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: c.author?.role && ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(c.author.role) ? '#eff6ff' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>
                    {c.author?.name || 'Unknown'}
                    {c.author?.role && ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(c.author.role) && (
                      <span style={{ fontSize: '0.7rem', color: '#2563eb', marginLeft: 6 }}>Staff</span>
                    )}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{fmtShort(c.createdAt)}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{c.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: 16 }}>No comments yet.</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <input className="form-input" value={comment} onChange={e => setComment(e.target.value)} placeholder="Type a reply..." style={{ flex: 1 }} maxLength={2000} />
          <button className="btn btn--primary" onClick={addComment} disabled={busy || !comment.trim()}>
            {busy ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Ticket list ──────────────────────────────────────────── */
function TicketList({ tickets, onSelect }) {
  if (!tickets.length) {
    return (
      <div className="empty-state" style={{ paddingTop: 24 }}>
        <div className="empty-state-icon">&#127915;</div>
        <h3>No tickets found</h3>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tickets.map(t => (
        <div key={t._id} className="card" style={{ padding: '14px 18px', cursor: 'pointer', transition: 'box-shadow 0.15s', borderLeft: t.slaBreached && !['RESOLVED','CLOSED'].includes(t.status) ? '4px solid #dc2626' : '4px solid transparent' }}
          onClick={() => onSelect(t)}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2563eb' }}>{t.ticketId}</span>
              <Badge list={STATUSES} value={t.status} />
              <Badge list={PRIORITIES} value={t.priority} />
              <SLATag ticket={t} />
            </div>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{t.comments?.length || 0} comments</span>
          </div>
          <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '0.92rem', color: '#111827' }}>{t.subject}</p>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
            {t.employee?.name && <><strong>{t.employee.name}</strong> ({t.employee?.employeeId}) &middot; </>}
            {CATEGORIES.find(c => c.value === t.category)?.label} &middot; {fmtShort(t.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Employee view ────────────────────────────────────────── */
function EmployeeTicketView() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('create');
  const [selected, setSelected] = useState(null);

  const fetchTickets = async () => {
    setLoading(true);
    try { const { data } = await api.get('/tickets/my'); setTickets(data.data); }
    catch { setTickets([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchTickets(); }, []);

  if (selected) {
    const fresh = tickets.find(t => t._id === selected._id) || selected;
    return (
      <div className="page">
        <TicketDetail ticket={fresh} isAdmin={false} onClose={() => setSelected(null)} onUpdated={fetchTickets} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Help Desk</h1>
        <p className="page-subtitle">Raise tickets for IT, HR, or Admin support</p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn ${tab === 'create' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('create')}>New Ticket</button>
        <button className={`btn ${tab === 'my' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('my')}>My Tickets ({tickets.length})</button>
      </div>
      {tab === 'create' && <CreateTicketForm onCreated={() => { fetchTickets(); setTab('my'); }} />}
      {tab === 'my' && (loading ? <div className="page-loading">Loading...</div> : <TicketList tickets={tickets} onSelect={setSelected} />)}
    </div>
  );
}

/* ── HR/Admin view ────────────────────────────────────────── */
function AdminTicketView() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats]     = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter]       = useState('');
  const [selected, setSelected]         = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (catFilter) params.set('category', catFilter);
      const [tRes, sRes] = await Promise.all([
        api.get(`/tickets?${params.toString()}`),
        api.get('/tickets/stats'),
      ]);
      setTickets(tRes.data.data); setStats(sRes.data.data);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, [statusFilter, catFilter]);

  if (selected) {
    const fresh = tickets.find(t => t._id === selected._id) || selected;
    return (
      <div className="page">
        <TicketDetail ticket={fresh} isAdmin={true} onClose={() => { setSelected(null); fetchAll(); }} onUpdated={fetchAll} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Help Desk</h1>
        <p className="page-subtitle">Manage employee support tickets and SLA tracking</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Open', value: stats.open, bg: '#dbeafe', color: '#2563eb' },
          { label: 'In Progress', value: stats.inProgress, bg: '#fef3c7', color: '#b45309' },
          { label: 'Resolved', value: stats.resolved, bg: '#dcfce7', color: '#15803d' },
          { label: 'Closed', value: stats.closed, bg: '#f3f4f6', color: '#6b7280' },
          { label: 'SLA Breached', value: stats.breached, bg: '#fee2e2', color: '#b91c1c' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 18px', borderRadius: 10, background: s.bg, minWidth: 90, textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value ?? '—'}</div>
            <div style={{ fontSize: '0.72rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="form-input" value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : <TicketList tickets={tickets} onSelect={setSelected} />}
    </div>
  );
}

export default function TicketsPage() {
  const { user } = useAuthStore();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  return isAdmin ? <AdminTicketView /> : <EmployeeTicketView />;
}
