import React, { useEffect, useState } from 'react';
import { api, API_BASE_URL } from '../services/api';
import { TimesheetRecord } from '../types';
import { formatHoursToTime, getTodayLocalDateString } from '../utils/format';
import { CalendarCheck, Download, RefreshCw, Trash2, Camera, ChevronDown, ChevronUp, Clock, UserCheck } from 'lucide-react';

export const Timesheets: React.FC = () => {
  const [timesheets, setTimesheets] = useState<TimesheetRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDateString());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Expanded row state for screenshots
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [employeeScreenshots, setEmployeeScreenshots] = useState<any[]>([]);
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);

  const fetchTimesheets = async () => {
    try {
      const res = await api.get('/admin/timesheets', {
        params: { date: selectedDate }
      });
      setTimesheets(res.data.timesheets);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheets();
    const interval = setInterval(fetchTimesheets, 10000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  const toggleRowScreenshots = async (userId: string) => {
    if (expandedEmployeeId === userId) {
      setExpandedEmployeeId(null);
      setEmployeeScreenshots([]);
      return;
    }

    setExpandedEmployeeId(userId);
    setLoadingScreenshots(true);
    try {
      const res = await api.get('/admin/screenshots', {
        params: { userId, date: selectedDate }
      });
      setEmployeeScreenshots(res.data.screenshots || []);
    } catch (e) {
      console.error('Failed to fetch employee screenshots', e);
      setEmployeeScreenshots([]);
    } finally {
      setLoadingScreenshots(false);
    }
  };

  const handleExportCSV = () => {
    const url = `${API_BASE_URL}/api/admin/timesheets/export-csv?date=${selectedDate}`;
    window.open(url, '_blank');
  };

  const handleDeleteTimesheet = async (id: string, employeeName: string) => {
    if (!window.confirm(`Are you sure you want to delete this timesheet entry for ${employeeName}?`)) return;
    try {
      await api.delete(`/admin/timesheets/${id}`);
      fetchTimesheets();
    } catch (err) {
      console.error('Failed to delete timesheet', err);
    }
  };

  const filtered = timesheets.filter(
    (t) =>
      t.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.employeeEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-sky-600" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Timesheets & Attendance</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Official daily clock-in/out timestamps, pause reasons, and expandable screenshot logs (Auto-refreshes every 10s)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-sky-500 shadow-xs"
          />

          <button
            onClick={handleExportCSV}
            disabled={timesheets.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export CSV / Payroll
          </button>

          <button
            onClick={fetchTimesheets}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No timesheets recorded for this date.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Shift</th>
                  <th className="px-5 py-3.5">Clock In</th>
                  <th className="px-5 py-3.5">Clock Out</th>
                  <th className="px-5 py-3.5">Active Work</th>
                  <th className="px-5 py-3.5">Idle Breaks</th>
                  <th className="px-5 py-3.5">Pause / Activity</th>
                  <th className="px-5 py-3.5">Total Time</th>
                  <th className="px-5 py-3.5">Productivity</th>
                  <th className="px-5 py-3.5 text-right">Screenshots & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => {
                  const isExpanded = expandedEmployeeId === (t as any).userId;
                  return (
                    <React.Fragment key={t.id}>
                      <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-sky-50/40' : ''}`}>
                        <td className="px-5 py-3.5 font-bold text-slate-900">{t.employeeName}</td>
                        <td className="px-5 py-3.5 text-slate-600 font-medium">{t.department}</td>
                        <td className="px-5 py-3.5 text-slate-500 font-medium">{t.shift}</td>
                        <td className="px-5 py-3.5 font-mono font-bold text-emerald-700">
                          {t.clockInAt ? new Date(t.clockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold">
                          {t.clockOutAt ? (
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              {new Date(t.clockOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-pulse">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-black text-slate-900">{formatHoursToTime(t.activeHours)}</td>
                        <td className="px-5 py-3.5 text-amber-700 font-bold">{formatHoursToTime(t.idleHours)}</td>
                        <td className="px-5 py-3.5">
                          {(t as any).pauseReason ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs max-w-[200px] truncate"
                              title={`${(t as any).pauseReason || ''} ${(t as any).pauseComment ? `("${(t as any).pauseComment}")` : ''}`}
                            >
                              {(t as any).pauseReason} {(t as any).pauseComment ? `("${(t as any).pauseComment}")` : ''}
                            </span>
                          ) : !t.clockOutAt ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              🟢 Working
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-black text-sky-700">{formatHoursToTime(t.totalHours)}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            {t.productivityScore}%
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleRowScreenshots((t as any).userId)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                              isExpanded
                                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Screenshots</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          <button
                            onClick={() => handleDeleteTimesheet(t.id, t.employeeName)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Timesheet Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      {/* EXPANDED SCREENSHOTS DRAWER BELOW TIMESHEET ROW */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={11} className="p-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Camera className="w-4 h-4 text-sky-600" />
                                  <h4 className="text-xs font-extrabold text-slate-900">
                                    Screenshots Captured Today for {t.employeeName}
                                  </h4>
                                </div>
                                <span className="text-[11px] font-bold text-slate-500">
                                  {employeeScreenshots.length} Captures
                                </span>
                              </div>

                              {loadingScreenshots ? (
                                <div className="p-6 text-center text-slate-400 text-xs">
                                  Loading employee screenshots...
                                </div>
                              ) : employeeScreenshots.length === 0 ? (
                                <div className="p-6 text-center text-slate-400 text-xs">
                                  No screenshots captured for {t.employeeName} on this date.
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                  {employeeScreenshots.map((s) => (
                                    <div key={s.id} className="group relative bg-slate-900 rounded-lg overflow-hidden border border-slate-200">
                                      <img
                                        src={s.filePath}
                                        alt={s.appName || 'Screenshot'}
                                        className="w-full h-24 object-cover group-hover:scale-105 transition-transform"
                                      />
                                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-90 p-2 flex flex-col justify-end">
                                        <p className="text-[10px] font-bold text-white truncate">{s.appName || 'Desktop'}</p>
                                        <p className="text-[9px] text-sky-400 font-mono">
                                          {new Date(s.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};