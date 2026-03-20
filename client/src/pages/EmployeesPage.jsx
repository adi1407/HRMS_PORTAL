import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';
import { Users } from 'lucide-react';

const PAGE_SIZE = 25;

export default function EmployeesPage() {
  const { user: me } = useAuthStore();
  const isAccounts = ['ACCOUNTS', 'SUPER_ADMIN'].includes(me?.role);
  // canManage: HR/DIRECTOR/SUPER_ADMIN — delete employees
  const canManage  = ['HR', 'DIRECTOR', 'SUPER_ADMIN'].includes(me?.role);
  // canCreate: ACCOUNTS can also add employees (to set salary/bank from the start)
  const canCreate  = canManage || me?.role === 'ACCOUNTS';

  const [employees,   setEmployees]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState({
    name: '', email: '', password: 'Welcome@123', role: 'EMPLOYEE',
    designation: '', department: '',
    grossSalary: '', bankAccountNumber: '', ifscCode: '', isManagingHead: false,
  });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  // Salary & bank details modal (ACCOUNTS only)
  const [bankModal,  setBankModal]  = useState(null);
  const [bankSaving, setBankSaving] = useState(false);
  const [bioSaving, setBioSaving] = useState({});

  useEffect(() => { fetchEmployees(); fetchDepartments(); }, []);
  useEffect(() => { setPage(1); }, [search]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setEmployees(data.data);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get('/departments');
      setDepartments(data.data || []);
    } catch {}
  };

  const filtered = employees.filter(e =>
    e.role !== 'SUPER_ADMIN' && (
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeId?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const payload = {
        name: form.name, email: form.email, password: form.password,
        role: form.role, designation: form.designation, department: form.department,
      };
      if (isAccounts) {
        payload.grossSalary       = Number(form.grossSalary) || 0;
        payload.bankAccountNumber = form.bankAccountNumber;
        payload.ifscCode          = form.ifscCode.toUpperCase();
        payload.isManagingHead    = form.isManagingHead;
      }
      await api.post('/users', payload);
      setMsg('✅ Employee created successfully.');
      setShowForm(false);
      setForm({
        name: '', email: '', password: 'Welcome@123', role: 'EMPLOYEE',
        designation: '', department: '',
        grossSalary: '', bankAccountNumber: '', ifscCode: '', isManagingHead: false,
      });
      fetchEmployees();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to create.'));
    } finally { setSaving(false); }
  };

  const deleteEmployee = async (emp) => {
    if (!window.confirm(`Permanently remove ${emp.name} (${emp.employeeId})? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${emp._id}`);
      setMsg(`✅ ${emp.name} has been permanently removed.`);
      fetchEmployees();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to remove employee.'));
    }
  };

  const toggleBiometricAttendance = async (emp) => {
    setBioSaving((s) => ({ ...s, [emp._id]: true }));
    setMsg('');
    try {
      const next = !emp.biometricAttendanceEnabled;
      await api.patch(`/users/${emp._id}`, { biometricAttendanceEnabled: next });
      setEmployees((prev) =>
        prev.map((e) => (e._id === emp._id ? { ...e, biometricAttendanceEnabled: next } : e))
      );
      setMsg(next ? `✅ Biometric attendance required for ${emp.name}. They must enroll on app / web.` : `✅ Biometric attendance off for ${emp.name}.`);
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to update biometric setting.'));
    } finally {
      setBioSaving((s) => ({ ...s, [emp._id]: false }));
    }
  };

  const openBankModal = (emp) => {
    setBankModal({
      emp,
      accountNo:      emp.bankAccountNumber || '',
      ifsc:           emp.ifscCode || '',
      salary:         emp.grossSalary || '',
      isManagingHead: emp.isManagingHead || false,
    });
  };

  const saveBankDetails = async () => {
    if (!bankModal) return;
    setBankSaving(true);
    try {
      const isFirstTime = !bankModal.emp.grossSalary || bankModal.emp.grossSalary === 0;

      if (isFirstTime || !isAccounts) {
        // First-time setup → apply directly; or non-accounts admin updating directly
        await api.patch(`/users/${bankModal.emp._id}`, {
          bankAccountNumber: bankModal.accountNo,
          ifscCode:          bankModal.ifsc.toUpperCase(),
          grossSalary:       Number(bankModal.salary) || 0,
          isManagingHead:    bankModal.isManagingHead,
        });
        setMsg(`✅ Details updated for ${bankModal.emp.name}.`);
      } else {
        // Salary already set → submit update request for department head approval
        const { data } = await api.post('/salary-requests', {
          employeeId:    bankModal.emp._id,
          newGrossSalary: bankModal.salary ? Number(bankModal.salary) : undefined,
          newBankAccount: bankModal.accountNo || undefined,
          newIfscCode:    bankModal.ifsc ? bankModal.ifsc.toUpperCase() : undefined,
          reason:         bankModal.reason || 'Salary/bank details update requested by Accounts',
        });
        setMsg(data.requiresApproval
          ? `✅ Update request submitted for ${bankModal.emp.name}. Awaiting department head approval.`
          : `✅ Details updated for ${bankModal.emp.name}.`
        );
      }
      setBankModal(null);
      fetchEmployees();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to update details.'));
    } finally { setBankSaving(false); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{filtered.length} of {employees.filter(e => e.role !== 'SUPER_ADMIN').length} staff members</p>
        </div>
        {canCreate && (
          <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancel' : '+ Add Employee'}
          </button>
        )}
      </div>

      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`}>{msg}</div>}

      {/* Add Employee Form */}
      {showForm && canCreate && (
        <div className="card">
          <h3 className="card-title">New Employee</h3>
          <form onSubmit={handleCreate} className="emp-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="john@company.com" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="ACCOUNTS">Accounts</option>
                  <option value="HR">HR</option>
                  <option value="DIRECTOR">Director</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Designation</label>
                <input className="form-input" value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} placeholder="Software Engineer" />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-select" value={form.department} onChange={e => setForm({...form, department: e.target.value})}>
                  <option value="">— Select Department —</option>
                  {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            {/* Salary & bank fields — only when ACCOUNTS is creating */}
            {isAccounts && (
              <>
                <div style={{ padding: '10px 14px', marginBottom: 12, fontSize: '0.85rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#166534' }}>
                  As Accounts, you can set salary and bank details now or add them later.
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Gross Salary (₹)</label>
                    <input className="form-input" type="number" placeholder="e.g. 30000" value={form.grossSalary} onChange={e => setForm({...form, grossSalary: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bank Account Number</label>
                    <input className="form-input" placeholder="e.g. 1234567890" value={form.bankAccountNumber} onChange={e => setForm({...form, bankAccountNumber: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">IFSC Code</label>
                    <input className="form-input" placeholder="e.g. SBIN0001234" maxLength={11} value={form.ifscCode} onChange={e => setForm({...form, ifscCode: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={form.isManagingHead}
                        onChange={e => setForm({...form, isManagingHead: e.target.checked})}
                        style={{ width: 16, height: 16 }}
                      />
                      Managing Head (full salary, no attendance deduction)
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Info note for HR/DIRECTOR — bank details handled by Accounts */}
            {!isAccounts && (
              <div style={{ padding: '10px 14px', marginBottom: 12, fontSize: '0.85rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, color: '#1e40af' }}>
                Gross salary, bank account &amp; IFSC code are managed by the <strong>Accounts department</strong> after the employee is created.
              </div>
            )}

            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Employee'}
            </button>
          </form>
        </div>
      )}

      <div className="search-bar">
        <input
          className="form-input"
          placeholder="Search by name, email or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading && <div className="page-loading">Loading employees…</div>}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Users size={40} strokeWidth={1.5} color="#9ca3af" /></div>
          <h3>No employees found</h3>
          <p>{search ? `No results for "${search}"` : 'No employees added yet.'}</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="table table--responsive">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Designation</th>
                  <th>Department</th>
                  {isAccounts && <th>Salary</th>}
                  {isAccounts && <th>Bank Details</th>}
                  {canManage  && <th>Biometric</th>}
                  {canManage  && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {paginated.map(emp => (
                  <tr key={emp._id}>
                    <td data-label="Emp ID"><strong>{emp.employeeId}</strong></td>
                    <td data-label="Name">
                      {emp.name}
                      {emp.isManagingHead && (
                        <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                          Managing Head
                        </span>
                      )}
                    </td>
                    <td data-label="Email" style={{ wordBreak: 'break-all' }}>{emp.email}</td>
                    <td data-label="Role"><span className="role-badge">{emp.role}</span></td>
                    <td data-label="Designation">{emp.designation || '—'}</td>
                    <td data-label="Department">{emp.department?.name || '—'}</td>
                    {isAccounts && (
                      <td data-label="Salary">
                        {emp.grossSalary > 0 ? `₹${emp.grossSalary?.toLocaleString('en-IN')}` : '—'}
                      </td>
                    )}
                    {isAccounts && (
                      <td data-label="Bank">
                        <span style={{ fontSize: '0.8rem', color: emp.bankAccountNumber ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {emp.bankAccountNumber ? 'Set' : 'Missing'}
                        </span>
                        <button
                          className="btn-tiny btn-tiny--blue"
                          style={{ marginLeft: 8 }}
                          onClick={() => openBankModal(emp)}
                        >
                          Edit
                        </button>
                      </td>
                    )}
                    {canManage && (
                      <td data-label="Biometric">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: bioSaving[emp._id] ? 'wait' : 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={!!emp.biometricAttendanceEnabled}
                            disabled={!!bioSaving[emp._id]}
                            onChange={() => toggleBiometricAttendance(emp)}
                          />
                          <span style={{ fontSize: '0.82rem', color: emp.biometricAttendanceEnabled ? '#059669' : '#6b7280', fontWeight: 600 }}>
                            {emp.biometricAttendanceEnabled ? 'Required' : 'Off'}
                          </span>
                        </label>
                      </td>
                    )}
                    {canManage && (
                      <td data-label="Action" className="td-actions">
                        <button className="btn-tiny btn-tiny--red" onClick={() => deleteEmployee(emp)}>
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={`pagination-btn ${page === p ? 'pagination-btn--active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
              <span className="pagination-info">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            </div>
          )}
        </>
      )}

      {/* Salary & Bank Details Modal — ACCOUNTS / SUPER_ADMIN */}
      {bankModal && (
        <div className="modal-overlay" onClick={() => setBankModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 16 }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Salary &amp; Bank — {bankModal.emp.name}</h3>
              <button style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--gray-500)' }} onClick={() => setBankModal(null)}>✕</button>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 8 }}>
              Employee ID: <strong>{bankModal.emp.employeeId}</strong> &nbsp;·&nbsp; Role: <strong>{bankModal.emp.role}</strong>
            </p>
            {bankModal.emp.grossSalary > 0 && isAccounts && (
              <div className="alert alert--error" style={{ marginBottom: 12, fontSize: '0.82rem' }}>
                This employee already has salary set (₹{bankModal.emp.grossSalary?.toLocaleString('en-IN')}). Changes will require department head approval.
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Gross Salary (₹)</label>
              <input
                className="form-input" type="number" placeholder="e.g. 30000"
                value={bankModal.salary}
                onChange={e => setBankModal({ ...bankModal, salary: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Bank Account Number</label>
              <input
                className="form-input" placeholder="e.g. 1234567890"
                value={bankModal.accountNo}
                onChange={e => setBankModal({ ...bankModal, accountNo: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">IFSC Code</label>
              <input
                className="form-input" placeholder="e.g. SBIN0001234" maxLength={11}
                value={bankModal.ifsc}
                onChange={e => setBankModal({ ...bankModal, ifsc: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={bankModal.isManagingHead}
                  onChange={e => setBankModal({ ...bankModal, isManagingHead: e.target.checked })}
                  style={{ width: 16, height: 16 }}
                />
                Managing Head (full salary always, no attendance deduction)
              </label>
              <small style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
                When enabled, this employee receives 100% gross salary regardless of attendance.
              </small>
            </div>
            {bankModal.emp.grossSalary > 0 && isAccounts && (
              <div className="form-group">
                <label className="form-label">Reason for Update *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Annual increment, correction..."
                  value={bankModal.reason || ''}
                  onChange={e => setBankModal({ ...bankModal, reason: e.target.value })}
                />
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'flex-end' }}>
              <button className="btn btn--secondary" onClick={() => setBankModal(null)}>Cancel</button>
              <button className="btn btn--primary" onClick={saveBankDetails} disabled={bankSaving}>
                {bankSaving ? 'Saving…' : bankModal.emp.grossSalary > 0 && isAccounts ? 'Submit for Approval' : 'Save Details'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
