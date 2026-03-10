import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

const STATUS_OPTIONS = [
  { value: 'COMPLETED',   label: 'Completed',   bg: '#dcfce7', color: '#15803d' },
  { value: 'IN_PROGRESS', label: 'In Progress',  bg: '#fef3c7', color: '#b45309' },
  { value: 'BLOCKED',     label: 'Blocked',       bg: '#fee2e2', color: '#b91c1c' },
];

function StatusBadge({ status }) {
  const opt = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: opt.bg, color: opt.color, whiteSpace: 'nowrap' }}>
      {opt.label}
    </span>
  );
}

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Employee: submit today's tasks ─────────────────────────── */
function SubmitTaskForm({ onSubmitted }) {
  const [tasks, setTasks] = useState([{ title: '', description: '', status: 'COMPLETED' }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.get('/daily-tasks/today')
      .then(({ data }) => { if (data.submitted) setAlreadySubmitted(true); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const updateTask = (idx, field, value) => {
    setTasks(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const addTask = () => {
    if (tasks.length >= 20) return;
    setTasks(prev => [...prev, { title: '', description: '', status: 'COMPLETED' }]);
  };

  const removeTask = (idx) => {
    if (tasks.length <= 1) return;
    setTasks(prev => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    for (const t of tasks) {
      if (!t.title.trim()) { setMsg('Each task must have a title.'); return; }
    }
    setBusy(true); setMsg('');
    try {
      await api.post('/daily-tasks', { tasks });
      setMsg('Tasks submitted successfully!');
      setAlreadySubmitted(true);
      onSubmitted();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Submission failed.');
    } finally { setBusy(false); }
  };

  if (checking) return <div className="page-loading">Checking today's status...</div>;

  if (alreadySubmitted) {
    return (
      <div className="card" style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>&#10003;</div>
        <h3 style={{ margin: '0 0 8px', color: '#15803d' }}>Today's Tasks Submitted</h3>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
          You have already submitted your task update for today. Come back tomorrow!
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <h4 style={{ margin: '0 0 14px', fontWeight: 600 }}>Submit Today's Tasks</h4>
      {msg && (
        <div className={`alert ${msg.includes('success') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}

      {tasks.map((t, idx) => (
        <div key={idx} style={{ padding: 14, marginBottom: 10, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>Task {idx + 1}</span>
            {tasks.length > 1 && (
              <button onClick={() => removeTask(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                Remove
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Title *</label>
              <input className="form-input" value={t.title} placeholder="What did you work on?"
                onChange={e => updateTask(idx, 'title', e.target.value)} maxLength={200} />
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
              <label className="form-label">Status</label>
              <select className="form-input" value={t.status} onChange={e => updateTask(idx, 'status', e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 8, marginBottom: 0 }}>
            <label className="form-label">Description (optional)</label>
            <textarea className="form-input" rows={2} value={t.description} placeholder="Details, notes, blockers..."
              onChange={e => updateTask(idx, 'description', e.target.value)} maxLength={1000} style={{ resize: 'vertical' }} />
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="btn btn--secondary" onClick={addTask} disabled={tasks.length >= 20}>
          + Add Task
        </button>
        <button className="btn btn--primary" onClick={submit} disabled={busy}>
          {busy ? 'Submitting...' : 'Submit Tasks'}
        </button>
      </div>
    </div>
  );
}

/* ── Employee: task history ─────────────────────────────────── */
function MyTaskHistory() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/daily-tasks/my?month=${month}&year=${year}`);
      setEntries(data.data);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEntries(); }, [month, year]);

  const years = [];
  const curYear = new Date().getFullYear();
  for (let y = curYear; y >= curYear - 2; y--) years.push(y);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-input" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 150 }}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="form-input" value={year} onChange={e => setYear(e.target.value)} style={{ width: 100 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : entries.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#128221;</div>
          <h3>No task entries</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No tasks submitted for {MONTHS[month - 1]} {year}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map(entry => (
            <div key={entry._id} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{fmt(entry.date)}</span>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{entry.tasks.length} task{entry.tasks.length > 1 ? 's' : ''}</span>
              </div>
              {entry.tasks.map((task, i) => (
                <div key={task._id || i} style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>{task.title}</span>
                    <StatusBadge status={task.status} />
                  </div>
                  {task.description && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>{task.description}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── HR: view all tasks + download PDF ─────────────────────── */
function HRTaskView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [filterMode, setFilterMode] = useState('month');
  const [downloading, setDownloading] = useState(null);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const years = [];
  const curYear = new Date().getFullYear();
  for (let y = curYear; y >= curYear - 2; y--) years.push(y);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      let params = '';
      if (search.trim()) {
        const isEmpId = search.trim().toUpperCase().startsWith('EMP');
        params += isEmpId ? `&employeeId=${encodeURIComponent(search.trim())}` : `&name=${encodeURIComponent(search.trim())}`;
      }
      if (filterMode === 'date' && dateFilter) {
        params += `&date=${dateFilter}`;
      } else if (filterMode === 'month') {
        params += `&month=${monthFilter}&year=${yearFilter}`;
      }
      const { data } = await api.get(`/daily-tasks?${params.replace(/^&/, '')}`);
      setEntries(data.data);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEntries(); }, [search, dateFilter, monthFilter, yearFilter, filterMode]);

  const downloadPDF = async (empId, empName) => {
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

  const uniqueEmployees = [];
  const seenEmpIds = new Set();
  for (const e of entries) {
    const emp = e.employee;
    if (emp && !seenEmpIds.has(emp.employeeId)) {
      seenEmpIds.add(emp.employeeId);
      uniqueEmployees.push(emp);
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 220px' }}>
            <label className="form-label">Search by Name or Employee ID</label>
            <input className="form-input" placeholder="e.g. John or EMP-0002" value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Filter by</label>
            <select className="form-input" value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ width: 120 }}>
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
                <select className="form-input" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ width: 140 }}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Year</label>
                <select className="form-input" value={yearFilter} onChange={e => setYearFilter(e.target.value)} style={{ width: 100 }}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Download PDF buttons per employee */}
      {filterMode === 'month' && uniqueEmployees.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>Download Monthly Report</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {uniqueEmployees.map(emp => (
              <button key={emp.employeeId}
                className="btn btn--secondary"
                style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => downloadPDF(emp.employeeId, emp.name)}
                disabled={downloading === emp.employeeId}>
                <span style={{ fontSize: 14 }}>&#128196;</span>
                {downloading === emp.employeeId ? 'Downloading...' : `${emp.name} (${emp.employeeId})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Entries */}
      {loading ? <div className="page-loading">Loading...</div> : entries.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#128221;</div>
          <h3>No task entries found</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Try adjusting the filters</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map(entry => (
            <div key={entry._id} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>
                    {entry.employee?.name}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#6b7280', marginLeft: 8 }}>
                    {entry.employee?.employeeId} · {entry.employee?.designation}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#2563eb' }}>{fmt(entry.date)}</span>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{entry.tasks.length} task{entry.tasks.length > 1 ? 's' : ''}</span>
                </div>
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
      )}
    </div>
  );
}

/* ── Employee view ──────────────────────────────────────────── */
function EmployeeTaskView() {
  const [tab, setTab] = useState('submit');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Daily Tasks</h1>
        <p className="page-subtitle">Submit your daily task updates and view history</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn ${tab === 'submit' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setTab('submit')}>Today's Update</button>
        <button className={`btn ${tab === 'history' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setTab('history')}>My History</button>
      </div>

      {tab === 'submit' && <SubmitTaskForm key={refreshKey} onSubmitted={() => { setRefreshKey(k => k + 1); setTab('history'); }} />}
      {tab === 'history' && <MyTaskHistory />}
    </div>
  );
}

/* ── HR/Admin view ──────────────────────────────────────────── */
function HRTaskPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Daily Tasks</h1>
        <p className="page-subtitle">View employee daily task updates and download monthly reports</p>
      </div>
      <HRTaskView />
    </div>
  );
}

/* ── Root ────────────────────────────────────────────────────── */
export default function DailyTaskPage() {
  const { user } = useAuthStore();
  const isManager = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  return isManager ? <HRTaskPage /> : <EmployeeTaskView />;
}
