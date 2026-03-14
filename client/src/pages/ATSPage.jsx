import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import {
  Briefcase, Plus, Search, X, ChevronDown, ChevronRight, UserPlus, FileText, Trash2, Save, Edit2, Upload, UserCheck,
} from 'lucide-react';

const JOB_STATUS = [
  { value: 'DRAFT', label: 'Draft', bg: '#f3f4f6', color: '#6b7280' },
  { value: 'OPEN', label: 'Open', bg: '#dbeafe', color: '#2563eb' },
  { value: 'ON_HOLD', label: 'On Hold', bg: '#fef3c7', color: '#b45309' },
  { value: 'CLOSED', label: 'Closed', bg: '#fee2e2', color: '#b91c1c' },
];

const EMP_TYPE = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'OTHER', label: 'Other' },
];

const APP_STATUS = [
  { value: 'APPLIED', label: 'Applied', bg: '#dbeafe', color: '#2563eb' },
  { value: 'SCREENING', label: 'Screening', bg: '#e0e7ff', color: '#4338ca' },
  { value: 'SHORTLISTED', label: 'Shortlisted', bg: '#fef3c7', color: '#b45309' },
  { value: 'INTERVIEW', label: 'Interview', bg: '#fed7aa', color: '#c2410c' },
  { value: 'OFFER', label: 'Offer', bg: '#bbf7d0', color: '#15803d' },
  { value: 'HIRED', label: 'Hired', bg: '#22c55e', color: '#fff' },
  { value: 'REJECTED', label: 'Rejected', bg: '#fecaca', color: '#b91c1c' },
  { value: 'WITHDRAWN', label: 'Withdrawn', bg: '#f3f4f6', color: '#6b7280' },
];

// Pipeline order: Jobs → Applications → Shortlist → Interview → Offer → Hired
const PIPELINE_STAGES = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED'];
const OUT_STAGES = ['REJECTED', 'WITHDRAWN'];

function getNextStages(current) {
  const idx = PIPELINE_STAGES.indexOf(current);
  if (idx === -1) return [];
  const next = PIPELINE_STAGES.slice(idx + 1);
  return [...next, ...OUT_STAGES];
}

const SOURCES = [
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'JOB_PORTAL', label: 'Job Portal' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'DIRECT', label: 'Direct' },
  { value: 'CAMPUS', label: 'Campus' },
  { value: 'AGENCY', label: 'Agency' },
  { value: 'OTHER', label: 'Other' },
];

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
function fmtInput(d) { return d ? new Date(d).toISOString().split('T')[0] : ''; }

const labelSt = { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 };
const inputSt = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' };
const btnPrimary = { padding: '8px 18px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnDanger = { ...btnPrimary, background: '#ef4444' };
const btnGreen = { ...btnPrimary, background: '#15803d' };
const cardSt = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 14 };

function Badge({ list, value }) {
  const opt = list.find(s => s.value === value);
  if (!opt) return null;
  return (
    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, background: opt.bg, color: opt.color, whiteSpace: 'nowrap' }}>
      {opt.label}
    </span>
  );
}

