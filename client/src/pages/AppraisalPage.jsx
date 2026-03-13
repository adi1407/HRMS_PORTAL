import { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

const CYCLE_TYPES = ['QUARTERLY', 'HALF_YEARLY', 'ANNUAL'];
const STATUSES = ['DRAFT', 'SELF_REVIEW', 'MANAGER_REVIEW', 'COMPLETED'];
const RATING_LABELS = {
  OUTSTANDING: 'Outstanding', EXCEEDS_EXPECTATIONS: 'Exceeds Expectations',
  MEETS_EXPECTATIONS: 'Meets Expectations', NEEDS_IMPROVEMENT: 'Needs Improvement',
  UNSATISFACTORY: 'Unsatisfactory',
};
const RATING_COLORS = {
  OUTSTANDING: { bg: '#dcfce7', color: '#15803d' },
  EXCEEDS_EXPECTATIONS: { bg: '#dbeafe', color: '#2563eb' },
  MEETS_EXPECTATIONS: { bg: '#fef3c7', color: '#b45309' },
  NEEDS_IMPROVEMENT: { bg: '#fed7aa', color: '#c2410c' },
  UNSATISFACTORY: { bg: '#fee2e2', color: '#b91c1c' },
};
const STATUS_COLORS = {
  DRAFT: { bg: '#f3f4f6', color: '#6b7280' },
  SELF_REVIEW: { bg: '#fef3c7', color: '#b45309' },
  MANAGER_REVIEW: { bg: '#dbeafe', color: '#2563eb' },
  COMPLETED: { bg: '#dcfce7', color: '#15803d' },
};

function Badge({ text, bg, color }) {
  return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: bg, color, whiteSpace: 'nowrap' }}>{text.replace(/_/g, ' ')}</span>;
}
function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

function ScoreStars({ score, max = 5 }) {
  if (score == null) return <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>—</span>;
  return (
    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: score >= 4 ? '#15803d' : score >= 3 ? '#2563eb' : score >= 2 ? '#b45309' : '#b91c1c' }}>
      {score}/{max}
    </span>
  );
}

