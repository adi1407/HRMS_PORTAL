import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { Search, Mail, Phone, Building2, Briefcase, User } from 'lucide-react';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Administrator',
  DIRECTOR: 'Director',
  HR: 'HR',
  ACCOUNTS: 'Accounts',
  EMPLOYEE: 'Employee',
};

const inputSt = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' };
const cardSt = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 14 };

function getInitials(name) {
  if (!name || !name.trim()) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function DirectoryPage() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (deptFilter) params.department = deptFilter;
      if (roleFilter) params.role = roleFilter;
      const { data } = await api.get('/users/directory', { params });
      setEmployees(data.data);
    } catch { setEmployees([]); }
    finally { setLoading(false); }
  }, [search, deptFilter, roleFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/departments').then(({ data }) => setDepartments(data.data || [])).catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Employee Directory</h2>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.88rem' }}>Who’s who — search by name, ID, department or designation</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name, Employee ID, email or designation..."
            style={{ ...inputSt, paddingLeft: 36, margin: 0 }}
          />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ ...inputSt, width: 'auto', minWidth: 160 }}>
          <option value="">All departments</option>
          {departments.filter(d => d.isActive !== false).map(d => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...inputSt, width: 'auto', minWidth: 130 }}>
          <option value="">All roles</option>
          <option value="DIRECTOR">Director</option>
          <option value="HR">HR</option>
          <option value="ACCOUNTS">Accounts</option>
          <option value="EMPLOYEE">Employee</option>
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setViewMode('grid')} style={{
            padding: '8px 14px', borderRadius: 8, border: `1px solid ${viewMode === 'grid' ? '#2563eb' : '#e5e7eb'}`,
            background: viewMode === 'grid' ? '#eff6ff' : '#fff', color: viewMode === 'grid' ? '#2563eb' : '#6b7280',
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
          }}>Grid</button>
          <button onClick={() => setViewMode('list')} style={{
            padding: '8px 14px', borderRadius: 8, border: `1px solid ${viewMode === 'list' ? '#2563eb' : '#e5e7eb'}`,
            background: viewMode === 'list' ? '#eff6ff' : '#fff', color: viewMode === 'list' ? '#2563eb' : '#6b7280',
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
          }}>List</button>
        </div>
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner" /><p>Loading directory...</p></div>
      ) : employees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
          <User size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>No employees match your search.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
          {employees.map(emp => (
            <EmployeeCard key={emp._id} emp={emp} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {employees.map(emp => (
            <EmployeeRow key={emp._id} emp={emp} />
          ))}
        </div>
      )}

      {!loading && employees.length > 0 && (
        <p style={{ marginTop: 16, fontSize: '0.82rem', color: '#9ca3af', textAlign: 'center' }}>
          {employees.length} employee{employees.length !== 1 ? 's' : ''} found
        </p>
      )}
    </div>
  );
}

function EmployeeCard({ emp }) {
  return (
    <div style={{ ...cardSt, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: emp.photoUrl ? 'transparent' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
      }}>
        {emp.photoUrl ? (
          <img src={emp.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{getInitials(emp.name)}</span>
        )}
      </div>
      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>{emp.name}</div>
      <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, marginBottom: 8 }}>{emp.employeeId}</div>
      <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Briefcase size={12} /> {emp.designation || '—'}
      </div>
      <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 8 }}>
        {emp.department?.name || '—'} {emp.branch?.name ? ` • ${emp.branch.name}` : ''}
      </div>
      <div style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#374151', fontWeight: 600, marginBottom: 10 }}>
        {ROLE_LABELS[emp.role] || emp.role}
      </div>
      <div style={{ width: '100%', borderTop: '1px solid #f3f4f6', paddingTop: 10, marginTop: 'auto' }}>
        {emp.email && (
          <a href={`mailto:${emp.email}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', marginBottom: 4 }}>
            <Mail size={12} /> {emp.email}
          </a>
        )}
        {emp.phone && (
          <a href={`tel:${emp.phone}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none' }}>
            <Phone size={12} /> {emp.phone}
          </a>
        )}
        {!emp.email && !emp.phone && <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>No contact</span>}
      </div>
    </div>
  );
}

function EmployeeRow({ emp }) {
  return (
    <div style={{ ...cardSt, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', marginBottom: 0, flexWrap: 'wrap' }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: emp.photoUrl ? 'transparent' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {emp.photoUrl ? (
          <img src={emp.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{getInitials(emp.name)}</span>
        )}
      </div>
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{emp.name} <span style={{ color: '#6b7280', fontWeight: 500, fontSize: '0.85rem' }}>({emp.employeeId})</span></div>
        <div style={{ fontSize: '0.82rem', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Briefcase size={12} /> {emp.designation || '—'}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Building2 size={12} /> {emp.department?.name || '—'}</span>
          <span style={{ padding: '1px 6px', borderRadius: 6, background: '#f3f4f6', fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>{ROLE_LABELS[emp.role] || emp.role}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, minWidth: 0 }}>
        {emp.email && <a href={`mailto:${emp.email}`} style={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} /> {emp.email}</a>}
        {emp.phone && <a href={`tel:${emp.phone}`} style={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} /> {emp.phone}</a>}
      </div>
    </div>
  );
}
