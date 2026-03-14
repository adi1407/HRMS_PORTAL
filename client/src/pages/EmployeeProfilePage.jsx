import { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';
import {
  User, GraduationCap, Briefcase, Building2, FileUp, Trash2, Plus, Save, Upload, Eye, ChevronDown, ChevronUp, Search, X, ArrowLeft, Lock,
} from 'lucide-react';

const TABS = [
  { id: 'personal', label: 'Personal Info', Icon: User },
  { id: 'education', label: 'Education', Icon: GraduationCap },
  { id: 'experience', label: 'Experience', Icon: Briefcase },
  { id: 'bank', label: 'Bank & IDs', Icon: Building2 },
  { id: 'documents', label: 'Documents', Icon: FileUp },
];

const EDU_LEVELS = [
  { value: '10TH', label: '10th / SSC' }, { value: '12TH', label: '12th / HSC' },
  { value: 'DIPLOMA', label: 'Diploma' }, { value: 'GRADUATION', label: 'Graduation' },
  { value: 'POST_GRADUATION', label: 'Post Graduation' }, { value: 'PHD', label: 'PhD' },
  { value: 'CERTIFICATION', label: 'Certification' }, { value: 'OTHER', label: 'Other' },
];

const DOC_CATEGORIES = [
  { value: 'AADHAAR', label: 'Aadhaar Card' }, { value: 'PAN', label: 'PAN Card' },
  { value: 'PASSPORT', label: 'Passport' }, { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' }, { value: 'PHOTO', label: 'Passport Photo' },
  { value: 'RESUME', label: 'Resume / CV' }, { value: 'OTHER', label: 'Other' },
];

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
function fmtInput(d) { return d ? new Date(d).toISOString().split('T')[0] : ''; }
function formatBytes(b) { if (!b) return ''; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }

const labelSt = { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 };
const inputSt = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' };
const btnPrimary = { padding: '8px 18px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnDanger = { ...btnPrimary, background: '#ef4444' };
const btnGreen = { ...btnPrimary, background: '#15803d' };
const cardSt = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 14 };

/* ── Payslip PIN (secure access for salary slip) ────────────── */
function PayslipPinCard() {
  const [hasPin, setHasPin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('set'); // 'set' | 'change' | 'remove'
  const [pin, setPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/users/me/payslip-pin');
      setHasPin(!!data.data?.hasPayslipPin);
    } catch { setHasPin(false); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleSet = async (e) => {
    e.preventDefault();
    const p = String(pin || '').trim();
    if (p.length < 4 || p.length > 8) { setMsg('PIN must be 4–8 digits.'); return; }
    if (!/^\d+$/.test(p)) { setMsg('PIN must contain only digits.'); return; }
    setSaving(true); setMsg('');
    try {
      await api.post('/users/me/payslip-pin', { pin: p });
      setMsg('Payslip PIN set. You will need it to view or download your salary slip.');
      setPin('');
      load();
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handleChange = async (e) => {
    e.preventDefault();
    const np = String(newPin || '').trim();
    if (np.length < 4 || np.length > 8) { setMsg('New PIN must be 4–8 digits.'); return; }
    if (!/^\d+$/.test(np)) { setMsg('New PIN must contain only digits.'); return; }
    setSaving(true); setMsg('');
    try {
      await api.patch('/users/me/payslip-pin', { currentPin: currentPin.trim(), newPin: np });
      setMsg('Payslip PIN updated.');
      setCurrentPin(''); setNewPin('');
      load();
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handleRemove = async (e) => {
    e.preventDefault();
    if (!currentPin.trim()) { setMsg('Enter current PIN to remove.'); return; }
    setSaving(true); setMsg('');
    try {
      await api.patch('/users/me/payslip-pin', { currentPin: currentPin.trim() });
      setMsg('Payslip PIN removed. Your salary slip will no longer require a PIN.');
      setCurrentPin('');
      setMode('set');
      load();
    } catch (err) { setMsg(err.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  if (loading) return null;
  return (
    <div style={{ ...cardSt, marginBottom: 20, borderColor: '#e0e7ff', background: '#fafbff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Lock size={18} color="#4f46e5" />
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#374151' }}>Payslip PIN</h3>
      </div>
      <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 14 }}>
        Optional 4–8 digit PIN to view or download your salary slip. Only you need to enter it.
      </p>
      {msg && <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: msg.includes('set') || msg.includes('updated') || msg.includes('removed') ? '#dcfce7' : msg.includes('Failed') ? '#fef2f2' : '#f0f9ff', color: msg.includes('Failed') ? '#b91c1c' : '#15803d', fontSize: '0.82rem' }}>{msg}</div>}
      {!hasPin ? (
        <form onSubmit={handleSet} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 140px', maxWidth: 180 }}>
            <label className="form-label" style={{ marginBottom: 4 }}>PIN (4–8 digits)</label>
            <input type="password" inputMode="numeric" autoComplete="off" className="form-input" placeholder="••••" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
          </div>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Setting…' : 'Set PIN'}</button>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'change' && (
            <form onSubmit={handleChange} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, flex: '1 1 120px' }}><label className="form-label" style={{ marginBottom: 4 }}>Current PIN</label><input type="password" inputMode="numeric" autoComplete="off" className="form-input" placeholder="••••" value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 8))} /></div>
              <div className="form-group" style={{ margin: 0, flex: '1 1 120px' }}><label className="form-label" style={{ marginBottom: 4 }}>New PIN</label><input type="password" inputMode="numeric" autoComplete="off" className="form-input" placeholder="••••" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))} /></div>
              <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Updating…' : 'Update PIN'}</button>
              <button type="button" className="btn btn--secondary" onClick={() => { setMode(''); setCurrentPin(''); setNewPin(''); setMsg(''); }}>Cancel</button>
            </form>
          )}
          {mode === 'remove' && (
            <form onSubmit={handleRemove} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, flex: '1 1 140px', maxWidth: 180 }}><label className="form-label" style={{ marginBottom: 4 }}>Current PIN</label><input type="password" inputMode="numeric" autoComplete="off" className="form-input" placeholder="••••" value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 8))} /></div>
              <button type="submit" className="btn btn--danger" disabled={saving}>{saving ? 'Removing…' : 'Remove PIN'}</button>
              <button type="button" className="btn btn--secondary" onClick={() => { setMode(''); setCurrentPin(''); setMsg(''); }}>Cancel</button>
            </form>
          )}
          {mode !== 'change' && mode !== 'remove' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--secondary" onClick={() => { setMode('change'); setMsg(''); }}>Change PIN</button>
              <button type="button" className="btn btn--secondary" style={{ color: '#b91c1c', borderColor: '#fecaca' }} onClick={() => { setMode('remove'); setMsg(''); }}>Remove PIN</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ProfileEditor — used by BOTH employee self-service AND admin
   apiBase = '/employee-profile/my' (self) or '/employee-profile/:empId' (admin)
   ══════════════════════════════════════════════════════════════ */
function ProfileEditor({ apiBase, profile, load, title, subtitle }) {
  const [tab, setTab] = useState('personal');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const showMsg = (m, dur = 3000) => { setMsg(m); setTimeout(() => setMsg(''), dur); };

  return (
    <div>
      {title && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>{title}</h2>
              {subtitle && <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.88rem' }}>{subtitle}</p>}
            </div>
            {profile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 120, height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: profile.completionPercent >= 80 ? '#22c55e' : profile.completionPercent >= 40 ? '#f59e0b' : '#ef4444', width: `${profile.completionPercent}%`, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>{profile.completionPercent}% Complete</span>
              </div>
            )}
          </div>
        </div>
      )}

      {msg && <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 14, background: msg.includes('success') || msg.includes('uploaded') || msg.includes('added') || msg.includes('updated') || msg.includes('removed') || msg.includes('saved') ? '#dcfce7' : '#fef2f2', color: msg.includes('success') || msg.includes('uploaded') || msg.includes('added') || msg.includes('updated') || msg.includes('removed') || msg.includes('saved') ? '#15803d' : '#b91c1c', fontSize: '0.88rem', fontWeight: 500 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
            background: tab === t.id ? '#2563eb' : '#fff', color: tab === t.id ? '#fff' : '#374151',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
            <t.Icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'personal' && <PersonalTab apiBase={apiBase} profile={profile} load={load} showMsg={showMsg} saving={saving} setSaving={setSaving} />}
      {tab === 'education' && <EducationTab apiBase={apiBase} profile={profile} load={load} showMsg={showMsg} />}
      {tab === 'experience' && <ExperienceTab apiBase={apiBase} profile={profile} load={load} showMsg={showMsg} />}
      {tab === 'bank' && <BankTab apiBase={apiBase} profile={profile} load={load} showMsg={showMsg} saving={saving} setSaving={setSaving} />}
      {tab === 'documents' && <DocumentsTab apiBase={apiBase} profile={profile} load={load} showMsg={showMsg} />}
    </div>
  );
}

