import React, { useEffect, useState } from 'react';
import { api, API_BASE_URL } from '../services/api';
import { ScreenshotItem, Employee } from '../types';
import { ScreenshotModal } from '../components/ScreenshotModal';
import { getStoredEmployeeId, setStoredEmployeeId } from '../utils/selection';
import { getTodayLocalDateString } from '../utils/format';
import { Image as ImageIcon, Download, User, RefreshCw, AppWindow } from 'lucide-react';

export const Screenshots: React.FC = () => {
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(getStoredEmployeeId());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDateString());
  const [loading, setLoading] = useState(true);
  const [activeModalIndex, setActiveModalIndex] = useState<number | null>(null);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/admin/employees');
      setEmployees(res.data.employees);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchScreenshots = async () => {
    try {
      const params: any = { date: selectedDate };
      if (selectedUserId) params.userId = selectedUserId;

      const res = await api.get('/admin/screenshots', { params });
      setScreenshots(res.data.screenshots);
    } catch (err) {
      console.error('Failed to fetch screenshots', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchScreenshots();
    const interval = setInterval(fetchScreenshots, 10000);
    return () => clearInterval(interval);
  }, [selectedUserId, selectedDate]);

  const handleDownloadZip = () => {
    let url = `${API_BASE_URL}/api/admin/screenshots/export-zip?date=${selectedDate}`;
    if (selectedUserId) url += `&userId=${selectedUserId}`;
    window.open(url, '_blank');
  };

  const currentModalScreenshot = activeModalIndex !== null ? screenshots[activeModalIndex] : null;

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-sky-600" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Screenshots Gallery</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Multi-monitor screen captures taken automatically every 10 minutes (Auto-refreshes every 10s)</p>
        </div>

        {/* Filters & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setStoredEmployeeId(e.target.value);
              }}
              className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-sky-500 shadow-xs"
            >
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.department})
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-sky-500 shadow-xs"
            />
          </div>

          <button
            onClick={handleDownloadZip}
            disabled={screenshots.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
          >
            <Download className="w-4 h-4" /> Download All (ZIP)
          </button>

          <button
            onClick={fetchScreenshots}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : screenshots.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No screenshots found</h3>
          <p className="text-xs text-slate-400 mt-1">Screen captures are uploaded automatically every 10 minutes from the agent.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {screenshots.map((s, index) => {
            const fullUrl = `${API_BASE_URL}${s.filePath}`;
            return (
              <div
                key={s.id}
                onClick={() => setActiveModalIndex(index)}
                className="group bg-white border border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-sky-400 hover:shadow-lg transition-all flex flex-col justify-between shadow-xs"
              >
                {/* Clean Screenshot Preview Image */}
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  <img
                    src={fullUrl}
                    alt={s.appName || 'Screen capture'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Footer Bar Below Image: Employee Name, Time, App & Circular SVG Activity Ring */}
                {(() => {
                  const sAny = s as any;
                  const isIdle = sAny.isIdle || sAny.category === 'IDLE';
                  const totalKeys = typeof sAny.intervalKeys === 'number' ? sAny.intervalKeys : (sAny.keystrokes || 0);
                  const totalClicks = typeof sAny.intervalClicks === 'number' ? sAny.intervalClicks : (sAny.clicks || sAny.mouseClicks || 0);

                  let actLevel = 0;
                  if (typeof sAny.activityPercent === 'number') {
                    actLevel = sAny.activityPercent;
                  } else if (typeof sAny.activityLevel === 'number') {
                    actLevel = sAny.activityLevel;
                  } else if (!isIdle && (totalKeys > 0 || totalClicks > 0)) {
                    const keyScore = (totalKeys / 70) * 60;
                    const clickScore = (totalClicks / 25) * 40;
                    actLevel = Math.round(keyScore + clickScore);
                  } else {
                    actLevel = 0;
                  }
                  actLevel = Math.min(100, Math.max(0, actLevel));
                  const strokeColor = actLevel >= 70 ? '#10b981' : actLevel >= 30 ? '#f59e0b' : '#ef4444';
                  const radius = 12;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset = circumference - (actLevel / 100) * circumference;
                  const timeFormatted = new Date(s.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <div className="p-3 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-900 truncate flex items-center gap-1">
                          <User className="w-3 h-3 text-sky-600 shrink-0" />
                          {s.user.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] font-mono font-bold text-slate-700">{timeFormatted}</span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="text-[10px] text-slate-500 font-medium truncate">{s.appName || 'Desktop'}</span>
                        </div>
                      </div>

                      {/* Circular SVG Activity Progress Ring Meter */}
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
      )}

      {/* Lightbox Modal */}
      {currentModalScreenshot && (
        <ScreenshotModal
          isOpen={activeModalIndex !== null}
          onClose={() => setActiveModalIndex(null)}
          imageUrl={`${API_BASE_URL}${currentModalScreenshot.filePath}`}
          title={`${currentModalScreenshot.user.name} — ${currentModalScreenshot.appName || 'Desktop'}`}
          timestamp={currentModalScreenshot.takenAt}
          onPrev={() => setActiveModalIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
          onNext={() => setActiveModalIndex((prev) => (prev !== null && prev < screenshots.length - 1 ? prev + 1 : prev))}
          hasPrev={activeModalIndex !== null && activeModalIndex > 0}
          hasNext={activeModalIndex !== null && activeModalIndex < screenshots.length - 1}
        />
      )}
    </div>
  );
};