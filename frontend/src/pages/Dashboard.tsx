import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DashboardStats } from '../types';
import { StatCard } from '../components/StatCard';
import { formatHoursToTime, getTodayLocalDateString } from '../utils/format';
import {
  Users,
  Radio,
  Clock,
  Coffee,
  PieChart as PieIcon,
  Globe,
} from 'lucide-react';



export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDateString());
  const [loading, setLoading] = useState(true);


  const fetchStats = async (dateStr?: string) => {
    try {
      const targetDate = dateStr || selectedDate;
      const res = await api.get(`/admin/dashboard?date=${targetDate}`);
      setStats(res.data.stats);
    } catch (err) {
      console.error('Failed to fetch dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(selectedDate);
    const interval = setInterval(() => fetchStats(selectedDate), 10000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner & Quick Insight Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent p-5 rounded-2xl border border-sky-100 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Organization Overview</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-700 border border-sky-200 uppercase tracking-wider">
              {isToday ? 'Real-time Analytics' : `Historical Records (${selectedDate})`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Productivity intelligence and attendance summary ({isToday ? 'Auto-refreshes every 10s' : `Showing data for ${selectedDate}`})</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="font-bold text-slate-600">Select Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setLoading(true);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800 text-xs focus:outline-none focus:border-sky-500"
            />
            {!isToday && (
              <button
                onClick={() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setSelectedDate(todayStr);
                  setLoading(true);
                }}
                className="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg font-bold text-[11px] transition-colors"
              >
                Reset Today
              </button>
            )}
          </div>

          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Focus Rate</p>
            <p className="text-base font-black text-slate-900">
              {stats.todayHours.activeHours > 0
                ? Math.round((stats.todayHours.activeHours / (stats.todayHours.activeHours + stats.todayHours.idleHours)) * 100)
                : 100}%
            </p>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Workforce</p>
            <p className="text-base font-black text-emerald-600">
              {stats.headcount.online} / {stats.headcount.total}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Workforce"
          value={stats.headcount.total}
          subtitle="Registered employees"
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Active Working"
          value={stats.headcount.online}
          subtitle="Currently inputting"
          icon={Radio}
          color="emerald"
          badge="Live"
        />
        <StatCard
          title="Away / Idle"
          value={stats.headcount.idle}
          subtitle="Inactive > 3 mins"
          icon={Coffee}
          color="amber"
        />
        <StatCard
          title="Total Hours Today"
          value={formatHoursToTime(stats.todayHours.activeHours)}
          subtitle={`${formatHoursToTime(stats.todayHours.idleHours)} idle breaks logged`}
          icon={Clock}
          color="sky"
        />
      </div>

      {/* Top Software & Domains — full width 2-col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Software Today */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-5 h-5 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-800">Top Software Today</h3>
          </div>
          <div className="space-y-3">
            {stats.topApps.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium py-4 text-center">No software activity logged today yet</p>
            ) : (
              stats.topApps.slice(0, 6).map((app, idx) => {
                const maxMins = Math.max(...stats.topApps.map((a) => a.durationMinutes), 1);
                const pct = Math.min(100, Math.round((app.durationMinutes / maxMins) * 100));
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span className="truncate max-w-[200px]">{app.name}</span>
                      <span className="text-sky-600 font-extrabold">{app.durationMinutes}m</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Visited Domains */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Top Visited Domains</h3>
          </div>
          <div className="space-y-2">
            {stats.topWebsites.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium py-4 text-center">No domain activity logged today</p>
            ) : (
              stats.topWebsites.slice(0, 6).map((w, idx) => {
                const maxMins = Math.max(...stats.topWebsites.map((x) => x.durationMinutes), 1);
                const pct = Math.min(100, Math.round((w.durationMinutes / maxMins) * 100));
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span className="truncate max-w-[200px]">{w.domain}</span>
                      <span className="text-indigo-600 font-extrabold">{w.durationMinutes}m</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};