import { useState, useEffect, useRef } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';
import { Image, FileText, Paperclip, FolderOpen, ArrowLeft } from 'lucide-react';

const DOC_TYPES = [
  { value: 'OFFER_LETTER',  label: 'Offer Letter' },
  { value: 'ID_PROOF',      label: 'ID Proof' },
  { value: 'CERTIFICATE',   label: 'Certificate' },
  { value: 'CONTRACT',      label: 'Contract' },
  { value: 'PAYSLIP',       label: 'Payslip' },
  { value: 'OTHER',         label: 'Other' },
];

const TYPE_COLORS = {
  OFFER_LETTER: { bg: '#dbeafe', color: '#2563eb' },
  ID_PROOF:     { bg: '#fef3c7', color: '#d97706' },
  CERTIFICATE:  { bg: '#dcfce7', color: '#16a34a' },
  CONTRACT:     { bg: '#f3e8ff', color: '#7c3aed' },
  PAYSLIP:      { bg: '#ffedd5', color: '#ea580c' },
  OTHER:        { bg: '#f3f4f6', color: '#374151' },
};

function TypeBadge({ type }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.OTHER;
  const label = DOC_TYPES.find(d => d.value === type)?.label || type;
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
      background: c.bg, color: c.color, whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }) {
  const isImage = mimeType?.startsWith('image/');
  const isPdf   = mimeType === 'application/pdf';
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0,
      background: isImage ? '#dbeafe' : isPdf ? '#fee2e2' : '#f3f4f6',
    }}>
      {isImage ? <Image size={16} strokeWidth={2} /> : isPdf ? <FileText size={16} strokeWidth={2} /> : <Paperclip size={16} strokeWidth={2} />}
    </div>
  );
}

/* ── Upload Form ─────────────────────────────────────────────── */
function UploadForm({ onUploaded, employeeId }) {
  const fileRef  = useRef();
  const [name,   setName]   = useState('');
  const [type,   setType]   = useState('OTHER');
  const [file,   setFile]   = useState(null);
  const [busy,   setBusy]   = useState(false);
  const [msg,    setMsg]    = useState('');

  const submit = async () => {
    if (!file) return setMsg('Please select a file.');
    if (!name.trim()) return setMsg('Please enter a document name.');
    setBusy(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name.trim());
      fd.append('type', type);
      if (employeeId) fd.append('employeeId', employeeId);
      await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg('✅ Document uploaded successfully.');
      setName(''); setType('OTHER'); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      onUploaded();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Upload failed.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <h4 style={{ margin: '0 0 14px', fontWeight: 600 }}>Upload Document</h4>
      {msg && (
        <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}
      <div className="dv-upload-grid">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Document Name *</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Aadhaar Card, Offer Letter" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Document Type</label>
          <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
            {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 12 }}>
        <label className="form-label">File * (PDF, JPG, PNG, DOC, DOCX — max 10 MB)</label>
        <input ref={fileRef} type="file" className="form-input"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={e => setFile(e.target.files[0] || null)} />
      </div>
      {file && (
        <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '4px 0 0' }}>
          Selected: {file.name} ({formatSize(file.size)})
        </p>
      )}
      <button className="btn btn--primary" style={{ marginTop: 14 }}
        onClick={submit} disabled={busy || !file || !name.trim()}>
        {busy ? 'Uploading...' : '⬆ Upload'}
      </button>
    </div>
  );
}

