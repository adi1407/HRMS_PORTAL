import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import api from './utils/api';

import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CheckInPage   from './pages/CheckInPage';
import SalaryPage    from './pages/SalaryPage';
import EmployeesPage  from './pages/EmployeesPage';
import FaceEnrollPage from './pages/FaceEnrollPage';
import LeavePage      from './pages/LeavePage';
import AttendancePage      from './pages/AttendancePage';
import BranchSettingsPage  from './pages/BranchSettingsPage';
import HolidayPage         from './pages/HolidayPage';
import ResignationPage     from './pages/ResignationPage';
import DocumentVaultPage   from './pages/DocumentVaultPage';
import ExpenseClaimsPage   from './pages/ExpenseClaimsPage';
import DailyTaskPage       from './pages/DailyTaskPage';
import TaskReportsPage     from './pages/TaskReportsPage';
import AnnouncementsPage   from './pages/AnnouncementsPage';
import ProtectedRoute from './components/shared/ProtectedRoute';
import Layout        from './components/shared/Layout';

export default function App() {
  const { setAuth, clearAuth } = useAuthStore();
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    // Try to restore session from refresh token (httpOnly cookie)
    // 8s timeout prevents infinite "Loading HRMS..." on cold Render start
    api.post('/auth/refresh', {}, { timeout: 8000 })
      .then(({ data }) => {
        if (data.accessToken) {
          return api.get('/auth/me').then(({ data: meData }) => {
            setAuth(meData.data, data.accessToken);
          });
        }
      })
      .catch(() => clearAuth())
      .finally(() => setBootstrapping(false));
  }, []);

  if (bootstrapping) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner"></div>
        <p>Loading HRMS...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="checkin"    element={<CheckInPage />} />
          <Route path="salary"     element={<SalaryPage />} />
          <Route path="employees"  element={<ProtectedRoute roles={['HR','DIRECTOR','SUPER_ADMIN','ACCOUNTS']}><EmployeesPage /></ProtectedRoute>} />
          <Route path="employees/:empId/enroll-face" element={<ProtectedRoute roles={['HR','DIRECTOR','SUPER_ADMIN']}><FaceEnrollPage /></ProtectedRoute>} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="leave"      element={<LeavePage />} />
          <Route path="holidays"   element={<HolidayPage />} />
          <Route path="branch-settings" element={<ProtectedRoute roles={['DIRECTOR','SUPER_ADMIN']}><BranchSettingsPage /></ProtectedRoute>} />
          <Route path="resignation"    element={<ResignationPage />} />
          <Route path="documents"      element={<DocumentVaultPage />} />
          <Route path="expense-claims" element={<ExpenseClaimsPage />} />
          <Route path="daily-tasks"   element={<DailyTaskPage />} />
          <Route path="task-reports"  element={<ProtectedRoute roles={['HR','DIRECTOR','SUPER_ADMIN']}><TaskReportsPage /></ProtectedRoute>} />
          <Route path="announcements" element={<ProtectedRoute roles={['HR','DIRECTOR','SUPER_ADMIN']}><AnnouncementsPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