function ProgressBar({ percent, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, percent)}%`, height: '100%', borderRadius: 3, background: color || '#2563eb', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: color || '#2563eb', minWidth: 35 }}>{percent}%</span>
    </div>
  );
}

/* ── Self-Assessment Form ─────────────────────────────────── */
function SelfReviewForm({ appraisal, onDone }) {
  const [scores, setScores] = useState(() =>
    appraisal.kpis.map(k => ({ kpiId: k._id, score: k.selfScore ?? '', comment: k.selfComment || '' }))
  );
  const [overall, setOverall] = useState(appraisal.overallSelfComment || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const setKpi = (idx, field, val) => setScores(p => p.map((s, i) => i === idx ? { ...s, [field]: val } : s));

  const submit = async () => {
    for (const s of scores) {
      if (s.score === '' || s.score == null) return setMsg('Please rate all KPIs.');
    }
    setBusy(true); setMsg('');
    try {
      await api.patch(`/appraisals/${appraisal._id}/self-review`, {
        kpiScores: scores.map(s => ({ kpiId: s.kpiId, score: Number(s.score), comment: s.comment })),
        overallComment: overall,
      });
      setMsg('Self-assessment submitted!');
      setTimeout(onDone, 600);
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      {msg && <div className={`alert ${msg.includes('!') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>{msg}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {appraisal.kpis.map((kpi, idx) => (
          <div key={kpi._id} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{kpi.title}</span>
                <Badge text={`${kpi.weight}%`} bg="#f3f4f6" color="#374151" />
              </div>
            </div>
            {kpi.description && <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#6b7280' }}>{kpi.description}</p>}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Score (0-5)</label>
                <select className="form-input" style={{ width: 80 }} value={scores[idx]?.score ?? ''} onChange={e => setKpi(idx, 'score', e.target.value)}>
                  <option value="">—</option>
                  {[0, 1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Comment</label>
                <input className="form-input" value={scores[idx]?.comment || ''} onChange={e => setKpi(idx, 'comment', e.target.value)} placeholder="Optional comment..." maxLength={1000} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label className="form-label">Overall Self-Assessment Comment</label>
        <textarea className="form-input" rows={3} value={overall} onChange={e => setOverall(e.target.value)} placeholder="Your overall reflection..." maxLength={2000} />
      </div>
      <button className="btn btn--primary" onClick={submit} disabled={busy}>{busy ? 'Submitting...' : 'Submit Self-Assessment'}</button>
    </div>
  );
}

/* ── Manager Review Form ──────────────────────────────────── */
function ManagerReviewForm({ appraisal, onDone }) {
  const [scores, setScores] = useState(() =>
    appraisal.kpis.map(k => ({ kpiId: k._id, score: k.managerScore ?? '', comment: k.managerComment || '' }))
  );
  const [overall, setOverall] = useState(appraisal.overallManagerComment || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const setKpi = (idx, field, val) => setScores(p => p.map((s, i) => i === idx ? { ...s, [field]: val } : s));

  const submit = async () => {
    for (const s of scores) {
      if (s.score === '' || s.score == null) return setMsg('Please rate all KPIs.');
    }
    setBusy(true); setMsg('');
    try {
      await api.patch(`/appraisals/${appraisal._id}/manager-review`, {
        kpiScores: scores.map(s => ({ kpiId: s.kpiId, score: Number(s.score), comment: s.comment })),
        overallComment: overall,
      });
      setMsg('Manager review submitted!');
      setTimeout(onDone, 600);
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      {msg && <div className={`alert ${msg.includes('!') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>{msg}</div>}
      <h4 style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.92rem', color: '#1e3a5f' }}>Employee Self-Assessment</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {appraisal.kpis.map(kpi => (
          <div key={kpi._id} style={{ padding: '6px 10px', borderRadius: 6, background: '#f9fafb', fontSize: '0.82rem', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{kpi.title}</span>
            <span style={{ color: '#6b7280' }}>Self: <ScoreStars score={kpi.selfScore} /></span>
            {kpi.selfComment && <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>"{kpi.selfComment}"</span>}
          </div>
        ))}
        {appraisal.overallSelfComment && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f0f7ff', fontSize: '0.82rem', color: '#1e3a8a' }}>
            <strong>Overall:</strong> {appraisal.overallSelfComment}
          </div>
        )}
      </div>

      <h4 style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.92rem', color: '#1e3a5f' }}>Your Manager Rating</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {appraisal.kpis.map((kpi, idx) => (
          <div key={kpi._id} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{kpi.title} <Badge text={`${kpi.weight}%`} bg="#f3f4f6" color="#374151" /></span>
              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Self: <ScoreStars score={kpi.selfScore} /></span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Your Score (0-5)</label>
                <select className="form-input" style={{ width: 80 }} value={scores[idx]?.score ?? ''} onChange={e => setKpi(idx, 'score', e.target.value)}>
                  <option value="">—</option>
                  {[0, 1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Comment</label>
                <input className="form-input" value={scores[idx]?.comment || ''} onChange={e => setKpi(idx, 'comment', e.target.value)} placeholder="Manager comment..." maxLength={1000} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label className="form-label">Overall Manager Comment</label>
        <textarea className="form-input" rows={3} value={overall} onChange={e => setOverall(e.target.value)} placeholder="Overall performance feedback..." maxLength={2000} />
      </div>
      <button className="btn btn--primary" onClick={submit} disabled={busy}>{busy ? 'Submitting...' : 'Submit Manager Review'}</button>
    </div>
  );
}

/* ── Appraisal Detail View ────────────────────────────────── */
function AppraisalDetail({ id, onBack, user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/appraisals/${id}`);
      setData(res.data);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const { data: blob } = await api.get(`/appraisals/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `Appraisal_${data.appraisalId}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { alert(err.response?.data?.message || 'Failed to download PDF.'); }
    finally { setDownloading(false); }
  };

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!data) return <div className="empty-state"><h3>Appraisal not found</h3></div>;

  const sc = STATUS_COLORS[data.status] || STATUS_COLORS.DRAFT;
  const rc = data.rating ? (RATING_COLORS[data.rating] || RATING_COLORS.MEETS_EXPECTATIONS) : null;
  const isOwner = data.employee?._id === user._id;
  const isReviewer = data.reviewer?._id === user._id;
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(user.role);
  const canSelfReview = isOwner && data.status === 'SELF_REVIEW';
  const canManagerReview = (isReviewer || isAdmin) && data.status === 'MANAGER_REVIEW';

  return (
    <div>
      <button className="btn btn--secondary" style={{ marginBottom: 14, fontSize: '0.85rem' }} onClick={onBack}>&larr; Back</button>

      {/* Header card */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{data.employee?.name}</span>
              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{data.employee?.employeeId}</span>
              <Badge text={data.appraisalId} bg="#f3f4f6" color="#374151" />
              <Badge text={data.status} {...sc} />
              <Badge text={data.cycleType} bg="#ede9fe" color="#6d28d9" />
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
              {data.cycleName} &middot; {data.employee?.designation || '—'} &middot; {fmt(data.period?.startDate)} to {fmt(data.period?.endDate)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>Reviewer: {data.reviewer?.name}</p>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            {data.status === 'COMPLETED' && rc && (
              <div style={{ padding: '6px 16px', borderRadius: 8, background: rc.bg }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: rc.color }}>{data.finalScore}/5</span>
                <span style={{ fontSize: '0.78rem', color: rc.color, marginLeft: 6 }}>{RATING_LABELS[data.rating]}</span>
              </div>
            )}
            {data.status === 'COMPLETED' && (isAdmin || isOwner) && (
              <button className="btn btn--primary" style={{ fontSize: '0.82rem', padding: '6px 14px' }} onClick={downloadPDF} disabled={downloading}>
                {downloading ? 'Downloading...' : 'Download PDF'}
              </button>
            )}
          </div>
        </div>
        {data.finalScore != null && (
          <ProgressBar percent={Math.round((data.finalScore / 5) * 100)} color={rc?.color} />
        )}
      </div>

      {/* Self-review form */}
      {canSelfReview && <SelfReviewForm appraisal={data} onDone={fetch} />}

      {/* Manager review form */}
      {canManagerReview && <ManagerReviewForm appraisal={data} onDone={fetch} />}

      {/* KPI results (when not in an active form state) */}
      {!canSelfReview && !canManagerReview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h4 style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.95rem', color: '#1e3a5f' }}>KPI Breakdown</h4>
          {data.kpis.map(kpi => (
            <div key={kpi._id} className="card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{kpi.title} <Badge text={`${kpi.weight}%`} bg="#f3f4f6" color="#374151" /></span>
              </div>
              {kpi.description && <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#6b7280' }}>{kpi.description}</p>}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.85rem' }}>
                <span>Self: <ScoreStars score={kpi.selfScore} /></span>
                <span>Manager: <ScoreStars score={kpi.managerScore} /></span>
                {kpi.managerScore != null && (
                  <span style={{ color: '#6b7280' }}>Weighted: {((kpi.managerScore * kpi.weight) / 100).toFixed(2)}</span>
                )}
              </div>
              {kpi.selfComment && <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>Self: "{kpi.selfComment}"</p>}
              {kpi.managerComment && <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#1e40af' }}>Manager: "{kpi.managerComment}"</p>}
            </div>
          ))}

          {/* Overall comments */}
          {(data.overallSelfComment || data.overallManagerComment) && (
            <div className="card" style={{ padding: 16, marginTop: 6 }}>
              {data.overallSelfComment && (
                <div style={{ marginBottom: data.overallManagerComment ? 10 : 0 }}>
                  <strong style={{ fontSize: '0.82rem', color: '#374151' }}>Employee's Overall Comment:</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5 }}>{data.overallSelfComment}</p>
                </div>
              )}
              {data.overallManagerComment && (
                <div>
                  <strong style={{ fontSize: '0.82rem', color: '#1e3a5f' }}>Manager's Overall Comment:</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#1e3a8a', lineHeight: 1.5 }}>{data.overallManagerComment}</p>
                </div>
              )}
            </div>
          )}

          {/* Score summary */}
          {data.status === 'COMPLETED' && (
            <div className="card" style={{ padding: 16, marginTop: 6 }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.88rem' }}>
                <span>Self Score: <strong>{data.weightedSelfScore?.toFixed(2) || '—'}/5</strong></span>
                <span>Manager Score: <strong>{data.weightedManagerScore?.toFixed(2) || '—'}/5</strong></span>
                <span>Final: <strong style={{ color: rc?.color }}>{data.finalScore?.toFixed(2) || '—'}/5 — {RATING_LABELS[data.rating] || '—'}</strong></span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Create Appraisal Form (HR) ───────────────────────────── */
function CreateAppraisalForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ employeeId: '', reviewerId: '', cycleType: 'QUARTERLY', cycleName: '', startDate: '', endDate: '', deadline: '' });
  const [kpis, setKpis] = useState([
    { title: 'Quality of Work', description: 'Accuracy, thoroughness, and reliability', weight: 25 },
    { title: 'Productivity', description: 'Output volume and efficiency', weight: 25 },
    { title: 'Communication', description: 'Clarity, teamwork, and collaboration', weight: 20 },
    { title: 'Initiative', description: 'Proactiveness and problem-solving ability', weight: 15 },
    { title: 'Attendance & Punctuality', description: 'Regularity and time management', weight: 15 },
  ]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setKpi = (idx, field, val) => setKpis(p => p.map((k, i) => i === idx ? { ...k, [field]: val } : k));
  const addKpi = () => setKpis(p => [...p, { title: '', description: '', weight: 0 }]);
  const removeKpi = (idx) => setKpis(p => p.filter((_, i) => i !== idx));

  const totalWeight = kpis.reduce((s, k) => s + (Number(k.weight) || 0), 0);

  const submit = async () => {
    if (!form.employeeId || !form.reviewerId || !form.cycleName || !form.startDate || !form.endDate) return setMsg('Fill all required fields.');
    if (totalWeight !== 100) return setMsg(`KPI weights must total 100%. Current: ${totalWeight}%.`);
    if (kpis.some(k => !k.title.trim())) return setMsg('All KPIs must have a title.');
    setBusy(true); setMsg('');
    try {
      await api.post('/appraisals', { ...form, kpis });
      setMsg('Appraisal created!');
      setTimeout(onCreated, 500);
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <h4 style={{ margin: 0, fontWeight: 600 }}>Create Performance Appraisal</h4>
        {onCancel && <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Cancel</button>}
      </div>
      {msg && <div className={`alert ${msg.includes('!') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12, marginBottom: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Employee ID *</label>
          <input className="form-input" value={form.employeeId} onChange={e => set('employeeId', e.target.value)} placeholder="EMP-0005" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Reviewer ID *</label>
          <input className="form-input" value={form.reviewerId} onChange={e => set('reviewerId', e.target.value)} placeholder="EMP-0002" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Cycle Type *</label>
          <select className="form-input" value={form.cycleType} onChange={e => set('cycleType', e.target.value)}>
            {CYCLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 12, marginBottom: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Cycle Name *</label>
          <input className="form-input" value={form.cycleName} onChange={e => set('cycleName', e.target.value)} placeholder="Q1 2026" maxLength={100} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Start Date *</label>
          <input className="form-input" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">End Date *</label>
          <input className="form-input" type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Deadline</label>
          <input className="form-input" type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
        </div>
      </div>

      {/* KPI Builder */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h5 style={{ margin: 0, fontWeight: 600, fontSize: '0.92rem' }}>
            KPIs <span style={{ fontSize: '0.78rem', fontWeight: 400, color: totalWeight === 100 ? '#15803d' : '#dc2626' }}>(Weight: {totalWeight}/100%)</span>
          </h5>
          <button className="btn btn--secondary" style={{ fontSize: '0.82rem' }} onClick={addKpi}>+ Add KPI</button>
        </div>
        {kpis.map((kpi, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="form-input" value={kpi.title} onChange={e => setKpi(idx, 'title', e.target.value)} placeholder="KPI title" style={{ flex: 2, minWidth: 150 }} maxLength={200} />
            <input className="form-input" value={kpi.description} onChange={e => setKpi(idx, 'description', e.target.value)} placeholder="Description" style={{ flex: 2, minWidth: 150 }} maxLength={500} />
            <input className="form-input" type="number" value={kpi.weight} onChange={e => setKpi(idx, 'weight', Number(e.target.value))} min={0} max={100} style={{ width: 75 }} />
            <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>%</span>
            {kpis.length > 1 && (
              <button onClick={() => removeKpi(idx)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem' }}>×</button>
            )}
          </div>
        ))}
      </div>

      <button className="btn btn--primary" onClick={submit} disabled={busy}>{busy ? 'Creating...' : 'Create Appraisal'}</button>
    </div>
  );
}

/* ── Employee View ────────────────────────────────────────── */
function EmployeeAppraisals() {
  const { user } = useAuthStore();
  const [appraisals, setAppraisals] = useState([]);
  const [toReview, setToReview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('my');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [myRes, revRes] = await Promise.all([
        api.get('/appraisals/my'),
        api.get('/appraisals/to-review'),
      ]);
      setAppraisals(myRes.data.data);
      setToReview(revRes.data.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (selected) {
    return (
      <div className="page">
        <AppraisalDetail id={selected} onBack={() => { setSelected(null); fetch(); }} user={user} />
      </div>
    );
  }

  const list = tab === 'my' ? appraisals : toReview;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Performance Appraisals</h1>
        <p className="page-subtitle">View your appraisals and complete assessments</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${tab === 'my' ? 'btn--primary' : 'btn--secondary'}`} style={{ fontSize: '0.85rem' }} onClick={() => setTab('my')}>My Appraisals ({appraisals.length})</button>
        {toReview.length > 0 && (
          <button className={`btn ${tab === 'review' ? 'btn--primary' : 'btn--secondary'}`} style={{ fontSize: '0.85rem' }} onClick={() => setTab('review')}>To Review ({toReview.length})</button>
        )}
      </div>

      {loading ? <div className="page-loading">Loading...</div> : list.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#128202;</div>
          <h3>{tab === 'my' ? 'No appraisals yet' : 'No reviews pending'}</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>{tab === 'my' ? 'Your appraisals will appear here when assigned.' : 'No employees need your review right now.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(a => {
            const sc2 = STATUS_COLORS[a.status] || STATUS_COLORS.DRAFT;
            const rc2 = a.rating ? RATING_COLORS[a.rating] : null;
            return (
              <div key={a._id} className="card" style={{ padding: '16px 20px', borderLeft: `4px solid ${sc2.color}`, cursor: 'pointer' }} onClick={() => setSelected(a._id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {tab === 'review' && <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{a.employee?.name}</span>}
                    <Badge text={a.appraisalId} bg="#f3f4f6" color="#374151" />
                    <Badge text={a.cycleName} bg="#ede9fe" color="#6d28d9" />
                    <Badge text={a.status} {...sc2} />
                    {rc2 && <Badge text={RATING_LABELS[a.rating]} {...rc2} />}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{fmt(a.period?.startDate)} — {fmt(a.period?.endDate)}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                  {a.kpis?.length || 0} KPIs &middot; Reviewer: {a.reviewer?.name || '—'}
                  {a.finalScore != null && <span> &middot; Score: <strong>{a.finalScore}/5</strong></span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── HR Admin View ────────────────────────────────────────── */
function AdminAppraisals() {
  const { user } = useAuthStore();
  const [appraisals, setAppraisals] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({ status: '', cycleType: '', search: '' });
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.cycleType) params.set('cycleType', filters.cycleType);
      if (filters.search.trim()) params.set('search', filters.search.trim());

      const [aRes, sRes] = await Promise.all([
        api.get(`/appraisals?${params.toString()}`),
        api.get('/appraisals/stats'),
      ]);
      setAppraisals(aRes.data.data);
      setStats(sRes.data.data);
    } catch { setAppraisals([]); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(fetchAll, 300);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this appraisal?')) return;
    setDeleting(id);
    try { await api.delete(`/appraisals/${id}`); fetchAll(); }
    catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    finally { setDeleting(null); }
  };

  const setFilter = (k, v) => setFilters(p => ({ ...p, [k]: v }));

  if (selected) {
    return (
      <div className="page">
        <AppraisalDetail id={selected} onBack={() => { setSelected(null); fetchAll(); }} user={user} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Performance Appraisals</h1>
          <p className="page-subtitle">Create and manage KPI-based performance review cycles</p>
        </div>
        {!showCreate && <button className="btn btn--primary" onClick={() => setShowCreate(true)}>+ New Appraisal</button>}
      </div>

      {showCreate && <CreateAppraisalForm onCreated={() => { setShowCreate(false); fetchAll(); }} onCancel={() => setShowCreate(false)} />}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: stats.total, bg: '#dbeafe', color: '#2563eb' },
          { label: 'Self Review', value: stats.selfReview, bg: '#fef3c7', color: '#b45309' },
          { label: 'Mgr Review', value: stats.managerReview, bg: '#e0e7ff', color: '#4338ca' },
          { label: 'Completed', value: stats.completed, bg: '#dcfce7', color: '#15803d' },
          { label: 'Avg Score', value: stats.avgScore != null ? `${stats.avgScore}/5` : '—', bg: '#fef3c7', color: '#b45309' },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 18px', borderRadius: 10, background: s.bg, minWidth: 80, textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: s.color }}>{s.value ?? '—'}</div>
            <div style={{ fontSize: '0.72rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Search name or ID..." style={{ flex: '1 1 180px', minWidth: 0 }} />
        <select className="form-input" value={filters.status} onChange={e => setFilter('status', e.target.value)} style={{ flex: '1 1 140px', minWidth: 0 }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="form-input" value={filters.cycleType} onChange={e => setFilter('cycleType', e.target.value)} style={{ flex: '1 1 140px', minWidth: 0 }}>
          <option value="">All Cycles</option>
          {CYCLE_TYPES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? <div className="page-loading">Loading...</div> : appraisals.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 24 }}>
          <div className="empty-state-icon">&#128202;</div>
          <h3>No appraisals found</h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Create a performance appraisal to get started</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {appraisals.map(a => {
            const sc2 = STATUS_COLORS[a.status] || STATUS_COLORS.DRAFT;
            const rc2 = a.rating ? RATING_COLORS[a.rating] : null;
            return (
              <div key={a._id} className="card" style={{ padding: '16px 20px', borderLeft: `4px solid ${sc2.color}`, cursor: 'pointer' }} onClick={() => setSelected(a._id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{a.employee?.name}</span>
                    <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{a.employee?.employeeId}</span>
                    <Badge text={a.appraisalId} bg="#f3f4f6" color="#374151" />
                    <Badge text={a.cycleName} bg="#ede9fe" color="#6d28d9" />
                    <Badge text={a.status} {...sc2} />
                    {rc2 && <Badge text={RATING_LABELS[a.rating]} {...rc2} />}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {a.finalScore != null && <span style={{ fontWeight: 700, fontSize: '0.88rem', color: rc2?.color || '#374151' }}>{a.finalScore}/5</span>}
                    <button className="btn btn--danger" style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      onClick={e => handleDelete(a._id, e)} disabled={deleting === a._id}>{deleting === a._id ? '...' : 'Del'}</button>
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                  {a.employee?.designation || '—'} &middot; {fmt(a.period?.startDate)} — {fmt(a.period?.endDate)}
                  &middot; Reviewer: {a.reviewer?.name || '—'} &middot; {a.kpis?.length || 0} KPIs
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AppraisalPage() {
  const { user } = useAuthStore();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  return isAdmin ? <AdminAppraisals /> : <EmployeeAppraisals />;
}
