import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { SystemSettings } from '../types';
import {
  Settings as SettingsIcon,
  Save,
  CheckCircle2,
  Terminal,
  ChevronRight,
  Trash2,
  Loader2
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ConsoleLine {
  id: number;
  type: 'cmd' | 'stdout' | 'stderr' | 'info';
  text: string;
}

const QUICK_CMDS = [
  { label: 'pm2 status', cmd: 'pm2 status' },
  { label: 'pm2 restart', cmd: 'pm2 restart all' },
  { label: 'disk usage', cmd: 'df -h' },
  { label: 'memory', cmd: 'free -h' },
  { label: 'uptime', cmd: 'uptime' },
  { label: 'git pull', cmd: 'git pull' },
  { label: 'nginx status', cmd: 'systemctl status nginx --no-pager -l' },
  { label: 'npm build', cmd: 'cd /root/improx-monitor/backend && npm run build' },
];

// ─── Settings Page ─────────────────────────────────────────────────────────
export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Console state
  const [lines, setLines] = useState<ConsoleLine[]>([
    { id: 0, type: 'info', text: '# VPS Console — connected to /root/improx-monitor' },
    { id: 1, type: 'info', text: '# Type any shell command and press Enter or ↵ to run.' },
  ]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const lineId = useRef(2);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data.settings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  // Auto-scroll console to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const addLine = (type: ConsoleLine['type'], text: string) => {
    setLines(prev => [...prev, { id: lineId.current++, type, text }]);
  };

  const runCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    addLine('cmd', `$ ${trimmed}`);
    setHistory(h => [trimmed, ...h.slice(0, 49)]);
    setHistIdx(-1);
    setInput('');
    setRunning(true);

    try {
      const res = await api.post('/admin/console/exec', { command: trimmed });
      const { stdout, stderr } = res.data;
      if (stdout) stdout.split('\n').forEach((l: string) => { if (l !== '') addLine('stdout', l); });
      if (stderr) stderr.split('\n').forEach((l: string) => { if (l !== '') addLine('stderr', l); });
      if (!stdout && !stderr) addLine('info', '(no output)');
    } catch (err: any) {
      const msg = err?.response?.data?.stderr || err?.response?.data?.message || err.message;
      addLine('stderr', `Error: ${msg}`);
    } finally {
      setRunning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : history[idx]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSuccessMsg(null);
    try {
      await api.put('/admin/settings', settings);
      setSuccessMsg('System settings saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to update settings', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-sky-600" />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings &amp; Policies</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium">Configure global desktop agent behavior, capture intervals, and retention</p>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-bold">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── System Settings Form ── */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Desktop Agent Tracking Engine</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Screenshot Frequency (Automated Interval)</label>
              <select
                value={settings.screenshotInterval}
                onChange={(e) => setSettings({ ...settings, screenshotInterval: parseInt(e.target.value, 10) || 10 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white cursor-pointer"
              >
                <option value={5}>Every 5 Minutes (High Monitoring)</option>
                <option value={10}>Every 10 Minutes (Standard Enterprise - Recommended)</option>
                <option value={15}>Every 15 Minutes (Moderate)</option>
                <option value={30}>Every 30 Minutes (Low Overhead)</option>
                <option value={60}>Every 60 Minutes (Hourly)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Controls automated screenshot interval across all connecting desktop agents.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Idle Inactivity Threshold (Minutes)</label>
              <input
                type="number" min="1" max="30"
                value={settings.idleThreshold}
                onChange={(e) => setSettings({ ...settings, idleThreshold: parseInt(e.target.value, 10) || 5 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Triggers Idle state after continuous 0 input.</p>
            </div>
          </div>

          <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Screenshot Retention Period (Days)</label>
              <select
                value={settings.retentionDays}
                onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value, 10) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              >
                <option value={15}>15 Days</option>
                <option value={30}>30 Days (Recommended)</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Company Brand Name</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit" disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* ── VPS Console ── */}
      <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-xl">

        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800">
          <div className="flex items-center gap-2.5">
            {/* Traffic-light dots */}
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            <Terminal className="w-4 h-4 text-slate-400 ml-2" />
            <span className="text-xs font-bold text-slate-300 tracking-wide">Console — root@200.141.2.53</span>
          </div>
          <button
            onClick={() => setLines([{ id: lineId.current++, type: 'info', text: '# Console cleared.' }])}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>

        {/* Quick-command pills */}
        <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-700">
          {QUICK_CMDS.map(q => (
            <button
              key={q.cmd}
              onClick={() => runCommand(q.cmd)}
              disabled={running}
              className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-slate-700 text-slate-300 hover:bg-sky-700 hover:text-white border border-slate-600 hover:border-sky-500 transition-all disabled:opacity-40"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Output area */}
        <div
          className="bg-slate-950 h-80 overflow-y-auto px-4 py-3 font-mono text-xs leading-5 select-text"
          onClick={() => inputRef.current?.focus()}
        >
          {lines.map(line => (
            <div key={line.id} className={
              line.type === 'cmd'    ? 'text-sky-400' :
              line.type === 'stderr' ? 'text-red-400' :
              line.type === 'info'   ? 'text-slate-500' :
                                       'text-emerald-300'
            }>
              {line.text}
            </div>
          ))}
          {running && (
            <div className="flex items-center gap-1.5 text-yellow-400 mt-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>running…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2 bg-slate-900 border-t border-slate-700 px-4 py-2.5">
          <ChevronRight className="w-4 h-4 text-sky-400 shrink-0" />
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={running}
            placeholder="Enter command… (↑↓ for history)"
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent font-mono text-xs text-white placeholder-slate-600 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => runCommand(input)}
            disabled={running || !input.trim()}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all disabled:opacity-40"
          >
            Run
          </button>
        </div>
      </div>

    </div>
  );
};