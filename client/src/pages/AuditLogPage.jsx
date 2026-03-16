import { useState, useEffect, useCallback } from 'react';
import { Info, AlertTriangle, XCircle, AlertOctagon } from 'lucide-react';
import api from '../utils/api';

const SEV_STYLE = {
  INFO:     { bg: '#dbeafe', color: '#2563eb', Icon: Info },
  WARNING:  { bg: '#fef3c7', color: '#b45309', Icon: AlertTriangle },
  ERROR:    { bg: '#fee2e2', color: '#b91c1c', Icon: XCircle },
  CRITICAL: { bg: '#7f1d1d', color: '#fff',    Icon: AlertOctagon },
};
const METHOD_STYLE = {
  POST:   { bg: '#dcfce7', color: '#15803d' },
  PATCH:  { bg: '#dbeafe', color: '#2563eb' },
  PUT:    { bg: '#e0e7ff', color: '#4338ca' },
  DELETE: { bg: '#fee2e2', color: '#b91c1c' },
  OTHER:  { bg: '#f3f4f6', color: '#6b7280' },
};
const ENTITIES = ['Auth','User','Attendance','Salary','Leave','Branch','Department','Holiday','Resignation','Document','ExpenseClaim','DailyTask','Announcement','Ticket','Asset','Onboarding','Notification','Warning','Appraisal','SalaryRequest','Analytics','Export','Face','System'];
const ACTIONS = ['CREATE','UPDATE','DELETE','LOGIN','LOGOUT','PAYSLIP_VIEW','PAYSLIP_DOWNLOAD','PAYSLIP_PIN_SET','PAYSLIP_PIN_CHANGED','PAYSLIP_PIN_REMOVED'];
const SEVERITIES = ['INFO','WARNING','ERROR','CRITICAL'];
const METHODS = ['POST','PATCH','PUT','DELETE'];

function Badge({ text, bg, color }) {
  return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700, background: bg, color, whiteSpace: 'nowrap' }}>{text}</span>;
}

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  return day === 1 ? 'yesterday' : `${day}d ago`;
}

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }

