import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Employee, TimelineInterval } from '../types';
import { ActivityTimelineView } from '../components/ScrinTimelineView';
import { formatHoursToTime, getTodayLocalDateString } from '../utils/format';
import { getStoredEmployeeId, setStoredEmployeeId } from '../utils/selection';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  Coffee,
  RefreshCw,
  Users,
  Calendar
} from 'lucide-react';

export const Timeline: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(getStoredEmployeeId());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDateString());
  const [timelineData, setTimelineData] = useState<{
    user: any;
    attendance: any;
    intervals: TimelineInterval[];
    activityBlocks: any[];
    screenshots: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/employees').then((res) => {
      const list = res.data.employees || [];
      setEmployees(list);
      const storedId = getStoredEmployeeId();
      if (storedId && list.some((e: any) => e.id === storedId)) {
        setSelectedUserId(storedId);
      } else if (list.length > 0 && !selectedUserId) {
        setSelectedUserId(list[0].id);
        setStoredEmployeeId(list[0].id);
      }
    });
  }, []);

  const fetchTimeline = async () => {
    if (!selectedUserId) return;
    try {
      const res = await api.get('/admin/timeline', {
        params: { userId: selectedUserId, date: selectedDate }
      });
      setTimelineData(res.data);
    } catch (err) {
      console.error('Failed to fetch timeline', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
    const interval = setInterval(fetchTimeline, 10000);
    return () => clearInterval(interval);
  }, [selectedUserId, selectedDate]);

  const selectedEmployee = employees.find((e) => e.id === selectedUserId);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Employee Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-sky-600" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Team 24-Hour Timeline</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Granular step-by-step activity timeline, task logs, and embedded desktop screenshot inspection
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
            <Users className="w-4 h-4 text-slate-400" />
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setStoredEmployeeId(e.target.value);
              }}
              className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.department || 'Employee'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchTimeline}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading || !timelineData ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Attendance Overview Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Clock In</p>
                <p className="text-sm font-black text-slate-900">
                  {timelineData.attendance?.clockInAt
                    ? new Date(timelineData.attendance.clockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Not Recorded'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Clock Out</p>
                <p className="text-sm font-black text-slate-900">
                  {selectedEmployee?.status === 'ONLINE' || (selectedEmployee?.status as string) === 'WORKING' || selectedEmployee?.status === 'PAUSED'
                    ? 'Active / Working'
                    : timelineData.attendance?.clockOutAt
                    ? new Date(timelineData.attendance.clockOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Active / Working'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Active Software Time</p>
                <p className="text-sm font-black text-slate-900">
                  {formatHoursToTime((timelineData.attendance?.totalActiveSeconds || 0) / 3600)}
                </p>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Break & Idle Time</p>
                <p className="text-sm font-black text-slate-900">
                  {formatHoursToTime((((timelineData.attendance?.totalIdleSeconds || 0) + ((timelineData.attendance as any)?.manualPauseSeconds || 0))) / 3600)}
                </p>
              </div>
            </div>
          </div>

          {/* 24-Hour Interactive Timeline with Scrubber and Embedded Thumbnails */}
          <ActivityTimelineView
            user={
              selectedEmployee || {
                id: selectedUserId,
                name: timelineData.user?.name || 'Employee',
                email: timelineData.user?.email || '',
                currentTask: timelineData.user?.currentTask
              }
            }
            date={selectedDate}
            attendance={timelineData.attendance}
            intervals={timelineData.intervals || []}
            activityBlocks={timelineData.activityBlocks || []}
            onRefresh={fetchTimeline}
            isAdmin={true}
          />
        </>
      )}
    </div>
  );
};