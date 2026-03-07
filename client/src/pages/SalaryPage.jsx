import React, { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function SalaryPage() {
  const { user } = useAuthStore();
  const isAdmin = ['ACCOUNTS', 'SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  return isAdmin ? <AdminSalaryView /> : <EmployeeSalaryView />;
}

/* ─── Employee View ─────────────────────────────────────────── */
function EmployeeSalaryView() {
  const [month,   setMonth]   = useState(new Date().getMonth() + 1);
  const [year,    setYear]    = useState(new Date().getFullYear());
  const [salary,  setSalary]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => { fetchSalary(); }, [month, year]);

  const fetchSalary = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get(`/salary/my?month=${month}&year=${year}`);
      setSalary(data.data);
    } catch (err) {
      setSalary(null);
      if (err.response?.status !== 404) setError(err.response?.data?.message || 'Failed to load salary.');
    } finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Salary</h1>
        <p className="page-subtitle">Monthly salary slip and deduction breakdown</p>
      </div>
      <div className="salary-controls">
        <select className="form-select" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="form-select" value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn--secondary" onClick={fetchSalary}>🔄 Refresh</button>
      </div>
      {error && <div className="alert alert--error">{error}</div>}
      {loading && <div className="page-loading">Loading salary slip...</div>}
      {!loading && !salary && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">💰</div>
          <h3>No salary slip found</h3>
          <p>Salary for {MONTHS[month-1]} {year} has not been generated yet.</p>
        </div>
      )}
      {salary && <SalarySlip salary={salary} />}
    </div>
  );
}

