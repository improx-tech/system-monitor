import React, { useState } from 'react';
import { TimelineInterval, ActivityCategory } from '../types';
import { API_BASE_URL } from '../services/api';
import { formatHoursToTime } from '../utils/format';
import { ScreenshotModal } from './ScreenshotModal';
import { AddOfflineTimeModal } from './AddOfflineTimeModal';
import {
  Clock,
  Camera,
  CameraOff,
  Plus,
  History,
  MousePointer,
  Keyboard,
  Info,
  Calendar
} from 'lucide-react';

interface ActivityTimelineViewProps {
  user: {
    id: string;
    name: string;
    email: string;
    department?: string;
    shift?: string;
    status?: string;
    currentTask?: string | null;
  };
  date: string;
  attendance?: {
    clockInAt: string | null;
    clockOutAt: string | null;
    totalActiveSeconds: number;
    totalIdleSeconds: number;
    totalWorkSeconds: number;
  };
  intervals: TimelineInterval[];
  activityBlocks?: any[];
  onRefresh?: () => void;
  isAdmin?: boolean;
}

const categoryColors: Record<ActivityCategory, { bg: string; text: string; border: string; label: string }> = {
  WORK: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: '💼 Work' },
  COMMUNICATION: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: '💬 Meeting' },
  BROWSING: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', label: '🌐 Browsing' },
  ENTERTAINMENT: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: '🎬 Media' },
  IDLE: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: '☕ Break' },
  OTHER: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', label: '📁 Other' }
};

