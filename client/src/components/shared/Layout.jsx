import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import api from '../../utils/api';
import NotificationBell from './NotificationBell';
import {
  LayoutDashboard, Fingerprint, CalendarDays, Leaf, CreditCard,
  Users, Gift, Settings, LogOut, Menu, X, FileText, FolderOpen, Receipt, ClipboardList, BarChart3, Megaphone, LifeBuoy, Package, Rocket, ShieldAlert, Star, ScrollText, Mail, BookOpen, UserCircle,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard',       label: 'Dashboard',       Icon: LayoutDashboard, roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/my-profile',      label: 'My Profile',      Icon: UserCircle,      roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/checkin',         label: 'Check In/Out',    Icon: Fingerprint,     roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/attendance',      label: 'Attendance',      Icon: CalendarDays,    roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/leave',           label: 'Leave',           Icon: Leaf,            roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/salary',          label: 'Salary',          Icon: CreditCard,      roles: ['SUPER_ADMIN','DIRECTOR','ACCOUNTS','EMPLOYEE','HR'] },
  { path: '/employees',       label: 'Employees',       Icon: Users,           roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS'] },
  { path: '/holidays',        label: 'Holidays',        Icon: Gift,            roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/resignation',     label: 'Resignation',     Icon: FileText,        roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/documents',       label: 'Documents',       Icon: FolderOpen,      roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/expense-claims',  label: 'Expense Claims',  Icon: Receipt,         roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/daily-tasks',     label: 'Daily Tasks',      Icon: ClipboardList,   roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/task-reports',    label: 'Task Reports',     Icon: BarChart3,       roles: ['SUPER_ADMIN','DIRECTOR','HR'] },
  { path: '/onboarding',       label: 'Onboarding',       Icon: Rocket,          roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/tickets',          label: 'Help Desk',        Icon: LifeBuoy,        roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/assets',           label: 'Assets',           Icon: Package,         roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/appraisals',       label: 'Appraisals',       Icon: Star,            roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/warnings',         label: 'Warnings',         Icon: ShieldAlert,     roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/policies',         label: 'Policies',          Icon: BookOpen,        roles: ['SUPER_ADMIN','DIRECTOR','HR','ACCOUNTS','EMPLOYEE'] },
  { path: '/announcements',   label: 'Announcements',    Icon: Megaphone,       roles: ['SUPER_ADMIN','DIRECTOR','HR'] },
  { path: '/email-alerts',    label: 'Email Alerts',     Icon: Mail,            roles: ['SUPER_ADMIN','DIRECTOR','HR'] },
  { path: '/audit-log',       label: 'Audit Log',        Icon: ScrollText,      roles: ['SUPER_ADMIN','DIRECTOR'] },
  { path: '/branch-settings', label: 'Office Settings', Icon: Settings,        roles: ['SUPER_ADMIN','DIRECTOR'] },
];

const ROLE_DISPLAY = {
  SUPER_ADMIN: 'Administrator',
  DIRECTOR:    'Director',
  HR:          'HR',
  ACCOUNTS:    'Accounts',
  EMPLOYEE:    'Employee',
};

export default function Layout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    clearAuth();
    navigate('/login');
  };

  const allowed = NAV_ITEMS.filter(item => item.roles.includes(user?.role));

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.png" alt="Sangi" className="sidebar-logo-img" />
            <div className="sidebar-logo-texts">
              <span className="sidebar-logo-text">Sangi</span>
              <span className="sidebar-logo-sub">HRMS Portal</span>
            </div>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user?.name}</p>
            <p className="sidebar-user-role">{ROLE_DISPLAY[user?.role] ?? user?.role}</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {allowed.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sidebar-link-icon"><item.Icon size={16} strokeWidth={2} /></span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={16} strokeWidth={2} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-wrapper">
        <header className="topbar">
          <button className="topbar-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} strokeWidth={2} />
          </button>
          <div className="topbar-brand">
            <img src="/logo.png" alt="Sangi" className="topbar-logo-img" />
            <span className="topbar-title">Sangi</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationBell />
            <div className="topbar-user">{user?.employeeId}</div>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