/* ─── Admin View ────────────────────────────────────────────── */
function AdminSalaryView() {
  const [month,      setMonth]      = useState(new Date().getMonth() + 1);
  const [year,       setYear]       = useState(new Date().getFullYear());
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(null);
  const [msg,        setMsg]        = useState('');
  const [selected,   setSelected]   = useState(null);

  // Adjust salary modal
  const [adjustModal, setAdjustModal] = useState(null); // { record }
  const [adjAmount,   setAdjAmount]   = useState('');
  const [adjNote,     setAdjNote]     = useState('');
  const [adjusting,   setAdjusting]   = useState(false);

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => { fetchAll(); }, [month, year]);

  const fetchAll = async () => {
    setLoading(true); setMsg('');
    try {
      const { data } = await api.get(`/salary?month=${month}&year=${year}`);
      setRecords(data.data);
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to load.'));
    } finally { setLoading(false); }
  };

  const generateAll = async () => {
    setGenerating(true); setMsg('');
    try {
      const { data } = await api.post('/salary/generate', { month, year });
      setMsg('✅ ' + (data.message || 'Salary generated!'));
      fetchAll();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to generate.'));
    } finally { setGenerating(false); }
  };

  const finalizeSlip = async (id) => {
    setFinalizing(id);
    try {
      await api.patch(`/salary/${id}/finalize`);
      setMsg('✅ Salary slip finalized.');
      fetchAll();
      if (selected?._id === id) setSelected(prev => ({ ...prev, status: 'FINAL' }));
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to finalize.'));
    } finally { setFinalizing(null); }
  };

  const openAdjust = (record) => { setAdjustModal({ record }); setAdjAmount(''); setAdjNote(''); setMsg(''); };

  const exportExcel = async () => {
    try {
      const res = await api.get(`/salary/export?month=${month}&year=${year}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Salary_Report_${MONTHS[month-1]}_${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg('❌ Failed to export report.');
    }
  };

  const handleAdjust = async () => {
    const amt = parseFloat(adjAmount);
    if (isNaN(amt) || amt === 0) return;
    setAdjusting(true); setMsg('');
    try {
      const { data } = await api.patch(`/salary/${adjustModal.record._id}/adjust`, { amount: amt, note: adjNote });
      setMsg('✅ ' + data.message);
      setAdjustModal(null);
      fetchAll();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to adjust salary.'));
    } finally { setAdjusting(false); }
  };

  // Detail view for a selected slip
  if (selected) {
    return (
      <div className="page">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn--secondary" onClick={() => setSelected(null)}>← Back</button>
            <div>
              <h1 className="page-title">Salary Slip</h1>
              <p className="page-subtitle">{selected.employee?.name} — {MONTHS[selected.month-1]} {selected.year}</p>
            </div>
          </div>
          {selected.status === 'DRAFT' && (
            <button className="btn btn--primary" onClick={() => finalizeSlip(selected._id)} disabled={finalizing === selected._id}>
              {finalizing === selected._id ? 'Finalizing...' : '✅ Finalize Slip'}
            </button>
          )}
        </div>
        {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`}>{msg}</div>}
        <SalarySlip salary={selected} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Salary Management</h1>
        <p className="page-subtitle">Generate and manage employee salary slips</p>
      </div>

      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`}>{msg}</div>}

      <div className="salary-controls">
        <select className="form-select" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="form-select" value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn--secondary" onClick={fetchAll}>🔄 Refresh</button>
        <button className="btn btn--secondary" onClick={exportExcel}>⬇ Export Excel</button>
        <button className="btn btn--primary" onClick={generateAll} disabled={generating}>
          {generating ? '⏳ Generating...' : '⚡ Generate All Salaries'}
        </button>
      </div>

      {loading && <div className="page-loading">Loading salary records...</div>}

      {!loading && records.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">💰</div>
          <h3>No salary records</h3>
          <p>No salaries generated for {MONTHS[month-1]} {year} yet.</p>
          <button className="btn btn--primary" onClick={generateAll} disabled={generating}>
            {generating ? '⏳ Generating...' : 'Generate Now'}
          </button>
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="table-wrapper">
          <table className="table table--responsive">
            <thead>
              <tr>
                <th>Employee ID</th><th>Name</th><th>Designation</th>
                <th>Gross</th><th>Deduction</th><th>Net Salary</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r._id}>
                  <td data-label="Emp ID"><strong>{r.employee?.employeeId}</strong></td>
                  <td data-label="Name">{r.employee?.name}</td>
                  <td data-label="Designation">{r.employee?.designation || '—'}</td>
                  <td data-label="Gross">₹{r.grossSalary?.toLocaleString('en-IN')}</td>
                  <td data-label="Deduction" className={r.hasDeduction ? 'text-danger' : ''}>
                    {r.hasDeduction ? `— ₹${r.deductionAmount?.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td data-label="Net Salary"><strong>₹{r.netSalary?.toLocaleString('en-IN')}</strong></td>
                  <td data-label="Status">
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                      background: r.status === 'FINAL' ? '#dcfce7' : '#fef3c7',
                      color:      r.status === 'FINAL' ? '#16a34a'  : '#d97706',
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td data-label="Actions" className="td-actions">
                    <button className="btn-tiny btn-tiny--green" onClick={() => setSelected(r)}>View</button>
                    {r.status === 'DRAFT' && (
                      <>
                        <button className="btn-tiny btn-tiny--green" onClick={() => finalizeSlip(r._id)} disabled={finalizing === r._id}>
                          {finalizing === r._id ? '…' : 'Finalize'}
                        </button>
                        <button className="btn-tiny btn-tiny--blue" onClick={() => openAdjust(r)}>Adjust</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Salary Modal */}
      {adjustModal && (
        <div className="modal-overlay" onClick={() => setAdjustModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Adjust Salary</h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 16 }}>
              {adjustModal.record.employee?.name} &nbsp;·&nbsp; {MONTHS[adjustModal.record.month - 1]} {adjustModal.record.year}
              &nbsp;·&nbsp; Net: <strong>₹{adjustModal.record.netSalary?.toLocaleString('en-IN')}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Amount (₹)</label>
              <input
                className="form-input"
                type="number"
                placeholder="e.g. 500 for bonus, -500 for deduction"
                value={adjAmount}
                onChange={e => setAdjAmount(e.target.value)}
              />
              <small style={{ color: '#6b7280' }}>Positive = bonus &nbsp;|&nbsp; Negative = deduction</small>
            </div>
            <div className="form-group">
              <label className="form-label">Note (optional)</label>
              <input className="form-input" placeholder="e.g. Performance bonus, Late penalty..." value={adjNote} onChange={e => setAdjNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn--primary" onClick={handleAdjust} disabled={adjusting || !adjAmount}>
                {adjusting ? 'Applying...' : 'Apply Adjustment'}
              </button>
              <button className="btn btn--secondary" onClick={() => setAdjustModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Shared Salary Slip ────────────────────────────────────── */
function SalarySlip({ salary }) {
  const downloadPDF = async () => {
    try {
      const res = await api.get(
        `/salary/${salary.employee?._id}/${salary.month}/${salary.year}/pdf`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Salary_${salary.employee?.name}_${MONTHS[salary.month-1]}_${salary.year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Failed to download PDF. Ensure salary slip is generated.'); }
  };

  return (
    <div className="salary-slip">
      <div className="salary-slip-header">
        <div className="salary-slip-header-left">
          <h2>Salary Slip</h2>
          <p>{MONTHS[salary.month - 1]} {salary.year}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn--secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={downloadPDF}>⬇ PDF</button>
          <div className={`salary-badge ${salary.status === 'FINAL' ? 'salary-badge--final' : 'salary-badge--draft'}`}>
            {salary.status}
          </div>
        </div>
      </div>
      <div className="salary-slip-body">
        <div className="salary-employee-info">
          <div className="info-row"><span>Employee ID</span><strong>{salary.employee?.employeeId}</strong></div>
          <div className="info-row"><span>Name</span><strong>{salary.employee?.name}</strong></div>
          <div className="info-row"><span>Designation</span><strong>{salary.employee?.designation || '—'}</strong></div>
          <div className="info-row"><span>Working Days</span><strong>{salary.daysInMonth}</strong></div>
        </div>
        <div className="salary-breakdown">
          <h3>Attendance Summary</h3>
          <div className="salary-row"><span>Full Days Present</span><span>{salary.fullDays}</span></div>
          <div className="salary-row"><span>Half Days</span><span>{(salary.displayHalfDays || 0) + (salary.realHalfDays || 0)}</span></div>
          <div className="salary-row"><span>Paid Leaves</span><span>{salary.paidLeaves}</span></div>
          <div className="salary-row"><span>Absent Days</span><span className="text-danger">{salary.absentDays}</span></div>
          <div className="salary-row"><span>Unpaid Leaves</span><span className="text-danger">{salary.unpaidLeaves}</span></div>
          <div className="salary-row"><span>Holidays</span><span>{salary.holidays}</span></div>
          <div className="salary-row"><span>Weekly Offs</span><span>{salary.weeklyOffs}</span></div>
        </div>
        <div className="salary-calculation">
          <h3>Salary Calculation</h3>
          <div className="salary-row"><span>Gross Salary</span><span>₹{salary.grossSalary?.toLocaleString('en-IN')}</span></div>
          <div className="salary-row"><span>Per Day Salary</span><span>₹{salary.perDaySalary?.toFixed(2)}</span></div>
          {salary.hasDeduction && (
            <>
              <div className="salary-row salary-row--deduction">
                <span>Total Deduction Days</span>
                <span className="text-danger">— {salary.deductionDays}</span>
              </div>
              <div className="salary-row salary-row--deduction">
                <span>Deduction Amount</span>
                <span className="text-danger">— ₹{salary.deductionAmount?.toLocaleString('en-IN')}</span>
              </div>
            </>
          )}
          <div className="salary-row salary-row--net">
            <span>Net Salary</span>
            <span>₹{salary.netSalary?.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
