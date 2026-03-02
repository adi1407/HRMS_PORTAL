import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import useAuthStore from '../store/authStore';

const HOLIDAY_TYPES = ['NATIONAL', 'REGIONAL', 'COMPANY', 'OPTIONAL'];
const TYPE_COLORS   = { NATIONAL: '#2563eb', REGIONAL: '#7c3aed', COMPANY: '#059669', OPTIONAL: '#d97706' };

const fmt = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

const isUpcoming = (dateStr) => new Date(dateStr) >= new Date(new Date().setHours(0,0,0,0));
const isPast     = (dateStr) => new Date(dateStr) <  new Date(new Date().setHours(0,0,0,0));

export default function HolidayPage() {
  const { user } = useAuthStore();
  const canManage = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);

  const currentYear = new Date().getFullYear();
  const [year,     setYear]     = useState(currentYear);
  const [holidays, setHolidays] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({ name: '', date: '', type: 'NATIONAL' });

  useEffect(() => { fetchHolidays(); }, [year]);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/holidays?year=${year}`);
      setHolidays(data.data || []);
    } catch { setHolidays([]); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.date) { setMsg('❌ Holiday name and date are required.'); return; }
    setSaving(true); setMsg('');
    try {
      const { data } = await api.post('/holidays', form);
      setMsg(`✅ "${data.data.name}" announced! Employees will be auto-marked present.`);
      setShowForm(false);
      setForm({ name: '', date: '', type: 'NATIONAL' });
      fetchHolidays();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to add holiday.'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (h) => {
    if (!window.confirm(`Remove "${h.name}" (${fmt(h.date)})? This will not undo already-marked attendance.`)) return;
    try {
      await api.delete(`/holidays/${h._id}`);
      setMsg(`✅ "${h.name}" removed.`);
      fetchHolidays();
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.message || 'Failed to remove.'));
    }
  };

  const upcoming = holidays.filter(h => isUpcoming(h.date));
  const past     = holidays.filter(h => isPast(h.date));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Holidays</h1>
          <p className="page-subtitle">
            {canManage
              ? 'Announce holidays — all staff are automatically marked present.'
              : 'View declared holidays for the year.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Year selector */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn btn--secondary" style={{ padding: '6px 12px' }}
              onClick={() => setYear(y => y - 1)}>◀</button>
            <span style={{ fontWeight: 600, fontSize: '1rem', minWidth: 48, textAlign: 'center' }}>{year}</span>
            <button className="btn btn--secondary" style={{ padding: '6px 12px' }}
              onClick={() => setYear(y => y + 1)} disabled={year >= currentYear + 1}>▶</button>
          </div>
          {canManage && (
            <button className="btn btn--primary" onClick={() => { setShowForm(f => !f); setMsg(''); }}>
              {showForm ? '✕ Cancel' : '+ Announce Holiday'}
            </button>
          )}
        </div>
      </div>

      {msg && <div className={`alert ${msg.startsWith('✅') ? 'alert--success' : 'alert--error'}`}>{msg}</div>}

      {/* Add Holiday Form */}
      {showForm && canManage && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="card-title">Announce New Holiday</h3>
          <form onSubmit={handleAdd} className="emp-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Holiday Name *</label>
                <input className="form-input" required placeholder="e.g. Republic Day"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input className="form-input" type="date" required
                  value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}>
                  {HOLIDAY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ padding: '10px 14px', fontSize: '0.82rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#166534', width: '100%' }}>
                  📢 All employees, HR & Accounts will be auto-marked <strong>present (Holiday)</strong> for this date.
                </div>
              </div>
            </div>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Announcing...' : 'Announce Holiday'}
            </button>
          </form>
        </div>
      )}

      {loading && <div className="page-loading">Loading holidays...</div>}

      {!loading && (
        <>
          {/* Upcoming / current year upcoming */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>
              Upcoming Holidays {year === currentYear ? '(This Year)' : `— ${year}`}
            </h3>
            {upcoming.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No upcoming holidays for {year}.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcoming.map(h => (
                  <div key={h._id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 10,
                    background: '#f8fafc', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 8
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                        background: TYPE_COLORS[h.type] || '#6b7280'
                      }} />
                      <div>
                        <p style={{ fontWeight: 600, margin: 0 }}>{h.name}</p>
                        <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0 }}>{fmt(h.date)}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: '0.75rem', padding: '2px 10px', borderRadius: 99,
                        background: TYPE_COLORS[h.type] + '1a', color: TYPE_COLORS[h.type],
                        fontWeight: 600, border: `1px solid ${TYPE_COLORS[h.type]}40`
                      }}>{h.type}</span>
                      {canManage && (
                        <button className="btn-tiny btn-tiny--red" onClick={() => handleDelete(h)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past holidays */}
          {past.length > 0 && (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16, color: '#6b7280' }}>
                Past Holidays — {year}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {past.map(h => (
                  <div key={h._id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', borderRadius: 10,
                    background: '#f9fafb', border: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 8,
                    opacity: 0.75
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: '#9ca3af'
                      }} />
                      <div>
                        <p style={{ fontWeight: 500, margin: 0, fontSize: '0.9rem' }}>{h.name}</p>
                        <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0 }}>{fmt(h.date)}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{h.type}</span>
                      {canManage && (
                        <button className="btn-tiny btn-tiny--red" style={{ opacity: 0.7 }}
                          onClick={() => handleDelete(h)}>Remove</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
