import { useState, useEffect, useRef } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';
import { Receipt } from 'lucide-react';

const CATEGORIES = [
  { value: 'TRAVEL',        label: 'Travel' },
  { value: 'FOOD',          label: 'Food' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'MEDICAL',       label: 'Medical' },
  { value: 'OTHER',         label: 'Other' },
];

const CAT_COLORS = {
  TRAVEL:        { bg: '#dbeafe', color: '#2563eb' },
  FOOD:          { bg: '#dcfce7', color: '#16a34a' },
  ACCOMMODATION: { bg: '#fef3c7', color: '#d97706' },
  COMMUNICATION: { bg: '#f3e8ff', color: '#7c3aed' },
  MEDICAL:       { bg: '#fee2e2', color: '#dc2626' },
  OTHER:         { bg: '#f3f4f6', color: '#374151' },
};

const STATUS_COLORS = {
  PENDING:  { bg: '#fef3c7', color: '#b45309' },
  APPROVED: { bg: '#dcfce7', color: '#15803d' },
  REJECTED: { bg: '#fee2e2', color: '#b91c1c' },
};

function CategoryBadge({ cat }) {
  const c = CAT_COLORS[cat] || CAT_COLORS.OTHER;
  const label = CATEGORIES.find(x => x.value === cat)?.label || cat;
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Employee: submit claim ─────────────────────────────────── */
function SubmitClaimForm({ onSubmitted }) {
  const fileRef = useRef();
  const [amount,      setAmount]      = useState('');
  const [category,    setCategory]    = useState('OTHER');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [file,        setFile]        = useState(null);
  const [busy,        setBusy]        = useState(false);
  const [msg,         setMsg]         = useState('');

  const submit = async () => {
    if (!amount || isNaN(amount) || Number(amount) < 1) return setMsg('Enter a valid amount (min ₹1).');
    if (!description.trim()) return setMsg('Description is required.');
    if (!expenseDate) return setMsg('Expense date is required.');
    setBusy(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('amount', amount);
      fd.append('category', category);
      fd.append('description', description.trim());
      fd.append('expenseDate', expenseDate);
      if (file) fd.append('receipt', file);
      await api.post('/expense-claims', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg('Claim submitted successfully.');
      setAmount(''); setCategory('OTHER'); setDescription(''); setExpenseDate(''); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      onSubmitted();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Submit failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <h4 style={{ margin: '0 0 14px', fontWeight: 600 }}>Submit Expense Claim</h4>
      {msg && (
        <div className={`alert ${msg.startsWith('Claim') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))', gap: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Amount (₹) *</label>
          <input className="form-input" type="number" min="1" value={amount}
            onChange={e => setAmount(e.target.value)} placeholder="e.g. 500" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Category</label>
          <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Expense Date *</label>
          <input className="form-input" type="date" value={expenseDate}
            onChange={e => setExpenseDate(e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Receipt (PDF/JPG/PNG, max 10 MB)</label>
          <input ref={fileRef} type="file" className="form-input"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => setFile(e.target.files[0] || null)} />
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 12 }}>
        <label className="form-label">Description *</label>
        <textarea className="form-input" rows={2} value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Brief reason for expense" style={{ resize: 'vertical' }} />
      </div>
      <button className="btn btn--primary" style={{ marginTop: 14 }}
        onClick={submit} disabled={busy}>
        {busy ? 'Submitting...' : 'Submit Claim'}
      </button>
    </div>
  );
}

/* ── Employee: claim history ────────────────────────────────── */
function MyClaims({ claims, onDeleted }) {
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this pending claim?')) return;
    setDeleting(id);
    try {
      await api.delete(`/expense-claims/${id}`);
      onDeleted();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally { setDeleting(null); }
  };

  if (!claims.length) {
    return (
      <div className="empty-state" style={{ paddingTop: 24 }}>
        <div className="empty-state-icon"><Receipt size={40} strokeWidth={1.5} color="#9ca3af" /></div>
        <h3>No claims yet</h3>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Submit an expense claim using the form above</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {claims.map(c => (
        <div key={c._id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>₹{c.amount.toLocaleString('en-IN')}</span>
              <CategoryBadge cat={c.category} />
              <StatusBadge status={c.status} />
            </div>
            <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#374151' }}>{c.description}</p>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              Expense date: {fmt(c.expenseDate)} &nbsp;·&nbsp; Submitted: {fmt(c.createdAt)}
              {c.status === 'APPROVED' && c.reimbursementType && (
                <> &nbsp;·&nbsp; Reimbursement: <strong>{c.reimbursementType === 'CASH' ? 'Cash' : 'Next salary'}</strong></>
              )}
              {c.reviewedBy?.name && <> &nbsp;·&nbsp; Reviewed by {c.reviewedBy.name}</>}
              {c.reviewNote && <> &nbsp;·&nbsp; Note: {c.reviewNote}</>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
            {c.receiptUrl && (
              <a href={c.receiptUrl} target="_blank" rel="noreferrer" className="btn btn--secondary" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
                Receipt
              </a>
            )}
            {c.status === 'PENDING' && (
              <button className="btn btn--danger" style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                onClick={() => handleDelete(c._id)} disabled={deleting === c._id}>
                {deleting === c._id ? '...' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── ACCOUNTS: review panel ─────────────────────────────────── */
function ReviewPanel() {
  const [claims,      setClaims]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [reviewing,   setReviewing]   = useState(null); // { id, action: 'approve'|'reject' }
  const [note,        setNote]         = useState('');
  const [reimType,    setReimType]     = useState('CASH');
  const [busy,        setBusy]         = useState(false);
  const [msg,         setMsg]          = useState('');

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const { data } = await api.get(`/expense-claims${params}`);
      setClaims(data.data);
    } catch { setClaims([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchClaims(); }, [statusFilter]);

  const openReview = (id, action) => { setReviewing({ id, action }); setNote(''); setReimType('CASH'); setMsg(''); };
  const closeReview = () => { setReviewing(null); setMsg(''); };

  const submitReview = async () => {
    setBusy(true); setMsg('');
    try {
      const payload = { action: reviewing.action, note };
      if (reviewing.action === 'approve') payload.reimbursementType = reimType;
      await api.patch(`/expense-claims/${reviewing.id}/review`, payload);
      closeReview();
      fetchClaims();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Action failed.');
    } finally { setBusy(false); }
  };

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['PENDING', 'APPROVED', 'REJECTED', ''].map(s => (
          <button key={s || 'ALL'}
            className={`btn ${statusFilter === s ? 'btn--primary' : 'btn--secondary'}`}
            style={{ fontSize: '0.82rem' }}
            onClick={() => setStatusFilter(s)}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Review modal */}
      {reviewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, padding: 24 }}>
            <h4 style={{ margin: '0 0 16px', fontWeight: 700 }}>
              {reviewing.action === 'approve' ? 'Approve Claim' : 'Reject Claim'}
            </h4>
            {reviewing.action === 'approve' && (
              <div className="form-group">
                <label className="form-label">Reimbursement Method *</label>
                <select className="form-input" value={reimType} onChange={e => setReimType(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="SALARY">Added to next salary</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Note (optional)</label>
              <textarea className="form-input" rows={2} value={note}
                onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
            </div>
            {msg && <div className="alert alert--error" style={{ marginBottom: 12 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn--secondary" onClick={closeReview} disabled={busy}>Cancel</button>
              <button
                className={`btn ${reviewing.action === 'approve' ? 'btn--primary' : 'btn--danger'}`}
                onClick={submitReview} disabled={busy}>
                {busy ? '...' : reviewing.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : claims.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon"><Receipt size={40} strokeWidth={1.5} color="#9ca3af" /></div>
          <h3>No {statusFilter || ''} claims</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {claims.map(c => (
            <div key={c._id} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>₹{c.amount.toLocaleString('en-IN')}</span>
                    <CategoryBadge cat={c.category} />
                    <StatusBadge status={c.status} />
                    {c.reimbursementType && (
                      <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>
                        via {c.reimbursementType === 'CASH' ? 'Cash' : 'Salary'}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#374151' }}>{c.description}</p>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    <strong>{c.employee?.name}</strong> ({c.employee?.employeeId}) &nbsp;·&nbsp;
                    {c.employee?.designation} &nbsp;·&nbsp;
                    Expense: {fmt(c.expenseDate)} &nbsp;·&nbsp; Submitted: {fmt(c.createdAt)}
                    {c.reviewNote && <> &nbsp;·&nbsp; Note: {c.reviewNote}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                  {c.receiptUrl && (
                    <a href={c.receiptUrl} target="_blank" rel="noreferrer"
                      className="btn btn--secondary" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
                      Receipt
                    </a>
                  )}
                  {c.status === 'PENDING' && (
                    <>
                      <button className="btn btn--primary" style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                        onClick={() => openReview(c._id, 'approve')}>
                        Approve
                      </button>
                      <button className="btn btn--danger" style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                        onClick={() => openReview(c._id, 'reject')}>
                        Reject
                      </button>
                    </>
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

/* ── Employee view ───────────────────────────────────────────── */
function EmployeeExpenseView() {
  const [claims,  setClaims]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('submit');

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/expense-claims/my');
      setClaims(data.data);
    } catch { setClaims([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchClaims(); }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Expense Claims</h1>
        <p className="page-subtitle">Submit and track your expense reimbursements</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn ${tab === 'submit' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setTab('submit')}>Submit Claim</button>
        <button className={`btn ${tab === 'history' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setTab('history')}>My Claims ({claims.length})</button>
      </div>

      {tab === 'submit' && <SubmitClaimForm onSubmitted={() => { fetchClaims(); setTab('history'); }} />}
      {tab === 'history' && (loading ? <div className="page-loading">Loading...</div> : <MyClaims claims={claims} onDeleted={fetchClaims} />)}
    </div>
  );
}

/* ── ACCOUNTS / DIRECTOR view ────────────────────────────────── */
function AccountsExpenseView() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Expense Claims</h1>
        <p className="page-subtitle">Review and approve employee expense claims</p>
      </div>
      <ReviewPanel />
    </div>
  );
}

/* ── Root ────────────────────────────────────────────────────── */
export default function ExpenseClaimsPage() {
  const { user } = useAuthStore();
  const isReviewer = ['ACCOUNTS', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  return isReviewer ? <AccountsExpenseView /> : <EmployeeExpenseView />;
}
