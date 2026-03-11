import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const TYPES = ['BIRTHDAY', 'WORK_ANNIVERSARY', 'PROBATION_REMINDER', 'LEAVE_BALANCE', 'SLA_BREACH'];
const STATUSES = ['SENT', 'FAILED', 'SKIPPED'];

const TYPE_CONFIG = {
  BIRTHDAY:            { icon: '🎂', label: 'Birthday',          bg: '#fce7f3', color: '#be185d' },
  WORK_ANNIVERSARY:    { icon: '🏆', label: 'Anniversary',       bg: '#fef3c7', color: '#b45309' },
  PROBATION_REMINDER:  { icon: '⏰', label: 'Probation',         bg: '#dbeafe', color: '#2563eb' },
  LEAVE_BALANCE:       { icon: '📋', label: 'Leave Balance',     bg: '#dcfce7', color: '#15803d' },
  SLA_BREACH:          { icon: '🚨', label: 'SLA Breach',        bg: '#fee2e2', color: '#b91c1c' },
};
const STATUS_STYLE = {
  SENT:    { bg: '#dcfce7', color: '#15803d' },
  FAILED:  { bg: '#fee2e2', color: '#b91c1c' },
  SKIPPED: { bg: '#f3f4f6', color: '#6b7280' },
};

function Badge({ text, bg, color }) {
  return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: bg, color, whiteSpace: 'nowrap' }}>{text}</span>;
}
function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
function fmtShort(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'; }

export default function EmailAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(null);
  const [triggerResult, setTriggerResult] = useState(null);

  const [filters, setFilters] = useState({ page: 1, type: '', status: '', startDate: '', endDate: '' });
  const setFilter = (k, v) => setFilters(p => ({ ...p, [k]: v, page: k === 'page' ? v : 1 }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', filters.page);
      params.set('limit', '40');
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const [hRes, sRes] = await Promise.all([
        api.get(`/email-alerts/history?${params.toString()}`),
        api.get('/email-alerts/stats'),
      ]);
      setAlerts(hRes.data.data.alerts);
      setTotal(hRes.data.data.total);
      setPages(hRes.data.data.pages);
      setStats(sRes.data.data);
    } catch { setAlerts([]); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(fetchAll, 300);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  const trigger = async (type) => {
    setTriggering(type || 'ALL');
    setTriggerResult(null);
    try {
      const { data } = await api.post('/email-alerts/trigger', type ? { type } : {});
      setTriggerResult(data.data);
      setTimeout(fetchAll, 1000);
    } catch (err) { setTriggerResult({ error: err.response?.data?.message || 'Failed' }); }
    finally { setTriggering(null); }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Email Alerts</h1>
          <p className="page-subtitle">Automated birthday wishes, anniversary greetings, probation reminders, leave balance & SLA alerts</p>
        </div>
        <button className="btn btn--primary" onClick={() => trigger(null)} disabled={!!triggering}>
          {triggering === 'ALL' ? 'Sending...' : 'Run All Alerts Now'}
        </button>
      </div>

      {triggerResult && (
        <div className={`alert ${triggerResult.error ? 'alert--error' : 'alert--success'}`} style={{ marginBottom: 16 }}>
          {triggerResult.error
            ? triggerResult.error
            : `Alerts sent — ${Object.entries(triggerResult).map(([k, v]) => `${k}: ${v}`).join(', ')}`
          }
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#dbeafe', minWidth: 70, textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2563eb' }}>{stats.total ?? '—'}</div>
          <div style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 600 }}>Total</div>
        </div>
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#dcfce7', minWidth: 70, textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#15803d' }}>{stats.sentToday ?? '—'}</div>
          <div style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: 600 }}>Today</div>
        </div>
        {TYPES.map(t => {
          const tc = TYPE_CONFIG[t];
          return (
            <div key={t} style={{ padding: '10px 16px', borderRadius: 10, background: tc.bg, minWidth: 70, textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: tc.color }}>{stats.byType?.[t] ?? 0}</div>
              <div style={{ fontSize: '0.68rem', color: tc.color, fontWeight: 600 }}>{tc.icon} {tc.label}</div>
            </div>
          );
        })}
      </div>

      {/* Quick trigger buttons */}
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <h5 style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.88rem', color: '#374151' }}>Manual Trigger</h5>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TYPES.map(t => {
            const tc = TYPE_CONFIG[t];
            return (
              <button key={t} className="btn btn--secondary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                onClick={() => trigger(t)} disabled={!!triggering}>
                {triggering === t ? '...' : `${tc.icon} ${tc.label}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Upcoming events */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: 14 }}>
          <h5 style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.88rem', color: '#be185d' }}>🎂 Upcoming Birthdays (30 days)</h5>
          {(stats.upcomingBirthdays || []).length === 0
            ? <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>None in the next 30 days</p>
            : (stats.upcomingBirthdays || []).map((u, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 600, color: '#111827' }}>{u.name} <span style={{ color: '#9ca3af', fontWeight: 400 }}>{u.employeeId}</span></span>
                <span style={{ color: u.daysUntil === 0 ? '#be185d' : '#6b7280', fontWeight: u.daysUntil === 0 ? 700 : 400 }}>
                  {u.daysUntil === 0 ? 'Today!' : `${u.daysUntil}d — ${fmtShort(u.date)}`}
                </span>
              </div>
            ))
          }
        </div>
        <div className="card" style={{ padding: 14 }}>
          <h5 style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.88rem', color: '#b45309' }}>🏆 Upcoming Anniversaries (30 days)</h5>
          {(stats.upcomingAnniversaries || []).length === 0
            ? <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>None in the next 30 days</p>
            : (stats.upcomingAnniversaries || []).map((u, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 600, color: '#111827' }}>{u.name} <span style={{ color: '#9ca3af', fontWeight: 400 }}>{u.years}yr</span></span>
                <span style={{ color: u.daysUntil === 0 ? '#b45309' : '#6b7280', fontWeight: u.daysUntil === 0 ? 700 : 400 }}>
                  {u.daysUntil === 0 ? 'Today!' : `${u.daysUntil}d — ${fmtShort(u.date)}`}
                </span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="form-input" value={filters.type} onChange={e => setFilter('type', e.target.value)} style={{ width: 160 }}>
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_CONFIG[t].icon} {TYPE_CONFIG[t].label}</option>)}
        </select>
        <select className="form-input" value={filters.status} onChange={e => setFilter('status', e.target.value)} style={{ width: 120 }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="form-input" type="date" value={filters.startDate} onChange={e => setFilter('startDate', e.target.value)} style={{ width: 140 }} />
        <input className="form-input" type="date" value={filters.endDate} onChange={e => setFilter('endDate', e.target.value)} style={{ width: 140 }} />
      </div>

      <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 10 }}>{total} alert records &middot; Page {filters.page} of {pages}</div>

      {/* History */}
      {loading ? <div className="page-loading">Loading...</div> : alerts.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#128231;</div>
          <h3>No email alerts yet</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Automated alerts run daily at 8:30 AM, or trigger them manually above</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map(a => {
            const tc = TYPE_CONFIG[a.type] || TYPE_CONFIG.BIRTHDAY;
            const sc = STATUS_STYLE[a.status] || STATUS_STYLE.SENT;
            return (
              <div key={a._id} className="card" style={{ padding: '12px 16px', borderLeft: `4px solid ${tc.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1rem' }}>{tc.icon}</span>
                    <Badge text={tc.label} bg={tc.bg} color={tc.color} />
                    <Badge text={a.status} bg={sc.bg} color={sc.color} />
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>{a.recipientName || '—'}</span>
                    {a.recipient?.employeeId && <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{a.recipient.employeeId}</span>}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{fmt(a.createdAt)}</span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#4b5563' }}>{a.subject}</p>
                {a.recipientEmail && <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>To: {a.recipientEmail}</p>}
                {a.error && <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#b91c1c' }}>Error: {a.error}</p>}
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
          <button className="btn btn--secondary" style={{ fontSize: '0.82rem', padding: '4px 12px' }}
            disabled={filters.page <= 1} onClick={() => setFilter('page', filters.page - 1)}>&larr; Prev</button>
          <span style={{ lineHeight: '32px', fontSize: '0.85rem', color: '#6b7280' }}>Page {filters.page} of {pages}</span>
          <button className="btn btn--secondary" style={{ fontSize: '0.82rem', padding: '4px 12px' }}
            disabled={filters.page >= pages} onClick={() => setFilter('page', filters.page + 1)}>Next &rarr;</button>
        </div>
      )}
    </div>
  );
}
