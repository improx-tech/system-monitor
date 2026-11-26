import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { RealtimeEmployee } from '../types';
import { useSocket } from '../context/SocketContext';
import { LiveEmployeeCard } from '../components/LiveEmployeeCard';
import { ScreenshotModal } from '../components/ScreenshotModal';
import { Radio, Search, Filter, RefreshCw } from 'lucide-react';

export const LiveGrid: React.FC = () => {
  const [employees, setEmployees] = useState<RealtimeEmployee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const [selectedScreenshot, setSelectedScreenshot] = useState<{
    url: string;
    title: string;
    timestamp: string;
  } | null>(null);

  const { socket } = useSocket();

  const fetchLiveGrid = async () => {
    try {
      const res = await api.get('/admin/realtime');
      setEmployees(res.data.grid);
    } catch (err) {
      console.error('Failed to load realtime grid', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveGrid();
    const interval = setInterval(fetchLiveGrid, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handlePresence = (data: any) => {
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === data.userId ? { ...emp, status: data.status, ...data } : emp))
      );
    };

    const handleActivity = (data: any) => {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === data.userId
            ? {
                ...emp,
                status: data.status,
                currentApp: data.currentApp,
                currentTitle: data.currentTitle,
                currentDomain: data.currentDomain,
                clicksPerMinute: data.clicksPerMinute,
                keysPerMinute: data.keysPerMinute,
                lastActiveAt: data.lastActiveAt
              }
            : emp
        )
      );
    };

    const handleScreenshot = (data: any) => {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === data.userId
            ? {
                ...emp,
                latestScreenshot: {
                  id: data.screenshotId,
                  filePath: data.filePath,
                  takenAt: data.takenAt,
                  appName: data.appName,
                  windowTitle: data.windowTitle
                }
              }
            : emp
        )
      );
    };

    socket.on('employee:presence', handlePresence);
    socket.on('employee:activity', handleActivity);
    socket.on('employee:screenshot', handleScreenshot);

    return () => {
      socket.off('employee:presence', handlePresence);
      socket.off('employee:activity', handleActivity);
      socket.off('employee:screenshot', handleScreenshot);
    };
  }, [socket]);

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.currentApp.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'ALL' ||
      emp.status === filterStatus ||
      (filterStatus === 'IDLE' && emp.status === 'PAUSED');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Real-Time Monitor Grid</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Live active applications, keyboard/mouse meters, and screen previews (Auto-refreshes every 10s)</p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, app..."
              className="bg-white border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 w-48 sm:w-64 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 text-xs shadow-xs">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'ONLINE', label: 'Online' },
              { id: 'IDLE', label: 'Idle / Break' },
              { id: 'OFFLINE', label: 'Offline' }
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilterStatus(id)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  filterStatus === id
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchLiveGrid}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-colors shadow-xs"
            title="Refresh Grid"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Cards */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <Filter className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No employees match this filter</h3>
          <p className="text-xs text-slate-400 mt-1">Try clearing your search query or selecting ALL statuses.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((emp) => (
            <LiveEmployeeCard
              key={emp.id}
              employee={emp}
              onViewScreenshot={(url, title, ts) =>
                setSelectedScreenshot({ url, title, timestamp: ts })
              }
            />
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedScreenshot && (
        <ScreenshotModal
          isOpen={!!selectedScreenshot}
          onClose={() => setSelectedScreenshot(null)}
          imageUrl={selectedScreenshot.url}
          title={selectedScreenshot.title}
          timestamp={selectedScreenshot.timestamp}
        />
      )}
    </div>
  );
};