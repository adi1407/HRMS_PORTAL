import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../utils/api';
import { Sun } from 'lucide-react';

const LEAVE_TYPES = ['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID', 'COMP_OFF', 'OTHER'];

const STATUS_COLOR = {
  PENDING:   { bg: '#fef3c7', text: '#d97706' },
  APPROVED:  { bg: '#dcfce7', text: '#16a34a' },
  REJECTED:  { bg: '#fee2e2', text: '#dc2626' },
  CANCELLED: { bg: '#f3f4f6', text: '#6b7280' },
};

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.CANCELLED;
  return (
    <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: c.bg, color: c.text }}>
      {status}
    </span>
  );
}

export default function LeavePage() {
  const [searchParams] = useSearchParams();
  const fromCal = searchParams.get('from');
  const toCal = searchParams.get('to');
  const { user } = useAuthStore();
  const isAdmin = ['SUPER_ADMIN', 'DIRECTOR', 'HR'].includes(user?.role);
  const isHR    = user?.role === 'HR';

  const dateOk = (s) => s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (dateOk(fromCal)) {
    const toSafe = dateOk(toCal) ? toCal : fromCal;
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Apply for leave</h1>
          <p className="page-subtitle">Dates are pre-filled from your dashboard calendar</p>
        </div>
        <EmployeeLeaveContent initialFrom={fromCal} initialTo={toSafe} />
      </div>
    );
  }

  if (isHR)    return <HRLeaveView />;
  if (isAdmin) return <AdminLeaveView />;
  return <EmployeeLeaveView />;
}

