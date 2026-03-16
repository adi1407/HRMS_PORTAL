import React, { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';
import { RefreshCw, Download, Calendar } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_COLORS = {
  FULL_DAY: 'green', HALF_DAY: 'yellow', ABSENT: 'red',
  ON_LEAVE: 'blue', HOLIDAY: 'green', WEEKLY_OFF: 'green',
};

const MANUAL_STATUSES = ['FULL_DAY', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF'];

const PAGE_SIZE = 50; // records per page for large teams

export default function AttendancePage() {
  const { user } = useAuthStore();
  // ACCOUNTS sees only their own attendance (same as EMPLOYEE) — no all-team view, no export
  const isAdmin   = ['SUPER_ADMIN', 'DIRECTOR', 'HR'].includes(user?.role);
  const canManage = ['SUPER_ADMIN', 'DIRECTOR', 'HR'].includes(user?.role);
  const [records,    setRecords]    = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [month,      setMonth]      = useState(new Date().getMonth() + 1);
  const [year,       setYear]       = useState(new Date().getFullYear());
  const [msg,        setMsg]        = useState('');
  const [empSearch,  setEmpSearch]  = useState('');
  const [page,       setPage]       = useState(1);

  // Override modal
  const [overrideModal,  setOverrideModal]  = useState(null);
  const [overrideStatus, setOverrideStatus] = useState('');
  const [overrideNote,   setOverrideNote]   = useState('');
  const [overriding,     setOverriding]     = useState(false);

  // Manual mark modal
  const [manualModal,  setManualModal]  = useState(false);
  const [manualEmp,    setManualEmp]    = useState('');
  const [manualDate,   setManualDate]   = useState(new Date().toISOString().slice(0, 10));
  const [manualStatus, setManualStatus] = useState('FULL_DAY');
  const [manualNote,   setManualNote]   = useState('');
  const [marking,      setMarking]      = useState(false);

  useEffect(() => { fetchRecords(); }, [month, year]);
  useEffect(() => { if (canManage) fetchEmployees(); }, [canManage]);
  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [month, year, empSearch]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const endpoint = isAdmin
        ? `/attendance?month=${month}&year=${year}`
        : `/attendance/my?month=${month}&year=${year}`;
      const { data } = await api.get(endpoint);
      setRecords(data.data);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await api.get('/users');
      setEmployees(data.data);
    } catch {}
  };

  const handleOverride = async () => {
    if (!overrideStatus) return;
    if (!overrideNote.trim()) { setMsg('❌ Reason is required.'); return; }
    setOverriding(true); setMsg('');
    try {
      const { data } = await api.patch(`/attendance/${overrideModal.record._id}/override`, { status: overrideStatus, notes: overrideNote });
      if (data.salaryRecalculated) {
        setMsg('✅ Attendance updated. Salary slip recalculated automatically.');
      } else if (data.salaryWarning) {
        setMsg(`✅ Attendance updated. ⚠️ ${data.salaryWarning}`);
      } else {
        setMsg('✅ Attendance updated.');
      }
      setOverrideModal(null);
      fetchRecords();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to override.'));
    } finally { setOverriding(false); }
  };

  const exportExcel = async () => {
    try {
      const res  = await api.get(`/attendance/export?month=${month}&year=${year}`, { responseType: 'blob' });
      const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Attendance_Report_${MONTH_NAMES[month-1]}_${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMsg('❌ Failed to export report.');
    }
  };

  const handleManualMark = async () => {
    if (!manualEmp || !manualDate || !manualStatus) return;
    if (!manualNote.trim()) { setMsg('❌ Reason is required.'); return; }
    setMarking(true); setMsg('');
    try {
      const { data } = await api.post('/attendance/manual', { employeeId: manualEmp, date: manualDate, status: manualStatus, notes: manualNote });
      let msg = '✅ ' + data.message;
      if (data.salaryRecalculated) msg += ' Salary slip recalculated automatically.';
      else if (data.salaryWarning)  msg = `✅ ${data.message} ⚠️ ${data.salaryWarning}`;
      setMsg(msg);
      setManualModal(false);
      setManualNote('');
      fetchRecords();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to mark attendance.'));
    } finally { setMarking(false); }
  };

  const openOverride = (record) => {
    setOverrideModal({ record });
    setOverrideStatus(record.displayStatus || record.status || 'FULL_DAY');
    setOverrideNote('');
    setMsg('');
  };

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

  // Client-side employee name filter (useful when team is 80-200 people)
  const filtered = isAdmin && empSearch.trim()
    ? records.filter(r =>
        r.employee?.name?.toLowerCase().includes(empSearch.toLowerCase()) ||
        r.employee?.employeeId?.toLowerCase().includes(empSearch.toLowerCase())
      )
    : records;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">{isAdmin ? 'Team attendance overview' : 'Your attendance history'}</p>
        </div>
        {canManage && (
          <button className="btn btn--primary" onClick={() => { setManualModal(true); setMsg(''); }}>
            + Mark Attendance
          </button>
        )}
      </div>

      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`}>{msg}</div>}

      <div className="attendance-controls">
        <select className="form-select" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="form-select" value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn--secondary" onClick={fetchRecords}><RefreshCw size={14} strokeWidth={2.5} /> Refresh</button>
        {isAdmin && <button className="btn btn--secondary" onClick={exportExcel}><Download size={14} strokeWidth={2.5} /> Export Excel</button>}
      </div>

      {/* Employee search — helpful when viewing 80–200 people */}
      {isAdmin && (
        <div className="search-bar">
          <input
            className="form-input"
            placeholder="Filter by employee name or ID…"
            value={empSearch}
            onChange={e => setEmpSearch(e.target.value)}
          />
        </div>
      )}

      {loading && <div className="page-loading">Loading records…</div>}

      {!loading && records.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar size={52} strokeWidth={1.2} /></div>
          <h3>No records found</h3>
          <p>No attendance data for {MONTHS[month-1]} {year}.</p>
        </div>
      )}

      {!loading && records.length > 0 && (
        <>
          {/* Record count badge */}
          {isAdmin && (
            <p style={{ fontSize: '12.5px', color: 'var(--gray-500)', marginBottom: 10 }}>
              Showing <strong>{paginated.length}</strong> of <strong>{filtered.length}</strong> records
              {empSearch && ` matching "${empSearch}"`}
            </p>
          )}

          <div className="table-wrapper">
            <table className="table table--responsive">
              <thead>
                <tr>
                  <th>Date</th>
                  {isAdmin && <th>Employee</th>}
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Hours</th>
                  {canManage && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {paginated.map(r => (
                  <tr key={r._id}>
                    <td data-label="Date">
                      {new Date(r.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', weekday:'short' })}
                    </td>
                    {isAdmin && (
                      <td data-label="Employee">
                        <strong>{r.employee?.name}</strong>
                        <br/><small style={{ color: 'var(--gray-500)' }}>{r.employee?.employeeId}</small>
                      </td>
                    )}
                    <td data-label="Status">
                      {(() => {
                        // WEEKLY_OFF and HOLIDAY always show their real label in green;
                        // all other statuses use the employee-facing displayStatus label.
                        const key = (r.status === 'WEEKLY_OFF' || r.status === 'HOLIDAY')
                          ? r.status
                          : (r.displayStatus || r.status);
                        return (
                          <span className={`status-pill status-pill--${STATUS_COLORS[key] || 'gray'}`}>
                            {key?.replace(/_/g, ' ')}
                          </span>
                        );
                      })()}
                      {r.overriddenByName && (
                        <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 3, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                          <span style={{ color: '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>✏ {r.overriddenByName}</span>
                          {r.notes && <span>· {r.notes}</span>}
                        </div>
                      )}
                    </td>
                    <td data-label="Check In">{r.checkInTime  || '—'}</td>
                    <td data-label="Check Out">{r.checkOutTime || '—'}</td>
                    <td data-label="Hours">{r.workingHours > 0 ? `${r.workingHours}h` : '—'}</td>
                    {canManage && (
                      <td data-label="Action" className="td-actions">
                        <button className="btn-tiny btn-tiny--green" onClick={() => openOverride(r)}>Override</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination — visible when there are many records */}
          {totalPages > 1 && (
            <div className="pagination">
              <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={`pagination-btn ${page === p ? 'pagination-btn--active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
              <span className="pagination-info">Page {page} / {totalPages}</span>
            </div>
          )}
        </>
      )}

      {/* Override Modal */}
      {overrideModal && (
        <div className="modal-overlay" onClick={() => setOverrideModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Override Attendance</h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 16 }}>
              {overrideModal.record.employee?.name} &nbsp;·&nbsp;
              {new Date(overrideModal.record.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={overrideStatus} onChange={e => setOverrideStatus(e.target.value)}>
                {MANUAL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reason <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="form-input" placeholder="Why is this being changed?" value={overrideNote} onChange={e => setOverrideNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn btn--primary" onClick={handleOverride} disabled={overriding}>
                {overriding ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn--secondary" onClick={() => setOverrideModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Mark Modal */}
      {manualModal && (
        <div className="modal-overlay" onClick={() => setManualModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Mark Attendance Manually</h3>
            <div className="form-group">
              <label className="form-label">Employee</label>
              <select className="form-select" value={manualEmp} onChange={e => setManualEmp(e.target.value)}>
                <option value="">— Select Employee —</option>
                {employees.map(e => (
                  <option key={e._id} value={e._id}>{e.name} ({e.employeeId})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} max={new Date().toISOString().slice(0,10)} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={manualStatus} onChange={e => setManualStatus(e.target.value)}>
                {MANUAL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reason <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="form-input" placeholder="e.g. WFH approved, field visit…" value={manualNote} onChange={e => setManualNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn btn--primary" onClick={handleManualMark} disabled={marking || !manualEmp}>
                {marking ? 'Marking…' : 'Mark Attendance'}
              </button>
              <button className="btn btn--secondary" onClick={() => setManualModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
