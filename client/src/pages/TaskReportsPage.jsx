import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const STATUS_OPTIONS = [
  { value: 'COMPLETED',   label: 'Completed',   bg: '#dcfce7', color: '#15803d' },
  { value: 'IN_PROGRESS', label: 'In Progress',  bg: '#fef3c7', color: '#b45309' },
  { value: 'BLOCKED',     label: 'Blocked',       bg: '#fee2e2', color: '#b91c1c' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function StatusBadge({ status }) {
  const opt = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: opt.bg, color: opt.color, whiteSpace: 'nowrap' }}>
      {opt.label}
    </span>
  );
}

function DeptBadge({ name }) {
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: '#f3e8ff', color: '#7c3aed', whiteSpace: 'nowrap' }}>
      {name}
    </span>
  );
}

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TaskReportsPage() {
  const [entries, setEntries] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [nameSearch, setNameSearch] = useState('');
  const [empIdSearch, setEmpIdSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [filterMode, setFilterMode] = useState('month');

  const [downloading, setDownloading] = useState(null);
  const [viewEmployee, setViewEmployee] = useState(null);

  const years = [];
  const curYear = new Date().getFullYear();
  for (let y = curYear; y >= curYear - 2; y--) years.push(y);

  useEffect(() => {
    api.get('/departments').then(({ data }) => setDepartments(data.data || [])).catch(() => {});
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nameSearch.trim()) params.set('name', nameSearch.trim());
      if (empIdSearch.trim()) params.set('employeeId', empIdSearch.trim());
      if (deptFilter) params.set('department', deptFilter);
      if (filterMode === 'date' && dateFilter) {
        params.set('date', dateFilter);
      } else if (filterMode === 'month') {
        params.set('month', monthFilter);
        params.set('year', yearFilter);
      }
      const { data } = await api.get(`/daily-tasks?${params.toString()}`);
      setEntries(data.data);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, [nameSearch, empIdSearch, deptFilter, dateFilter, monthFilter, yearFilter, filterMode]);

  useEffect(() => {
    const timer = setTimeout(fetchEntries, 300);
    return () => clearTimeout(timer);
  }, [fetchEntries]);

  const downloadPDF = async (empId) => {
    setDownloading(empId);
    try {
      const { data } = await api.get(
        `/daily-tasks/report/${empId}/${monthFilter}/${yearFilter}/pdf`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Task_Report_${empId}_${MONTHS[monthFilter - 1]}_${yearFilter}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || 'Download failed.');
    } finally { setDownloading(null); }
  };

  // Group entries by employee
  const employeeMap = {};
  for (const e of entries) {
    const emp = e.employee;
    if (!emp) continue;
    const key = emp.employeeId || emp._id;
    if (!employeeMap[key]) {
      employeeMap[key] = { employee: emp, entries: [], totalTasks: 0, completed: 0, inProgress: 0, blocked: 0 };
    }
    employeeMap[key].entries.push(e);
    for (const t of e.tasks) {
      employeeMap[key].totalTasks++;
      if (t.status === 'COMPLETED') employeeMap[key].completed++;
      else if (t.status === 'IN_PROGRESS') employeeMap[key].inProgress++;
      else if (t.status === 'BLOCKED') employeeMap[key].blocked++;
    }
  }
  const employeeList = Object.values(employeeMap).sort((a, b) => a.employee.name.localeCompare(b.employee.name));

  // If viewing a specific employee's detail
  const viewData = viewEmployee ? employeeMap[viewEmployee] : null;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Task Reports</h1>
        <p className="page-subtitle">View employee daily tasks by department, name, or ID &mdash; download monthly PDF reports</p>
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 180px' }}>
            <label className="form-label">Employee Name</label>
            <input className="form-input" placeholder="e.g. John" value={nameSearch}
              onChange={e => setNameSearch(e.target.value)} />
          </div>

          <div className="form-group" style={{ margin: 0, flex: '0 1 160px' }}>
            <label className="form-label">Employee ID</label>
            <input className="form-input" placeholder="e.g. EMP-0002" value={empIdSearch}
              onChange={e => setEmpIdSearch(e.target.value)} />
          </div>

          <div className="form-group" style={{ margin: 0, flex: '0 1 180px' }}>
            <label className="form-label">Department</label>
            <select className="form-input" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Filter by</label>
            <select className="form-input" value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ flex: '0 1 110px', minWidth: 0 }}>
              <option value="month">Month</option>
              <option value="date">Date</option>
            </select>
          </div>

          {filterMode === 'date' ? (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Month</label>
                <select className="form-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ flex: '0 1 130px', minWidth: 0 }}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Year</label>
                <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)} style={{ flex: '0 1 90px', minWidth: 0 }}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Employee detail view (drilldown) ─────────────────── */}
      {viewData && (
        <div style={{ marginBottom: 20 }}>
          <button className="btn btn--secondary" style={{ marginBottom: 14, fontSize: '0.85rem' }}
            onClick={() => setViewEmployee(null)}>
            &larr; Back to all employees
          </button>

          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontWeight: 700, color: '#111827' }}>{viewData.employee.name}</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                  {viewData.employee.employeeId} &middot; {viewData.employee.designation || '—'}
                  {viewData.employee.department?.name && <> &middot; <DeptBadge name={viewData.employee.department.name} /></>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, background: '#dbeafe', color: '#2563eb' }}>
                  {viewData.entries.length} day{viewData.entries.length !== 1 ? 's' : ''} reported
                </span>
                <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, background: '#dcfce7', color: '#15803d' }}>
                  {viewData.completed} completed
                </span>
                {viewData.inProgress > 0 && (
                  <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, background: '#fef3c7', color: '#b45309' }}>
                    {viewData.inProgress} in progress
                  </span>
                )}
                {viewData.blocked > 0 && (
                  <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, background: '#fee2e2', color: '#b91c1c' }}>
                    {viewData.blocked} blocked
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {viewData.entries.map(entry => (
              <div key={entry._id} className="card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2563eb' }}>{fmt(entry.date)}</span>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{entry.tasks.length} task{entry.tasks.length > 1 ? 's' : ''}</span>
                </div>
                {entry.tasks.map((task, i) => (
                  <div key={task._id || i} style={{ padding: '6px 0', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>{task.title}</span>
                      <StatusBadge status={task.status} />
                    </div>
                    {task.description && (
                      <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>{task.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Employee overview table ──────────────────────────── */}
      {!viewEmployee && (
        <>
          {loading ? <div className="page-loading">Loading...</div> : employeeList.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: 24 }}>
              <div className="empty-state-icon">&#128221;</div>
              <h3>No task entries found</h3>
              <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Try adjusting the filters above</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {employeeList.map(({ employee: emp, entries: empEntries, totalTasks, completed, inProgress, blocked }) => (
                <div key={emp.employeeId || emp._id} className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    {/* Left: employee info */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{emp.name}</span>
                        <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{emp.employeeId}</span>
                        {emp.department?.name && <DeptBadge name={emp.department.name} />}
                      </div>
                      <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#9ca3af' }}>
                        {emp.designation || '—'}
                      </p>

                      {/* Stats row */}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.8rem' }}>
                        <span style={{ color: '#2563eb', fontWeight: 600 }}>
                          {empEntries.length} day{empEntries.length !== 1 ? 's' : ''} &middot; {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                        </span>
                        <span style={{ color: '#15803d', fontWeight: 600 }}>{completed} done</span>
                        {inProgress > 0 && <span style={{ color: '#b45309', fontWeight: 600 }}>{inProgress} in progress</span>}
                        {blocked > 0 && <span style={{ color: '#b91c1c', fontWeight: 600 }}>{blocked} blocked</span>}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn--primary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                        onClick={() => setViewEmployee(emp.employeeId || emp._id)}>
                        View Tasks
                      </button>
                      {filterMode === 'month' && (
                        <button className="btn btn--secondary" style={{ fontSize: '0.82rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => downloadPDF(emp.employeeId)}
                          disabled={downloading === emp.employeeId}>
                          <span style={{ fontSize: 14 }}>&#128196;</span>
                          {downloading === emp.employeeId ? 'Downloading...' : 'PDF Report'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
