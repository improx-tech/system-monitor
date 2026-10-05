import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { LiveGrid } from './pages/LiveGrid';
import { Employees } from './pages/Employees';
import { Screenshots } from './pages/Screenshots';
import { Timeline } from './pages/Timeline';
import { AppAnalytics } from './pages/AppAnalytics';
import { WebAnalytics } from './pages/WebAnalytics';
import { Timesheets } from './pages/Timesheets';
import { Settings } from './pages/Settings';
import { EmployeePortal } from './pages/EmployeePortal';

const ProtectedLayout: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isEmployee = user.role === 'EMPLOYEE';

  return (
    <SocketProvider>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            {isEmployee ? (
              <Routes>
                <Route path="/portal" element={<EmployeePortal />} />
                <Route path="*" element={<Navigate to="/portal" replace />} />
              </Routes>
            ) : (
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/realtime" element={<LiveGrid />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/screenshots" element={<Screenshots />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="/analytics/apps" element={<AppAnalytics />} />
                <Route path="/analytics/websites" element={<Navigate to="/timeline" replace />} />
                <Route path="/timesheets" element={<Timesheets />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            )}
          </main>
        </div>
      </div>
    </SocketProvider>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;