/* ─── HR View: admin approval panel + own personal leave section ── */
function HRLeaveView() {
  const [showMyLeave, setShowMyLeave] = useState(false);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Leave Management</h1>
        <p className="page-subtitle">Review leave requests, grant comp-offs, and manage your own leave</p>
      </div>

      {/* Admin section */}
      <AdminLeaveContent />

      {/* HR personal leave section — collapsible */}
      <div style={{ marginTop: 32 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 10, cursor: 'pointer', userSelect: 'none',
          }}
          onClick={() => setShowMyLeave(v => !v)}
        >
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e40af' }}>
            My Own Leave Application
          </h2>
          <span style={{ fontSize: '1.2rem', color: '#1e40af' }}>{showMyLeave ? '▲' : '▼'}</span>
        </div>
        {showMyLeave && (
          <div style={{ marginTop: 16 }}>
            <EmployeeLeaveContent />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Employee View ────────────────────────────────────────────── */
function EmployeeLeaveView() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Leave</h1>
        <p className="page-subtitle">Apply for leave or view your application history</p>
      </div>
      <EmployeeLeaveContent />
    </div>
  );
}

/* ─── Employee leave form + history (reused in HRLeaveView) ─────── */
function EmployeeLeaveContent({ initialFrom, initialTo }) {
  const [tab, setTab]     = useState('apply');
  const [form, setForm]   = useState({ type: 'CASUAL', fromDate: '', toDate: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]     = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialFrom) {
      const end = initialTo || initialFrom;
      setForm((f) => ({ ...f, fromDate: initialFrom, toDate: end }));
      setTab('apply');
    }
  }, [initialFrom, initialTo]);

  useEffect(() => {
    if (tab === 'history') fetchLeaves();
  }, [tab]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leaves/my');
      setLeaves(data.data);
    } catch {}
    finally { setLoading(false); }
  };

  const totalDays = form.fromDate && form.toDate
    ? Math.max(0, Math.ceil((new Date(form.toDate) - new Date(form.fromDate)) / (1000 * 60 * 60 * 24)) + 1)
    : 0;

  const handleApply = async (e) => {
    e.preventDefault();
    if (totalDays < 1) { setMsg({ success: false, text: 'To Date must be on or after From Date.' }); return; }
    setSaving(true); setMsg(null);
    try {
      await api.post('/leaves', form);
      setMsg({ success: true, text: 'Leave application submitted successfully.' });
      setForm({ type: 'CASUAL', fromDate: '', toDate: '', reason: '' });
    } catch (err) {
      setMsg({ success: false, text: err.response?.data?.message || 'Failed to submit.' });
    } finally { setSaving(false); }
  };

  return (
    <>
      {msg && (
        <div className={`alert ${msg.success ? 'alert--success' : 'alert--error'}`}>{msg.text}</div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'apply' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('apply')}>
          Apply Leave
        </button>
        <button className={`btn ${tab === 'history' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('history')}>
          My History
        </button>
      </div>

      {tab === 'apply' && (
        <div className="card">
          <h3 className="card-title">New Leave Application</h3>
          <form onSubmit={handleApply} className="emp-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Leave Type *</label>
                <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {LEAVE_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t === 'COMP_OFF' ? 'Compensatory Off' : t.charAt(0) + t.slice(1).toLowerCase() + ' Leave'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">From Date *</label>
                <input
                  className="form-input" type="date" required
                  value={form.fromDate}
                  onChange={e => setForm({ ...form, fromDate: e.target.value, toDate: form.toDate < e.target.value ? e.target.value : form.toDate })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">To Date *</label>
                <input
                  className="form-input" type="date" required
                  min={form.fromDate}
                  value={form.toDate}
                  onChange={e => setForm({ ...form, toDate: e.target.value })}
                />
              </div>
            </div>
            {totalDays > 0 && (
              <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '-4px 0 12px' }}>
                Duration: <strong>{totalDays} day(s)</strong>
              </p>
            )}
            <div className="form-group">
              <label className="form-label">Reason *</label>
              <textarea
                className="form-input" required rows={3}
                placeholder="Briefly describe the reason for leave…"
                value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Application'}
            </button>
          </form>
        </div>
      )}

      {tab === 'history' && (
        <>
          {loading && <div className="page-loading">Loading…</div>}
          {!loading && leaves.length === 0 && (
            <p style={{ color: '#6b7280' }}>No leave applications yet.</p>
          )}
          {!loading && leaves.length > 0 && (
            <div className="table-wrapper">
              <table className="table table--responsive">
                <thead>
                  <tr>
                    <th>Type</th><th>From</th><th>To</th><th>Days</th>
                    <th>Reason</th><th>Status</th><th>Admin Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map(l => (
                    <tr key={l._id}>
                      <td data-label="Type">
                        {l.type === 'COMP_OFF'
                          ? <span style={{ background: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700 }}>Comp Off</span>
                          : l.type}
                      </td>
                      <td data-label="From">{new Date(l.fromDate).toLocaleDateString('en-IN')}</td>
                      <td data-label="To">{new Date(l.toDate).toLocaleDateString('en-IN')}</td>
                      <td data-label="Days">{l.totalDays}</td>
                      <td data-label="Reason" style={{ maxWidth: '200px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{l.reason}</td>
                      <td data-label="Status"><StatusBadge status={l.status} /></td>
                      <td data-label="Notes" style={{ fontSize: '0.8rem', color: '#6b7280' }}>{l.reviewNotes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ─── Admin View ───────────────────────────────────────────────── */
function AdminLeaveView() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Leave Management</h1>
        <p className="page-subtitle">Review leave requests &amp; grant compensatory offs</p>
      </div>
      <AdminLeaveContent />
    </div>
  );
}

/* ─── Admin leave content (reused in HRLeaveView) ───────────────── */
function AdminLeaveContent() {
  const [tab, setTab]           = useState('requests');
  const [leaves, setLeaves]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('PENDING');
  const [reviewing, setReviewing] = useState({});
  const [saving, setSaving]     = useState(null);
  const [msg, setMsg]           = useState(null);

  useEffect(() => { if (tab === 'requests') fetchLeaves(); }, [filter, tab]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const qs = filter !== 'ALL' ? `?status=${filter}` : '';
      const { data } = await api.get(`/leaves${qs}`);
      setLeaves(data.data);
    } catch {}
    finally { setLoading(false); }
  };

  const setReviewField = (id, field, value) =>
    setReviewing(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleReview = async (leaveId, status) => {
    setSaving(leaveId + status); setMsg(null);
    try {
      await api.patch(`/leaves/${leaveId}/review`, {
        status,
        reviewNotes: reviewing[leaveId]?.notes || '',
        isPaid: reviewing[leaveId]?.isPaid !== false,
      });
      setMsg({ success: true, text: `Leave ${status.toLowerCase()} successfully.` });
      fetchLeaves();
    } catch (err) {
      setMsg({ success: false, text: err.response?.data?.message || 'Action failed.' });
    } finally { setSaving(null); }
  };

  const filters = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];

  return (
    <>
      {msg && (
        <div className={`alert ${msg.success ? 'alert--success' : 'alert--error'}`}>{msg.text}</div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'requests' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('requests')}>
          Leave Requests
        </button>
        <button className={`btn ${tab === 'compoff' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => { setTab('compoff'); setMsg(null); }}>
          Comp Off (Sunday Work)
        </button>
      </div>

      {tab === 'requests' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {filters.map(s => (
              <button
                key={s}
                className={`btn ${filter === s ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setFilter(s)}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {loading && <div className="page-loading">Loading…</div>}

          {!loading && leaves.length === 0 && (
            <p style={{ color: '#6b7280' }}>
              No {filter !== 'ALL' ? filter.toLowerCase() : ''} leave requests found.
            </p>
          )}

          {!loading && leaves.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {leaves.map(l => (
                <div key={l._id} className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: '0.95rem' }}>
                        {l.employee?.name}&nbsp;
                        <span className="role-badge">{l.employee?.employeeId}</span>
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '0.88rem' }}>
                        <strong>{l.type === 'COMP_OFF' ? 'Comp Off' : l.type}</strong>
                        &nbsp;·&nbsp;
                        {new Date(l.fromDate).toLocaleDateString('en-IN')} → {new Date(l.toDate).toLocaleDateString('en-IN')}
                        &nbsp;·&nbsp; <strong>{l.totalDays} day(s)</strong>
                        {l.isPaid !== undefined && l.status === 'APPROVED' && (
                          <span style={{ marginLeft: 8, fontSize: '0.78rem', color: '#6b7280' }}>
                            ({l.isPaid ? 'Paid' : 'Unpaid'})
                          </span>
                        )}
                      </p>
                      <p style={{ margin: '2px 0', fontSize: '0.82rem', color: '#4b5563' }}>{l.reason}</p>
                      {l.reviewNotes && (
                        <p style={{ margin: '2px 0', fontSize: '0.78rem', color: '#6b7280' }}>Notes: {l.reviewNotes}</p>
                      )}
                      <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                        Applied {new Date(l.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>

                  {l.status === 'PENDING' && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          className="form-input"
                          placeholder="Review notes (optional)"
                          style={{ flex: 1, minWidth: '180px', padding: '6px 10px', fontSize: '0.85rem' }}
                          value={reviewing[l._id]?.notes || ''}
                          onChange={e => setReviewField(l._id, 'notes', e.target.value)}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={reviewing[l._id]?.isPaid !== false}
                            onChange={e => setReviewField(l._id, 'isPaid', e.target.checked)}
                          />
                          Paid Leave
                        </label>
                        <button
                          className="btn btn--primary"
                          style={{ padding: '6px 16px' }}
                          disabled={saving === l._id + 'APPROVED'}
                          onClick={() => handleReview(l._id, 'APPROVED')}
                        >
                          {saving === l._id + 'APPROVED' ? '…' : 'Approve'}
                        </button>
                        <button
                          className="btn btn--danger"
                          style={{ padding: '6px 16px' }}
                          disabled={saving === l._id + 'REJECTED'}
                          onClick={() => handleReview(l._id, 'REJECTED')}
                        >
                          {saving === l._id + 'REJECTED' ? '…' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'compoff' && <CompOffPanel onMsg={setMsg} />}
    </>
  );
}

/* ─── Comp Off Panel ─────────────────────────────────────────────── */
function CompOffPanel({ onMsg }) {
  const [month,   setMonth]   = useState(new Date().getMonth() + 1);
  const [year,    setYear]    = useState(new Date().getFullYear());
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(false);
  const [grantModal, setGrantModal] = useState(null);
  const [compOffDate, setCompOffDate] = useState('');
  const [compOffNote, setCompOffNote] = useState('');
  const [granting,    setGranting]    = useState(false);
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => { fetchSundayWorkers(); }, [month, year]);

  const fetchSundayWorkers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/leaves/sunday-workers?month=${month}&year=${year}`);
      setGrouped(data.data || {});
    } catch (err) {
      onMsg({ success: false, text: err.response?.data?.message || 'Failed to load Sunday workers.' });
    } finally { setLoading(false); }
  };

  const openGrant = (sundayDate, emp) => {
    setGrantModal({ employeeId: emp.employeeId, name: emp.name, empId: emp.empId, sundayDate });
    const nextDay = new Date(sundayDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setCompOffDate(nextDay.toISOString().slice(0, 10));
    setCompOffNote('');
    onMsg(null);
  };

  const handleGrant = async () => {
    if (!compOffDate) return;
    setGranting(true);
    try {
      const { data } = await api.post('/leaves/grant-comp-off', {
        employeeId:       grantModal.employeeId,
        sundayWorkedDate: grantModal.sundayDate,
        compOffDate,
        reason: compOffNote || `Comp off for working on Sunday ${new Date(grantModal.sundayDate).toLocaleDateString('en-IN')}`,
      });
      onMsg({ success: true, text: data.message });
      setGrantModal(null);
      fetchSundayWorkers();
    } catch (err) {
      onMsg({ success: false, text: err.response?.data?.message || 'Failed to grant comp off.' });
    } finally { setGranting(false); }
  };

  const sundayDates = Object.keys(grouped).sort();

  return (
    <div>
      <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 20, fontSize: '0.87rem', color: '#166534' }}>
        <strong>Compensatory Off Policy</strong><br />
        Employees who work on a Sunday are entitled to a compensatory day off on any other working day.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <select className="form-select" style={{ maxWidth: 140 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS_FULL.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: 110 }} value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn--secondary" onClick={fetchSundayWorkers}>Refresh</button>
      </div>

      {loading && <div className="page-loading">Checking Sunday attendance…</div>}

      {!loading && sundayDates.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Sun size={40} strokeWidth={1.5} color="#9ca3af" /></div>
          <h3>No Sunday workers</h3>
          <p>No employees have attendance records on Sundays in {MONTHS_FULL[month-1]} {year}.</p>
        </div>
      )}

      {!loading && sundayDates.map(dateStr => {
        const workers = grouped[dateStr];
        const label = new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
        return (
          <div key={dateStr} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                {label}
                <span style={{ marginLeft: 10, fontSize: '0.78rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                  {workers.length} worker{workers.length !== 1 ? 's' : ''}
                </span>
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {workers.map((emp, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{emp.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                      {emp.empId} &nbsp;·&nbsp; {emp.designation || 'Employee'} &nbsp;·&nbsp;
                      <span style={{ fontWeight: 600, color: emp.status === 'FULL_DAY' ? '#16a34a' : '#d97706' }}>
                        {emp.status?.replace(/_/g, ' ')}
                      </span>
                    </p>
                  </div>
                  <button
                    className="btn btn--primary"
                    style={{ padding: '6px 14px', fontSize: '12.5px' }}
                    onClick={() => openGrant(dateStr, emp)}
                  >
                    + Grant Comp Off
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {grantModal && (
        <div className="modal-overlay" onClick={() => setGrantModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Grant Compensatory Off</h3>
            <div style={{ padding: '10px 14px', marginBottom: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: '0.85rem', color: '#166534' }}>
              <strong>{grantModal.name}</strong> ({grantModal.empId})<br />
              Worked on: <strong>{new Date(grantModal.sundayDate).toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'short', year:'numeric' })}</strong>
            </div>
            <div className="form-group">
              <label className="form-label">Comp-Off Date <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                className="form-input" type="date"
                value={compOffDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setCompOffDate(e.target.value)}
              />
              <small style={{ color: 'var(--gray-500)', fontSize: '11.5px' }}>Select any weekday (Monday – Saturday).</small>
            </div>
            <div className="form-group">
              <label className="form-label">Note (optional)</label>
              <input className="form-input" placeholder="e.g. As per employee request…" value={compOffNote} onChange={e => setCompOffNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn--primary" onClick={handleGrant} disabled={granting || !compOffDate}>
                {granting ? 'Granting…' : 'Grant Comp Off'}
              </button>
              <button className="btn btn--secondary" onClick={() => setGrantModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
