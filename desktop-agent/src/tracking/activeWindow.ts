import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app, powerMonitor } from 'electron';
import { InputTracker } from './inputTracker';

let GetForegroundWindow: any = null;
let GetWindowTextW: any = null;
let GetWindowThreadProcessId: any = null;
let OpenProcess: any = null;
let QueryFullProcessImageNameW: any = null;
let CloseHandle: any = null;

if (process.platform === 'win32') {
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    GetForegroundWindow = user32.func('void* GetForegroundWindow()');
    GetWindowTextW = user32.func('int GetWindowTextW(void* hWnd, _Out_ char16_t* lpString, int nMaxCount)');
    GetWindowThreadProcessId = user32.func('uint32_t GetWindowThreadProcessId(void* hWnd, _Out_ uint32_t* lpdwProcessId)');
    OpenProcess = kernel32.func('void* OpenProcess(uint32_t dwDesiredAccess, int bInheritHandle, uint32_t dwProcessId)');
    QueryFullProcessImageNameW = kernel32.func('int QueryFullProcessImageNameW(void* hProcess, uint32_t dwFlags, _Out_ char16_t* lpExeName, _Inout_ uint32_t* lpdwSize)');
    CloseHandle = kernel32.func('int CloseHandle(void* hObject)');
  } catch (e) {
    console.warn('Native Win32 loader warning in activeWindow:', e);
  }
}

function getForegroundWindowInfo(): { appName: string; processName: string; windowTitle: string } {
  if (process.platform !== 'win32' || !GetForegroundWindow) {
    return { appName: 'Desktop', processName: 'explorer.exe', windowTitle: 'Desktop' };
  }

  try {
    const hwnd = GetForegroundWindow();
    if (!hwnd) {
      return { appName: 'Desktop', processName: 'explorer.exe', windowTitle: 'Desktop' };
    }

    const titleBuf = Buffer.alloc(1024);
    const titleLen = GetWindowTextW(hwnd, titleBuf, 512);
    const windowTitle = titleLen > 0 ? titleBuf.toString('utf16le', 0, titleLen * 2).trim() : 'Active Window';

    let processName = 'explorer.exe';
    const pidBuf = [0];
    GetWindowThreadProcessId(hwnd, pidBuf);
    const pid = pidBuf[0];

    if (pid > 0 && OpenProcess && QueryFullProcessImageNameW && CloseHandle) {
      const hProc = OpenProcess(0x1000, 0, pid);
      if (hProc) {
        const pathBuf = Buffer.alloc(1024);
        const sizeBuf = [512];
        if (QueryFullProcessImageNameW(hProc, 0, pathBuf, sizeBuf)) {
          const fullPath = pathBuf.toString('utf16le', 0, sizeBuf[0] * 2);
          if (fullPath) {
            processName = path.basename(fullPath);
          }
        }
        CloseHandle(hProc);
      }
    }

    const appName = processName.replace(/\.exe$/i, '');
    return { appName, processName, windowTitle };
  } catch (e) {
    return { appName: 'Desktop', processName: 'explorer.exe', windowTitle: 'Desktop' };
  }
}

export interface TrackerSample {
  appName: string;
  processName: string;
  windowTitle: string;
  domain: string | null;
  clicks: number;
  keys: number;
  isIdle: boolean;
}

