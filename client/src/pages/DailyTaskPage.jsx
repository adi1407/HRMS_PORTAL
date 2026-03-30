import { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { Users, Calendar, LayoutGrid, ListTodo, BarChart3 } from 'lucide-react';

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

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function emptyTask() {
  return { title: '', description: '', status: 'IN_PROGRESS' };
}

/* ── Submit today's tasks (self) ───────────────────────────── */
function SubmitTaskForm({ onSubmitted }) {
  const [tasks, setTasks] = useState([emptyTask()]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [todayEntry, setTodayEntry] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.get('/daily-tasks/today')
      .then(({ data }) => { setTodayEntry(data.data); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const updateTask = (idx, field, value) => {
    setTasks(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const addTask = () => {
    if (tasks.length >= 20) return;
    setTasks(prev => [...prev, emptyTask()]);
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
      onSubmitted();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Submission failed.');
    } finally { setBusy(false); }
  };

  if (checking) return <div className="page-loading">Checking today&apos;s status...</div>;

  if (todayEntry?.source === 'HOD') {
    return <UpdateHodTasksForm initial={todayEntry} onSaved={onSubmitted} />;
  }

  if (todayEntry && todayEntry.source === 'SELF') {
    return (
      <div className="card" style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>&#10003;</div>
        <h3 style={{ margin: '0 0 8px', color: '#15803d' }}>Today&apos;s Tasks Submitted</h3>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
          You have already submitted your task update for today. Come back tomorrow!
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <h4 style={{ margin: '0 0 14px', fontWeight: 600 }}>Submit Today&apos;s Tasks</h4>
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
              <button type="button" onClick={() => removeTask(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                Remove
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 10 }}>
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
        <button type="button" className="btn btn--secondary" onClick={addTask} disabled={tasks.length >= 20}>
          + Add Task
        </button>
        <button type="button" className="btn btn--primary" onClick={submit} disabled={busy}>
          {busy ? 'Submitting...' : 'Submit Tasks'}
        </button>
      </div>
    </div>
  );
}

/** Employee updates tasks when HOD assigned the row */
function UpdateHodTasksForm({ initial, onSaved }) {
  const [tasks, setTasks] = useState(() =>
    (initial.tasks || []).map((t) => ({ title: t.title, description: t.description || '', status: t.status || 'IN_PROGRESS' })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const updateTask = (idx, field, value) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const save = async () => {
    for (const t of tasks) {
      if (!t.title.trim()) { setMsg('Each task must have a title.'); return; }
    }
    setBusy(true); setMsg('');
    try {
      await api.patch('/daily-tasks/today', { tasks });
      setMsg('Tasks updated.');
      onSaved();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Update failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20, border: '1px solid #fde68a', background: '#fffbeb' }}>
      <h4 style={{ margin: '0 0 8px', fontWeight: 600 }}>Tasks assigned by your Head of Department</h4>
      <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: '#92400e' }}>
        Update progress and status for today. You can edit until the end of the day.
      </p>
      {msg && <div className={`alert ${msg.includes('updated') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>{msg}</div>}
      {tasks.map((t, idx) => (
        <div key={idx} style={{ padding: 14, marginBottom: 10, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Title *</label>
              <input className="form-input" value={t.title} onChange={(e) => updateTask(idx, 'title', e.target.value)} maxLength={200} />
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
              <label className="form-label">Status</label>
              <select className="form-input" value={t.status} onChange={(e) => updateTask(idx, 'status', e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 8, marginBottom: 0 }}>
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={2} value={t.description} onChange={(e) => updateTask(idx, 'description', e.target.value)} maxLength={1000} style={{ resize: 'vertical' }} />
          </div>
        </div>
      ))}
      <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
        {busy ? 'Saving...' : 'Save updates'}
      </button>
    </div>
  );
}

/* ── My task history ───────────────────────────────────────── */
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

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-input" value={month} onChange={e => setMonth(e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="form-input" value={year} onChange={e => setYear(e.target.value)} style={{ flex: '0 1 100px', minWidth: 0 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{fmt(entry.date)}</span>
                <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                  {entry.source === 'HOD' ? 'HOD assigned' : 'Self'} · {entry.tasks.length} task{entry.tasks.length > 1 ? 's' : ''}
                </span>
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

/* ── HOD: assign + team views ───────────────────────────────── */
function HodTeamPanel({ dept }) {
  const [sub, setSub] = useState('assign');
  const [team, setTeam] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [assignEmp, setAssignEmp] = useState('');
  const [assignDate, setAssignDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [assignTasks, setAssignTasks] = useState([emptyTask()]);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');

  const [dayDate, setDayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dayFilterEmp, setDayFilterEmp] = useState('');
  const [dayRows, setDayRows] = useState([]);
  const [loadingDay, setLoadingDay] = useState(false);

  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d.toISOString().slice(0, 10);
  });
  const [weekFilterEmp, setWeekFilterEmp] = useState('');
  const [weekRows, setWeekRows] = useState([]);
  const [loadingWeek, setLoadingWeek] = useState(false);

  const [sumMonth, setSumMonth] = useState(String(new Date().getMonth() + 1));
  const [sumYear, setSumYear] = useState(String(new Date().getFullYear()));
  const [summary, setSummary] = useState([]);
  const [loadingSum, setLoadingSum] = useState(false);

  useEffect(() => {
    api.get(`/departments/${dept._id}/team`)
      .then(({ data }) => {
        setTeam(data.data || []);
        const emps = (data.data || []).filter((u) => u._id !== (dept.head?._id || dept.head));
        if (emps.length && !assignEmp) setAssignEmp(emps[0]._id);
      })
      .catch(() => setTeam([]))
      .finally(() => setLoadingTeam(false));
  }, [dept._id, dept.head]);

  const fetchDay = async () => {
    setLoadingDay(true);
    try {
      const q = dayFilterEmp ? `&employeeId=${encodeURIComponent(dayFilterEmp)}` : '';
      const { data } = await api.get(`/daily-tasks/hod-team-tasks?date=${dayDate}${q}`);
      setDayRows(data.data || []);
    } catch { setDayRows([]); }
    finally { setLoadingDay(false); }
  };

  const fetchWeek = async () => {
    setLoadingWeek(true);
    try {
      const q = weekFilterEmp ? `&employeeId=${encodeURIComponent(weekFilterEmp)}` : '';
      const { data } = await api.get(`/daily-tasks/hod-team-tasks?weekStart=${weekStart}${q}`);
      setWeekRows(data.data || []);
    } catch { setWeekRows([]); }
    finally { setLoadingWeek(false); }
  };

  const fetchSummary = async () => {
    setLoadingSum(true);
    try {
      const { data } = await api.get(`/daily-tasks/hod-team-summary?month=${sumMonth}&year=${sumYear}`);
      setSummary(data.data || []);
    } catch { setSummary([]); }
    finally { setLoadingSum(false); }
  };

  useEffect(() => { if (sub === 'day') fetchDay(); }, [sub, dayDate, dayFilterEmp]);
  useEffect(() => { if (sub === 'week') fetchWeek(); }, [sub, weekStart, weekFilterEmp]);
  useEffect(() => { if (sub === 'summary') fetchSummary(); }, [sub, sumMonth, sumYear]);

  const submitAssign = async (e) => {
    e.preventDefault();
    if (!assignEmp) { setAssignMsg('Choose a team member.'); return; }
    for (const t of assignTasks) {
      if (!t.title.trim()) { setAssignMsg('Each task needs a title.'); return; }
    }
    setAssignBusy(true); setAssignMsg('');
    try {
      await api.post('/daily-tasks/hod-assign', {
        employeeId: assignEmp,
        date: assignDate,
        tasks: assignTasks,
      });
      setAssignMsg('✅ Tasks assigned.');
      setAssignTasks([emptyTask()]);
    } catch (err) {
      setAssignMsg(err.response?.data?.message || 'Failed.');
    } finally { setAssignBusy(false); }
  };

  const updateAssignTask = (idx, field, value) => {
    setAssignTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const hodAssignTargets = useMemo(() => team.filter((u) => u._id !== (dept.head?._id || dept.head)), [team, dept.head]);

  return (
    <div>
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e3a5f' }}>
          <strong>{dept.name}</strong> — head of department tools. Assign tasks for any date; team sees updates under <em>My Daily Tasks</em>.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'assign', label: 'Assign tasks', Icon: ListTodo },
          { id: 'day', label: 'Day view', Icon: Calendar },
          { id: 'week', label: 'Week view', Icon: LayoutGrid },
          { id: 'summary', label: 'Monthly summary', Icon: BarChart3 },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`btn ${sub === id ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setSub(id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon size={14} strokeWidth={2} /> {label}
          </button>
        ))}
      </div>

      {sub === 'assign' && (
        <form className="card" style={{ padding: 20 }} onSubmit={submitAssign}>
          <h4 style={{ margin: '0 0 14px', fontWeight: 600 }}>Assign tasks</h4>
          {assignMsg && <div className={`alert ${assignMsg.startsWith('✅') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>{assignMsg}</div>}
          {loadingTeam ? <div className="page-loading">Loading team...</div> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12, marginBottom: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Team member</label>
                  <select className="form-input" value={assignEmp} onChange={(e) => setAssignEmp(e.target.value)} required>
                    <option value="">— Select —</option>
                    {hodAssignTargets.map((u) => (
                      <option key={u._id} value={u._id}>{u.name} ({u.employeeId})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} />
                </div>
              </div>
              {hodAssignTargets.length === 0 && (
                <p style={{ color: '#b45309', fontSize: '0.88rem' }}>No other employees in this department yet. Add employees and assign departments in Employees.</p>
              )}
              {assignTasks.map((t, idx) => (
                <div key={idx} style={{ padding: 12, marginBottom: 10, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Title *</label>
                      <input className="form-input" value={t.title} onChange={(e) => updateAssignTask(idx, 'title', e.target.value)} maxLength={200} />
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 130 }}>
                      <label className="form-label">Status</label>
                      <select className="form-input" value={t.status} onChange={(e) => updateAssignTask(idx, 'status', e.target.value)}>
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 8, marginBottom: 0 }}>
                    <label className="form-label">Description</label>
                    <textarea className="form-input" rows={2} value={t.description} onChange={(e) => updateAssignTask(idx, 'description', e.target.value)} maxLength={1000} style={{ resize: 'vertical' }} />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setAssignTasks((p) => [...p, emptyTask()])} disabled={assignTasks.length >= 20}>
                  + Task
                </button>
                <button type="submit" className="btn btn--primary" disabled={assignBusy || hodAssignTargets.length === 0}>
                  {assignBusy ? 'Saving...' : 'Assign / update day'}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {sub === 'day' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: 200 }}>
              <label className="form-label">Team member</label>
              <select className="form-input" value={dayFilterEmp} onChange={(e) => setDayFilterEmp(e.target.value)}>
                <option value="">All in department</option>
                {hodAssignTargets.map((u) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.employeeId})</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn--secondary" onClick={fetchDay}>Refresh</button>
          </div>
          {loadingDay ? <div className="page-loading">Loading...</div> : dayRows.length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>No task submissions for that day.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dayRows.map((row) => (
                <div key={row._id} style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{row.employee?.name} <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.85rem' }}>{row.employee?.employeeId}</span></div>
                  {row.tasks.map((task, i) => (
                    <div key={task._id || i} style={{ padding: '6px 0', borderTop: i ? '1px solid #e5e7eb' : 'none' }}>
                      <span style={{ fontWeight: 600 }}>{task.title}</span> <StatusBadge status={task.status} />
                      {task.description && <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>{task.description}</p>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sub === 'week' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Week starting (Monday)</label>
              <input className="form-input" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: 200 }}>
              <label className="form-label">Team member</label>
              <select className="form-input" value={weekFilterEmp} onChange={(e) => setWeekFilterEmp(e.target.value)}>
                <option value="">All in department</option>
                {hodAssignTargets.map((u) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.employeeId})</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn--secondary" onClick={fetchWeek}>Refresh</button>
          </div>
          {loadingWeek ? <div className="page-loading">Loading...</div> : weekRows.length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>No entries in this week range.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {weekRows.map((row) => (
                <div key={row._id} className="card" style={{ padding: '12px 16px', marginBottom: 0 }}>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 6 }}>{fmt(row.date)}</div>
                  <div style={{ fontWeight: 700 }}>{row.employee?.name}</div>
                  <div style={{ fontSize: '0.82rem', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {row.tasks.map((task, i) => (
                      <span key={task._id || i} style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 8, fontSize: '0.8rem' }}>{task.title}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sub === 'summary' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <select className="form-input" value={sumMonth} onChange={(e) => setSumMonth(e.target.value)} style={{ maxWidth: 160 }}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="form-input" value={sumYear} onChange={(e) => setSumYear(e.target.value)} style={{ maxWidth: 100 }}>
              {[0, 1, 2].map((o) => {
                const y = new Date().getFullYear() - o;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
            <button type="button" className="btn btn--secondary" onClick={fetchSummary}>Refresh</button>
          </div>
          {loadingSum ? <div className="page-loading">Loading...</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th style={{ textAlign: 'center' }}>Days w/ tasks</th>
                    <th style={{ textAlign: 'center' }}>HOD-assigned days</th>
                    <th style={{ textAlign: 'center' }}>Tasks</th>
                    <th style={{ textAlign: 'center' }}>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={row.employee._id}>
                      <td>{row.employee.name} <span style={{ color: '#9ca3af' }}>{row.employee.employeeId}</span></td>
                      <td style={{ textAlign: 'center' }}>{row.daysWithTasks}</td>
                      <td style={{ textAlign: 'center' }}>{row.hodAssignedDays}</td>
                      <td style={{ textAlign: 'center' }}>{row.taskCount}</td>
                      <td style={{ textAlign: 'center' }}>{row.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
export default function DailyTaskPage() {
  const [tab, setTab] = useState('submit');
  const [refreshKey, setRefreshKey] = useState(0);
  const [hodCtx, setHodCtx] = useState(null);
  const [hodLoading, setHodLoading] = useState(true);

  useEffect(() => {
    api.get('/departments/me-head')
      .then(({ data }) => setHodCtx(data.data))
      .catch(() => setHodCtx({ isHead: false }))
      .finally(() => setHodLoading(false));
  }, []);

  const showHod = hodCtx?.isHead;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Daily Tasks</h1>
        <p className="page-subtitle">
          {showHod
            ? 'Submit your work, review history, and manage your team as head of department'
            : 'Submit your daily task updates and view your history'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button type="button" className={`btn ${tab === 'submit' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('submit')}>Today&apos;s Update</button>
        <button type="button" className={`btn ${tab === 'history' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('history')}>My History</button>
        {!hodLoading && showHod && (
          <button type="button" className={`btn ${tab === 'hod' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('hod')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Users size={15} strokeWidth={2} /> My team ({hodCtx.department?.name})
          </button>
        )}
      </div>

      {tab === 'submit' && <SubmitTaskForm key={refreshKey} onSubmitted={() => { setRefreshKey((k) => k + 1); setTab('history'); }} />}
      {tab === 'history' && <MyTaskHistory />}
      {tab === 'hod' && showHod && <HodTeamPanel dept={hodCtx.department} />}
    </div>
  );
}