function MiniBar({ items, colorFn }) {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem' }}>
          <span style={{ width: 75, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
          <div style={{ flex: 1, height: 12, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden' }}>
            <div style={{ width: `${(item.count / max) * 100}%`, height: '100%', borderRadius: 3, background: colorFn?.(item.label) || '#2563eb', transition: 'width 0.3s' }} />
          </div>
          <span style={{ minWidth: 30, textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>{item.count}</span>
        </div>
      ))}
    </div>
  );
}

function HourlyChart({ data }) {
  const hours = Array.from({ length: 24 }, (_, i) => {
    const match = data.find(d => d.hour === i);
    return { hour: i, count: match?.count || 0 };
  });
  const max = Math.max(...hours.map(h => h.count), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
      {hours.map(h => (
        <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '100%', minHeight: 2,
            height: `${(h.count / max) * 50}px`,
            background: h.count > 0 ? '#2563eb' : '#e2e8f0',
            borderRadius: '2px 2px 0 0', transition: 'height 0.3s',
          }} />
          {h.hour % 4 === 0 && <span style={{ fontSize: '0.6rem', color: '#9ca3af', marginTop: 2 }}>{h.hour}h</span>}
        </div>
      ))}
    </div>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const [filters, setFilters] = useState({
    page: 1, search: '', severity: '', action: '', entity: '', method: '',
    actor: '', startDate: '', endDate: '',
  });

  const setFilter = (k, v) => setFilters(p => ({ ...p, [k]: v, page: k === 'page' ? v : 1 }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', filters.page);
      params.set('limit', '50');
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.action) params.set('action', filters.action);
      if (filters.entity) params.set('entity', filters.entity);
      if (filters.method) params.set('method', filters.method);
      if (filters.actor.trim()) params.set('actor', filters.actor.trim());
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const [logRes, statsRes] = await Promise.all([
        api.get(`/audit-logs?${params.toString()}`),
        api.get('/audit-logs/stats'),
      ]);
      setLogs(logRes.data.data.logs);
      setTotal(logRes.data.data.total);
      setPages(logRes.data.data.pages);
      setStats(statsRes.data.data);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(fetchAll, 350);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  const clearOld = async () => {
    if (!window.confirm('Delete audit logs older than 90 days?')) return;
    setClearing(true);
    try {
      const { data } = await api.delete('/audit-logs/clear?olderThanDays=90');
      alert(data.message);
      fetchAll();
    } catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setClearing(false); }
  };

  const sevColor = (s) => {
    const m = { INFO: '#2563eb', WARNING: '#b45309', ERROR: '#b91c1c', CRITICAL: '#7f1d1d' };
    return m[s] || '#6b7280';
  };
  const entityColor = () => '#6d28d9';
  const methodColor = (m) => {
    const c = { POST: '#15803d', PATCH: '#2563eb', PUT: '#4338ca', DELETE: '#b91c1c' };
    return c[m] || '#6b7280';
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Track all system actions — who did what, when</p>
        </div>
        <button className="btn btn--secondary" style={{ fontSize: '0.82rem', borderColor: '#b91c1c', color: '#b91c1c' }} onClick={clearOld} disabled={clearing}>
          {clearing ? 'Clearing...' : 'Clear Logs (90d+)'}
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: stats.total, bg: '#dbeafe', color: '#2563eb' },
          { label: 'Today', value: stats.today, bg: '#dcfce7', color: '#15803d' },
          { label: 'This Week', value: stats.thisWeek, bg: '#fef3c7', color: '#b45309' },
          { label: 'Info', value: stats.bySeverity?.INFO || 0, bg: '#dbeafe', color: '#2563eb' },
          { label: 'Warnings', value: stats.bySeverity?.WARNING || 0, bg: '#fef3c7', color: '#b45309' },
          { label: 'Errors', value: (stats.bySeverity?.ERROR || 0) + (stats.bySeverity?.CRITICAL || 0), bg: '#fee2e2', color: '#b91c1c' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 16px', borderRadius: 10, background: s.bg, minWidth: 75, textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: s.color }}>{s.value ?? '—'}</div>
            <div style={{ fontSize: '0.68rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Visual charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: 14 }}>
          <h5 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>Today's Activity (Hourly)</h5>
          <HourlyChart data={stats.hourlyToday || []} />
        </div>
        <div className="card" style={{ padding: 14 }}>
          <h5 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>Top Entities</h5>
          <MiniBar items={(stats.byEntity || []).slice(0, 6).map(e => ({ label: e.entity || '—', count: e.count }))} colorFn={entityColor} />
        </div>
        <div className="card" style={{ padding: 14 }}>
          <h5 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>Most Active Users</h5>
          <MiniBar items={(stats.recentActors || []).slice(0, 6).map(a => ({ label: a.name || '—', count: a.count }))} colorFn={() => '#15803d'} />
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 180px' }}>
            <label className="form-label" style={{ fontSize: '0.72rem' }}>Search</label>
            <input className="form-input" value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Description, name, path..." />
          </div>
          <div className="form-group" style={{ margin: 0, flex: '0 1 140px' }}>
            <label className="form-label" style={{ fontSize: '0.72rem' }}>Actor</label>
            <input className="form-input" value={filters.actor} onChange={e => setFilter('actor', e.target.value)} placeholder="Name or ID" />
          </div>
          <div className="form-group" style={{ margin: 0, flex: '0 1 120px' }}>
            <label className="form-label" style={{ fontSize: '0.72rem' }}>Severity</label>
            <select className="form-input" value={filters.severity} onChange={e => setFilter('severity', e.target.value)}>
              <option value="">All</option>
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: '0 1 120px' }}>
            <label className="form-label" style={{ fontSize: '0.72rem' }}>Action</label>
            <select className="form-input" value={filters.action} onChange={e => setFilter('action', e.target.value)}>
              <option value="">All</option>
              {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: '0 1 130px' }}>
            <label className="form-label" style={{ fontSize: '0.72rem' }}>Entity</label>
            <select className="form-input" value={filters.entity} onChange={e => setFilter('entity', e.target.value)}>
              <option value="">All</option>
              {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: '0 1 110px' }}>
            <label className="form-label" style={{ fontSize: '0.72rem' }}>Method</label>
            <select className="form-input" value={filters.method} onChange={e => setFilter('method', e.target.value)}>
              <option value="">All</option>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: '0 1 130px' }}>
            <label className="form-label" style={{ fontSize: '0.72rem' }}>From</label>
            <input className="form-input" type="date" value={filters.startDate} onChange={e => setFilter('startDate', e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0, flex: '0 1 130px' }}>
            <label className="form-label" style={{ fontSize: '0.72rem' }}>To</label>
            <input className="form-input" type="date" value={filters.endDate} onChange={e => setFilter('endDate', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Results info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: '0.82rem', color: '#6b7280' }}>
        <span>{total.toLocaleString()} log entries &middot; Page {filters.page} of {pages}</span>
      </div>

      {/* Log timeline */}
      {loading ? <div className="page-loading">Loading...</div> : logs.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#128270;</div>
          <h3>No audit logs found</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Adjust filters or wait for system activity</p>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          {/* Timeline line */}
          <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: '#e5e7eb' }} />

          {logs.map(log => {
            const sev = SEV_STYLE[log.severity] || SEV_STYLE.INFO;
            const mth = METHOD_STYLE[log.method] || METHOD_STYLE.OTHER;
            return (
              <div key={log._id} style={{ position: 'relative', marginBottom: 8 }}>
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute', left: -18, top: 14, width: 12, height: 12, borderRadius: 6,
                  background: sev.color === '#fff' ? '#7f1d1d' : sev.color, border: '2px solid #fff', zIndex: 1,
                }} />

                <div className="card" style={{ padding: '12px 16px', marginLeft: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <sev.Icon size={14} strokeWidth={2} />
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111827' }}>{log.actorName || log.actor?.name || 'System'}</span>
                      {log.actor?.employeeId && <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{log.actor.employeeId}</span>}
                      {log.actorRole && <Badge text={log.actorRole} bg="#f3f4f6" color="#6b7280" />}
                      <Badge text={log.method || 'OTHER'} {...mth} />
                      <Badge text={log.severity} bg={sev.bg} color={sev.color} />
                      {log.entity && <Badge text={log.entity} bg="#ede9fe" color="#6d28d9" />}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#9ca3af', whiteSpace: 'nowrap' }} title={fmt(log.createdAt)}>{timeAgo(log.createdAt)}</span>
                  </div>
                  <p style={{ margin: '2px 0', fontSize: '0.84rem', color: '#374151', lineHeight: 1.4 }}>{log.description || log.action}</p>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: '#9ca3af', marginTop: 4, flexWrap: 'wrap' }}>
                    {log.path && <span>Path: {log.path}</span>}
                    {log.ip && <span>IP: {log.ip}</span>}
                    {log.statusCode && <span>Status: {log.statusCode}</span>}
                    <span>{fmt(log.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
          <button className="btn btn--secondary" style={{ fontSize: '0.82rem', padding: '4px 12px' }}
            disabled={filters.page <= 1} onClick={() => setFilter('page', filters.page - 1)}>&larr; Prev</button>
          <span style={{ lineHeight: '32px', fontSize: '0.85rem', color: '#6b7280' }}>
            Page {filters.page} of {pages}
          </span>
          <button className="btn btn--secondary" style={{ fontSize: '0.82rem', padding: '4px 12px' }}
            disabled={filters.page >= pages} onClick={() => setFilter('page', filters.page + 1)}>Next &rarr;</button>
        </div>
      )}
    </div>
  );
}
