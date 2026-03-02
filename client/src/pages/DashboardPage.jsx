import React, { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore';
import api from '../utils/api';
import {
  Users, UserCheck, Clock, UserX, Briefcase, HelpCircle,
  CheckCircle2, XCircle, ClipboardList, Timer, CalendarDays,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const CELL_COLOR = {
  FULL_DAY:         'present',
  HALF_DAY:         'half',
  HALF_DAY_DISPLAY: 'half',
  ABSENT:           'absent',
  ON_LEAVE:         'leave',
  HOLIDAY:          'holiday',
  WEEKLY_OFF:       'weekoff',
};

function AttendanceCalendar({ records, month, year, holidays = [] }) {
  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const holidaySet = new Set(holidays.map(h => {
    const d = new Date(h.date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }));

  const statusMap = {};
  records.forEach(r => {
    const d   = new Date(r.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    statusMap[key] = (r.status === 'WEEKLY_OFF' || r.status === 'HOLIDAY')
      ? r.status
      : (r.displayStatus || r.status);
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay();
  const offset      = (firstDay + 6) % 7;

  const cells = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="att-calendar">
      <div className="att-cal-weekdays">
        {WEEKDAYS.map(w => <div key={w} className="att-cal-wday">{w}</div>)}
      </div>
      <div className="att-cal-grid">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="att-cal-cell att-cal-cell--empty" />;

          const key      = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const status   = statusMap[key];
          const isToday  = key === todayStr;
          const isFuture = new Date(year, month - 1, day) > today;
          const dow      = new Date(year, month - 1, day).getDay();
          const isSunday = dow === 0;
          const isHol    = holidaySet.has(key);

          let colorCls = '';
          let titleStr = '';

          if (status) {
            colorCls = `att-cal-cell--${CELL_COLOR[status] || 'other'}`;
            titleStr = status.replace(/_/g, ' ');
          } else if (isSunday) {
            colorCls = 'att-cal-cell--weekoff';
            titleStr = 'Weekly Off';
          } else if (isHol) {
            colorCls = 'att-cal-cell--holiday';
            titleStr = 'Holiday';
          } else if (isFuture) {
            colorCls = 'att-cal-cell--future';
          } else if (isToday) {
            titleStr = 'Today';
          } else {
            colorCls = 'att-cal-cell--no-record';
            titleStr = 'No record';
          }

          return (
            <div
              key={key}
              className={`att-cal-cell ${colorCls}${isToday ? ' att-cal-cell--today' : ''}`}
              title={titleStr}
            >
              <span className="att-cal-num">{day}</span>
            </div>
          );
        })}
      </div>
      <div className="att-cal-legend">
        {[
          { cls: 'present',   label: 'Full Day' },
          { cls: 'half',      label: 'Half Day' },
          { cls: 'absent',    label: 'Absent' },
          { cls: 'leave',     label: 'On Leave' },
          { cls: 'holiday',   label: 'Holiday / Sunday' },
          { cls: 'no-record', label: 'No Record' },
          { cls: 'future',    label: 'Upcoming' },
        ].map(({ cls, label }) => (
          <span key={cls} className="att-cal-legend-item">
            <span className={`att-cal-legend-dot att-cal-legend-dot--${cls}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Reusable personal attendance + leave section (used by EMPLOYEE, ACCOUNTS, and HR)
function EmployeeSection({ user }) {
  const nowMonth = new Date().getMonth() + 1;
  const nowYear  = new Date().getFullYear();
  const [calMonth, setCalMonth] = useState(nowMonth);
  const [calYear,  setCalYear]  = useState(nowYear);
  const [todayRecord,  setTodayRecord]  = useState(null);
  const [monthRecords, setMonthRecords] = useState([]);
  const [leaves,       setLeaves]       = useState([]);
  const [holidays,     setHolidays]     = useState([]);
  const [allHolidays,  setAllHolidays]  = useState([]);
  const [loading,      setLoading]      = useState(true);

  const isCurrentMonth = calMonth === nowMonth && calYear === nowYear;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/attendance/today'),
      api.get(`/attendance/my?month=${calMonth}&year=${calYear}`),
      api.get('/leaves/my'),
      api.get(`/holidays?year=${nowYear}`),
    ]).then(([todayRes, monthRes, leaveRes, holRes]) => {
      setTodayRecord(todayRes.data.data);
      setMonthRecords(monthRes.data.data || []);
      setLeaves(leaveRes.data.data || []);
      const holAll = holRes.data.data || [];
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      setAllHolidays(holAll);
      setHolidays(holAll.filter(h => new Date(h.date) >= todayStart).slice(0, 5));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [calMonth, calYear]);

  const handlePrevMonth = () => {
    if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (isCurrentMonth) return;
    if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const present       = monthRecords.filter(r => r.displayStatus === 'FULL_DAY').length;
  const halfDay       = monthRecords.filter(r => r.displayStatus === 'HALF_DAY').length;
  const absent        = monthRecords.filter(r => r.displayStatus === 'ABSENT').length;
  const onLeave       = monthRecords.filter(r => r.displayStatus === 'ON_LEAVE').length;
  const leaveReqCount = leaves.filter(l => {
    const d = new Date(l.fromDate);
    return d.getMonth() + 1 === calMonth && d.getFullYear() === calYear;
  }).length;

  if (loading) return <div className="page-loading">Loading your attendance…</div>;

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card stat-card--green">
          <div className="stat-card-icon"><UserCheck size={22} strokeWidth={2} /></div>
          <div className="stat-card-value">{present}</div>
          <div className="stat-card-label">Present Days</div>
        </div>
        <div className="stat-card stat-card--yellow">
          <div className="stat-card-icon"><Clock size={22} strokeWidth={2} /></div>
          <div className="stat-card-value">{halfDay}</div>
          <div className="stat-card-label">Half Days</div>
        </div>
        <div className="stat-card stat-card--red">
          <div className="stat-card-icon"><UserX size={22} strokeWidth={2} /></div>
          <div className="stat-card-value">{absent}</div>
          <div className="stat-card-label">Absent</div>
        </div>
        <div className="stat-card stat-card--blue">
          <div className="stat-card-icon"><Briefcase size={22} strokeWidth={2} /></div>
          <div className="stat-card-value">{onLeave}</div>
          <div className="stat-card-label">On Leave</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-card-icon"><ClipboardList size={22} strokeWidth={2} /></div>
          <div className="stat-card-value">{leaveReqCount}</div>
          <div className="stat-card-label">Leave Requests</div>
        </div>
      </div>

      <div className="card">
        <div className="att-cal-header">
          <h3 className="card-title" style={{ margin: 0 }}>
            Attendance — {MONTH_NAMES[calMonth - 1]} {calYear}
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn--secondary" style={{ padding: '5px 10px' }} onClick={handlePrevMonth}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn--secondary" style={{ padding: '5px 10px' }} onClick={handleNextMonth} disabled={isCurrentMonth}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <AttendanceCalendar records={monthRecords} month={calMonth} year={calYear} holidays={allHolidays} />
      </div>

      <div className="dashboard-employee">
        <div className="today-card">
          <h2 className="today-card-title">Today's Status</h2>
          {todayRecord ? (
            <div className="today-status">
              <div className={`status-badge status-badge--${(todayRecord.displayStatus || '').toLowerCase().replace(/_/g,'-')}`}>
                {todayRecord.displayStatus?.replace(/_/g, ' ')}
              </div>
              <div className="today-times">
                {todayRecord.checkInTime && (
                  <div className="today-time-item">
                    <span className="today-time-label">Check In</span>
                    <span className="today-time-value today-time-checkin">
                      <CheckCircle2 size={13} strokeWidth={2.5} /> {todayRecord.checkInTime}
                    </span>
                  </div>
                )}
                {todayRecord.checkOutTime && (
                  <div className="today-time-item">
                    <span className="today-time-label">Check Out</span>
                    <span className="today-time-value today-time-checkout">
                      <XCircle size={13} strokeWidth={2.5} /> {todayRecord.checkOutTime}
                    </span>
                  </div>
                )}
                {todayRecord.workingHours > 0 && (
                  <div className="today-time-item">
                    <span className="today-time-label">Hours Worked</span>
                    <span className="today-time-value">
                      <Timer size={13} strokeWidth={2.5} /> {todayRecord.workingHours}h
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="today-empty">
              <p>No attendance record for today.</p>
              <a href="/checkin" className="btn btn--primary">Check In Now</a>
            </div>
          )}
        </div>

        <div className="employee-info-card">
          <h3>My Details</h3>
          <div className="info-row"><span>Employee ID</span><strong>{user?.employeeId}</strong></div>
          <div className="info-row"><span>Designation</span><strong>{user?.designation || '—'}</strong></div>
          <div className="info-row"><span>Department</span><strong>{user?.department?.name || '—'}</strong></div>
          <div className="info-row"><span>Branch</span><strong>{user?.branch?.name || '—'}</strong></div>
          <div className="info-row">
            <span>Face Enrolled</span>
            <strong style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {user?.faceEnrolled
                ? <><CheckCircle2 size={14} color="#059669" strokeWidth={2.5} /> Yes</>
                : <><XCircle size={14} color="#dc2626" strokeWidth={2.5} /> No — Contact HR</>}
            </strong>
          </div>
        </div>
      </div>

      {holidays.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3 className="card-title" style={{ marginBottom: 14 }}>Upcoming Holidays</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {holidays.map(h => (
              <div key={h._id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CalendarDays size={16} color="#059669" />
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{h.name}</p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>
                      {new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>{h.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  // Who sees the admin stats panel
  const isAdminRole = ['SUPER_ADMIN', 'DIRECTOR', 'HR'].includes(user?.role);
  // HR sees both admin stats AND their own personal attendance section
  const showEmployeeSection = ['HR', 'ACCOUNTS', 'EMPLOYEE'].includes(user?.role);

  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(isAdminRole);

  useEffect(() => {
    if (!isAdminRole) return;
    api.get('/analytics/dashboard')
      .then(({ data }) => setStats(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdminRole]);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Welcome back, <strong>{user?.name}</strong>!
          &nbsp;—&nbsp;{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Admin stats section — SUPER_ADMIN, DIRECTOR, HR */}
      {isAdminRole && (
        <>
          {loading && <div className="page-loading">Loading dashboard…</div>}
          {!loading && stats && (
            <>
              <div className="stats-grid">
                <div className="stat-card stat-card--blue">
                  <div className="stat-card-icon"><Users size={22} strokeWidth={2} /></div>
                  <div className="stat-card-value">{stats.totalEmployees}</div>
                  <div className="stat-card-label">Total Staff</div>
                </div>
                <div className="stat-card stat-card--green">
                  <div className="stat-card-icon"><UserCheck size={22} strokeWidth={2} /></div>
                  <div className="stat-card-value">{stats.presentToday}</div>
                  <div className="stat-card-label">Present Today</div>
                </div>
                <div className="stat-card stat-card--yellow">
                  <div className="stat-card-icon"><Clock size={22} strokeWidth={2} /></div>
                  <div className="stat-card-value">{stats.halfDayToday}</div>
                  <div className="stat-card-label">Half Day</div>
                </div>
                <div className="stat-card stat-card--red">
                  <div className="stat-card-icon"><UserX size={22} strokeWidth={2} /></div>
                  <div className="stat-card-value">{stats.absentToday}</div>
                  <div className="stat-card-label">Absent Today</div>
                </div>
                <div className="stat-card stat-card--purple">
                  <div className="stat-card-icon"><Briefcase size={22} strokeWidth={2} /></div>
                  <div className="stat-card-value">{stats.onLeaveToday}</div>
                  <div className="stat-card-label">On Leave</div>
                </div>
                <div className="stat-card stat-card--gray">
                  <div className="stat-card-icon"><HelpCircle size={22} strokeWidth={2} /></div>
                  <div className="stat-card-value">{stats.notMarkedYet}</div>
                  <div className="stat-card-label">Not Marked Yet</div>
                </div>
              </div>

              {stats.roleBreakdown && Object.keys(stats.roleBreakdown).length > 0 && (
                <div className="card" style={{ marginTop: 20, marginBottom: 20 }}>
                  <h3 className="card-title" style={{ marginBottom: 14 }}>Staff Overview</h3>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {Object.entries(stats.roleBreakdown).map(([role, count]) => (
                      <div key={role} style={{
                        padding: '10px 20px', borderRadius: 10, background: '#f8fafc',
                        border: '1px solid #e2e8f0', textAlign: 'center', minWidth: 90
                      }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{count}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2, fontWeight: 500 }}>{role}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.upcomingHolidays?.length > 0 && (
                <div className="card" style={{ marginBottom: 24 }}>
                  <h3 className="card-title" style={{ marginBottom: 14 }}>Upcoming Holidays</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {stats.upcomingHolidays.map(h => (
                      <div key={h._id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <CalendarDays size={16} color="#059669" />
                          <div>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{h.name}</p>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>
                              {new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })}
                            </p>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>{h.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* HR also sees their own attendance section below admin stats */}
          {showEmployeeSection && (
            <div style={{ marginTop: 4 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid #e2e8f0' }}>
                My Attendance &amp; Leave
              </h2>
              <EmployeeSection user={user} />
            </div>
          )}
        </>
      )}

      {/* Employee / Accounts — only their own personal section */}
      {!isAdminRole && <EmployeeSection user={user} />}
    </div>
  );
}
