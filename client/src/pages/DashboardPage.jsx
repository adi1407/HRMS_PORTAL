import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../utils/api';
import {
  Users, UserCheck, Clock, UserX, Briefcase, HelpCircle,
  CheckCircle2, XCircle, ClipboardList, Timer, CalendarDays,
  ChevronLeft, ChevronRight, Megaphone, X, AlertTriangle, Info,
  TrendingUp, ArrowUpRight, Sun, Moon, Sparkles, FileText,
  Building2, BadgeCheck, Activity, Shield,
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

const PRIORITY_STYLE = {
  URGENT:    { bg: 'linear-gradient(135deg, #fef2f2, #fee2e2)', border: '#fca5a5', icon: AlertTriangle, iconColor: '#dc2626', label: '#991b1b' },
  IMPORTANT: { bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '#fcd34d', icon: Megaphone, iconColor: '#d97706', label: '#92400e' },
  NORMAL:    { bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '#93c5fd', icon: Info, iconColor: '#2563eb', label: '#1e40af' },
};

const ROLE_ICON = { EMPLOYEE: Users, HR: Shield, ACCOUNTS: FileText, DIRECTOR: Building2, SUPER_ADMIN: Shield };
const ROLE_COLOR = { EMPLOYEE: '#2563eb', HR: '#7c3aed', ACCOUNTS: '#0891b2', DIRECTOR: '#059669', SUPER_ADMIN: '#dc2626' };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good Morning', icon: Sun };
  if (h < 17) return { text: 'Good Afternoon', icon: Sun };
  return { text: 'Good Evening', icon: Moon };
}

