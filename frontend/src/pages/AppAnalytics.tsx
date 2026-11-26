import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AppAnalyticsItem, Employee } from '../types';
import { formatHoursToTime, getTodayLocalDateString } from '../utils/format';
import { getStoredEmployeeId, setStoredEmployeeId } from '../utils/selection';
import { DonutChart } from '../components/DonutChart';
import { PieChart, RefreshCw, Layers, Users } from 'lucide-react';

export const AppAnalytics: React.FC = () => {
  const [apps, setApps] = useState<AppAnalyticsItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(getStoredEmployeeId());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDateString());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/employees').then((res) => {
      setEmployees(res.data.employees || []);
    }).catch(() => {});
  }, []);

  const fetchAppAnalytics = async () => {
    try {
      const params: any = { date: selectedDate };
      if (selectedUserId) params.userId = selectedUserId;
      const res = await api.get('/admin/analytics/apps', { params });
      setApps(res.data.apps || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppAnalytics();
    const interval = setInterval(fetchAppAnalytics, 10000);
    return () => clearInterval(interval);
  }, [selectedDate, selectedUserId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-sky-600" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Application Usage Analytics</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Breakdown of software tools utilized across the team (Auto-refreshes every 10s)</p>
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
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.department || 'Team'})
                </option>
              ))}
            </select>
          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-sky-500 shadow-xs"
          />

          <button
            onClick={fetchAppAnalytics}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : apps.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white border border-slate-200 rounded-2xl shadow-xs">
          No application logs recorded for this date.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Scrin.io Donut Visualizer */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-extrabold text-slate-800 mb-2 uppercase tracking-wider">Apps & URLs Donut Chart</h3>
            <DonutChart
              data={apps.map((app, idx) => ({
                name: app.appName,
                minutes: Math.round(app.totalHours * 60),
                percentage: app.percentage,
                color: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'][idx % 7]
              }))}
              totalDurationFormatted={formatHoursToTime(apps.reduce((sum, a) => sum + a.totalHours, 0))}
              totalPercentageFormatted={`${Math.round(apps.reduce((sum, a) => sum + a.percentage, 0))}%`}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Software Name</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Total Time</th>
                    <th className="px-5 py-3.5">Share of Workday</th>
                    <th className="px-5 py-3.5">Clicks</th>
                    <th className="px-5 py-3.5">Keystrokes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {apps.map((app, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-sky-600 shrink-0" />
                        <span className="truncate max-w-xs" title={app.appName}>{app.appName}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-bold">
                          {app.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-extrabold text-slate-900">
                        {formatHoursToTime(app.totalHours)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-sky-500 h-full rounded-full"
                              style={{ width: `${Math.min(app.percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono font-bold text-slate-600">{app.percentage}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-emerald-600 font-extrabold">{app.clicks}</td>
                      <td className="px-5 py-3.5 text-amber-600 font-extrabold">{app.keystrokes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      </div>
      )}
    </div>
  );
};