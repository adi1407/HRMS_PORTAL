import { useState, useEffect, useCallback, useMemo } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const GRANULARITIES = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' },
  { value: 'half_year', label: 'Half-yearly' },
  { value: 'year', label: 'Yearly' },
];

function canSubmit(role) {
  return ['HR', 'DIRECTOR', 'SUPER_ADMIN', 'EMPLOYEE'].includes(role);
}

function isAdminAudit(role) {
  return role === 'SUPER_ADMIN' || role === 'DIRECTOR';
}

function TabBtn({ active, children, onClick }) {
  return (
    <button
      type="button"
      className={`btn ${active ? 'btn--primary' : 'btn--secondary'}`}
      style={{ marginRight: 8, marginBottom: 8 }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ScoreStars({ score }) {
  return (
    <span style={{ fontWeight: 700, color: score >= 4 ? '#15803d' : score >= 3 ? '#2563eb' : '#b45309' }}>
      {score}/5
    </span>
  );
}

function ChartBlock({ title, data, loading }) {
  const chartData = useMemo(() => {
    if (!data?.labels?.length) return [];
    return data.labels.map((name, i) => ({
      name: name.length > 18 ? `${name.slice(0, 16)}…` : name,
      fullName: name,
      avg: data.averages[i],
      count: data.counts[i],
    }));
  }, [data]);

  if (loading) return <div className="page-loading">Loading chart…</div>;
  if (!chartData.length) {
    return <p style={{ color: '#6b7280' }}>No ratings in this range yet.</p>;
  }

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{title}</h3>
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 64 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 5]} tickCount={6} />
            <Tooltip
              formatter={(v, name, props) => [Number(v).toFixed(2), 'Average']}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
            />
            <Line type="monotone" dataKey="avg" stroke="#2563eb" strokeWidth={2} dot name="Avg" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function FeedbackRatingsPage() {
  const { user } = useAuthStore();
  const role = user?.role;
  const [tab, setTab] = useState('submit');

  const [weekInfo, setWeekInfo] = useState(null);
  const [ratees, setRatees] = useState([]);
  const [rateeId, setRateeId] = useState('');
  const [score, setScore] = useState(5);
  const [review, setReview] = useState('');
  const [weekStartOverride, setWeekStartOverride] = useState('');
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);

  const [received, setReceived] = useState(null);
  const [given, setGiven] = useState(null);
  const [audit, setAudit] = useState(null);
  const [listLoading, setListLoading] = useState(false);

  const [granularity, setGranularity] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mySeries, setMySeries] = useState(null);
  const [adminSeries, setAdminSeries] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [adminDirection, setAdminDirection] = useState('');

  const loadWeekInfo = useCallback(async () => {
    try {
      const { data } = await api.get('/feedback-ratings/week-info');
      setWeekInfo(data.data);
    } catch {
      setWeekInfo(null);
    }
  }, []);

  const loadEligible = useCallback(async () => {
    if (!canSubmit(role)) return;
    try {
      const { data } = await api.get('/feedback-ratings/eligible-ratees');
      setRatees(data.data?.ratees || []);
    } catch {
      setRatees([]);
    }
  }, [role]);

  const loadReceived = useCallback(async () => {
    setListLoading(true);
    try {
      const { data } = await api.get('/feedback-ratings/me/received');
      setReceived(data.data);
    } catch {
      setReceived({ ratings: [], total: 0 });
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadGiven = useCallback(async () => {
    setListLoading(true);
    try {
      const { data } = await api.get('/feedback-ratings/me/given');
      setGiven(data.data);
    } catch {
      setGiven({ ratings: [], total: 0 });
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setListLoading(true);
    try {
      const { data } = await api.get('/feedback-ratings/admin/audit?limit=100');
      setAudit(data.data);
    } catch {
      setAudit({ ratings: [], total: 0 });
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadMyChart = useCallback(async () => {
    setChartLoading(true);
    try {
      const params = new URLSearchParams({ granularity });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const { data } = await api.get(`/feedback-ratings/analytics/me?${params}`);
      setMySeries(data.data);
    } catch {
      setMySeries(null);
    } finally {
      setChartLoading(false);
    }
  }, [granularity, from, to]);

  const loadAdminChart = useCallback(async () => {
    setChartLoading(true);
    try {
      const params = new URLSearchParams({ granularity });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (adminDirection) params.set('direction', adminDirection);
      const { data } = await api.get(`/feedback-ratings/admin/analytics?${params}`);
      setAdminSeries(data.data);
    } catch {
      setAdminSeries(null);
    } finally {
      setChartLoading(false);
    }
  }, [granularity, from, to, adminDirection]);

  useEffect(() => {
    loadWeekInfo();
    loadEligible();
  }, [loadWeekInfo, loadEligible]);

  useEffect(() => {
    if (user?.role && !canSubmit(user.role)) {
      setTab((prev) => (prev === 'submit' ? 'received' : prev));
    }
  }, [user?.role]);

  useEffect(() => {
    if (tab === 'received') loadReceived();
    if (tab === 'given') loadGiven();
    if (tab === 'admin') loadAudit();
    if (tab === 'charts') {
      loadMyChart();
      if (role && isAdminAudit(role)) loadAdminChart();
    }
  }, [tab, loadReceived, loadGiven, loadAudit, loadMyChart, loadAdminChart, role]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitMsg('');
    if (!rateeId) {
      setSubmitMsg('Select who you are rating.');
      return;
    }
    if (review.trim().length < (weekInfo?.reviewMin ?? 20)) {
      setSubmitMsg(`Review must be at least ${weekInfo?.reviewMin ?? 20} characters.`);
      return;
    }
    setSubmitBusy(true);
    try {
      const body = { rateeId, score: Number(score), review: review.trim() };
      if (role === 'SUPER_ADMIN' && weekStartOverride) body.weekStart = weekStartOverride;
      await api.post('/feedback-ratings', body);
      setSubmitMsg('Feedback submitted for this week.');
      setReview('');
      loadGiven();
      loadWeekInfo();
    } catch (err) {
      setSubmitMsg(err.response?.data?.message || 'Could not submit.');
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Weekly feedback</h1>
        <p className="page-subtitle">
          {canSubmit(role)
            ? 'Rate leadership or staff once per week (1–5) with a written reason. You cannot see who rated you; Super Admin and Director can audit all submissions.'
            : 'View anonymous feedback about you (score and review only) and trends. Your role cannot submit weekly ratings.'}
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 16 }}>
        {canSubmit(role) && (
          <TabBtn active={tab === 'submit'} onClick={() => setTab('submit')}>
            Submit
          </TabBtn>
        )}
        <TabBtn active={tab === 'received'} onClick={() => setTab('received')}>
          About me
        </TabBtn>
        {canSubmit(role) && (
          <TabBtn active={tab === 'given'} onClick={() => setTab('given')}>
            I rated
          </TabBtn>
        )}
        <TabBtn active={tab === 'charts'} onClick={() => setTab('charts')}>
          Charts
        </TabBtn>
        {isAdminAudit(role) && (
          <TabBtn active={tab === 'admin'} onClick={() => setTab('admin')}>
            Admin audit
          </TabBtn>
        )}
      </div>

      {tab === 'submit' && canSubmit(role) && (
        <div className="card" style={{ padding: 24, maxWidth: 560 }}>
          {weekInfo && (
            <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#374151' }}>
              <strong>This week (IST):</strong> {weekInfo.weekLabel}
            </p>
          )}
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Who are you rating?</label>
              <select className="form-input" value={rateeId} onChange={(e) => setRateeId(e.target.value)} required>
                <option value="">— Select —</option>
                {ratees.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.employeeId}) — {u.role}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Score (1–5)</label>
              <select className="form-input" style={{ maxWidth: 120 }} value={score} onChange={(e) => setScore(e.target.value)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Review (required, {weekInfo?.reviewMin ?? 20}–{weekInfo?.reviewMax ?? 500} chars)</label>
              <textarea
                className="form-input"
                rows={5}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                minLength={weekInfo?.reviewMin ?? 20}
                maxLength={weekInfo?.reviewMax ?? 500}
                placeholder="Explain your rating constructively…"
                required
              />
              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{review.trim().length} characters</span>
            </div>
            {role === 'SUPER_ADMIN' && (
              <div className="form-group">
                <label className="form-label">Backfill week (optional, ISO date in that week)</label>
                <input
                  type="date"
                  className="form-input"
                  value={weekStartOverride}
                  onChange={(e) => setWeekStartOverride(e.target.value)}
                />
              </div>
            )}
            {submitMsg && (
              <div className={`alert ${submitMsg.includes('submit') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>
                {submitMsg}
              </div>
            )}
            <button type="submit" className="btn btn--primary" disabled={submitBusy}>
              {submitBusy ? 'Submitting…' : 'Submit weekly feedback'}
            </button>
          </form>
        </div>
      )}

      {tab === 'received' && (
        <div className="card" style={{ padding: 20 }}>
          {listLoading ? (
            <div className="page-loading">Loading…</div>
          ) : (received?.ratings || []).length === 0 ? (
            <p style={{ color: '#6b7280' }}>No feedback received yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {received?.ratings?.map((r) => (
                <li key={r._id} className="card" style={{ padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <ScoreStars score={r.score} />
                    <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{r.weekLabel}</span>
                  </div>
                  <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{r.review}</p>
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Anonymous rater — identity hidden</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'given' && (
        <div className="card" style={{ padding: 20 }}>
          {listLoading ? (
            <div className="page-loading">Loading…</div>
          ) : (given?.ratings || []).length === 0 ? (
            <p style={{ color: '#6b7280' }}>You have not submitted any weekly feedback yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {given?.ratings?.map((r) => (
                <li key={r._id} className="card" style={{ padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <strong>{r.ratee?.name}</strong>
                    <ScoreStars score={r.score} />
                    <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{r.weekLabel}</span>
                  </div>
                  <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{r.review}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'charts' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Granularity</label>
              <select className="form-input" value={granularity} onChange={(e) => setGranularity(e.target.value)}>
                {GRANULARITIES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">From</label>
              <input type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">To</label>
              <input type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button type="button" className="btn btn--secondary" onClick={() => { loadMyChart(); if (isAdminAudit(role)) loadAdminChart(); }}>
              Refresh charts
            </button>
          </div>
          {isAdminAudit(role) && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Org chart — direction filter</label>
              <select className="form-input" style={{ maxWidth: 280 }} value={adminDirection} onChange={(e) => setAdminDirection(e.target.value)}>
                <option value="">All</option>
                <option value="LEADERSHIP_TO_EMPLOYEE">Leadership → staff</option>
                <option value="EMPLOYEE_TO_LEADERSHIP">Employee → leadership</option>
              </select>
            </div>
          )}
          <ChartBlock title="My received ratings (average score)" data={mySeries} loading={chartLoading} />
          {isAdminAudit(role) && (
            <ChartBlock title="Organization — all ratings (average score)" data={adminSeries} loading={chartLoading} />
          )}
        </div>
      )}

      {tab === 'admin' && isAdminAudit(role) && (
        <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
          {listLoading ? (
            <div className="page-loading">Loading…</div>
          ) : (
            <table
              style={{
                width: '100%',
                minWidth: 720,
                fontSize: '0.88rem',
                borderCollapse: 'collapse',
                border: '1px solid var(--border)',
              }}
            >
              <thead>
                <tr style={{ background: 'var(--gray-50)' }}>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>Week</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>Rater</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>Ratee</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>Dir</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>Score</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border)' }}>Review</th>
                </tr>
              </thead>
              <tbody>
                {(audit?.ratings || []).map((r) => (
                  <tr key={r._id}>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>{r.weekLabel}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      {r.rater?.name} ({r.rater?.employeeId})
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      {r.ratee?.name} ({r.ratee?.employeeId})
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      {r.direction === 'LEADERSHIP_TO_EMPLOYEE' ? 'L→S' : 'E→L'}
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>{r.score}</td>
                    <td style={{ maxWidth: 280, whiteSpace: 'pre-wrap', padding: 8, borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      {r.review}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