/* ── Document List ───────────────────────────────────────────── */
function DocList({ docs, onDeleted, canDelete }) {
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document permanently?')) return;
    setDeleting(id);
    try {
      await api.delete(`/documents/${id}`);
      onDeleted();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally { setDeleting(null); }
  };

  if (docs.length === 0) {
    return (
      <div className="empty-state" style={{ paddingTop: 32 }}>
        <div className="empty-state-icon"><FolderOpen size={40} strokeWidth={1.5} color="#9ca3af" /></div>
        <h3>No documents yet</h3>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Upload documents using the form above</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {docs.map(doc => (
        <div key={doc._id} className="card dv-doc-item">
          <FileIcon mimeType={doc.mimeType} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#111827' }}>{doc.name}</span>
              <TypeBadge type={doc.type} />
            </div>
            <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 3 }}>
              {formatSize(doc.fileSize)} &nbsp;·&nbsp;
              {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {doc.uploadedBy?.name && ` · Uploaded by ${doc.uploadedBy.name}`}
            </div>
          </div>
          <div className="dv-doc-actions">
            <a href={doc.fileUrl} target="_blank" rel="noreferrer"
              className="btn btn--secondary dv-doc-btn">
              View
            </a>
            <a href={doc.fileUrl} download={doc.name}
              className="btn btn--secondary dv-doc-btn">
              ⬇
            </a>
            {canDelete && (
              <button className="btn btn--danger dv-doc-btn"
                onClick={() => handleDelete(doc._id)}
                disabled={deleting === doc._id}>
                {deleting === doc._id ? '...' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Employee View (own docs only) ──────────────────────────── */
function EmployeeVaultView() {
  const { user } = useAuthStore();
  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/documents/my');
      setDocs(data.data);
    } catch { setDocs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDocs(); }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Document Vault</h1>
        <p className="page-subtitle">Your personal document storage</p>
      </div>
      <UploadForm onUploaded={fetchDocs} employeeId={null} />
      {loading
        ? <div className="page-loading">Loading...</div>
        : <DocList docs={docs} onDeleted={fetchDocs} canDelete={true} />
      }
    </div>
  );
}

/* ── HR / Admin View ─────────────────────────────────────────── */
function AdminVaultView() {
  const { user } = useAuthStore();
  const [employees,    setEmployees]    = useState([]);
  const [selectedEmp,  setSelectedEmp]  = useState(null); // { _id, name, employeeId }
  const [empDocs,      setEmpDocs]      = useState([]);
  const [empLoading,   setEmpLoading]   = useState(false);
  const [myDocs,       setMyDocs]       = useState([]);
  const [myLoading,    setMyLoading]    = useState(true);
  const [tab,          setTab]          = useState('employees'); // 'employees' | 'mine'

  useEffect(() => {
    // Load employee list
    api.get('/documents/all-employees')
      .then(({ data }) => setEmployees(data.data))
      .catch(() => {});
    // Load own docs
    fetchMyDocs();
  }, []);

  const fetchMyDocs = async () => {
    setMyLoading(true);
    try {
      const { data } = await api.get('/documents/my');
      setMyDocs(data.data);
    } catch { setMyDocs([]); }
    finally { setMyLoading(false); }
  };

  const selectEmployee = async (emp) => {
    setSelectedEmp(emp);
    setEmpLoading(true);
    try {
      const { data } = await api.get(`/documents/employee/${emp._id}`);
      setEmpDocs(data.data);
    } catch { setEmpDocs([]); }
    finally { setEmpLoading(false); }
  };

  const refreshEmpDocs = async () => {
    if (!selectedEmp) return;
    setEmpLoading(true);
    try {
      const { data } = await api.get(`/documents/employee/${selectedEmp._id}`);
      setEmpDocs(data.data);
    } catch { setEmpDocs([]); }
    finally { setEmpLoading(false); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Document Vault</h1>
        <p className="page-subtitle">Manage employee documents</p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'employees' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setTab('employees')}>Employee Documents</button>
        <button className={`btn ${tab === 'mine' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setTab('mine')}>My Documents</button>
      </div>

      {tab === 'mine' && (
        <>
          <UploadForm onUploaded={fetchMyDocs} employeeId={null} />
          {myLoading
            ? <div className="page-loading">Loading...</div>
            : <DocList docs={myDocs} onDeleted={fetchMyDocs} canDelete={true} />
          }
        </>
      )}

      {tab === 'employees' && (
        <div className="dv-admin-grid">
          {/* Employee list sidebar */}
          <div className="card dv-emp-sidebar">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                Select Employee ({employees.length})
              </h4>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {employees.map(emp => (
                <button key={emp._id}
                  onClick={() => selectEmployee(emp)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 16px',
                    background: selectedEmp?._id === emp._id ? '#eff6ff' : 'transparent',
                    border: 'none', borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer', display: 'block',
                    borderLeft: selectedEmp?._id === emp._id ? '3px solid #3b82f6' : '3px solid transparent',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>{emp.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {emp.employeeId} · {emp.department?.name || emp.designation || ''}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Document panel for selected employee */}
          <div>
            {!selectedEmp ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <div style={{ marginBottom: 12 }}><ArrowLeft size={32} strokeWidth={1.5} color="#9ca3af" /></div>
                <p style={{ margin: 0 }}>Select an employee to view or upload their documents</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 700 }}>{selectedEmp.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.83rem', color: '#6b7280' }}>{selectedEmp.employeeId}</p>
                  </div>
                </div>
                <UploadForm onUploaded={refreshEmpDocs} employeeId={selectedEmp._id} />
                {empLoading
                  ? <div className="page-loading">Loading...</div>
                  : <DocList docs={empDocs} onDeleted={refreshEmpDocs} canDelete={true} />
                }
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentVaultPage() {
  const { user } = useAuthStore();
  const isAdmin = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  return isAdmin ? <AdminVaultView /> : <EmployeeVaultView />;
}
