import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

export default function ResignationPage() {
  const { user } = useAuthStore();
  const isHead = user?.isManagingHead || ['DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  const isHR   = user?.role === 'HR';

  if (isHead) return <HeadView />;
  if (isHR)   return <HRCombinedView />;
  return <EmployeeView />;
}

/* ─── Shared: employee resign section (no page wrapper) ──────── */
function MyResignationSection() {
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [reason,     setReason]     = useState('');
  const [lastDate,   setLastDate]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg,        setMsg]        = useState('');
  const [showForm,   setShowForm]   = useState(false);

  useEffect(() => { fetchMy(); }, []);

  const fetchMy = async () => {
    try {
      const { data } = await api.get('/resignations/my');
      setHistory(data.data || []);
    } catch { setHistory([]); }
    finally { setLoading(false); }
  };

  const latest        = history[0] || null;
  const isApproved    = latest?.status === 'APPROVED';
  const canApplyAgain = !latest || latest.status === 'REJECTED';

  const submit = async () => {
    if (!reason.trim()) return setMsg('Please enter a reason.');
    setSubmitting(true); setMsg('');
    try {
      await api.post('/resignations', { reason, lastWorkingDate: lastDate || undefined });
      setMsg('✅ Resignation submitted. HR will review it shortly.');
      setReason(''); setLastDate(''); setShowForm(false);
      fetchMy();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to submit.');
    } finally { setSubmitting(false); }
  };

  const downloadDocs = async (r) => {
    try {
      const res = await api.get(`/resignations/${r._id}/documents`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = 'Resignation_Documents.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Failed to download documents.'); }
  };

  if (loading) return <div style={{ padding: 16, color: '#6b7280' }}>Loading your resignation history...</div>;

  return (
    <div>
      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      {latest && (
        <div className="card" style={{ padding: 20, maxWidth: 600, width: '100%', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Latest Resignation</h4>
            <StatusBadge status={latest.status} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <InfoRow label="Reason" value={latest.reason} />
            {latest.lastWorkingDate && (
              <InfoRow label="Requested Last Day" value={new Date(latest.lastWorkingDate).toLocaleDateString('en-IN')} />
            )}
            <InfoRow label="Submitted On" value={new Date(latest.createdAt).toLocaleDateString('en-IN')} />
            {latest.hrNote && <InfoRow label="HR Note" value={latest.hrNote} />}
            {latest.headNote && <InfoRow label="Head Note" value={latest.headNote} />}
            {latest.rejectionNote && (
              <div className="alert alert--error" style={{ marginTop: 8 }}>Rejected: {latest.rejectionNote}</div>
            )}
          </div>
          {isApproved && (
            <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => downloadDocs(latest)}>
              ⬇ Download Experience Letter + Payslips
            </button>
          )}
          {canApplyAgain && !showForm && (
            <button className="btn btn--danger" style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>
              Apply for Resignation Again
            </button>
          )}
        </div>
      )}

      {(canApplyAgain && (showForm || !latest)) && (
        <div className="card" style={{ padding: 20, maxWidth: 600, width: '100%', marginBottom: 16 }}>
          <h4 style={{ marginBottom: 14 }}>{latest ? 'New Resignation Request' : 'Submit Resignation'}</h4>
          {latest?.status === 'REJECTED' && (
            <div className="alert alert--error" style={{ marginBottom: 12, fontSize: '0.85rem' }}>
              Your previous resignation was rejected. You can submit a new request below.
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Reason for Resignation *</label>
            <textarea className="form-input" rows={4}
              placeholder="Please state your reason for resignation..."
              value={reason} onChange={e => setReason(e.target.value)}
              style={{ resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Requested Last Working Date (optional)</label>
            <input type="date" className="form-input" value={lastDate}
              onChange={e => setLastDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--danger" onClick={submit} disabled={submitting || !reason.trim()}>
              {submitting ? 'Submitting...' : 'Submit Resignation'}
            </button>
            {latest && <button className="btn btn--secondary" onClick={() => setShowForm(false)}>Cancel</button>}
          </div>
        </div>
      )}

      {history.length > 1 && (
        <div style={{ maxWidth: 600, width: '100%' }}>
          <h4 style={{ marginBottom: 10, color: '#374151' }}>Previous Resignations</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.slice(1).map(r => (
              <div key={r._id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div style={{ fontSize: '0.9rem', color: '#374151' }}>{r.reason}</div>
                {r.rejectionNote && (
                  <div style={{ fontSize: '0.82rem', color: '#dc2626', marginTop: 4 }}>Rejection: {r.rejectionNote}</div>
                )}
                {r.status === 'APPROVED' && (
                  <button className="btn btn--secondary" style={{ fontSize: '0.78rem', marginTop: 8 }} onClick={() => downloadDocs(r)}>
                    ⬇ Documents
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Employee: submit + track own resignation ─────────────── */
function EmployeeView() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Resignation</h1>
        <p className="page-subtitle">Submit and track your resignation request</p>
      </div>
      <MyResignationSection />
    </div>
  );
}

/* ─── HR Combined: review panel + own resignation section ───── */
function HRCombinedView() {
  const [myOpen, setMyOpen] = useState(false);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Resignation</h1>
        <p className="page-subtitle">Review employee resignations and manage your own</p>
      </div>

      {/* HR review panel */}
      <HRPanel />

      {/* Collapsible own resignation section */}
      <div style={{ marginTop: 32, borderTop: '1px solid #e5e7eb', paddingTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>My Resignation</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>Submit or track your own resignation request</p>
          </div>
          <button className="btn btn--secondary" style={{ fontSize: '0.85rem' }} onClick={() => setMyOpen(o => !o)}>
            {myOpen ? 'Hide' : 'Show My Resignation'}
          </button>
        </div>
        {myOpen && <MyResignationSection />}
      </div>
    </div>
  );
}

/* ─── HR Panel: review pending resignations (no page wrapper) ── */
function HRPanel() {
  const [list,      setList]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [note,      setNote]      = useState('');
  const [msg,       setMsg]       = useState('');

  useEffect(() => { fetchList(); }, []);

  const fetchList = async () => {
    try {
      const { data } = await api.get('/resignations');
      setList(data.data);
    } finally { setLoading(false); }
  };

  const review = async (id, action) => {
    setMsg('');
    try {
      const { data } = await api.patch(`/resignations/${id}/hr-review`, { action, note });
      setMsg('✅ ' + data.message);
      setReviewing(null); setNote('');
      fetchList();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed.'));
    }
  };

  if (loading) return <div style={{ padding: 16, color: '#6b7280' }}>Loading resignations...</div>;

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 600 }}>Pending HR Review</h2>
      <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#6b7280' }}>Approve to forward to Managing Head, or reject</p>

      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      {list.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">📋</div>
          <h3>No pending resignations</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {list.map(r => (
            <div key={r._id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{r.employee?.name}</strong>
                  <span style={{ color: '#6b7280', marginLeft: 8, fontSize: '0.85rem' }}>{r.employee?.employeeId} · {r.employee?.designation}</span>
                  <div style={{ marginTop: 6, fontSize: '0.9rem' }}><strong>Reason:</strong> {r.reason}</div>
                  {r.lastWorkingDate && (
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      Last day: {new Date(r.lastWorkingDate).toLocaleDateString('en-IN')}
                    </div>
                  )}
                  <div style={{ marginTop: 4 }}><StatusBadge status={r.status} /></div>
                </div>
                {r.status === 'PENDING_HR' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn--primary" style={{ fontSize: '0.8rem' }}
                      onClick={() => { setReviewing({ id: r._id, action: 'approve' }); setNote(''); }}>
                      Approve & Forward
                    </button>
                    <button className="btn btn--danger" style={{ fontSize: '0.8rem' }}
                      onClick={() => { setReviewing({ id: r._id, action: 'reject' }); setNote(''); }}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewing && (
        <div className="modal-overlay" onClick={() => setReviewing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">
              {reviewing.action === 'approve' ? 'Approve & Forward to Head' : 'Reject Resignation'}
            </h3>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">{reviewing.action === 'reject' ? 'Rejection Reason *' : 'Note (optional)'}</label>
              <textarea className="form-input" rows={3} value={note} onChange={e => setNote(e.target.value)}
                placeholder={reviewing.action === 'reject' ? 'Reason for rejection...' : 'Any notes for the employee...'} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                className={reviewing.action === 'approve' ? 'btn btn--primary' : 'btn btn--danger'}
                onClick={() => review(reviewing.id, reviewing.action)}
                disabled={reviewing.action === 'reject' && !note.trim()}
              >
                Confirm
              </button>
              <button className="btn btn--secondary" onClick={() => setReviewing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Managing Head View: final approval ───────────────────── */
function HeadView() {
  const [list,      setList]      = useState([]);
  const [allList,   setAllList]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [note,      setNote]      = useState('');
  const [msg,       setMsg]       = useState('');
  const [tab,       setTab]       = useState('pending');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [pending, all] = await Promise.all([
        api.get('/resignations/pending-head'),
        api.get('/resignations'),
      ]);
      setList(pending.data.data);
      setAllList(all.data.data);
    } finally { setLoading(false); }
  };

  const review = async (id, action) => {
    setMsg('');
    try {
      const { data } = await api.patch(`/resignations/${id}/head-review`, { action, note });
      setMsg('✅ ' + data.message);
      setReviewing(null); setNote('');
      fetchAll();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed.'));
    }
  };

  const downloadDocs = async (resignation) => {
    try {
      const res = await api.get(`/resignations/${resignation._id}/documents`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `Resignation_${resignation.employee?.name?.replace(/\s+/g,'_')}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Failed to download documents.'); }
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  const displayList = tab === 'pending' ? list : allList;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Resignation Management</h1>
        <p className="page-subtitle">Final approval authority</p>
      </div>

      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn ${tab === 'pending' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('pending')}>
          Pending ({list.length})
        </button>
        <button className={`btn ${tab === 'all' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('all')}>
          All Resignations
        </button>
      </div>

      {displayList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>No resignations {tab === 'pending' ? 'pending your approval' : 'found'}</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {displayList.map(r => (
            <div key={r._id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{r.employee?.name}</strong>
                  <span style={{ color: '#6b7280', marginLeft: 8, fontSize: '0.85rem' }}>{r.employee?.employeeId} · {r.employee?.designation}</span>
                  <div style={{ marginTop: 4, fontSize: '0.9rem' }}><strong>Reason:</strong> {r.reason}</div>
                  {r.hrNote && <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 2 }}>HR Note: {r.hrNote}</div>}
                  <div style={{ marginTop: 6 }}><StatusBadge status={r.status} /></div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.status === 'PENDING_HEAD' && (
                    <>
                      <button className="btn btn--primary" style={{ fontSize: '0.8rem' }}
                        onClick={() => { setReviewing({ id: r._id, action: 'approve' }); setNote(''); }}>
                        Approve
                      </button>
                      <button className="btn btn--danger" style={{ fontSize: '0.8rem' }}
                        onClick={() => { setReviewing({ id: r._id, action: 'reject' }); setNote(''); }}>
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === 'APPROVED' && (
                    <button className="btn btn--secondary" style={{ fontSize: '0.8rem' }} onClick={() => downloadDocs(r)}>
                      ⬇ Documents
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewing && (
        <div className="modal-overlay" onClick={() => setReviewing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">
              {reviewing.action === 'approve' ? 'Approve Resignation' : 'Reject Resignation'}
            </h3>
            {reviewing.action === 'approve' && (
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 12 }}>
                Approving will finalize the resignation. Experience letter and payslips will become available for download.
              </p>
            )}
            <div className="form-group">
              <label className="form-label">{reviewing.action === 'reject' ? 'Rejection Reason *' : 'Note (optional)'}</label>
              <textarea className="form-input" rows={3} value={note} onChange={e => setNote(e.target.value)}
                placeholder={reviewing.action === 'reject' ? 'Reason for rejection...' : 'Any message for the employee...'} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                className={reviewing.action === 'approve' ? 'btn btn--primary' : 'btn btn--danger'}
                onClick={() => review(reviewing.id, reviewing.action)}
                disabled={reviewing.action === 'reject' && !note.trim()}
              >
                Confirm
              </button>
              <button className="btn btn--secondary" onClick={() => setReviewing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    PENDING_HR:   { label: 'Pending HR Review',   bg: '#fef3c7', color: '#d97706' },
    PENDING_HEAD: { label: 'Pending Head Approval', bg: '#dbeafe', color: '#2563eb' },
    APPROVED:     { label: 'Approved',              bg: '#dcfce7', color: '#16a34a' },
    REJECTED:     { label: 'Rejected',              bg: '#fee2e2', color: '#dc2626' },
  };
  const s = map[status] || { label: status, bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: '0.9rem', flexWrap: 'wrap' }}>
      <span style={{ color: '#6b7280', minWidth: 140 }}>{label}:</span>
      <span style={{ color: '#111827' }}>{value}</span>
    </div>
  );
}