export const ActivityTimelineView: React.FC<ActivityTimelineViewProps> = ({
  user,
  date,
  attendance,
  intervals = [],
  activityBlocks = [],
  onRefresh,
  isAdmin = false
}) => {
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'intervals' | 'stream'>('intervals');
  const [streamSortOrder, setStreamSortOrder] = useState<'asc' | 'desc'>('asc'); // Default: Morning -> Evening
  const [streamSearchQuery, setStreamSearchQuery] = useState('');
  const [streamFilterStatus, setStreamFilterStatus] = useState<'ALL' | 'ACTIVE' | 'IDLE'>('ALL');
  const [selectedScreenshot, setSelectedScreenshot] = useState<{
    url: string;
    title: string;
    timestamp: string;
  } | null>(null);
  const [isAddOfflineOpen, setIsAddOfflineOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Group intervals by hour to populate top scrubber bar
  const hourlyActivity = hours.map((hour) => {
    const intervalsInHour = intervals.filter((inv) => {
      const invHour = new Date(inv.startTime).getHours();
      return invHour === hour;
    });

    const activeSec = intervalsInHour.reduce((sum, inv) => sum + (inv.isIdle ? 0 : inv.durationSeconds), 0);
    const breakSec = intervalsInHour.reduce((sum, inv) => sum + (inv.isIdle ? inv.durationSeconds : 0), 0);
    const hasWork = activeSec > 0;
    const hasBreak = breakSec > 0;

    return {
      hour,
      label: hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`,
      activeSec,
      breakSec,
      hasWork,
      hasBreak,
      count: intervalsInHour.length
    };
  });

  // Filter intervals based on selected hour and category
  const filteredIntervals = intervals.filter((inv) => {
    const invHour = new Date(inv.startTime).getHours();
    const matchesHour = selectedHour === null || invHour === selectedHour;
    const matchesCategory = filterCategory === 'ALL' || inv.category === filterCategory;
    return matchesHour && matchesCategory;
  });

  const currentDateObj = new Date(date);
  const currentDayNum = currentDateObj.getDate();
  const year = currentDateObj.getFullYear();
  const month = currentDateObj.getMonth();
  const monthName = currentDateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const activeHoursFormatted = formatHoursToTime((attendance?.totalActiveSeconds || 0) / 3600);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 0. SCRIN.IO HORIZONTAL CALENDAR STRIP */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">{monthName}</h4>
          <span className="text-[11px] font-bold text-slate-400">All times are UTC+5.5</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {daysArray.map((dayNum) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const d = new Date(year, month, dayNum);
            const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
            const isSelected = dayNum === currentDayNum;

            return (
              <button
                key={dayNum}
                onClick={() => {
                  if (onRefresh) onRefresh();
                }}
                className={`flex flex-col items-center min-w-[38px] p-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 font-extrabold shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 font-medium'
                }`}
              >
                <span className="text-[9px] uppercase opacity-80">{dayName}</span>
                <span className="text-sm font-black">{dayNum}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SCRIN.IO BIG DAY STATS HEADER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
            {currentDateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <div className="flex items-baseline gap-3 mt-1">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">{activeHoursFormatted}</h2>
            <span className="text-xs font-bold text-slate-500">Week: {activeHoursFormatted} | Month: {activeHoursFormatted}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-slate-100 pl-6 text-xs font-medium text-slate-600">
          <div>
            <span className="block text-[10px] text-slate-400 font-bold uppercase">Tasks & Software</span>
            <span className="font-extrabold text-slate-800">{intervals.length} Intervals Recorded</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-bold uppercase">Active Ratio</span>
            <span className="font-extrabold text-emerald-600">
              {attendance?.totalWorkSeconds ? Math.round(((attendance.totalActiveSeconds || 0) / attendance.totalWorkSeconds) * 100) : 100}%
            </span>
          </div>
        </div>
      </div>

      {/* 1. TOP SCRIN.IO 24-HOUR HORIZONTAL TIMELINE BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              24-Hour Activity Bar — {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setSelectedHour(null)}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                selectedHour === null
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Hours ({intervals.length})
            </button>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span className="text-[11px] font-semibold text-slate-600">Active Work</span>
            </div>
            <div className="flex items-center gap-1.5 ml-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-400" />
              <span className="text-[11px] font-semibold text-slate-600">Break / Idle</span>
            </div>
          </div>
        </div>

        {/* 24-Hour Interactive Segmented Scrubber Bar */}
        <div className="grid grid-cols-12 md:grid-cols-24 gap-1 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner relative">
          {hourlyActivity.map((h) => {
            const isSelected = selectedHour === h.hour;
            const isHovered = hoveredHour === h.hour;
            const totalWorkMins = Math.min(60, Math.round(h.activeSec / 60));
            const totalBreakMins = Math.min(60 - totalWorkMins, Math.round(h.breakSec / 60));
            const workPct = Math.round((totalWorkMins / 60) * 100);
            const breakPct = Math.round((totalBreakMins / 60) * 100);
            const hasActivity = totalWorkMins > 0 || totalBreakMins > 0;

            return (
              <div
                key={h.hour}
                onClick={() => setSelectedHour(isSelected ? null : h.hour)}
                onMouseEnter={() => setHoveredHour(h.hour)}
                onMouseLeave={() => setHoveredHour(null)}
                className={`relative flex flex-col items-center justify-between h-20 rounded-xl p-1 transition-all cursor-pointer select-none group ${
                  isSelected
                    ? 'ring-2 ring-sky-500 bg-white shadow-md'
                    : 'hover:bg-white hover:shadow-xs'
                }`}
              >
                {/* Custom Floating React Tooltip (ONLY shown on hover, NO native title box!) */}
                {isHovered && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 pointer-events-none whitespace-nowrap bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl border border-slate-700 animate-fade-in flex items-center gap-1.5">
                    <span className="text-sky-400 font-mono">{h.label}</span>
                    <span className="text-slate-400">•</span>
                    {hasActivity ? (
                      <>
                        {totalWorkMins > 0 && <span className="text-emerald-400">{totalWorkMins}m Work</span>}
                        {totalWorkMins > 0 && totalBreakMins > 0 && <span className="text-slate-400">|</span>}
                        {totalBreakMins > 0 && <span className="text-amber-400">{totalBreakMins}m Break</span>}
                      </>
                    ) : (
                      <span className="text-slate-300 font-normal">No Activity Logged</span>
                    )}
                  </div>
                )}

                <span className="text-[10px] font-black text-slate-600">{h.label}</span>

                {/* Vertical Segmented Meter */}
                <div className="w-full flex-1 max-h-10 bg-slate-200 rounded-md overflow-hidden flex flex-col-reverse relative my-1 border border-slate-300/60">
                  {hasActivity ? (
                    <>
                      <div
                        style={{ height: `${workPct}%` }}
                        className="w-full bg-emerald-500 transition-all duration-300"
                      />
                      <div
                        style={{ height: `${breakPct}%` }}
                        className="w-full bg-amber-400 transition-all duration-300"
                      />
                    </>
                  ) : (
                    <div className="w-full h-full bg-slate-200/80" />
                  )}
                </div>

                <div className="text-[9px] font-bold leading-tight text-center">
                  {totalWorkMins > 0 ? (
                    <span className="text-emerald-700 font-extrabold">{totalWorkMins}m</span>
                  ) : totalBreakMins > 0 ? (
                    <span className="text-amber-700 font-extrabold">{totalBreakMins}m</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. VIEW MODE TOGGLE & ACTION CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('intervals')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'intervals'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Task Intervals & Screenshots ({filteredIntervals.length})
          </button>
          <button
            onClick={() => setViewMode('stream')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'stream'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            ⚡ Live 20s Telemetry Stream ({activityBlocks.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddOfflineOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add offline time
          </button>

          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-xs transition-all"
          >
            <History className="w-3.5 h-3.5 text-slate-400" /> History of changes
          </button>
        </div>
      </div>

      {viewMode === 'stream' ? (
        /* LIVE 20-SECOND TELEMETRY STREAM VIEW */
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          {/* Header Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <h4 className="text-sm font-black text-slate-900 tracking-tight">Real-Time 20-Second Activity Stream</h4>
                <p className="text-[11px] text-slate-500 font-medium">Logged heartbeats for {date} • Total {activityBlocks.length} records</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Search Box */}
              <input
                type="text"
                value={streamSearchQuery}
                onChange={(e) => setStreamSearchQuery(e.target.value)}
                placeholder="Search app, window, domain..."
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white w-44 md:w-56"
              />

              {/* Status Filter Buttons */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                {(['ALL', 'ACTIVE', 'IDLE'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStreamFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      streamFilterStatus === st
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Idle'}
                  </button>
                ))}
              </div>

              {/* Sort Order Toggle Button */}
              <button
                onClick={() => setStreamSortOrder(streamSortOrder === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors border border-slate-200"
                title="Toggle time sorting order"
              >
                <span>{streamSortOrder === 'asc' ? '⬇️ Morning → Evening (Oldest First)' : '⬆️ Evening → Morning (Newest First)'}</span>
              </button>
            </div>
          </div>

          {/* Processed Stream Records */}
          {(() => {
            const processedBlocks = [...activityBlocks]
              .filter((block) => {
                if (streamFilterStatus === 'ACTIVE' && block.isIdle) return false;
                if (streamFilterStatus === 'IDLE' && !block.isIdle) return false;
                if (streamSearchQuery) {
                  const q = streamSearchQuery.toLowerCase();
                  const app = (block.appName || '').toLowerCase();
                  const win = (block.windowTitle || '').toLowerCase();
                  const dom = (block.domain || '').toLowerCase();
                  const usr = (block.user?.name || '').toLowerCase();
                  return app.includes(q) || win.includes(q) || dom.includes(q) || usr.includes(q);
                }
                return true;
              })
              .sort((a, b) => {
                const tA = new Date(a.recordedAt || 0).getTime();
                const tB = new Date(b.recordedAt || 0).getTime();
                return streamSortOrder === 'asc' ? tA - tB : tB - tA;
              });

            if (processedBlocks.length === 0) {
              return (
                <div className="text-center py-14 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-600">No 20-second telemetry records match your filter criteria.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Try resetting the search or status filters above.</p>
                </div>
              );
            }

            return (
              <div className="overflow-x-auto max-h-[580px] rounded-xl border border-slate-200/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/90 text-slate-600 uppercase text-[10px] font-black tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Application</th>
                      <th className="py-3 px-4">Active Window Title</th>
                      <th className="py-3 px-4">Website / Domain</th>
                      <th className="py-3 px-4">Input Intensity</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {processedBlocks.map((block: any, idx: number) => {
                      const blockTime = block.recordedAt
                        ? new Date(block.recordedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
                        : '—';
                      const clicks = block.mouseClicks || 0;
                      const keys = block.keystrokes || 0;
                      const appName = block.appName || 'Desktop App';
                      const appLower = appName.toLowerCase();

                      let appIcon = '⚡';
                      let appBadgeStyle = 'bg-slate-100 text-slate-800 border-slate-200';
                      if (appLower.includes('chrome') || appLower.includes('edge') || appLower.includes('firefox')) {
                        appIcon = '🌐';
                        appBadgeStyle = 'bg-sky-50 text-sky-800 border-sky-200';
                      } else if (appLower.includes('code') || appLower.includes('visual studio')) {
                        appIcon = '💻';
                        appBadgeStyle = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                      } else if (appLower.includes('slack') || appLower.includes('teams') || appLower.includes('zoom')) {
                        appIcon = '💬';
                        appBadgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                      } else if (appLower.includes('figma')) {
                        appIcon = '🎨';
                        appBadgeStyle = 'bg-purple-50 text-purple-800 border-purple-200';
                      }

                      return (
                        <tr key={block.id || idx} className="hover:bg-slate-50/90 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-600 whitespace-nowrap">
                            {blockTime}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${appBadgeStyle}`}>
                              <span>{appIcon}</span>
                              <span>{appName}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-800 font-medium max-w-sm">
                            <span className="line-clamp-1" title={block.windowTitle || ''}>
                              {block.windowTitle || '—'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {block.domain ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-bold">
                                <span>🌐</span> {block.domain}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            <div className="flex items-center gap-2">
                              <span>{clicks} clicks • {keys} keys</span>
                              <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0">
                                <div
                                  className={`h-full rounded-full ${clicks + keys > 20 ? 'bg-emerald-500' : 'bg-sky-400'}`}
                                  style={{ width: `${Math.min(100, (clicks + keys) * 3)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                block.isIdle
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              ● {block.isIdle ? 'Idle' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      ) : (
        /* CATEGORY FILTER BAR & INTERVALS LIST */
        <>
          {/* Hourly Breakdown Card when an hour block is selected */}
          {selectedHour !== null && (
            <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  <h4 className="text-sm font-black tracking-tight text-white">
                    Selected Hour Breakdown — {hourlyActivity[selectedHour].label} ({selectedHour}:00 - {selectedHour}:59)
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedHour(null)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs transition-all border border-slate-700"
                >
                  ✕ Show All Hours
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Productive Work</span>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">{Math.round((hourlyActivity[selectedHour].activeSec || 0) / 60)} mins</p>
                </div>
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Breaks & Away Time</span>
                  <p className="text-lg font-black text-amber-400 mt-0.5">{Math.round((hourlyActivity[selectedHour].breakSec || 0) / 60)} mins</p>
                </div>
                <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Activity Sessions</span>
                  <p className="text-lg font-black text-sky-400 mt-0.5">{hourlyActivity[selectedHour].count} Intervals</p>
                </div>
              </div>

              {/* Software App Usage Breakdown for this hour */}
              {(() => {
                const hourBlocks = activityBlocks.filter((b) => {
                  if (!b.recordedAt) return false;
                  return new Date(b.recordedAt).getHours() === selectedHour;
                });

                const appCounts: Record<string, number> = {};
                hourBlocks.forEach((b) => {
                  const app = b.appName || 'Desktop App';
                  appCounts[app] = (appCounts[app] || 0) + 0.33;
                });

                const appList = Object.entries(appCounts).sort((a, b) => b[1] - a[1]);

                if (appList.length === 0) return null;

                return (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Software App Usage in Hour {hourlyActivity[selectedHour].label}</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {appList.map(([app, mins]) => (
                        <span key={app} className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <span>💻</span> {app} <span className="text-sky-400 font-mono">({Math.max(1, Math.round(mins))}m)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {['ALL', 'WORK', 'COMMUNICATION', 'BROWSING', 'IDLE'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterCategory === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat === 'ALL' ? 'All Activities' : categoryColors[cat as ActivityCategory]?.label || cat}
              </button>
            ))}
          </div>
      <div className="space-y-4">
        {filteredIntervals.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No activity recorded for this period</h4>
            <p className="text-xs text-slate-400 mt-1">Start tracking from the desktop agent or add offline time above.</p>
          </div>
        ) : (
          filteredIntervals.map((inv) => {
            const catStyle = categoryColors[inv.category] || categoryColors.WORK;
            const statusDotClass = inv.isIdle
              ? 'bg-amber-500'
              : inv.isOfflineTime
              ? 'bg-sky-500'
              : 'bg-emerald-500';

            return (
              <div
                key={inv.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all space-y-3"
              >
                {/* Interval Header Line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                    <span className="text-xs font-bold text-slate-500 font-mono tracking-tight shrink-0">
                      {inv.startTime ? `${new Date(inv.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })} - ${new Date(inv.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}` : inv.timeRangeFormatted}
                    </span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass}`} />
                    <span className="text-sm font-black text-slate-900 truncate min-w-0" title={inv.taskName}>
                      {inv.taskName}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                    >
                      {catStyle.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 shrink-0">
                    <span>{inv.durationMinutes} min{inv.durationMinutes > 1 ? 's' : ''}</span>
                    {inv.clicks > 0 && (
                      <span className="flex items-center gap-1 text-slate-600">
                        <MousePointer className="w-3 h-3 text-slate-400" /> {inv.clicks}
                      </span>
                    )}
                    {inv.keystrokes > 0 && (
                      <span className="flex items-center gap-1 text-slate-600">
                        <Keyboard className="w-3 h-3 text-slate-400" /> {inv.keystrokes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Screenshot / Content Block */}
                <div className="pt-1">
                  {inv.isOfflineTime ? (
                    <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-100 flex items-start gap-2.5 text-xs text-sky-900">
                      <Calendar className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Offline Work Logged</p>
                        <p className="text-[11px] text-sky-700 mt-0.5">{inv.comment || 'Manual activity entry'}</p>
                      </div>
                    </div>
                  ) : inv.hasScreenshot ? (
                    <div className="flex flex-wrap gap-3">
                      {inv.screenshots.map((shot) => {
                        const fullUrl = `${API_BASE_URL}${shot.filePath}`;
                        const timeStr = new Date(shot.takenAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div
                            key={shot.id}
                            onClick={() =>
                              setSelectedScreenshot({
                                url: fullUrl,
                                title: `${user.name} — ${shot.taskName || shot.appName || 'Screen'}`,
                                timestamp: shot.takenAt
                              })
                            }
                            className="group w-52 rounded-2xl bg-white border border-slate-200 overflow-hidden cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                          >
                            {/* Clean Full Preview Image (NO text on top of image!) */}
                            <div className="w-full aspect-video bg-slate-900 overflow-hidden relative">
                              <img
                                src={fullUrl}
                                alt={shot.appName || 'Screenshot'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>

                            {/* Footer Bar Below Image: Time, App Name, and Filled Circular Activity Ring Meter */}
                            {(() => {
                              const sAny = shot as any;
                              const isIdle = sAny.isIdle || sAny.category === 'IDLE';
                              const score = ((sAny.clicks || 0) * 2) + (sAny.keystrokes || 0);
                              const rawCalc = Math.round((score / 150) * 100);
                              const actLevel = typeof sAny.activityLevel === 'number'
                                ? sAny.activityLevel
                                : (isIdle ? 0 : (score > 0 ? Math.min(100, rawCalc) : 100));
                              const strokeColor = actLevel >= 70 ? '#10b981' : actLevel >= 30 ? '#f59e0b' : '#ef4444';
                              const radius = 12;
                              const circumference = 2 * Math.PI * radius;
                              const strokeDashoffset = circumference - (actLevel / 100) * circumference;

                              return (
                                <div className="p-2.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                      <span className="text-[11px] font-mono font-black text-slate-800">{timeStr}</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5">{shot.appName || shot.taskName || 'Desktop'}</p>
                                  </div>

                                  {/* Circular SVG Activity Progress Ring */}
                                  <div className="relative w-8 h-8 flex items-center justify-center shrink-0" title={`Activity Level: ${actLevel}%`}>
                                    <svg className="w-8 h-8 transform -rotate-90">
                                      <circle
                                        cx="16"
                                        cy="16"
                                        r={radius}
                                        stroke="#e2e8f0"
                                        strokeWidth="3"
                                        fill="transparent"
                                      />
                                      <circle
                                        cx="16"
                                        cy="16"
                                        r={radius}
                                        stroke={strokeColor}
                                        strokeWidth="3"
                                        fill="transparent"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={strokeDashoffset}
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                    <span className="absolute text-[8px] font-black text-slate-800 font-mono">{actLevel}%</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-400 flex items-center gap-2">
                      <CameraOff className="w-4 h-4 text-slate-300" />
                      <span>Screenshots not available</span>
                    </div>
                  )}
                </div>

                {/* Comment / App Window Details */}
                {(inv.comment || inv.windowTitle) && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {inv.comment ? `Note: ${inv.comment}` : `Active Window: ${inv.windowTitle}`}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </>
      )}

      {/* 4. LIGHTBOX SCREENSHOT MODAL */}
      {selectedScreenshot && (
        <ScreenshotModal
          isOpen={!!selectedScreenshot}
          onClose={() => setSelectedScreenshot(null)}
          imageUrl={selectedScreenshot.url}
          title={selectedScreenshot.title}
          timestamp={selectedScreenshot.timestamp}
        />
      )}

      {/* 5. ADD OFFLINE TIME MODAL */}
      <AddOfflineTimeModal
        isOpen={isAddOfflineOpen}
        onClose={() => setIsAddOfflineOpen(false)}
        onSuccess={() => onRefresh && onRefresh()}
        defaultDate={date}
        userId={isAdmin ? user.id : undefined}
      />

      {/* 6. HISTORY OF CHANGES AUDIT MODAL */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">History of Changes</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-80 overflow-y-auto text-xs text-slate-600">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                  <span>Automatic Telemetry Record</span>
                  <span className="text-[10px] text-slate-400">{date}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {intervals.length} activity blocks recorded automatically via Improx Desktop Agent.
                </p>
              </div>
              {attendance?.clockInAt && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                    <span>Shift Clock In</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(attendance.clockInAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Employee authenticated and started work shift tracking.
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