export default function ATSPage() {
  const [view, setView] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobStatusFilter, setJobStatusFilter] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [msg, setMsg] = useState('');

  const loadJobs = useCallback(async () => {
    try {
      const params = {};
      if (jobStatusFilter) params.status = jobStatusFilter;
      if (jobSearch.trim()) params.search = jobSearch.trim();
      const [jobsRes, statsRes] = await Promise.all([
        api.get('/ats/jobs', { params }),
        api.get('/ats/jobs/stats'),
      ]);
      setJobs(jobsRes.data.data);
      setStats(statsRes.data.data);
    } catch { setJobs([]); }
    finally { setLoading(false); }
  }, [jobStatusFilter, jobSearch]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    api.get('/departments').then(({ data }) => setDepartments(data.data || [])).catch(() => {});
    api.get('/users').then(({ data }) => setManagers(data.data || [])).catch(() => {});
  }, []);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Applicant Tracking (ATS)</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.88rem' }}>Jobs → Applications → Shortlist → Interview → Offer → Hired</p>
        </div>
        <button onClick={() => { setEditingJob(null); setShowJobForm(true); }} style={btnPrimary}>
          <Plus size={16} /> New Job Opening
        </button>
      </div>

      {msg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: msg.includes('success') || msg.includes('added') || msg.includes('updated') || msg.includes('deleted') ? '#dcfce7' : '#fef2f2',
          color: msg.includes('success') || msg.includes('added') || msg.includes('updated') || msg.includes('deleted') ? '#15803d' : '#b91c1c',
          fontSize: '0.88rem', fontWeight: 500,
        }}>{msg}</div>
      )}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#eff6ff', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }}>{stats.openJobs}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Open Jobs</div>
          </div>
          <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>{stats.totalApplications}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Total Applications</div>
          </div>
          {Object.entries(stats.byStatus || {}).slice(0, 4).map(([status, count]) => (
            <div key={status} style={{ background: '#f9fafb', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#374151' }}>{count}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{APP_STATUS.find(s => s.value === status)?.label || status}</div>
            </div>
          ))}
        </div>
      )}

      {showJobForm && (
        <JobForm
          job={editingJob}
          departments={departments}
          managers={managers}
          onClose={() => { setShowJobForm(false); setEditingJob(null); }}
          onSaved={() => { showMsg('Job saved successfully.'); setShowJobForm(false); setEditingJob(null); loadJobs(); }}
          showMsg={showMsg}
        />
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder="Search jobs..." style={{ ...inputSt, paddingLeft: 32, margin: 0 }} />
        </div>
        <select value={jobStatusFilter} onChange={e => setJobStatusFilter(e.target.value)} style={{ ...inputSt, width: 'auto', minWidth: 130 }}>
          <option value="">All status</option>
          {JOB_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            <Briefcase size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p>No job openings. Create one to start receiving applications.</p>
          </div>
        ) : (
          jobs.map(job => (
            <JobCard
              key={job._id}
              job={job}
              onEdit={() => { setEditingJob(job); setShowJobForm(true); }}
              onDelete={() => {
                if (!window.confirm('Delete this job and all its applications?')) return;
                api.delete(`/ats/jobs/${job._id}`).then(() => { showMsg('Job deleted.'); loadJobs(); }).catch(err => showMsg(err.response?.data?.message || 'Delete failed.'));
              }}
              onRefresh={loadJobs}
              showMsg={showMsg}
            />
          ))
        )}
      </div>
    </div>
  );
}

