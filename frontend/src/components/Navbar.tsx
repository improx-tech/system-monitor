import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Wifi, WifiOff, User as UserIcon, Sun, Moon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { getStoredEmployeeId, setStoredEmployeeId } from '../utils/selection';
import { Employee } from '../types';

// Page title map
const PAGE_TITLES: Record<string, string> = {
  '/':                  'Overview',
  '/realtime':          'Live Monitor',
  '/employees':         'Employees',
  '/screenshots':       'Screenshots',
  '/timeline':          '24h Timeline',
  '/analytics/apps':    'App Analytics',
  '/timesheets':        'Timesheets',
  '/settings':          'System Settings',
  '/portal':            'My Workspace',
};

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [time, setTime] = useState<string>(new Date().toLocaleTimeString());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(getStoredEmployeeId());

  const isAdminOrHR = user?.role === 'ADMIN' || user?.department === 'HR' || user?.role === 'MANAGER';
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Console';

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isAdminOrHR) {
      api.get('/admin/employees').then((res) => {
        setEmployees(res.data.employees || []);
      }).catch(() => {});
    }

    const handler = (e: any) => {
      setSelectedUserId(e.detail || '');
    };
    window.addEventListener('improx-employee-changed', handler);
    return () => window.removeEventListener('improx-employee-changed', handler);
  }, [isAdminOrHR]);

  const handleSelectEmployee = (id: string) => {
    setSelectedUserId(id);
    setStoredEmployeeId(id);
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-xs transition-colors duration-300">
      <div className="flex items-center gap-4">
        {/* Dynamic page title — no "Management Console" */}
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          {pageTitle}
        </h2>

        {isAdminOrHR && employees.length > 0 && (
          <div className="hidden md:flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-3 py-1 rounded-xl">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500">Employee:</span>
            <select
              value={selectedUserId}
              onChange={(e) => handleSelectEmployee(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-sky-700 dark:text-sky-400 focus:outline-none cursor-pointer"
            >
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.department || 'General'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Live Sync indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs transition-colors duration-300">
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 -ml-4" />
              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 inline" /> Live Sync
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5 inline" /> Connecting...
              </span>
            </>
          )}
        </div>

        {/* Live Clock */}
        <div className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors duration-300">
          {time}
        </div>

        {/* Day / Night Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-400 hover:bg-amber-50 dark:hover:bg-slate-700 hover:border-amber-300 dark:hover:border-yellow-500 transition-all duration-200"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900 border border-sky-300 dark:border-sky-700 flex items-center justify-center text-sky-700 dark:text-sky-300 font-bold text-xs">
              {user?.name?.charAt(0).toUpperCase() || <UserIcon className="w-4 h-4" />}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{user?.name || 'Administrator'}</p>
              <p className="text-[10px] text-sky-600 dark:text-sky-400 uppercase font-extrabold tracking-wider">{user?.role || 'ADMIN'}</p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Logout"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};