const BROWSER_PROCESSES = ['chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'opera.exe'];

export function extractDomainFromTitle(title: string): string | null {
  if (!title) return null;

  const domainPattern = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/;
  const match = title.match(domainPattern);
  if (match) {
    return match[1].toLowerCase();
  }

  const lower = title.toLowerCase();
  if (lower.includes('github')) return 'github.com';
  if (lower.includes('youtube')) return 'youtube.com';
  if (lower.includes('gmail') || lower.includes('google mail')) return 'mail.google.com';
  if (lower.includes('google drive')) return 'drive.google.com';
  if (lower.includes('google docs')) return 'docs.google.com';
  if (lower.includes('google sheets')) return 'sheets.google.com';
  if (lower.includes('google search') || lower.includes('google')) return 'google.com';
  if (lower.includes('whatsapp')) return 'web.whatsapp.com';
  if (lower.includes('slack')) return 'slack.com';
  if (lower.includes('jira')) return 'jira.atlassian.net';
  if (lower.includes('notion')) return 'notion.so';
  if (lower.includes('figma')) return 'figma.com';
  if (lower.includes('stack overflow')) return 'stackoverflow.com';
  if (lower.includes('linkedin')) return 'linkedin.com';
  if (lower.includes('chatgpt') || lower.includes('openai')) return 'chatgpt.com';

  return null;
}

export class NativeTrackerSupervisor {
  private child: ChildProcess | null = null;
  private pendingResolves: Array<(sample: TrackerSample) => void> = [];
  private idleThresholdSeconds = 120;
  private inputTracker: InputTracker;

  constructor(idleThresholdMinutes = 2) {
    this.idleThresholdSeconds = idleThresholdMinutes * 60;
    this.inputTracker = new InputTracker(idleThresholdMinutes);
    this.spawnTrackerProcess();
  }

  private findTrackerBinary(): string {
    const candidates = [
      path.join(process.resourcesPath || '.', 'bin', 'tracker_engine.exe'),
      path.join(process.resourcesPath || '.', 'app.asar.unpacked', 'bin', 'tracker_engine.exe'),
      path.join(process.resourcesPath || '.', 'app.asar.unpacked', 'dist', 'bin', 'tracker_engine.exe'),
      path.join(__dirname, '../bin/tracker_engine.exe'),
      path.join(__dirname, '../../bin/tracker_engine.exe'),
      path.join(app ? app.getAppPath() : '.', 'dist/bin/tracker_engine.exe'),
      path.join(app ? app.getAppPath() : '.', 'bin/tracker_engine.exe')
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        console.log('✅ Found tracker binary at:', c);
        return c;
      }
    }
    console.warn('⚠️ Tracker binary not found in candidates, defaulting to:', candidates[0]);
    return candidates[0];
  }

  private spawnTrackerProcess() {
    const binPath = this.findTrackerBinary();
    if (!fs.existsSync(binPath)) {
      console.warn('tracker_engine.exe not found at:', binPath);
      return;
    }

    try {
      this.child = spawn(binPath, [], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let lineBuffer = '';
      this.child.stdout?.on('data', (chunk) => {
        lineBuffer += chunk.toString();
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              const data = JSON.parse(trimmed);
              const processName = data.processName || 'explorer.exe';
              const windowTitle = data.windowTitle || 'Desktop';
              let domain: string | null = null;

              if (BROWSER_PROCESSES.includes(processName.toLowerCase())) {
                domain = extractDomainFromTitle(windowTitle);
              }

              const sample: TrackerSample = {
                appName: processName,
                processName,
                windowTitle,
                domain,
                clicks: data.clicks || 0,
                keys: data.keys || 0,
                isIdle: (data.idleSeconds || 0) >= this.idleThresholdSeconds
              };

              const resolver = this.pendingResolves.shift();
              if (resolver) resolver(sample);
            } catch (e) {}
          }
        }
      });

      this.child.on('exit', () => {
        this.child = null;
        setTimeout(() => this.spawnTrackerProcess(), 2000);
      });
    } catch (e) {
      console.warn('Failed to spawn tracker process:', e);
    }
  }

  public setIdleThreshold(minutes: number) {
    this.idleThresholdSeconds = minutes * 60;
    this.inputTracker.setIdleThreshold(minutes);
  }

  public async getSample(): Promise<TrackerSample> {
    if (process.platform === 'darwin') {
      return this.getMacSample();
    }

    const metrics = this.inputTracker.getAndResetMetrics(20);
    const idleSeconds = powerMonitor ? powerMonitor.getSystemIdleTime() : 0;
    const fg = getForegroundWindowInfo();
    const isLockScreen = fg.processName.toLowerCase() === 'lockapp.exe' || 
                         fg.processName.toLowerCase() === 'logonui.exe' || 
                         fg.processName.toLowerCase().endsWith('.scr');
    const hasInput = (metrics.clicks > 0 || metrics.keystrokes > 0);
    // User is idle ONLY if there was ZERO input AND (lock screen OR idle threshold exceeded)
    const isIdle = !hasInput && (isLockScreen || metrics.isIdle || idleSeconds >= this.idleThresholdSeconds);

    if (!this.child || !this.child.stdin) {
      let domain: string | null = null;
      if (BROWSER_PROCESSES.includes(fg.processName.toLowerCase())) {
        domain = extractDomainFromTitle(fg.windowTitle);
      }

      return {
        appName: isLockScreen ? 'Lock Screen' : (isIdle ? 'Away / Idle Break' : fg.appName),
        processName: fg.processName,
        windowTitle: isLockScreen ? 'Screen Locked' : (isIdle ? 'Black Screen / Idle Break' : fg.windowTitle),
        domain,
        clicks: metrics.clicks,
        keys: metrics.keystrokes,
        isIdle
      };
    }

    return new Promise((resolve) => {
      this.pendingResolves.push(resolve);
      this.child?.stdin?.write('sample\n');

      setTimeout(() => {
        const idx = this.pendingResolves.indexOf(resolve);
        if (idx !== -1) {
          this.pendingResolves.splice(idx, 1);
          const fg = getForegroundWindowInfo();
          resolve({
            appName: fg.appName,
            processName: fg.processName,
            windowTitle: isIdle ? 'Away / Idle' : fg.windowTitle,
            domain: extractDomainFromTitle(fg.windowTitle),
            clicks: metrics.clicks,
            keys: metrics.keystrokes,
            isIdle
          });
        }
      }, 1500);
    });
  }

  private async getMacSample(): Promise<TrackerSample> {
    return new Promise((resolve) => {
      const script = `tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set frontAppName to name of frontApp
        tell process frontAppName
          if exists (window 1) then
            set windowTitle to name of window 1
          else
            set windowTitle to frontAppName
          end if
        end tell
      end tell
      return frontAppName & "|||" & windowTitle`;

      const child = spawn('osascript', ['-e', script]);
      let out = '';
      child.stdout.on('data', (data) => (out += data.toString()));
      child.on('close', () => {
        const parts = out.trim().split('|||');
        const appName = parts[0] || 'Finder';
        const windowTitle = parts[1] || appName;
        const domain = extractDomainFromTitle(windowTitle);

        resolve({
          appName,
          processName: appName,
          windowTitle,
          domain,
          clicks: 1,
          keys: 1,
          isIdle: false
        });
      });

      child.on('error', () => {
        resolve({
          appName: 'Finder',
          processName: 'Finder',
          windowTitle: 'Desktop',
          domain: null,
          clicks: 0,
          keys: 0,
          isIdle: false
        });
      });
    });
  }

  public destroy() {
    this.inputTracker.destroy();
    if (this.child) {
      try {
        this.child.stdin?.write('exit\n');
        this.child.kill();
      } catch (e) {}
    }
  }
}