import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Employee, TimelineInterval } from '../types';
import { AddEmployeeModal } from '../components/AddEmployeeModal';
import { EditEmployeeModal } from '../components/EditEmployeeModal';
import { ActivityTimelineView } from '../components/ScrinTimelineView';
import { getStoredEmployeeId, setStoredEmployeeId } from '../utils/selection';
import { formatHoursToTime, getTodayLocalDateString } from '../utils/format';
import {
  Users,
  UserPlus,
  Search,
  Trash2,
  RefreshCw,
  Pencil,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Coffee,
  Calendar,
  Activity,
  RotateCcw
} from 'lucide-react';

export const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(getStoredEmployeeId());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDateString());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [timelineData, setTimelineData] = useState<{
    user: any;
    attendance: any;
    intervals: TimelineInterval[];
    activityBlocks?: any[];
    screenshots: any[];
  } | null>(null);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/admin/employees');
      const list = res.data.employees || [];
      setEmployees(list);

      setSelectedUserId((prev) => {
        if (prev && list.some((e: any) => e.id === prev)) {
          return prev;
        }
        const stored = getStoredEmployeeId();
        if (stored && list.some((e: any) => e.id === stored)) {
          return stored;
        }
        if (list.length > 0) {
          setStoredEmployeeId(list[0].id);
          return list[0].id;
        }
        return '';
      });
    } catch (err) {
      console.error('Failed to fetch employees', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectedEmployeeTimeline = async () => {
    if (!selectedUserId) return;
    try {
      const res = await api.get('/admin/timeline', {
        params: { userId: selectedUserId, date: selectedDate }
      });
      setTimelineData(res.data);
    } catch (err) {
      console.error('Failed to fetch employee timeline', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchSelectedEmployeeTimeline();
    const interval = setInterval(() => {
      fetchEmployees();
      fetchSelectedEmployeeTimeline();
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedUserId, selectedDate]);

  const handleResetEmployeeTime = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Are you sure you want to reset all time tracking data for ${name} for ${selectedDate} to 0 minutes?\n\n(This employee will start fresh from 0 minutes. Their account and login will be kept.)`
      )
    )
      return;

    try {
      await api.post(`/admin/employees/${id}/reset-today`, { date: selectedDate });
      fetchEmployees();
      fetchSelectedEmployeeTimeline();
      alert(`✅ Time tracking data for ${name} has been reset to 0 minutes! The employee can now start fresh.`);
    } catch (err: any) {
      alert('Failed to reset time: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete ${name} and all their records from the database?`)) return;
    try {
      await api.delete(`/admin/employees/${id}`);
      if (selectedUserId === id) setSelectedUserId('');
      fetchEmployees();
    } catch (err) {
      console.error('Failed to delete employee', err);
    }
  };

  const handleSystemWipe = async () => {
    if (
      !window.confirm(
        '⚠️ DANGER: Are you sure you want to DELETE ALL old employees, activity logs, attendance, screenshots, and telemetry to start completely from scratch?'
      )
    )
      return;

    try {
      await api.post('/admin/system/wipe-database');
      setSelectedUserId('');
      fetchEmployees();
      alert('✅ Database fully wiped! All old employees and records have been deleted. You can now register fresh employees.');
    } catch (err: any) {
      alert('Failed to wipe database: ' + (err.response?.data?.message || err.message));
    }
  };

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedEmployee = employees.find((e) => e.id === selectedUserId);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-600" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Super Admin Employee Directory</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Select an employee on the left sidebar to view their session logs, 24h scrubber bar, and screenshots
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-sky-600/20 transition-all"
          >
            <UserPlus className="w-4 h-4" /> Add New Employee
          </button>
          <button
            onClick={fetchEmployees}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl transition-colors shadow-xs"
            title="Refresh employee directory"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        /* TWO COLUMN DIRECTORY LAYOUT */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: EMPLOYEE DIRECTORY LIST (3 Cols) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Employees ({filtered.length})</h3>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700"
              />
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
              {filtered.map((emp) => {
                const isSelected = emp.id === selectedUserId;
                const isEmpClockedOut = !!(emp.clockOutAt || (emp as any).attendances?.[0]?.clockOutAt);
                const statusDot = isEmpClockedOut
                  ? 'bg-slate-300'
                  : emp.status === 'ONLINE' || (emp.status as string) === 'WORKING'
                  ? 'bg-emerald-500'
                  : emp.status === 'PAUSED' || emp.status === 'IDLE'
                  ? 'bg-amber-400'
                  : 'bg-slate-300';

                return (
                  <div
                    key={emp.id}
                    onClick={() => {
                      setSelectedUserId(emp.id);
                      setStoredEmployeeId(emp.id);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-sky-50 border-sky-500 shadow-sm ring-1 ring-sky-500'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-xs">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusDot}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 truncate">{emp.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{emp.email}</p>
                        <p className="text-[9px] font-bold text-sky-600 mt-0.5">{emp.department || 'General'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEmployee(emp);
                          setIsEditModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit Employee"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(emp.id, emp.name);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Employee"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: SELECTED EMPLOYEE FULL MONITORING PANEL (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            {selectedEmployee ? (
              <>
                {/* Employee Info Strip & Weekly Productivity */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white font-black flex items-center justify-center text-lg shadow-md shadow-sky-600/20">
                        {selectedEmployee.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-black text-slate-900">{selectedEmployee.name}</h2>
                          <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase border border-slate-200">
                            {selectedEmployee.department || 'General'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{selectedEmployee.email} • Shift: {selectedEmployee.shift || '09:00 - 18:00'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResetEmployeeTime(selectedEmployee.id, selectedEmployee.name)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                        title="Reset time tracking data for this employee for selected date back to 0m"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Today (0m)</span>
                      </button>
                      <span className={`px-3 py-1 rounded-xl text-xs font-extrabold ${
                        (selectedEmployee.clockOutAt || (selectedEmployee as any).attendances?.[0]?.clockOutAt)
                          ? 'bg-slate-100 text-slate-600'
                          : selectedEmployee.status === 'ONLINE' || (selectedEmployee.status as string) === 'WORKING'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedEmployee.status === 'PAUSED' || selectedEmployee.status === 'IDLE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {(selectedEmployee.clockOutAt || (selectedEmployee as any).attendances?.[0]?.clockOutAt)
                          ? '⚪ Shift Completed'
                          : selectedEmployee.status === 'ONLINE' || (selectedEmployee.status as string) === 'WORKING'
                          ? '🟢 Active Working'
                          : selectedEmployee.status === 'PAUSED' || selectedEmployee.status === 'IDLE'
                          ? '🟡 On Break'
                          : '🔴 Logged Out'}
                      </span>
                    </div>
                  </div>

                  {/* Attendance Stats Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Software</span>
                      <span className="text-sm font-black text-slate-900">
                        {formatHoursToTime(
                          ((timelineData?.attendance?.totalActiveSeconds !== undefined && timelineData?.attendance?.totalActiveSeconds !== null)
                            ? timelineData.attendance.totalActiveSeconds
                            : ((selectedEmployee as any).totalActiveSeconds !== undefined)
                            ? (selectedEmployee as any).totalActiveSeconds
                            : Math.round((selectedEmployee.activeHoursToday || 0) * 3600)) / 3600
                        )}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Break / Idle</span>
                      <span className="text-sm font-black text-amber-700">
                        {formatHoursToTime(
                          ((timelineData?.attendance?.totalIdleSeconds !== undefined && timelineData?.attendance?.totalIdleSeconds !== null)
                            ? ((timelineData.attendance.totalIdleSeconds || 0) + ((timelineData.attendance as any).manualPauseSeconds || 0))
                            : ((selectedEmployee as any).totalIdleSeconds !== undefined)
                            ? (selectedEmployee as any).totalIdleSeconds
                            : Math.round((selectedEmployee.idleHoursToday || 0) * 3600)) / 3600
                        )}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Clock In</span>
                      <span className="text-sm font-black text-emerald-700">
                        {timelineData?.attendance?.clockInAt
                          ? new Date(timelineData.attendance.clockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Not Recorded'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Clock Out</span>
                      <span className="text-sm font-black text-slate-700">
                        {timelineData?.attendance?.clockOutAt
                          ? new Date(timelineData.attendance.clockOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Active Shift'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 24h Scrubber Timeline & Screenshots */}
                <ActivityTimelineView
                  user={{
                    id: selectedEmployee.id,
                    name: selectedEmployee.name,
                    email: selectedEmployee.email,
                    department: selectedEmployee.department,
                    shift: selectedEmployee.shift,
                    status: selectedEmployee.status
                  }}
                  date={selectedDate}
                  attendance={timelineData?.attendance}
                  intervals={timelineData?.intervals || []}
                  activityBlocks={timelineData?.activityBlocks || []}
                  onRefresh={fetchSelectedEmployeeTimeline}
                  isAdmin={true}
                />
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs font-medium">
                Select an employee from the left directory to view detailed telemetry.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchEmployees}
      />

      {editingEmployee && (
        <EditEmployeeModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingEmployee(null);
          }}
          onSuccess={fetchEmployees}
          employee={editingEmployee}
        />
      )}
    </div>
  );
};