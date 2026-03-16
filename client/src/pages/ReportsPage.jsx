import React, { useState } from 'react';
import { Loader2, BarChart3, ClipboardList, CalendarDays, Wallet, Printer } from 'lucide-react';
import api from '../utils/api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ── CSV helper ─────────────────────────────────────────────── */
function downloadCSV(filename, rows) {
  const csv = rows
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv, { type: 'text/csv;charset=utf-8;' }]);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ── Status badge ───────────────────────────────────────────── */
function SBadge({ status }) {
  const cfg = {
    FINAL:   { bg: '#dcfce7', color: '#16a34a' },
    DRAFT:   { bg: '#fef3c7', color: '#d97706' },
    DEFAULT: { bg: '#f3f4f6', color: '#6b7280' },
  };
  const s = cfg[status] || cfg.DEFAULT;
  return (
    <span style={{ padding:'2px 9px', borderRadius:'12px', fontSize:'0.73rem', fontWeight:700, background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

/* ── Main page ──────────────────────────────────────────────── */
export default function ReportsPage() {
  const [tab,    setTab]    = useState('attendance');
  const [month,  setMonth]  = useState(new Date().getMonth() + 1);
  const [year,   setYear]   = useState(new Date().getFullYear());
  const [attData, setAttData] = useState(null);   // aggregated per employee
  const [salData, setSalData] = useState(null);   // raw salary records
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);
  const hasData = attData !== null && salData !== null;

  /* ── Generate both reports at once ─── */
  const generate = async () => {
    setLoading(true); setError(''); setAttData(null); setSalData(null);
    try {
      const [attRes, salRes] = await Promise.all([
        api.get(`/attendance?month=${month}&year=${year}`),
        api.get(`/salary?month=${month}&year=${year}`),
      ]);

      // Aggregate daily attendance rows → one summary row per employee
      const byEmp = {};
      for (const rec of attRes.data.data) {
        const eid = rec.employee?._id;
        if (!eid) continue;
        if (!byEmp[eid]) {
          byEmp[eid] = {
            employee: rec.employee,
            fullDays: 0, halfDays: 0, absent: 0,
            onLeave: 0, holiday: 0, weeklyOff: 0,
          };
        }
        const s = rec.displayStatus || rec.status;
        if      (s === 'FULL_DAY')                          byEmp[eid].fullDays++;
        else if (s === 'HALF_DAY' || s === 'HALF_DAY_DISPLAY') byEmp[eid].halfDays++;
        else if (s === 'ABSENT')                            byEmp[eid].absent++;
        else if (s === 'ON_LEAVE')                          byEmp[eid].onLeave++;
        else if (s === 'HOLIDAY')                           byEmp[eid].holiday++;
        else if (s === 'WEEKLY_OFF')                        byEmp[eid].weeklyOff++;
      }

      setAttData(Object.values(byEmp).sort((a, b) =>
        (a.employee?.employeeId || '').localeCompare(b.employee?.employeeId || '')
      ));
      setSalData(
        salRes.data.data.sort((a, b) =>
          (a.employee?.employeeId || '').localeCompare(b.employee?.employeeId || '')
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate report.');
    } finally { setLoading(false); }
  };

  /* ── CSV exports ─── */
  const exportAttCSV = () => {
    const headers = ['Emp ID','Name','Designation','Full Days','Half Days','Absent','On Leave','Holiday','Weekly Off','Present %'];
    const rows = attData.map(r => {
      const working = r.fullDays + r.halfDays + r.absent;
      const pct = working > 0 ? Math.round(((r.fullDays + r.halfDays * 0.5) / working) * 100) : 0;
      return [r.employee?.employeeId, r.employee?.name, r.employee?.designation || '',
              r.fullDays, r.halfDays, r.absent, r.onLeave, r.holiday, r.weeklyOff, pct + '%'];
    });
    downloadCSV(`Attendance_${MONTHS[month-1]}_${year}.csv`, [headers, ...rows]);
  };

  const exportSalCSV = () => {
    const headers = ['Emp ID','Name','Designation','Gross Salary','Deduction Days','Deduction (Rs)','Net Salary','Status'];
    const rows = salData.map(r => [
      r.employee?.employeeId, r.employee?.name, r.employee?.designation || '',
      r.grossSalary, r.deductionDays || 0, r.deductionAmount || 0, r.netSalary, r.status,
    ]);
    const totals = ['TOTAL', '', '',
      salData.reduce((s, r) => s + (r.grossSalary || 0), 0),
      salData.reduce((s, r) => s + (r.deductionDays || 0), 0),
      salData.reduce((s, r) => s + (r.deductionAmount || 0), 0),
      salData.reduce((s, r) => s + (r.netSalary || 0), 0), ''];
    downloadCSV(`Salary_${MONTHS[month-1]}_${year}.csv`, [headers, ...rows, totals]);
  };

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Monthly Reports</h1>
        <p className="page-subtitle">Generate attendance and salary reports for any month</p>
      </div>

      {/* ── Controls card ── */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 150px', minWidth: 0 }}>
            <label className="form-label">Month</label>
            <select className="form-select" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: '1 1 120px', minWidth: 0 }}>
            <label className="form-label">Year</label>
            <select className="form-select" value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button className="btn btn--primary" onClick={generate} disabled={loading}>
            {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Loader2 size={14} className="spin" /> Generating...
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BarChart3 size={14} strokeWidth={2} /> Generate Report
            </span>
          )}
          </button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {/* ── Empty state ── */}
      {!hasData && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon"><ClipboardList size={40} strokeWidth={1.5} color="#9ca3af" /></div>
          <h3>Select a month and generate</h3>
          <p>Choose month &amp; year above, then click Generate Report to view attendance and salary data for all employees.</p>
        </div>
      )}

      {/* ── Reports ── */}
      {hasData && (
        <>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button
              className={`btn ${tab === 'attendance' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setTab('attendance')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CalendarDays size={14} strokeWidth={2} /> Attendance Report
              </span>
              <span style={{ marginLeft: '6px', fontWeight: 400, opacity: 0.8 }}>({attData.length} employees)</span>
            </button>
            <button
              className={`btn ${tab === 'salary' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setTab('salary')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wallet size={14} strokeWidth={2} /> Salary Report
              </span>
              <span style={{ marginLeft: '6px', fontWeight: 400, opacity: 0.8 }}>({salData.length} employees)</span>
            </button>
          </div>

          {/* ── Attendance Table ── */}
          {tab === 'attendance' && (
            <div className="report-section">
              <div className="report-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 700 }}>Attendance — {MONTHS[month-1]} {year}</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
                    Showing daily attendance summary per employee
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn--secondary" onClick={exportAttCSV}>⬇ Export CSV</button>
                  <button className="btn btn--secondary" onClick={() => window.print()}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Printer size={14} strokeWidth={2} /> Print
                    </span>
                  </button>
                </div>
              </div>

              {attData.length === 0 ? (
                <p style={{ color: '#6b7280', marginTop: '12px' }}>No attendance records found for this period.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="table" id="print-table">
                    <thead>
                      <tr>
                        <th>Emp ID</th>
                        <th>Name</th>
                        <th>Designation</th>
                        <th style={{ textAlign: 'center' }}>Full Days</th>
                        <th style={{ textAlign: 'center' }}>Half Days</th>
                        <th style={{ textAlign: 'center' }}>Absent</th>
                        <th style={{ textAlign: 'center' }}>On Leave</th>
                        <th style={{ textAlign: 'center' }}>Holiday</th>
                        <th style={{ textAlign: 'center' }}>Weekly Off</th>
                        <th style={{ textAlign: 'center' }}>Present %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attData.map(r => {
                        const working = r.fullDays + r.halfDays + r.absent;
                        const pct = working > 0
                          ? Math.round(((r.fullDays + r.halfDays * 0.5) / working) * 100)
                          : 0;
                        const pctColor = pct >= 90 ? '#16a34a' : pct >= 75 ? '#d97706' : '#dc2626';
                        return (
                          <tr key={r.employee?._id}>
                            <td><strong>{r.employee?.employeeId}</strong></td>
                            <td>{r.employee?.name}</td>
                            <td>{r.employee?.designation || '—'}</td>
                            <td style={{ textAlign: 'center' }}>{r.fullDays}</td>
                            <td style={{ textAlign: 'center' }}>{r.halfDays}</td>
                            <td style={{ textAlign: 'center' }} className={r.absent > 0 ? 'text-danger' : ''}>{r.absent}</td>
                            <td style={{ textAlign: 'center' }}>{r.onLeave}</td>
                            <td style={{ textAlign: 'center' }}>{r.holiday}</td>
                            <td style={{ textAlign: 'center' }}>{r.weeklyOff}</td>
                            <td style={{ textAlign: 'center' }}>
                              <strong style={{ color: pctColor }}>{pct}%</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f9fafb', fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>
                        <td colSpan={3}>TOTAL ({attData.length} employees)</td>
                        <td style={{ textAlign: 'center' }}>{attData.reduce((s, r) => s + r.fullDays, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{attData.reduce((s, r) => s + r.halfDays, 0)}</td>
                        <td style={{ textAlign: 'center' }} className="text-danger">{attData.reduce((s, r) => s + r.absent, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{attData.reduce((s, r) => s + r.onLeave, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{attData.reduce((s, r) => s + r.holiday, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{attData.reduce((s, r) => s + r.weeklyOff, 0)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Salary Table ── */}
          {tab === 'salary' && (
            <div className="report-section">
              <div className="report-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 700 }}>Salary — {MONTHS[month-1]} {year}</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
                    Monthly salary breakdown for all employees
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn--secondary" onClick={exportSalCSV}>⬇ Export CSV</button>
                  <button className="btn btn--secondary" onClick={() => window.print()}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Printer size={14} strokeWidth={2} /> Print
                    </span>
                  </button>
                </div>
              </div>

              {salData.length === 0 ? (
                <p style={{ color: '#6b7280', marginTop: '12px' }}>
                  No salary records for this period. Generate salaries first from the Salary page.
                </p>
              ) : (
                <div className="table-wrapper">
                  <table className="table" id="print-table">
                    <thead>
                      <tr>
                        <th>Emp ID</th>
                        <th>Name</th>
                        <th>Designation</th>
                        <th style={{ textAlign: 'right' }}>Gross (₹)</th>
                        <th style={{ textAlign: 'center' }}>Deduction Days</th>
                        <th style={{ textAlign: 'right' }}>Deduction (₹)</th>
                        <th style={{ textAlign: 'right' }}>Net Salary (₹)</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salData.map(r => (
                        <tr key={r._id}>
                          <td><strong>{r.employee?.employeeId}</strong></td>
                          <td>{r.employee?.name}</td>
                          <td>{r.employee?.designation || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{r.grossSalary?.toLocaleString('en-IN')}</td>
                          <td style={{ textAlign: 'center' }} className={r.deductionDays > 0 ? 'text-danger' : ''}>
                            {r.deductionDays > 0 ? `— ${r.deductionDays}` : '0'}
                          </td>
                          <td style={{ textAlign: 'right' }} className={r.hasDeduction ? 'text-danger' : ''}>
                            {r.hasDeduction ? `— ${r.deductionAmount?.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}><strong>{r.netSalary?.toLocaleString('en-IN')}</strong></td>
                          <td style={{ textAlign: 'center' }}><SBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f9fafb', fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>
                        <td colSpan={3}>TOTAL ({salData.length} employees)</td>
                        <td style={{ textAlign: 'right' }}>
                          {salData.reduce((s, r) => s + (r.grossSalary || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td></td>
                        <td style={{ textAlign: 'right' }} className="text-danger">
                          — {salData.reduce((s, r) => s + (r.deductionAmount || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong>{salData.reduce((s, r) => s + (r.netSalary || 0), 0).toLocaleString('en-IN')}</strong>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
