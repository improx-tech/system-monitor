import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { LogOut, Wifi, WifiOff, User as UserIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { getStoredEmployeeId, setStoredEmployeeId } from '../utils/selection';
import { Employee } from '../types';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [time, setTime] = useState<string>(new Date().toLocaleTimeString());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(getStoredEmployeeId());

  const isAdminOrHR = user?.role === 'ADMIN' || user?.department === 'HR' || user?.role === 'MANAGER';

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
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-xs">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-bold text-slate-800 tracking-tight">
          {user?.role === 'EMPLOYEE' ? 'My Personal Workspace' : 'Console'}
        </h2>

        {isAdminOrHR && employees.length > 0 && (
          <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Employee:</span>
            <select
              value={selectedUserId}
              onChange={(e) => handleSelectEmployee(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-sky-700 focus:outline-none cursor-pointer"
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

      <div className="flex items-center gap-5">
        {/* Real-time Socket Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs">
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 -ml-4"></span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 inline" /> Live Sync
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="text-rose-600 font-medium flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5 inline" /> Connecting...
              </span>
            </>
          )}
        </div>

        {/* Live Clock */}
        <div className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          {time}
        </div>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-700 font-bold text-xs">
              {user?.name?.charAt(0).toUpperCase() || <UserIcon className="w-4 h-4" />}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-slate-800">{user?.name || 'Administrator'}</p>
              <p className="text-[10px] text-sky-600 uppercase font-extrabold tracking-wider">{user?.role || 'ADMIN'}</p>
            </div>
          </div>

          <button
            onClick={logout}
            title="Logout"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};