function JobForm({ job, departments, managers, onClose, onSaved, showMsg }) {
  const isEdit = !!job;
  const [title, setTitle] = useState(job?.title || '');
  const [description, setDescription] = useState(job?.description || '');
  const [department, setDepartment] = useState(job?.department?._id || job?.department || '');
  const [location, setLocation] = useState(job?.location || '');
  const [employmentType, setEmploymentType] = useState(job?.employmentType || 'FULL_TIME');
  const [noOfPositions, setNoOfPositions] = useState(job?.noOfPositions ?? 1);
  const [requirements, setRequirements] = useState(job?.requirements || '');
  const [salaryRangeMin, setSalaryRangeMin] = useState(job?.salaryRangeMin ?? '');
  const [salaryRangeMax, setSalaryRangeMax] = useState(job?.salaryRangeMax ?? '');
  const [status, setStatus] = useState(job?.status || 'DRAFT');
  const [closingDate, setClosingDate] = useState(fmtInput(job?.closingDate) || '');
  const [hiringManager, setHiringManager] = useState(job?.hiringManager?._id || job?.hiringManager || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return showMsg('Title is required.');
    setSaving(true);
    try {
      const payload = { title: title.trim(), description, department: department || undefined, location, employmentType, noOfPositions, requirements, status, closingDate: closingDate || undefined, hiringManager: hiringManager || undefined };
      if (salaryRangeMin !== '') payload.salaryRangeMin = Number(salaryRangeMin);
      if (salaryRangeMax !== '') payload.salaryRangeMax = Number(salaryRangeMax);
      if (isEdit) {
        await api.patch(`/ats/jobs/${job._id}`, payload);
        showMsg('Job updated.');
      } else {
        await api.post('/ats/jobs', payload);
        showMsg('Job created.');
      }
      onSaved();
    } catch (err) { showMsg(err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ ...cardSt, border: '2px solid #2563eb', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>{isEdit ? 'Edit Job' : 'New Job Opening'}</h3>
        <button onClick={onClose} style={btnDanger}><X size={16} /> Cancel</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}><label style={labelSt}>Title *</label><input value={title} onChange={e => setTitle(e.target.value)} style={inputSt} placeholder="e.g. Senior Software Engineer" /></div>
        <div><label style={labelSt}>Department</label><select value={department} onChange={e => setDepartment(e.target.value)} style={inputSt}><option value="">—</option>{departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
        <div><label style={labelSt}>Location</label><input value={location} onChange={e => setLocation(e.target.value)} style={inputSt} placeholder="City / Remote" /></div>
        <div><label style={labelSt}>Employment Type</label><select value={employmentType} onChange={e => setEmploymentType(e.target.value)} style={inputSt}>{EMP_TYPE.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}</select></div>
        <div><label style={labelSt}>No. of Positions</label><input type="number" min={1} value={noOfPositions} onChange={e => setNoOfPositions(Number(e.target.value) || 1)} style={inputSt} /></div>
        <div><label style={labelSt}>Status</label><select value={status} onChange={e => setStatus(e.target.value)} style={inputSt}>{JOB_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        <div><label style={labelSt}>Closing Date</label><input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Hiring Manager</label><select value={hiringManager} onChange={e => setHiringManager(e.target.value)} style={inputSt}><option value="">—</option>{managers.map(m => <option key={m._id} value={m._id}>{m.name} {m.employeeId ? `(${m.employeeId})` : ''}</option>)}</select></div>
        <div><label style={labelSt}>Salary Min (₹)</label><input type="number" value={salaryRangeMin} onChange={e => setSalaryRangeMin(e.target.value)} style={inputSt} placeholder="LPA" /></div>
        <div><label style={labelSt}>Salary Max (₹)</label><input type="number" value={salaryRangeMax} onChange={e => setSalaryRangeMax(e.target.value)} style={inputSt} placeholder="LPA" /></div>
      </div>
      <div style={{ marginTop: 14 }}><label style={labelSt}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...inputSt, resize: 'vertical' }} /></div>
      <div style={{ marginTop: 14 }}><label style={labelSt}>Requirements</label><textarea value={requirements} onChange={e => setRequirements(e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} /></div>
      <button onClick={submit} disabled={saving} style={{ ...btnGreen, marginTop: 16, opacity: saving ? 0.6 : 1 }}><Save size={15} /> {saving ? 'Saving…' : (isEdit ? 'Update Job' : 'Create Job')}</button>
    </div>
  );
}

function JobCard({ job, onEdit, onDelete, onRefresh, showMsg }) {
  const [expanded, setExpanded] = useState(false);
  const [applications, setApplications] = useState([]);
  const [appLoading, setAppLoading] = useState(false);
  const [showAppForm, setShowAppForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' | 'list'

  const loadApplications = useCallback(async () => {
    setAppLoading(true);
    try {
      const params = viewMode === 'list' && statusFilter ? { status: statusFilter } : {};
      const { data } = await api.get(`/ats/jobs/${job._id}/applications`, { params });
      setApplications(data.data);
    } catch { setApplications([]); }
    finally { setAppLoading(false); }
  }, [job._id, statusFilter, viewMode]);

  useEffect(() => { if (expanded) loadApplications(); }, [expanded, loadApplications]);

  const byStage = applications.reduce((acc, app) => {
    const s = app.status || 'APPLIED';
    if (!acc[s]) acc[s] = [];
    acc[s].push(app);
    return acc;
  }, {});

  const pipelineCounts = PIPELINE_STAGES.map(st => ({ stage: st, count: (byStage[st] || []).length, label: APP_STATUS.find(s => s.value === st)?.label || st }));

  return (
    <div style={cardSt}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {expanded ? <ChevronDown size={20} color="#6b7280" /> : <ChevronRight size={20} color="#6b7280" />}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{job.title}</div>
            <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
              {job.department?.name || '—'} • {EMP_TYPE.find(e => e.value === job.employmentType)?.label || job.employmentType} • {job.applicationCount || 0} applications
              {pipelineCounts.some(p => p.count > 0) && (
                <span style={{ marginLeft: 6 }}>
                  ({pipelineCounts.filter(p => p.count > 0).map(p => `${p.count} ${p.label}`).join(', ')})
                </span>
              )}
              {job.hiredCount > 0 && <span style={{ color: '#15803d', fontWeight: 600 }}> • {job.hiredCount} hired</span>}
            </div>
          </div>
          <Badge list={JOB_STATUS} value={job.status} />
        </div>
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
          <button onClick={onEdit} style={{ ...btnPrimary, padding: '6px 12px', fontSize: '0.78rem' }}><Edit2 size={14} /> Edit</button>
          <button onClick={onDelete} style={{ ...btnDanger, padding: '6px 12px', fontSize: '0.78rem' }}><Trash2 size={14} /></button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputSt, width: 'auto', minWidth: 140 }}>
                <option value="">All status</option>
                {PIPELINE_STAGES.map(st => (
                  <option key={st} value={st}>{APP_STATUS.find(s => s.value === st)?.label || st}</option>
                ))}
                <option value="REJECTED">Rejected</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" onClick={() => setViewMode('pipeline')} style={{
                  padding: '6px 12px', borderRadius: 8, border: `1px solid ${viewMode === 'pipeline' ? '#2563eb' : '#e5e7eb'}`,
                  background: viewMode === 'pipeline' ? '#eff6ff' : '#fff', color: viewMode === 'pipeline' ? '#2563eb' : '#6b7280',
                  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                }}>Pipeline</button>
                <button type="button" onClick={() => setViewMode('list')} style={{
                  padding: '6px 12px', borderRadius: 8, border: `1px solid ${viewMode === 'list' ? '#2563eb' : '#e5e7eb'}`,
                  background: viewMode === 'list' ? '#eff6ff' : '#fff', color: viewMode === 'list' ? '#2563eb' : '#6b7280',
                  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                }}>List</button>
              </div>
            </div>
            <button onClick={() => setShowAppForm(true)} style={btnGreen}><UserPlus size={15} /> Add Application</button>
          </div>

          {showAppForm && (
            <ApplicationForm
              jobId={job._id}
              onClose={() => setShowAppForm(false)}
              onSaved={() => { showMsg('Application added.'); setShowAppForm(false); loadApplications(); onRefresh(); }}
              showMsg={showMsg}
            />
          )}

          {appLoading ? <p style={{ color: '#6b7280', fontSize: '0.88rem' }}>Loading applications...</p> : applications.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.88rem' }}>No applications yet. Add candidates to move them through: Applied → Shortlist → Interview → Offer → Hired.</p>
          ) : viewMode === 'pipeline' ? (
            <div className="ats-pipeline" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, minHeight: 120 }}>
              {PIPELINE_STAGES.map(st => (
                <div key={st} style={{
                  flex: '0 0 180px', minWidth: 180, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '10px 12px', background: APP_STATUS.find(s => s.value === st)?.bg || '#f1f5f9',
                    color: APP_STATUS.find(s => s.value === st)?.color || '#374151', fontSize: '0.8rem', fontWeight: 700,
                    borderBottom: '1px solid #e2e8f0',
                  }}>
                    {APP_STATUS.find(s => s.value === st)?.label || st} {(byStage[st] || []).length}
                  </div>
                  <div style={{ flex: 1, padding: 8, overflowY: 'auto', maxHeight: 400 }}>
                    {(byStage[st] || []).map(app => (
                      <ApplicationPipelineCard key={app._id} application={app} onUpdated={loadApplications} onRefresh={onRefresh} showMsg={showMsg} />
                    ))}
                  </div>
                </div>
              ))}
              {(byStage['REJECTED']?.length > 0 || byStage['WITHDRAWN']?.length > 0) && (
                <div style={{
                  flex: '0 0 140px', minWidth: 140, background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 12px', fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c', borderBottom: '1px solid #fecaca' }}>
                    Out ({(byStage['REJECTED'] || []).length + (byStage['WITHDRAWN'] || []).length})
                  </div>
                  <div style={{ flex: 1, padding: 8, overflowY: 'auto', maxHeight: 400 }}>
                    {[...(byStage['REJECTED'] || []), ...(byStage['WITHDRAWN'] || [])].map(app => (
                      <ApplicationPipelineCard key={app._id} application={app} onUpdated={loadApplications} onRefresh={onRefresh} showMsg={showMsg} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {applications.map(app => (
                <ApplicationRow key={app._id} application={app} onUpdated={loadApplications} onRefresh={onRefresh} showMsg={showMsg} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApplicationPipelineCard({ application, onUpdated, onRefresh, showMsg }) {
  const [moving, setMoving] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const nextOptions = getNextStages(application.status);

  const moveTo = async (newStatus) => {
    setMoving(true);
    try {
      const payload = { status: newStatus };
      if (newStatus === 'INTERVIEW' && !application.interviewDate) payload.interviewDate = new Date().toISOString().split('T')[0];
      await api.patch(`/ats/applications/${application._id}`, payload);
      showMsg(`Moved to ${APP_STATUS.find(s => s.value === newStatus)?.label || newStatus}.`);
      onUpdated();
      onRefresh();
    } catch (err) { showMsg(err.response?.data?.message || 'Failed.'); }
    finally { setMoving(false); }
  };

  if (showFull) {
    return (
      <div style={{ marginBottom: 8 }}>
        <ApplicationRow application={application} onUpdated={onUpdated} onRefresh={onRefresh} showMsg={showMsg} />
        <button type="button" onClick={() => setShowFull(false)} style={{ ...btnPrimary, marginTop: 6, padding: '4px 10px', fontSize: '0.75rem' }}>← Back to card</button>
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginBottom: 8,
      boxShadow: '0 1px 2px rgba(0,0,0,.05)',
    }}>
      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4 }}>{application.candidateName}</div>
      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: 6 }}>{application.email}</div>
      {application.rating != null && (
        <div style={{ fontSize: '0.72rem', marginBottom: 6 }}>★ {application.rating}/5</div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {nextOptions.slice(0, 4).map(st => (
          <button key={st} type="button" onClick={() => moveTo(st)} disabled={moving} style={{
            padding: '3px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: '0.7rem', fontWeight: 600,
            color: APP_STATUS.find(s => s.value === st)?.color || '#374151', cursor: 'pointer',
          }}>{APP_STATUS.find(s => s.value === st)?.label || st}</button>
        ))}
        {nextOptions.length > 4 && (
          <select value="" onChange={e => { const v = e.target.value; if (v) moveTo(v); e.target.value = ''; }} style={{ ...inputSt, padding: '3px 6px', fontSize: '0.7rem', width: 'auto', minWidth: 80 }}>
            <option value="">More...</option>
            {nextOptions.slice(4).map(st => <option key={st} value={st}>{APP_STATUS.find(s => s.value === st)?.label || st}</option>)}
          </select>
        )}
      </div>
      <button type="button" onClick={() => setShowFull(true)} style={{ fontSize: '0.7rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit details</button>
    </div>
  );
}

function ApplicationForm({ jobId, onClose, onSaved, showMsg }) {
  const [candidateName, setCandidateName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('DIRECT');
  const [currentCompany, setCurrentCompany] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [notes, setNotes] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!candidateName.trim() || !email.trim()) return showMsg('Name and email are required.');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('candidateName', candidateName.trim());
      fd.append('email', email.trim());
      fd.append('phone', phone.trim());
      fd.append('source', source);
      fd.append('currentCompany', currentCompany.trim());
      if (experienceYears !== '') fd.append('experienceYears', experienceYears);
      if (expectedSalary !== '') fd.append('expectedSalary', expectedSalary);
      fd.append('noticePeriod', noticePeriod.trim());
      fd.append('notes', notes.trim());
      if (resumeFile) fd.append('resume', resumeFile);
      await api.post(`/ats/jobs/${jobId}/applications`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSaved();
    } catch (err) { showMsg(err.response?.data?.message || 'Failed.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, padding: 16, marginBottom: 14, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Add Candidate</h4>
        <button onClick={onClose} style={{ ...btnDanger, padding: '4px 10px', fontSize: '0.78rem' }}><X size={14} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12 }}>
        <div><label style={labelSt}>Name *</label><input value={candidateName} onChange={e => setCandidateName(e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Email *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Source</label><select value={source} onChange={e => setSource(e.target.value)} style={inputSt}>{SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
        <div><label style={labelSt}>Current Company</label><input value={currentCompany} onChange={e => setCurrentCompany(e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Exp (years)</label><input type="number" min={0} value={experienceYears} onChange={e => setExperienceYears(e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Expected Salary</label><input type="number" value={expectedSalary} onChange={e => setExpectedSalary(e.target.value)} style={inputSt} placeholder="₹" /></div>
        <div><label style={labelSt}>Notice Period</label><input value={noticePeriod} onChange={e => setNoticePeriod(e.target.value)} style={inputSt} placeholder="e.g. 2 weeks" /></div>
        <div><label style={labelSt}>Resume (PDF/DOC)</label><input type="file" accept=".pdf,.doc,.docx" onChange={e => setResumeFile(e.target.files[0])} style={inputSt} /></div>
      </div>
      <div style={{ marginTop: 8 }}><label style={labelSt}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} /></div>
      <button onClick={submit} disabled={submitting} style={{ ...btnGreen, marginTop: 12, opacity: submitting ? 0.6 : 1 }}><Save size={14} /> {submitting ? 'Adding…' : 'Add Application'}</button>
    </div>
  );
}

function ApplicationRow({ application, onUpdated, onRefresh, showMsg }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(application.status);
  const [notes, setNotes] = useState(application.notes || '');
  const [rating, setRating] = useState(application.rating ?? '');
  const [interviewDate, setInterviewDate] = useState(fmtInput(application.interviewDate) || '');
  const [interviewFeedback, setInterviewFeedback] = useState(application.interviewFeedback || '');
  const [offeredSalary, setOfferedSalary] = useState(application.offeredSalary ?? '');
  const [rejectedReason, setRejectedReason] = useState(application.rejectedReason || '');
  const [hiredAt, setHiredAt] = useState(fmtInput(application.hiredAt) || '');
  const [saving, setSaving] = useState(false);
  const [uploadingOffer, setUploadingOffer] = useState(false);
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [createResult, setCreateResult] = useState(null);

  useEffect(() => {
    setStatus(application.status);
    setNotes(application.notes || '');
    setRating(application.rating ?? '');
    setInterviewDate(fmtInput(application.interviewDate) || '');
    setInterviewFeedback(application.interviewFeedback || '');
    setOfferedSalary(application.offeredSalary ?? '');
    setRejectedReason(application.rejectedReason || '');
    setHiredAt(fmtInput(application.hiredAt) || '');
  }, [application]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { status, notes, rating: rating === '' ? undefined : Number(rating), interviewDate: interviewDate || undefined, interviewFeedback: interviewFeedback.trim() || undefined, offeredSalary: offeredSalary === '' ? undefined : Number(offeredSalary), rejectedReason: rejectedReason.trim() || undefined };
      if (hiredAt) payload.hiredAt = hiredAt;
      if (status === 'HIRED' && !hiredAt) payload.hiredAt = new Date().toISOString().split('T')[0];
      await api.patch(`/ats/applications/${application._id}`, payload);
      showMsg('Application updated.');
      setEditing(false);
      onUpdated();
      onRefresh();
    } catch (err) { showMsg(err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const uploadOfferLetter = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setUploadingOffer(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/ats/applications/${application._id}/offer-letter`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showMsg('Offer letter uploaded.');
      onUpdated();
      onRefresh();
    } catch (err) { showMsg(err.response?.data?.message || 'Upload failed.'); }
    finally { setUploadingOffer(false); e.target.value = ''; }
  };

  const createEmployee = async () => {
    if (!window.confirm('Create an employee account for this candidate? They will get a temporary password to sign in.')) return;
    setCreatingEmployee(true);
    setCreateResult(null);
    try {
      const { data } = await api.post(`/ats/applications/${application._id}/create-employee`);
      setCreateResult(data.data);
      showMsg('Employee created. Share the temporary password with the new joinee.');
      onUpdated();
      onRefresh();
    } catch (err) { showMsg(err.response?.data?.message || 'Create failed.'); }
    finally { setCreatingEmployee(false); }
  };

  const isOfferOrHired = status === 'OFFER' || status === 'HIRED';
  const [moving, setMoving] = useState(false);
  const nextOptions = getNextStages(application.status);

  const moveTo = async (newStatus) => {
    setMoving(true);
    try {
      const payload = { status: newStatus };
      if (newStatus === 'INTERVIEW' && !application.interviewDate) payload.interviewDate = new Date().toISOString().split('T')[0];
      await api.patch(`/ats/applications/${application._id}`, payload);
      showMsg(`Moved to ${APP_STATUS.find(s => s.value === newStatus)?.label || newStatus}.`);
      onUpdated();
      onRefresh();
    } catch (err) { showMsg(err.response?.data?.message || 'Failed.'); }
    finally { setMoving(false); }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{application.candidateName}</div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{application.email} {application.phone ? `• ${application.phone}` : ''}</div>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>
            {application.currentCompany && <span>{application.currentCompany}</span>}
            {application.experienceYears != null && <span> • {application.experienceYears} yrs</span>}
            {application.expectedSalary && <span> • ₹{application.expectedSalary}</span>}
            {application.noticePeriod && <span> • Notice: {application.noticePeriod}</span>}
            {' • '}{fmt(application.createdAt)}
          </div>
          {application.hiredAt && status === 'HIRED' && (
            <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: 4 }}>Joining: {fmt(application.hiredAt)}</div>
          )}
          {application.createdEmployee && (
            <div style={{ marginTop: 6 }}>
              <a href="/employees" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <UserCheck size={14} /> Employee: {application.createdEmployee.name} ({application.createdEmployee.employeeId})
              </a>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge list={APP_STATUS} value={application.status} />
          {application.resumeUrl && <a href={application.resumeUrl} target="_blank" rel="noreferrer" style={{ ...btnPrimary, padding: '4px 10px', fontSize: '0.75rem', textDecoration: 'none' }}><FileText size={12} /> Resume</a>}
          {application.offerLetterUrl && <a href={application.offerLetterUrl} target="_blank" rel="noreferrer" style={{ ...btnPrimary, padding: '4px 10px', fontSize: '0.75rem', textDecoration: 'none', background: '#15803d' }}><FileText size={12} /> Offer</a>}
          {!editing ? <button onClick={() => setEditing(true)} style={{ ...btnPrimary, padding: '4px 10px', fontSize: '0.75rem' }}><Edit2 size={12} /> Edit</button> : (
            <>
              <button onClick={save} disabled={saving} style={{ ...btnGreen, padding: '4px 10px', fontSize: '0.75rem', opacity: saving ? 0.6 : 1 }}><Save size={12} /> Save</button>
              <button onClick={() => setEditing(false)} style={{ ...btnDanger, padding: '4px 10px', fontSize: '0.75rem' }}><X size={12} /> Cancel</button>
            </>
          )}
          <button onClick={async () => { if (!window.confirm('Delete this application?')) return; await api.delete(`/ats/applications/${application._id}`); showMsg('Application deleted.'); onUpdated(); onRefresh(); }} style={{ ...btnDanger, padding: '4px 10px', fontSize: '0.75rem' }}><Trash2 size={12} /></button>
        </div>
      </div>

      {nextOptions.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.78rem', color: '#6b7280', marginRight: 4 }}>Move to →</span>
          {nextOptions.map(st => (
            <button key={st} type="button" onClick={() => moveTo(st)} disabled={moving} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: '0.75rem', fontWeight: 500, color: APP_STATUS.find(s => s.value === st)?.color || '#374151', cursor: 'pointer' }}>{APP_STATUS.find(s => s.value === st)?.label || st}</button>
          ))}
        </div>
      )}

      {isOfferOrHired && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500 }}>
            <Upload size={14} />
            {application.offerLetterUrl ? 'Replace offer letter' : 'Upload offer letter'}
            <input type="file" accept=".pdf,.doc,.docx" onChange={uploadOfferLetter} disabled={uploadingOffer} style={{ width: 0, height: 0, opacity: 0 }} />
          </label>
          {uploadingOffer && <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Uploading…</span>}
        </div>
      )}

      {status === 'HIRED' && !application.createdEmployee && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
          <button onClick={createEmployee} disabled={creatingEmployee} style={{ ...btnGreen, padding: '8px 14px', fontSize: '0.82rem' }}>
            <UserCheck size={14} /> {creatingEmployee ? 'Creating…' : 'Create Employee'}
          </button>
          {createResult && (
            <div style={{ marginTop: 10, padding: 10, background: '#f0fdf4', borderRadius: 8, fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 600, color: '#15803d' }}>Employee created</div>
              <div style={{ marginTop: 4 }}>Temp password: <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>{createResult.tempPassword}</code></div>
              <p style={{ margin: '6px 0 0', color: '#6b7280' }}>Share this password with the new joinee. They can change it after first login.</p>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 10 }}>
            <div><label style={labelSt}>Status</label><select value={status} onChange={e => setStatus(e.target.value)} style={inputSt}>{APP_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
            <div><label style={labelSt}>Rating (1-5)</label><input type="number" min={1} max={5} value={rating} onChange={e => setRating(e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>Interview Date</label><input type="date" value={interviewDate} onChange={e => setInterviewDate(e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>Offered Salary (₹)</label><input type="number" value={offeredSalary} onChange={e => setOfferedSalary(e.target.value)} style={inputSt} /></div>
            {status === 'HIRED' && <div><label style={labelSt}>Joining Date</label><input type="date" value={hiredAt} onChange={e => setHiredAt(e.target.value)} style={inputSt} /></div>}
          </div>
          <div style={{ marginTop: 10 }}><label style={labelSt}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} /></div>
          <div style={{ marginTop: 10 }}><label style={labelSt}>Interview Feedback</label><textarea value={interviewFeedback} onChange={e => setInterviewFeedback(e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} /></div>
          {(status === 'REJECTED' || status === 'WITHDRAWN') && <div style={{ marginTop: 10 }}><label style={labelSt}>Reason</label><input value={rejectedReason} onChange={e => setRejectedReason(e.target.value)} style={inputSt} placeholder="Rejection / withdrawal reason" /></div>}
        </div>
      )}
    </div>
  );
}