function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dismissed_ann') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    api.get('/announcements/active')
      .then(({ data }) => setAnnouncements(data.data || []))
      .catch(() => {});
  }, []);

  const dismiss = (id) => {
    const updated = [...dismissed, id];
    setDismissed(updated);
    sessionStorage.setItem('dismissed_ann', JSON.stringify(updated));
  };

  const visible = announcements.filter(a => !dismissed.includes(a._id));
  if (visible.length === 0) return null;

  return (
    <div className="db-announcements">
      {visible.map(ann => {
        const style = PRIORITY_STYLE[ann.priority] || PRIORITY_STYLE.NORMAL;
        const IconComp = style.icon;
        return (
          <div key={ann._id} className="db-ann-card" style={{ background: style.bg, borderColor: style.border }}>
            <div className="db-ann-icon">
              <IconComp size={18} color={style.iconColor} strokeWidth={2.2} />
            </div>
            <div className="db-ann-body">
              <div className="db-ann-title" style={{ color: style.label }}>
                {ann.title}
                {ann.priority === 'URGENT' && <span className="announcement-pulse" />}
              </div>
              <div className="db-ann-text">{ann.content}</div>
              <div className="db-ann-meta">
                By {ann.createdBy?.name} &middot; {new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {ann.audience !== 'ALL' && (
                  <> &middot; {ann.audience === 'DEPARTMENT' ? ann.department?.name : ann.branch?.name}</>
                )}
              </div>
            </div>
            <button className="db-ann-close" onClick={() => dismiss(ann._id)} title="Dismiss">
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AttendanceCalendar({ records, month, year, holidays = [], onDayClick }) {
  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const holidayByKey = {};
  holidays.forEach((h) => {
    const d = new Date(h.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    holidayByKey[key] = h.name || 'Holiday';
  });

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
          const isHol    = holidayByKey[key] != null;
          const holName  = holidayByKey[key];

          let colorCls = '';
          let titleStr = '';

          if (status) {
            colorCls = `att-cal-cell--${CELL_COLOR[status] || 'other'}`;
            titleStr = status.replace(/_/g, ' ');
          } else if (isSunday) {
            colorCls = 'att-cal-cell--weekoff';
            titleStr = 'Sunday — Weekly off';
          } else if (isHol) {
            colorCls = 'att-cal-cell--holiday';
            titleStr = holName;
          } else if (isFuture) {
            colorCls = 'att-cal-cell--future';
          } else if (isToday) {
            titleStr = 'Today';
          } else {
            colorCls = 'att-cal-cell--no-record';
            titleStr = 'No record';
          }

          const interactive = typeof onDayClick === 'function';
          const handleClick = interactive
            ? () => onDayClick({ key, day, month, year, isSunday, isHoliday: isHol, holidayName: holName, status })
            : undefined;

          return (
            <div
              key={key}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={handleClick}
              onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick?.(); } } : undefined}
              className={`att-cal-cell ${colorCls}${isToday ? ' att-cal-cell--today' : ''}${interactive ? ' att-cal-cell--interactive' : ''}`}
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

function QuickAction({ icon: Icon, label, href, color }) {
  return (
    <a href={href} className="db-quick-action" style={{ '--qa-color': color }}>
      <div className="db-qa-icon"><Icon size={18} strokeWidth={2} /></div>
      <span className="db-qa-label">{label}</span>
      <ArrowUpRight size={14} className="db-qa-arrow" />
    </a>
  );
}

function AdminStatCard({ icon: Icon, value, label, color, trend }) {
  return (
    <div className="db-stat-card" style={{ '--sc-color': color }}>
      <div className="db-stat-top">
        <div className="db-stat-icon"><Icon size={20} strokeWidth={2} /></div>
        {trend !== undefined && (
          <span className={`db-stat-trend ${trend >= 0 ? 'db-stat-trend--up' : 'db-stat-trend--down'}`}>
            <TrendingUp size={12} /> {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="db-stat-value">{value}</div>
      <div className="db-stat-label">{label}</div>
    </div>
  );
}

function EmployeeSection({ user }) {
  const navigate = useNavigate();
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
      api.get(`/holidays?year=${calYear}`),
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

  const handleCalendarDayClick = ({ key, isSunday, isHoliday, holidayName, status }) => {
    if (status === 'HOLIDAY' || status === 'WEEKLY_OFF') {
      window.alert(status === 'WEEKLY_OFF' ? 'Weekly off — no leave needed for this day.' : 'This day is marked as a holiday on your calendar.');
      return;
    }
    if (isSunday) {
      window.alert('Sunday — weekly off. Leave does not apply to this day.');
      return;
    }
    if (isHoliday) {
      window.alert(`Holiday: ${holidayName || 'Company holiday'}`);
      return;
    }
    navigate(`/leaves?from=${key}&to=${key}`);
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

  const totalWorking = present + halfDay + absent + onLeave;
  const attendancePct = totalWorking > 0 ? Math.round(((present + halfDay * 0.5) / totalWorking) * 100) : 0;

  return (
    <>
      {/* My stats mini cards */}
      <div className="db-emp-stats">
        <div className="db-emp-stat" style={{ '--es-color': '#059669' }}>
          <div className="db-emp-stat-icon"><UserCheck size={18} /></div>
          <div className="db-emp-stat-num">{present}</div>
          <div className="db-emp-stat-label">Present</div>
        </div>
        <div className="db-emp-stat" style={{ '--es-color': '#d97706' }}>
          <div className="db-emp-stat-icon"><Clock size={18} /></div>
          <div className="db-emp-stat-num">{halfDay}</div>
          <div className="db-emp-stat-label">Half Day</div>
        </div>
        <div className="db-emp-stat" style={{ '--es-color': '#dc2626' }}>
          <div className="db-emp-stat-icon"><UserX size={18} /></div>
          <div className="db-emp-stat-num">{absent}</div>
          <div className="db-emp-stat-label">Absent</div>
        </div>
        <div className="db-emp-stat" style={{ '--es-color': '#2563eb' }}>
          <div className="db-emp-stat-icon"><Briefcase size={18} /></div>
          <div className="db-emp-stat-num">{onLeave}</div>
          <div className="db-emp-stat-label">On Leave</div>
        </div>
        <div className="db-emp-stat" style={{ '--es-color': '#7c3aed' }}>
          <div className="db-emp-stat-icon"><ClipboardList size={18} /></div>
          <div className="db-emp-stat-num">{leaveReqCount}</div>
          <div className="db-emp-stat-label">Leave Req</div>
        </div>
      </div>

      {/* Two-column: Today + My Details */}
      <div className="db-emp-grid">
        <div className="db-card db-today-card">
          <div className="db-card-header">
            <h3>Today's Status</h3>
            {attendancePct > 0 && (
              <div className="db-attendance-ring" title={`${attendancePct}% attendance this month`}>
                <svg viewBox="0 0 36 36" className="db-ring-svg">
                  <path className="db-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="db-ring-fg" strokeDasharray={`${attendancePct}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="db-ring-text">{attendancePct}%</span>
              </div>
            )}
          </div>
          {todayRecord ? (
            <div className="db-today-body">
              <div className={`db-today-badge db-today-badge--${(todayRecord.displayStatus || '').toLowerCase().replace(/_/g,'-')}`}>
                {todayRecord.displayStatus?.replace(/_/g, ' ')}
              </div>
              <div className="db-today-times">
                {todayRecord.checkInTime && (
                  <div className="db-time-row">
                    <span className="db-time-label"><CheckCircle2 size={14} color="#059669" /> Check In</span>
                    <span className="db-time-val">{todayRecord.checkInTime}</span>
                  </div>
                )}
                {todayRecord.checkOutTime && (
                  <div className="db-time-row">
                    <span className="db-time-label"><XCircle size={14} color="#dc2626" /> Check Out</span>
                    <span className="db-time-val">{todayRecord.checkOutTime}</span>
                  </div>
                )}
                {todayRecord.workingHours > 0 && (
                  <div className="db-time-row">
                    <span className="db-time-label"><Timer size={14} color="#2563eb" /> Hours</span>
                    <span className="db-time-val db-time-val--accent">{todayRecord.workingHours}h</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="db-today-empty">
              <Activity size={32} color="#94a3b8" strokeWidth={1.5} />
              <p>No attendance record for today</p>
              <a href="/checkin" className="db-btn-primary">Check In Now</a>
            </div>
          )}
        </div>

        <div className="db-card db-info-card">
          <div className="db-card-header"><h3>My Details</h3></div>
          <div className="db-info-rows">
            <div className="db-info-row">
              <span className="db-info-label">Employee ID</span>
              <span className="db-info-val">{user?.employeeId}</span>
            </div>
            <div className="db-info-row">
              <span className="db-info-label">Designation</span>
              <span className="db-info-val">{user?.designation || '—'}</span>
            </div>
            <div className="db-info-row">
              <span className="db-info-label">Department</span>
              <span className="db-info-val">{user?.department?.name || '—'}</span>
            </div>
            <div className="db-info-row">
              <span className="db-info-label">Branch</span>
              <span className="db-info-val">{user?.branch?.name || '—'}</span>
            </div>
            <div className="db-info-row">
              <span className="db-info-label">Face Enrolled</span>
              <span className="db-info-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {user?.faceEnrolled
                  ? <><BadgeCheck size={15} color="#059669" /> Yes</>
                  : <><XCircle size={15} color="#dc2626" /> No — Contact HR</>}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="db-card">
        <div className="db-card-header" style={{ marginBottom: 12 }}>
          <h3>Attendance — {MONTH_NAMES[calMonth - 1]} {calYear}</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="db-nav-btn" onClick={handlePrevMonth}><ChevronLeft size={16} /></button>
            <button className="db-nav-btn" onClick={handleNextMonth} disabled={isCurrentMonth}><ChevronRight size={16} /></button>
          </div>
        </div>
        <AttendanceCalendar
          records={monthRecords}
          month={calMonth}
          year={calYear}
          holidays={allHolidays}
          onDayClick={handleCalendarDayClick}
        />
        <p style={{ margin: '12px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
          Tip: Click a date to apply for leave. Sundays and company holidays are shown in green — click to see the holiday name.
        </p>
      </div>

      {/* Upcoming holidays */}
      {holidays.length > 0 && (
        <div className="db-card">
          <div className="db-card-header"><h3>Upcoming Holidays</h3></div>
          <div className="db-holiday-list">
            {holidays.map(h => (
              <div key={h._id} className="db-holiday-row">
                <div className="db-holiday-icon"><CalendarDays size={16} /></div>
                <div className="db-holiday-info">
                  <span className="db-holiday-name">{h.name}</span>
                  <span className="db-holiday-date">
                    {new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })}
                  </span>
                </div>
                <span className="db-holiday-type">{h.type}</span>
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
  const greeting = getGreeting();

  const isAdminRole = ['SUPER_ADMIN', 'DIRECTOR', 'HR'].includes(user?.role);
  const showEmployeeSection = ['HR', 'ACCOUNTS', 'EMPLOYEE', 'DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);
  const canExport = user?.isManagingHead || ['DIRECTOR', 'SUPER_ADMIN'].includes(user?.role);

  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(isAdminRole);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isAdminRole) return;
    api.get('/analytics/dashboard')
      .then(({ data }) => setStats(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdminRole]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/export/all', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }));
      const now = new Date();
      const tag = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `HRMS_Export_${tag}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page db-page">
      {/* Hero header */}
      <div className="db-hero">
        <div className="db-hero-content">
          <div className="db-hero-text">
            <h1 className="db-hero-greeting">
              {greeting.text}, <strong>{user?.name?.split(' ')[0]}</strong>
            </h1>
            <p className="db-hero-date">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="db-hero-actions">
            {canExport && (
              <button className="db-btn-export" onClick={handleExport} disabled={exporting}>
                <FileText size={16} />
                {exporting ? 'Exporting...' : 'Export Data'}
              </button>
            )}
          </div>
        </div>
      </div>

      <AnnouncementBanner />

      {/* Quick actions */}
      <div className="db-quick-actions">
        <QuickAction icon={CheckCircle2} label="Check In" href="/checkin" color="#059669" />
        <QuickAction icon={ClipboardList} label="Apply Leave" href="/leaves" color="#2563eb" />
        <QuickAction icon={FileText} label="My Salary" href="/salary" color="#7c3aed" />
        <QuickAction icon={CalendarDays} label="Attendance" href="/attendance" color="#d97706" />
      </div>

      {/* Admin stats */}
      {isAdminRole && (
        <>
          {loading && <div className="page-loading">Loading dashboard…</div>}
          {!loading && stats && (
            <>
              <div className="db-section-title">
                <Sparkles size={18} /> Organization Overview
              </div>
              <div className="db-admin-stats">
                <AdminStatCard icon={Users} value={stats.totalEmployees} label="Total Staff" color="#2563eb" />
                <AdminStatCard icon={UserCheck} value={stats.presentToday} label="Present Today" color="#059669" />
                <AdminStatCard icon={Clock} value={stats.halfDayToday} label="Half Day" color="#d97706" />
                <AdminStatCard icon={UserX} value={stats.absentToday} label="Absent Today" color="#dc2626" />
                <AdminStatCard icon={Briefcase} value={stats.onLeaveToday} label="On Leave" color="#7c3aed" />
                <AdminStatCard icon={HelpCircle} value={stats.notMarkedYet} label="Not Marked" color="#64748b" />
              </div>

              {/* Role breakdown */}
              {stats.roleBreakdown && Object.keys(stats.roleBreakdown).length > 0 && (
                <div className="db-card db-role-card">
                  <div className="db-card-header"><h3>Staff by Role</h3></div>
                  <div className="db-role-grid">
                    {Object.entries(stats.roleBreakdown).map(([role, count]) => {
                      const RoleIcon = ROLE_ICON[role] || Users;
                      const color = ROLE_COLOR[role] || '#64748b';
                      return (
                        <div key={role} className="db-role-chip" style={{ '--rc-color': color }}>
                          <div className="db-role-icon"><RoleIcon size={16} /></div>
                          <div className="db-role-count">{count}</div>
                          <div className="db-role-name">{role.replace(/_/g, ' ')}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Admin holidays */}
              {stats.upcomingHolidays?.length > 0 && (
                <div className="db-card">
                  <div className="db-card-header"><h3>Upcoming Holidays</h3></div>
                  <div className="db-holiday-list">
                    {stats.upcomingHolidays.map(h => (
                      <div key={h._id} className="db-holiday-row">
                        <div className="db-holiday-icon"><CalendarDays size={16} /></div>
                        <div className="db-holiday-info">
                          <span className="db-holiday-name">{h.name}</span>
                          <span className="db-holiday-date">
                            {new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })}
                          </span>
                        </div>
                        <span className="db-holiday-type">{h.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {showEmployeeSection && (
            <div className="db-section-divider">
              <div className="db-section-title"><Activity size={18} /> My Attendance & Leave</div>
              <EmployeeSection user={user} />
            </div>
          )}
        </>
      )}

      {!isAdminRole && <EmployeeSection user={user} />}
    </div>
  );
}
