import React from 'react';
import { RealtimeEmployee } from '../types';
import { API_BASE_URL } from '../services/api';
import { formatHoursToTime } from '../utils/format';
import { Monitor, MousePointer, Keyboard, Clock, Globe, AppWindow, Maximize2, Tag } from 'lucide-react';

interface LiveEmployeeCardProps {
  employee: RealtimeEmployee;
  onViewScreenshot: (screenshotUrl: string, title: string, timestamp: string) => void;
}

export const LiveEmployeeCard: React.FC<LiveEmployeeCardProps> = ({ employee, onViewScreenshot }) => {
  const statusColor =
    employee.status === 'ONLINE'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
      : employee.status === 'IDLE'
      ? 'bg-amber-50 text-amber-700 border-amber-300'
      : employee.status === 'PAUSED'
      ? 'bg-amber-100 text-amber-800 border-amber-400 font-extrabold'
      : 'bg-rose-50 text-rose-700 border-rose-300';

  const dotColor =
    employee.status === 'ONLINE'
      ? 'bg-emerald-500'
      : employee.status === 'IDLE' || employee.status === 'PAUSED'
      ? 'bg-amber-500'
      : 'bg-rose-500';

  const fullScreenshotUrl = employee.latestScreenshot
    ? `${API_BASE_URL}${employee.latestScreenshot.filePath}`
    : null;

  // Format relative screenshot time (e.g., "a minute ago")
  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    const diffSec = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSec < 60) return 'just now';
    if (diffSec < 120) return 'a minute ago';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
    return `${Math.floor(diffSec / 3600)} hours ago`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-sky-300 transition-all shadow-xs hover:shadow-md group">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center font-extrabold text-sm text-emerald-700 shadow-xs shrink-0">
              {employee.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors truncate" title={employee.name}>
                {employee.name}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium truncate" title={employee.department}>{employee.department}</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shrink-0 max-w-[50%] ${statusColor}`}
            title={
              employee.status === 'PAUSED'
                ? `PAUSED: ${employee.pauseReason || 'Break'} ${employee.pauseComment ? `("${employee.pauseComment}")` : ''}`
                : undefined
            }
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor} ${employee.status === 'ONLINE' ? 'animate-pulse' : ''}`} />
            <span className="truncate">
              {employee.status === 'PAUSED'
                ? `PAUSED: ${employee.pauseReason || 'Break'}`
                : employee.status === 'ONLINE'
                ? 'WORKING'
                : employee.status}
            </span>
          </div>
        </div>

        {/* Task Name Badge (Scrin.io Style) */}
        {employee.status !== 'OFFLINE' && employee.currentTask ? (
          <div className="mb-2.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs min-w-0">
            <div className="flex items-center gap-1.5 text-slate-700 font-bold truncate min-w-0 flex-1">
              <Tag className={`w-3.5 h-3.5 shrink-0 ${employee.status === 'PAUSED' ? 'text-amber-600' : 'text-emerald-600'}`} />
              <span className="truncate" title={employee.currentTask}>{employee.currentTask}</span>
            </div>
            <span className={`text-[10px] font-bold shrink-0 ml-2 ${employee.status === 'PAUSED' ? 'text-amber-700' : 'text-emerald-700'}`}>
              {employee.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE'}
            </span>
          </div>
        ) : (
          <div className="mb-2.5 px-2.5 py-1 rounded-lg bg-slate-50/50 border border-slate-200/60 flex items-center justify-between text-xs min-w-0">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium truncate min-w-0 flex-1">
              <Tag className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span className="truncate">No Active Task</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 shrink-0 ml-2">OFFLINE</span>
          </div>
        )}

        {/* Screenshot Preview */}
        <div className="relative w-full aspect-video rounded-xl bg-slate-100 border border-slate-200 overflow-hidden mb-3.5 flex items-center justify-center group/screen">
          {fullScreenshotUrl ? (
            <>
              <img
                src={fullScreenshotUrl}
                alt="Latest screen capture"
                className="w-full h-full object-cover object-top transition-transform duration-300 group-hover/screen:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />

              {/* Scrin.io-style latest screenshot timestamp badge */}
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-[10px] font-mono text-white flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{getRelativeTime(employee.latestScreenshot?.takenAt)}</span>
              </div>

              <button
                onClick={() =>
                  onViewScreenshot(
                    fullScreenshotUrl,
                    `${employee.name} — ${employee.currentTask || employee.currentApp || 'Desktop'}`,
                    employee.latestScreenshot?.takenAt || new Date().toISOString()
                  )
                }
                className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/screen:opacity-100 flex items-center justify-center gap-2 text-xs font-bold text-white transition-opacity backdrop-blur-xs"
              >
                <Maximize2 className="w-4 h-4 text-emerald-400" /> View Fullscreen
              </button>
            </>
          ) : (
            <div className="text-center p-4">
              <Monitor className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs text-slate-500 font-medium">
                {employee.status === 'OFFLINE' ? 'Offline — Agent Not Running' : 'Capturing screen...'}
              </p>
            </div>
          )}
        </div>

        {/* Current Active Window & Domain */}
        <div className="space-y-2 text-xs mb-3 min-w-0">
          <div className="flex items-center gap-2 text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 min-w-0">
            <AppWindow className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span
              className="truncate font-semibold flex-1 min-w-0"
              title={employee.status === 'OFFLINE' ? 'None (Offline)' : (employee.currentTitle || employee.currentApp || 'Desktop')}
            >
              {employee.status === 'OFFLINE' ? 'None (Offline)' : (employee.currentApp || 'Desktop')}
            </span>
          </div>

          {employee.status !== 'OFFLINE' && employee.currentDomain && (
            <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 min-w-0">
              <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate font-medium flex-1 min-w-0" title={employee.currentDomain}>
                {employee.currentDomain}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 text-sky-600" /> Today
          </span>
          <span className="font-extrabold text-slate-800">{formatHoursToTime(employee.activeHoursToday)}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <MousePointer className="w-3 h-3 text-emerald-600" /> Clicks
          </span>
          <span className="font-extrabold text-slate-800">{employee.clicksPerMinute || 0}/m</span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <Keyboard className="w-3 h-3 text-amber-600" /> Keys
          </span>
          <span className="font-extrabold text-slate-800">{employee.keysPerMinute || 0}/m</span>
        </div>
      </div>
    </div>
  );
};