/* ── Personal Info Tab ──────────────────────────────────────── */
function PersonalTab({ apiBase, profile, load, showMsg, saving, setSaving }) {
  const [f, setF] = useState({
    fatherName: '', motherName: '', dateOfBirth: '', gender: '', bloodGroup: '',
    maritalStatus: '', spouseName: '', nationality: 'Indian', religion: '',
    personalEmail: '', personalPhone: '',
    emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '',
    currentAddress: '', permanentAddress: '',
  });

  useEffect(() => {
    if (profile) {
      setF({
        fatherName: profile.fatherName || '', motherName: profile.motherName || '',
        dateOfBirth: fmtInput(profile.dateOfBirth), gender: profile.gender || '', bloodGroup: profile.bloodGroup || '',
        maritalStatus: profile.maritalStatus || '', spouseName: profile.spouseName || '',
        nationality: profile.nationality || 'Indian', religion: profile.religion || '',
        personalEmail: profile.personalEmail || '', personalPhone: profile.personalPhone || '',
        emergencyContactName: profile.emergencyContactName || '', emergencyContactRelation: profile.emergencyContactRelation || '', emergencyContactPhone: profile.emergencyContactPhone || '',
        currentAddress: profile.currentAddress || '', permanentAddress: profile.permanentAddress || '',
      });
    }
  }, [profile]);

  const save = async () => {
    setSaving(true);
    try { await api.patch(apiBase, f); showMsg('Personal info saved successfully!'); load(); }
    catch (err) { showMsg(err.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div style={cardSt}>
      <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Personal Information</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14 }}>
        <div><label style={labelSt}>Father's Name *</label><input value={f.fatherName} onChange={e => set('fatherName', e.target.value)} style={inputSt} placeholder="Full name" /></div>
        <div><label style={labelSt}>Mother's Name *</label><input value={f.motherName} onChange={e => set('motherName', e.target.value)} style={inputSt} placeholder="Full name" /></div>
        <div><label style={labelSt}>Date of Birth</label><input type="date" value={f.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Gender</label><select value={f.gender} onChange={e => set('gender', e.target.value)} style={inputSt}><option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></div>
        <div><label style={labelSt}>Blood Group</label><select value={f.bloodGroup} onChange={e => set('bloodGroup', e.target.value)} style={inputSt}><option value="">Select</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b} value={b}>{b}</option>)}</select></div>
        <div><label style={labelSt}>Marital Status</label><select value={f.maritalStatus} onChange={e => set('maritalStatus', e.target.value)} style={inputSt}><option value="">Select</option><option value="SINGLE">Single</option><option value="MARRIED">Married</option><option value="DIVORCED">Divorced</option><option value="WIDOWED">Widowed</option></select></div>
        {f.maritalStatus === 'MARRIED' && <div><label style={labelSt}>Spouse Name</label><input value={f.spouseName} onChange={e => set('spouseName', e.target.value)} style={inputSt} /></div>}
        <div><label style={labelSt}>Nationality</label><input value={f.nationality} onChange={e => set('nationality', e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Religion</label><input value={f.religion} onChange={e => set('religion', e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Personal Email</label><input type="email" value={f.personalEmail} onChange={e => set('personalEmail', e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Personal Phone *</label><input value={f.personalPhone} onChange={e => set('personalPhone', e.target.value)} style={inputSt} placeholder="+91 XXXXX XXXXX" /></div>
      </div>
      <h4 style={{ margin: '20px 0 12px', fontSize: '0.92rem', color: '#374151' }}>Emergency Contact</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14 }}>
        <div><label style={labelSt}>Contact Name *</label><input value={f.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>Relation</label><input value={f.emergencyContactRelation} onChange={e => set('emergencyContactRelation', e.target.value)} style={inputSt} placeholder="e.g. Father, Mother, Spouse" /></div>
        <div><label style={labelSt}>Phone *</label><input value={f.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} style={inputSt} /></div>
      </div>
      <h4 style={{ margin: '20px 0 12px', fontSize: '0.92rem', color: '#374151' }}>Address</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 14 }}>
        <div><label style={labelSt}>Current Address *</label><textarea value={f.currentAddress} onChange={e => set('currentAddress', e.target.value)} rows={3} style={{ ...inputSt, resize: 'vertical' }} /></div>
        <div><label style={labelSt}>Permanent Address *</label><textarea value={f.permanentAddress} onChange={e => set('permanentAddress', e.target.value)} rows={3} style={{ ...inputSt, resize: 'vertical' }} /></div>
      </div>
      <button onClick={save} disabled={saving} style={{ ...btnPrimary, marginTop: 18, opacity: saving ? 0.6 : 1 }}><Save size={15} /> {saving ? 'Saving…' : 'Save Personal Info'}</button>
    </div>
  );
}

/* ── Education Tab ──────────────────────────────────────────── */
function EducationTab({ apiBase, profile, load, showMsg }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ level: '10TH', boardOrUniversity: '', schoolOrCollege: '', degree: '', specialization: '', stream: '', yearOfPassing: '', percentage: '', cgpa: '' });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(null);

  const addEdu = async () => {
    setSubmitting(true);
    try {
      await api.post(`${apiBase}/education`, { ...form, yearOfPassing: form.yearOfPassing ? Number(form.yearOfPassing) : undefined, percentage: form.percentage ? Number(form.percentage) : undefined, cgpa: form.cgpa ? Number(form.cgpa) : undefined });
      showMsg('Education added successfully!'); setShowForm(false);
      setForm({ level: '10TH', boardOrUniversity: '', schoolOrCollege: '', degree: '', specialization: '', stream: '', yearOfPassing: '', percentage: '', cgpa: '' });
      load();
    } catch (err) { showMsg(err.response?.data?.message || 'Failed.'); }
    finally { setSubmitting(false); }
  };
  const delEdu = async (id) => {
    if (!window.confirm('Remove this education entry?')) return;
    try { await api.delete(`${apiBase}/education/${id}`); showMsg('Education removed.'); load(); }
    catch (err) { showMsg(err.response?.data?.message || 'Failed.'); }
  };
  const uploadMarksheet = async (eduId, file) => {
    setUploading(eduId);
    try {
      const fd = new FormData(); fd.append('file', file);
      await api.post(`${apiBase}/education/${eduId}/marksheet`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showMsg('Marksheet uploaded!'); load();
    } catch (err) { showMsg(err.response?.data?.message || 'Upload failed.'); }
    finally { setUploading(null); }
  };

  const list = profile?.education || [];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Education Details</h3>
        <button onClick={() => setShowForm(!showForm)} style={showForm ? btnDanger : btnPrimary}>{showForm ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Education</>}</button>
      </div>
      {showForm && (
        <div style={{ ...cardSt, border: '2px solid #2563eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14 }}>
            <div><label style={labelSt}>Level *</label><select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} style={inputSt}>{EDU_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
            <div><label style={labelSt}>Board / University</label><input value={form.boardOrUniversity} onChange={e => setForm({ ...form, boardOrUniversity: e.target.value })} style={inputSt} placeholder="e.g. CBSE, Mumbai University" /></div>
            <div><label style={labelSt}>School / College</label><input value={form.schoolOrCollege} onChange={e => setForm({ ...form, schoolOrCollege: e.target.value })} style={inputSt} /></div>
            {['GRADUATION','POST_GRADUATION','PHD','DIPLOMA','CERTIFICATION'].includes(form.level) && (<><div><label style={labelSt}>Degree</label><input value={form.degree} onChange={e => setForm({ ...form, degree: e.target.value })} style={inputSt} placeholder="e.g. B.Tech, BBA, MBA" /></div><div><label style={labelSt}>Specialization</label><input value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} style={inputSt} /></div></>)}
            {form.level === '12TH' && <div><label style={labelSt}>Stream</label><input value={form.stream} onChange={e => setForm({ ...form, stream: e.target.value })} style={inputSt} placeholder="e.g. Science, Commerce, Arts" /></div>}
            <div><label style={labelSt}>Year of Passing</label><input type="number" value={form.yearOfPassing} onChange={e => setForm({ ...form, yearOfPassing: e.target.value })} style={inputSt} placeholder="2020" min={1970} max={2040} /></div>
            <div><label style={labelSt}>Percentage (%)</label><input type="number" value={form.percentage} onChange={e => setForm({ ...form, percentage: e.target.value })} style={inputSt} placeholder="85.5" min={0} max={100} step="0.1" /></div>
            <div><label style={labelSt}>CGPA (out of 10)</label><input type="number" value={form.cgpa} onChange={e => setForm({ ...form, cgpa: e.target.value })} style={inputSt} placeholder="8.5" min={0} max={10} step="0.01" /></div>
          </div>
          <button onClick={addEdu} disabled={submitting} style={{ ...btnGreen, marginTop: 14, opacity: submitting ? 0.6 : 1 }}><Save size={15} /> {submitting ? 'Adding…' : 'Add Education'}</button>
        </div>
      )}
      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}><GraduationCap size={40} style={{ marginBottom: 8, opacity: 0.4 }} /><p>No education entries yet.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(e => {
            const levelLabel = EDU_LEVELS.find(l => l.value === e.level)?.label || e.level;
            return (
              <div key={e._id} style={cardSt}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>{levelLabel} {e.degree ? `— ${e.degree}` : ''} {e.specialization ? `(${e.specialization})` : ''}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>{e.schoolOrCollege && <span>{e.schoolOrCollege}</span>}{e.boardOrUniversity && <span> • {e.boardOrUniversity}</span>}{e.stream && <span> • {e.stream}</span>}{e.yearOfPassing && <span> • {e.yearOfPassing}</span>}</div>
                    <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: 4 }}>{e.percentage != null && <span>Percentage: {e.percentage}%</span>}{e.percentage != null && e.cgpa != null && <span> | </span>}{e.cgpa != null && <span>CGPA: {e.cgpa}</span>}</div>
                  </div>
                  <button onClick={() => delEdu(e._id)} style={{ ...btnDanger, padding: '5px 10px', fontSize: '0.78rem' }}><Trash2 size={14} /></button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {e.marksheetUrl && <a href={e.marksheetUrl} target="_blank" rel="noreferrer" style={{ ...btnPrimary, padding: '5px 12px', fontSize: '0.78rem', textDecoration: 'none' }}><Eye size={13} /> View Marksheet</a>}
                  <label style={{ ...btnGreen, padding: '5px 12px', fontSize: '0.78rem', cursor: uploading === e._id ? 'wait' : 'pointer', opacity: uploading === e._id ? 0.6 : 1 }}>
                    <Upload size={13} /> {e.marksheetUrl ? 'Replace' : 'Upload'} Marksheet
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={ev => ev.target.files[0] && uploadMarksheet(e._id, ev.target.files[0])} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Experience Tab ─────────────────────────────────────────── */
function ExperienceTab({ apiBase, profile, load, showMsg }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ companyName: '', designation: '', department: '', location: '', fromDate: '', toDate: '', ctcPerAnnum: '', reasonForLeaving: '' });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(null);

  const addExp = async () => {
    setSubmitting(true);
    try {
      await api.post(`${apiBase}/experience`, { ...form, ctcPerAnnum: form.ctcPerAnnum ? Number(form.ctcPerAnnum) : undefined });
      showMsg('Experience added!'); setShowForm(false);
      setForm({ companyName: '', designation: '', department: '', location: '', fromDate: '', toDate: '', ctcPerAnnum: '', reasonForLeaving: '' });
      load();
    } catch (err) { showMsg(err.response?.data?.message || 'Failed.'); }
    finally { setSubmitting(false); }
  };
  const delExp = async (id) => {
    if (!window.confirm('Remove this experience entry?')) return;
    try { await api.delete(`${apiBase}/experience/${id}`); showMsg('Experience removed.'); load(); }
    catch (err) { showMsg(err.response?.data?.message || 'Failed.'); }
  };
  const uploadDoc = async (expId, docType, file) => {
    setUploading(`${expId}-${docType}`);
    try {
      const fd = new FormData(); fd.append('file', file);
      await api.post(`${apiBase}/experience/${expId}/${docType}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showMsg(`${docType.replace(/([A-Z])/g, ' $1').trim()} uploaded!`); load();
    } catch (err) { showMsg(err.response?.data?.message || 'Upload failed.'); }
    finally { setUploading(null); }
  };

  const list = profile?.experience || [];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div><h3 style={{ margin: 0, fontSize: '1rem' }}>Work Experience</h3><p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>Skip if fresher</p></div>
        <button onClick={() => setShowForm(!showForm)} style={showForm ? btnDanger : btnPrimary}>{showForm ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Experience</>}</button>
      </div>
      {showForm && (
        <div style={{ ...cardSt, border: '2px solid #2563eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14 }}>
            <div><label style={labelSt}>Company Name *</label><input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} style={inputSt} /></div>
            <div><label style={labelSt}>Designation</label><input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} style={inputSt} /></div>
            <div><label style={labelSt}>Department</label><input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} style={inputSt} /></div>
            <div><label style={labelSt}>Location</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={inputSt} placeholder="City, State" /></div>
            <div><label style={labelSt}>From Date</label><input type="date" value={form.fromDate} onChange={e => setForm({ ...form, fromDate: e.target.value })} style={inputSt} /></div>
            <div><label style={labelSt}>To Date</label><input type="date" value={form.toDate} onChange={e => setForm({ ...form, toDate: e.target.value })} style={inputSt} /></div>
            <div><label style={labelSt}>CTC Per Annum (₹)</label><input type="number" value={form.ctcPerAnnum} onChange={e => setForm({ ...form, ctcPerAnnum: e.target.value })} style={inputSt} /></div>
            <div><label style={labelSt}>Reason for Leaving</label><input value={form.reasonForLeaving} onChange={e => setForm({ ...form, reasonForLeaving: e.target.value })} style={inputSt} /></div>
          </div>
          <button onClick={addExp} disabled={submitting} style={{ ...btnGreen, marginTop: 14, opacity: submitting ? 0.6 : 1 }}><Save size={15} /> {submitting ? 'Adding…' : 'Add Experience'}</button>
        </div>
      )}
      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}><Briefcase size={40} style={{ marginBottom: 8, opacity: 0.4 }} /><p>No experience entries.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(ex => (
            <div key={ex._id} style={cardSt}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>{ex.companyName}</div>
                  <div style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 500 }}>{ex.designation || '—'} {ex.department ? `• ${ex.department}` : ''}</div>
                  <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 4 }}>{fmt(ex.fromDate)} — {fmt(ex.toDate) || 'Present'}{ex.location && <span> • {ex.location}</span>}{ex.ctcPerAnnum && <span> • ₹{(ex.ctcPerAnnum / 100000).toFixed(1)} LPA</span>}</div>
                  {ex.reasonForLeaving && <div style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: 2 }}>Left: {ex.reasonForLeaving}</div>}
                </div>
                <button onClick={() => delExp(ex._id)} style={{ ...btnDanger, padding: '5px 10px', fontSize: '0.78rem' }}><Trash2 size={14} /></button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {['experienceLetter', 'relievingLetter', 'offerLetter'].map(dt => {
                  const url = ex[`${dt}Url`]; const lbl = dt.replace(/([A-Z])/g, ' $1').trim(); const isUp = uploading === `${ex._id}-${dt}`;
                  return (<span key={dt} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    {url && <a href={url} target="_blank" rel="noreferrer" style={{ ...btnPrimary, padding: '4px 10px', fontSize: '0.75rem', textDecoration: 'none' }}><Eye size={12} /> {lbl}</a>}
                    <label style={{ ...btnGreen, padding: '4px 10px', fontSize: '0.75rem', cursor: isUp ? 'wait' : 'pointer', opacity: isUp ? 0.6 : 1 }}>
                      <Upload size={12} /> {url ? 'Replace' : 'Upload'} {lbl}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={ev => ev.target.files[0] && uploadDoc(ex._id, dt, ev.target.files[0])} />
                    </label>
                  </span>);
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Bank & IDs Tab ─────────────────────────────────────────── */
function BankTab({ apiBase, profile, load, showMsg, saving, setSaving }) {
  const [f, setF] = useState({ aadhaarNumber: '', panNumber: '', passportNumber: '', passportExpiry: '', uanNumber: '', esicNumber: '', bankName: '', bankAccountNumber: '', ifscCode: '', bankBranch: '' });
  useEffect(() => {
    if (profile) setF({ aadhaarNumber: profile.aadhaarNumber || '', panNumber: profile.panNumber || '', passportNumber: profile.passportNumber || '', passportExpiry: fmtInput(profile.passportExpiry), uanNumber: profile.uanNumber || '', esicNumber: profile.esicNumber || '', bankName: profile.bankName || '', bankAccountNumber: profile.bankAccountNumber || '', ifscCode: profile.ifscCode || '', bankBranch: profile.bankBranch || '' });
  }, [profile]);
  const save = async () => {
    setSaving(true);
    try { await api.patch(apiBase, f); showMsg('Bank & ID details saved!'); load(); }
    catch (err) { showMsg(err.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <div style={cardSt}>
      <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Identity Documents</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14 }}>
        <div><label style={labelSt}>Aadhaar Number *</label><input value={f.aadhaarNumber} onChange={e => set('aadhaarNumber', e.target.value)} style={inputSt} placeholder="XXXX XXXX XXXX" maxLength={14} /></div>
        <div><label style={labelSt}>PAN Number *</label><input value={f.panNumber} onChange={e => set('panNumber', e.target.value.toUpperCase())} style={inputSt} placeholder="ABCDE1234F" maxLength={10} /></div>
        <div><label style={labelSt}>Passport Number</label><input value={f.passportNumber} onChange={e => set('passportNumber', e.target.value.toUpperCase())} style={inputSt} /></div>
        <div><label style={labelSt}>Passport Expiry</label><input type="date" value={f.passportExpiry} onChange={e => set('passportExpiry', e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>UAN Number (PF)</label><input value={f.uanNumber} onChange={e => set('uanNumber', e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>ESIC Number</label><input value={f.esicNumber} onChange={e => set('esicNumber', e.target.value)} style={inputSt} /></div>
      </div>
      <h3 style={{ margin: '24px 0 16px', fontSize: '1rem' }}>Bank Details</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14 }}>
        <div><label style={labelSt}>Bank Name *</label><input value={f.bankName} onChange={e => set('bankName', e.target.value)} style={inputSt} placeholder="e.g. State Bank of India" /></div>
        <div><label style={labelSt}>Account Number *</label><input value={f.bankAccountNumber} onChange={e => set('bankAccountNumber', e.target.value)} style={inputSt} /></div>
        <div><label style={labelSt}>IFSC Code *</label><input value={f.ifscCode} onChange={e => set('ifscCode', e.target.value.toUpperCase())} style={inputSt} placeholder="e.g. SBIN0001234" /></div>
        <div><label style={labelSt}>Bank Branch</label><input value={f.bankBranch} onChange={e => set('bankBranch', e.target.value)} style={inputSt} /></div>
      </div>
      <button onClick={save} disabled={saving} style={{ ...btnPrimary, marginTop: 18, opacity: saving ? 0.6 : 1 }}><Save size={15} /> {saving ? 'Saving…' : 'Save Bank & ID Details'}</button>
    </div>
  );
}

/* ── Documents Tab ──────────────────────────────────────────── */
function DocumentsTab({ apiBase, profile, load, showMsg }) {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState(''); const [category, setCategory] = useState('OTHER'); const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const uploadDoc = async () => {
    if (!file || !label.trim()) { showMsg('Label and file are required.'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('label', label.trim()); fd.append('category', category);
      await api.post(`${apiBase}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showMsg('Document uploaded!'); setShowForm(false); setLabel(''); setCategory('OTHER'); setFile(null); load();
    } catch (err) { showMsg(err.response?.data?.message || 'Upload failed.'); }
    finally { setSubmitting(false); }
  };
  const delDoc = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    try { await api.delete(`${apiBase}/documents/${id}`); showMsg('Document removed.'); load(); }
    catch (err) { showMsg(err.response?.data?.message || 'Failed.'); }
  };

  const list = profile?.documents || [];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div><h3 style={{ margin: 0, fontSize: '1rem' }}>Identity & Other Documents</h3><p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>Upload Aadhaar, PAN, Passport, Photo, Resume, etc.</p></div>
        <button onClick={() => setShowForm(!showForm)} style={showForm ? btnDanger : btnPrimary}>{showForm ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Upload Document</>}</button>
      </div>
      {showForm && (
        <div style={{ ...cardSt, border: '2px solid #2563eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14 }}>
            <div><label style={labelSt}>Label *</label><input value={label} onChange={e => setLabel(e.target.value)} style={inputSt} placeholder="e.g. Aadhaar Card Front" /></div>
            <div><label style={labelSt}>Category</label><select value={category} onChange={e => setCategory(e.target.value)} style={inputSt}>{DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div><label style={labelSt}>File (PDF, JPG, PNG) *</label><input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setFile(e.target.files[0])} style={inputSt} /></div>
          </div>
          <button onClick={uploadDoc} disabled={submitting} style={{ ...btnGreen, marginTop: 14, opacity: submitting ? 0.6 : 1 }}><Upload size={15} /> {submitting ? 'Uploading…' : 'Upload'}</button>
        </div>
      )}
      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}><FileUp size={40} style={{ marginBottom: 8, opacity: 0.4 }} /><p>No documents uploaded yet.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
          {list.map(d => {
            const catLabel = DOC_CATEGORIES.find(c => c.value === d.category)?.label || d.category;
            return (
              <div key={d._id} style={{ ...cardSt, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 14 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{d.label}</div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{catLabel} {d.fileSize ? `• ${formatBytes(d.fileSize)}` : ''}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{fmt(d.uploadedAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" style={{ ...btnPrimary, padding: '4px 10px', fontSize: '0.75rem', textDecoration: 'none' }}><Eye size={12} /> View</a>
                  <button onClick={() => delDoc(d._id)} style={{ ...btnDanger, padding: '4px 10px', fontSize: '0.75rem' }}><Trash2 size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Admin View — list employees, click to open full editable profile
   ══════════════════════════════════════════════════════════════ */
function AdminProfileView() {
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingEmp, setEditingEmp] = useState(null);
  const [editProfile, setEditProfile] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  const loadList = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/employee-profile', { params });
      setEmployees(data.data);
    } catch { setEmployees([]); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { loadList(); }, [loadList]);

  const openEmployee = async (emp) => {
    setEditingEmp(emp); setEditLoading(true); setViewMode('edit');
    try {
      const { data } = await api.get(`/employee-profile/${emp._id}`);
      setEditProfile(data.data);
    } catch { setEditProfile(null); }
    finally { setEditLoading(false); }
  };

  const reloadEditProfile = async () => {
    if (!editingEmp) return;
    try {
      const { data } = await api.get(`/employee-profile/${editingEmp._id}`);
      setEditProfile(data.data);
    } catch { /* keep existing */ }
  };

  const backToList = () => { setViewMode('list'); setEditingEmp(null); setEditProfile(null); loadList(); };

  // My own profile (for HR to fill their own details)
  const [myProfile, setMyProfile] = useState(null);
  const [myLoading, setMyLoading] = useState(false);
  const loadMyProfile = async () => {
    setMyLoading(true);
    try { const { data } = await api.get('/employee-profile/my'); setMyProfile(data.data); }
    catch { setMyProfile(null); }
    finally { setMyLoading(false); }
  };
  const reloadMyProfile = async () => {
    try { const { data } = await api.get('/employee-profile/my'); setMyProfile(data.data); }
    catch { /* keep */ }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading profiles...</p></div>;

  // Editing a specific employee
  if (viewMode === 'edit' && editingEmp) {
    return (
      <div>
        <button onClick={backToList} style={{ ...btnPrimary, background: '#6b7280', marginBottom: 16 }}><ArrowLeft size={15} /> Back to All Employees</button>
        {editLoading ? <div className="page-loading"><div className="spinner" /><p>Loading profile...</p></div> : editProfile ? (
          <ProfileEditor
            apiBase={`/employee-profile/${editingEmp._id}`}
            profile={editProfile}
            load={reloadEditProfile}
            title={`${editingEmp.name} (${editingEmp.employeeId})`}
            subtitle={`${editingEmp.designation || ''} • ${editingEmp.department || ''} — Edit all profile details below`}
          />
        ) : <p style={{ color: '#9ca3af' }}>Profile not found.</p>}
      </div>
    );
  }

  // Viewing own profile
  if (viewMode === 'myprofile') {
    return (
      <div>
        <button onClick={() => { setViewMode('list'); }} style={{ ...btnPrimary, background: '#6b7280', marginBottom: 16 }}><ArrowLeft size={15} /> Back to All Employees</button>
        <PayslipPinCard />
        {myLoading ? <div className="page-loading"><div className="spinner" /><p>Loading profile...</p></div> : myProfile ? (
          <ProfileEditor
            apiBase="/employee-profile/my"
            profile={myProfile}
            load={reloadMyProfile}
            title="My Profile"
            subtitle="Fill in your own personal, education, experience and document details"
          />
        ) : <p style={{ color: '#9ca3af' }}>Profile not found.</p>}
      </div>
    );
  }

  // Employee list
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Employee Profiles</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.88rem' }}>View, add, and edit employee profile details</p>
        </div>
        <button onClick={() => { loadMyProfile(); setViewMode('myprofile'); }} style={btnPrimary}>
          <User size={15} /> My Profile
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID..." style={{ ...inputSt, paddingLeft: 32, margin: 0 }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputSt, width: 'auto', minWidth: 140 }}>
          <option value="">All Profiles</option>
          <option value="complete">80%+ Complete</option>
          <option value="incomplete">Below 80%</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {employees.map(e => (
          <div key={e._id} onClick={() => openEmployee(e)} style={{ ...cardSt, marginBottom: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', transition: 'box-shadow 0.2s' }}
            onMouseEnter={ev => ev.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
            onMouseLeave={ev => ev.currentTarget.style.boxShadow = 'none'}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{e.name} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({e.employeeId})</span></div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{e.designation || '—'} • {e.department}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 80, height: 8, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: e.completionPercent >= 80 ? '#22c55e' : e.completionPercent >= 40 ? '#f59e0b' : '#ef4444', width: `${e.completionPercent}%` }} />
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: e.completionPercent >= 80 ? '#15803d' : e.completionPercent >= 40 ? '#b45309' : '#b91c1c', minWidth: 35 }}>{e.completionPercent}%</span>
            </div>
          </div>
        ))}
        {employees.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>No employees found.</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Employee self-service (non-admin roles)
   ══════════════════════════════════════════════════════════════ */
function EmployeeSelfProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const { data } = await api.get('/employee-profile/my'); setProfile(data.data); }
    catch { setProfile(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading profile...</p></div>;

  return (
    <div>
      <PayslipPinCard />
      <ProfileEditor
        apiBase="/employee-profile/my"
        profile={profile}
        load={load}
        title="My Profile"
        subtitle="Complete your personal, education, experience and document details"
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Accounts View — read-only view of employee bank & profile info
   ══════════════════════════════════════════════════════════════ */
function AccountsProfileView() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewingEmp, setViewingEmp] = useState(null);
  const [viewProfile, setViewProfile] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get('/employee-profile', { params });
      setEmployees(data.data);
    } catch { setEmployees([]); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const viewEmp = async (empId) => {
    if (viewingEmp === empId) { setViewingEmp(null); setViewProfile(null); return; }
    setViewingEmp(empId); setViewLoading(true);
    try { const { data } = await api.get(`/employee-profile/${empId}`); setViewProfile(data.data); }
    catch { setViewProfile(null); }
    finally { setViewLoading(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading profiles...</p></div>;

  const field = (label, val) => (
    <div style={{ padding: '6px 0' }}>
      <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{label}</span>
      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>{val || '—'}</div>
    </div>
  );

  return (
    <div>
      <h2 style={{ margin: '0 0 4px' }}>Employee Profiles</h2>
      <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '0.88rem' }}>View employee bank details and profile information (read-only)</p>

      <div style={{ position: 'relative', maxWidth: 300, marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID..." style={{ ...inputSt, paddingLeft: 32, margin: 0 }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {employees.map(e => (
          <div key={e._id}>
            <div onClick={() => viewEmp(e._id)} style={{ ...cardSt, marginBottom: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{e.name} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({e.employeeId})</span></div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{e.designation || '—'} • {e.department}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {viewingEmp === e._id ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
              </div>
            </div>

            {viewingEmp === e._id && (
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: 18 }}>
                {viewLoading ? <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Loading…</p> : viewProfile ? (
                  <div>
                    {/* Bank Details — primary focus for accounts */}
                    <div style={{ marginBottom: 16 }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.92rem', color: '#2563eb', borderBottom: '2px solid #2563eb', paddingBottom: 4, display: 'inline-block' }}>Bank & Payment Details</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: '2px 16px' }}>
                        {field('Bank Name', viewProfile.bankName)}
                        {field('Account Number', viewProfile.bankAccountNumber)}
                        {field('IFSC Code', viewProfile.ifscCode)}
                        {field('Bank Branch', viewProfile.bankBranch)}
                        {field('PAN Number', viewProfile.panNumber)}
                        {field('UAN Number (PF)', viewProfile.uanNumber)}
                        {field('ESIC Number', viewProfile.esicNumber)}
                        {field('Aadhaar Number', viewProfile.aadhaarNumber)}
                      </div>
                    </div>

                    {/* Personal Info summary */}
                    <div style={{ marginBottom: 16 }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: 4 }}>Personal Information</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: '2px 16px' }}>
                        {field("Father's Name", viewProfile.fatherName)}
                        {field("Mother's Name", viewProfile.motherName)}
                        {field('Date of Birth', fmt(viewProfile.dateOfBirth))}
                        {field('Gender', viewProfile.gender)}
                        {field('Blood Group', viewProfile.bloodGroup)}
                        {field('Marital Status', viewProfile.maritalStatus)}
                        {field('Personal Phone', viewProfile.personalPhone)}
                        {field('Personal Email', viewProfile.personalEmail)}
                      </div>
                    </div>

                    {/* Address */}
                    <div style={{ marginBottom: 16 }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: 4 }}>Address</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '2px 16px' }}>
                        {field('Current Address', viewProfile.currentAddress)}
                        {field('Permanent Address', viewProfile.permanentAddress)}
                      </div>
                    </div>

                    {/* Emergency Contact */}
                    <div style={{ marginBottom: 16 }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: 4 }}>Emergency Contact</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: '2px 16px' }}>
                        {field('Name', viewProfile.emergencyContactName)}
                        {field('Relation', viewProfile.emergencyContactRelation)}
                        {field('Phone', viewProfile.emergencyContactPhone)}
                      </div>
                    </div>

                    {/* Education summary */}
                    {viewProfile.education?.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: 4 }}>Education ({viewProfile.education.length})</h4>
                        {viewProfile.education.map((ed, i) => (
                          <div key={i} style={{ fontSize: '0.82rem', color: '#4b5563', marginBottom: 4 }}>
                            <strong>{EDU_LEVELS.find(l => l.value === ed.level)?.label || ed.level}</strong>
                            {ed.degree ? ` — ${ed.degree}` : ''}{ed.specialization ? ` (${ed.specialization})` : ''}
                            {ed.schoolOrCollege ? ` • ${ed.schoolOrCollege}` : ''}{ed.yearOfPassing ? ` • ${ed.yearOfPassing}` : ''}
                            {ed.percentage != null ? ` • ${ed.percentage}%` : ''}{ed.cgpa != null ? ` • CGPA ${ed.cgpa}` : ''}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Experience summary */}
                    {viewProfile.experience?.length > 0 && (
                      <div>
                        <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: 4 }}>Experience ({viewProfile.experience.length})</h4>
                        {viewProfile.experience.map((ex, i) => (
                          <div key={i} style={{ fontSize: '0.82rem', color: '#4b5563', marginBottom: 4 }}>
                            <strong>{ex.companyName}</strong> — {ex.designation || '—'} ({fmt(ex.fromDate)} – {fmt(ex.toDate) || 'Present'})
                            {ex.location ? ` • ${ex.location}` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : <p style={{ color: '#9ca3af' }}>Profile not found.</p>}
              </div>
            )}
          </div>
        ))}
        {employees.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>No employees found.</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main Export
   ══════════════════════════════════════════════════════════════ */
export default function EmployeeProfilePage() {
  const { user } = useAuthStore();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  const isAccounts = user?.role === 'ACCOUNTS';
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {isAdmin ? <AdminProfileView /> : isAccounts ? <AccountsProfileView /> : <EmployeeSelfProfile />}
    </div>
  );
}
