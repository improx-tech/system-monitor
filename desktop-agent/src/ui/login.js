// Electron IPC Renderer Safe Initialization
let ipcRenderer;
if (typeof require !== 'undefined') {
  try {
    ipcRenderer = require('electron').ipcRenderer;
  } catch (e) {}
}
if (!ipcRenderer && typeof window !== 'undefined' && window.require) {
  try {
    ipcRenderer = window.require('electron').ipcRenderer;
  } catch (e) {}
}

// -------------------------------------------------------------
// DOM ELEMENTS DECLARATION
// -------------------------------------------------------------

// Views
const loginView = document.getElementById('loginView');
const agentDashboardView = document.getElementById('agentDashboardView');

// Login Elements
const serverUrlInput = document.getElementById('serverUrl');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorBox = document.getElementById('errorBox');
const successBox = document.getElementById('successBox');
const btnSubmit = document.getElementById('btnSubmit');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const loginForm = document.getElementById('loginForm');

// Header & User Profile Elements
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const userDepartment = document.getElementById('userDepartment');
const headerStatusDot = document.getElementById('headerStatusDot');
const currentViewTitle = document.getElementById('currentViewTitle') || document.getElementById('pageTitle');
const currentHeaderDate = document.getElementById('currentHeaderDate') || document.getElementById('headerDate');

// Metrics Strip
const todayActiveTime = document.getElementById('todayActiveTime');
const todayBreakTime = document.getElementById('todayBreakTime');
const liveStatusPill = document.getElementById('liveStatusPill');
const liveStatusDot = document.getElementById('liveStatusDot');
const liveStatusText = document.getElementById('liveStatusText');

// Task & Tracking Controls
const taskInput = document.getElementById('taskInput');
const btnAddTask = document.getElementById('btnAddTask');
const btnPlay = document.getElementById('btnPlay');
const btnStop = document.getElementById('btnStop');
const catPills = document.querySelectorAll('.cat-pill');
const todayTimer = document.getElementById('todayTimer');
const displayTaskTitle = document.getElementById('displayTaskTitle');
const displayTaskDuration = document.getElementById('displayTaskDuration');
const liveActiveAppText = document.getElementById('liveActiveAppText');

// Left Navigation Tabs & Panels
const navTabs = document.querySelectorAll('.nav-tab');
const tabPanels = document.querySelectorAll('.tab-content, .tab-panel');

// Date Pickers
const timelineDatePicker = document.getElementById('timelineDatePicker');
const shotsDatePicker = document.getElementById('shotsDatePicker');
const appsDatePicker = document.getElementById('appsDatePicker');
const logsDatePicker = document.getElementById('logsDatePicker');

// Modals
const btnOpenSettings = document.getElementById('btnOpenSettings');
const btnClockOut = document.getElementById('btnClockOut');
const settingsModal = document.getElementById('settingsModal');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnCancelSettings = document.getElementById('btnCancelSettings');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const chkAutoLaunch = document.getElementById('chkAutoLaunch');
const chkAutoStart = document.getElementById('chkAutoStart');
const chkMinimizeTray = document.getElementById('chkMinimizeTray');

const pauseModal = document.getElementById('pauseModal');
const btnClosePause = document.getElementById('btnClosePause');
const btnCancelPause = document.getElementById('btnCancelPause');
const btnConfirmPause = document.getElementById('btnConfirmPause');
const pauseCommentInput = document.getElementById('pauseCommentInput');

// Screenshot Lightbox Elements
const screenshotLightboxModal = document.getElementById('screenshotLightboxModal');
const btnCloseLightbox = document.getElementById('btnCloseLightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxTaskName = document.getElementById('lightboxTaskName');
const lightboxTimestamp = document.getElementById('lightboxTimestamp');
const btnManualScreenshot = document.getElementById('btnManualScreenshot');

// -------------------------------------------------------------
// STATE VARIABLES
// -------------------------------------------------------------
let currentCategory = 'WORK';
let currentTaskName = 'General Work';
let isRunning = false;
let isPaused = false;
let isSystemIdle = false;
let sessionSeconds = 0;
let timerInterval = null;

// Helper for accurate local YYYY-MM-DD date string
function getLocalDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Initialize Date Pickers to Today (Local Time)
const todayISO = getLocalDateString();
if (timelineDatePicker) timelineDatePicker.value = todayISO;
if (shotsDatePicker) shotsDatePicker.value = todayISO;
if (appsDatePicker) appsDatePicker.value = todayISO;
if (logsDatePicker) logsDatePicker.value = todayISO;

if (currentHeaderDate) {
  currentHeaderDate.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// -------------------------------------------------------------
// 1. LEFT SIDEBAR NAVIGATION LOGIC
// -------------------------------------------------------------
const tabTitles = {
  tabTracker: 'Live Tracker',
  tabTimeline: '24-Hour Activity Timeline',
  tabScreenshots: 'My Screenshots Gallery',
  tabApps: 'Software & Web History',
  tabLogs: 'Daily Timesheet & Activity Logs'
};

navTabs.forEach((tab) => {
  tab.addEventListener('click', async () => {
    navTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    const targetTabId = tab.getAttribute('data-tab');
    tabPanels.forEach((p) => p.classList.add('hidden'));

    const targetPanel = document.getElementById(targetTabId);
    if (targetPanel) targetPanel.classList.remove('hidden');

    if (currentViewTitle && tabTitles[targetTabId]) {
      currentViewTitle.textContent = tabTitles[targetTabId];
    }

    const todayStr = getLocalDateString();

    if (targetTabId === 'tabTimeline') {
      const pickerVal = timelineDatePicker ? timelineDatePicker.value || todayStr : todayStr;
      await loadDesktopTimeline(pickerVal);
    } else if (targetTabId === 'tabScreenshots') {
      const pickerVal = shotsDatePicker ? shotsDatePicker.value || todayStr : todayStr;
      await loadDesktopScreenshots(pickerVal);
    } else if (targetTabId === 'tabApps') {
      const pickerVal = appsDatePicker ? appsDatePicker.value || todayStr : todayStr;
      await loadDesktopApps(pickerVal);
    } else if (targetTabId === 'tabLogs') {
      const pickerVal = logsDatePicker ? logsDatePicker.value || todayStr : todayStr;
      await loadDesktopLogs(pickerVal);
    }
  });
});

if (timelineDatePicker) {
  timelineDatePicker.addEventListener('change', (e) => loadDesktopTimeline(e.target.value));
}
if (shotsDatePicker) {
  shotsDatePicker.addEventListener('change', (e) => loadDesktopScreenshots(e.target.value));
}
if (appsDatePicker) {
  appsDatePicker.addEventListener('change', (e) => loadDesktopApps(e.target.value));
}
if (logsDatePicker) {
  logsDatePicker.addEventListener('change', (e) => loadDesktopLogs(e.target.value));
}

const btnSubTabAppsSummary = document.getElementById('btnSubTabAppsSummary');
const btnSubTabAppsStream = document.getElementById('btnSubTabAppsStream');

if (btnSubTabAppsSummary) {
  btnSubTabAppsSummary.addEventListener('click', () => {
    appsSubTab = 'summary';
    btnSubTabAppsSummary.classList.add('active');
    if (btnSubTabAppsStream) btnSubTabAppsStream.classList.remove('active');
    const todayStr = getLocalDateString();
    const pickerVal = appsDatePicker ? appsDatePicker.value || todayStr : todayStr;
    loadDesktopApps(pickerVal);
  });
}

if (btnSubTabAppsStream) {
  btnSubTabAppsStream.addEventListener('click', () => {
    appsSubTab = 'stream';
    btnSubTabAppsStream.classList.add('active');
    if (btnSubTabAppsSummary) btnSubTabAppsSummary.classList.remove('active');
    const todayStr = getLocalDateString();
    const pickerVal = appsDatePicker ? appsDatePicker.value || todayStr : todayStr;
    loadDesktopApps(pickerVal);
  });
}

// -------------------------------------------------------------
// 2. TIMELINE, SCREENSHOTS, APPS & LOGS LOADERS
// -------------------------------------------------------------

let selectedTimelineHour = null;
let cachedTimelineData = null;
let cachedTimelineDate = null;
let appsSubTab = 'summary';

// Load Timeline
async function loadDesktopTimeline(dateStr) {
  const container = (document.getElementById('desktopTimelineContainer') || document.getElementById('timelineScrubberBar'));
  if (!container || !ipcRenderer) return;
  container.innerHTML = `
    <div class="desktop-loader-box">
      <div class="desktop-spinner"></div>
      <p>Loading 24-hour scrubber timeline for ${dateStr}...</p>
    </div>
  `;

  try {
    const data = await ipcRenderer.invoke('get-my-timeline', dateStr);
    cachedTimelineData = data;
    cachedTimelineDate = dateStr;
    renderDesktopTimeline(data, dateStr);
  } catch (e) {
    container.innerHTML = '<p style="color: #ef4444; font-size: 12px;">Failed to load timeline.</p>';
  }
}

window.filterTimelineHour = function(h) {
  selectedTimelineHour = selectedTimelineHour === h ? null : h;
  if (cachedTimelineData && cachedTimelineDate) {
    renderDesktopTimeline(cachedTimelineData, cachedTimelineDate);
  }
};

function renderDesktopTimeline(data, dateStr) {
  const container = (document.getElementById('desktopTimelineContainer') || document.getElementById('timelineScrubberBar'));
  if (!container) return;

  if (!data || !data.intervals || data.intervals.length === 0) {
    container.innerHTML = '<div style="padding: 30px; color: #64748b; font-size: 13px; font-weight: 600; text-align: center;"><p>No activity timeline recorded for ' + dateStr + '.</p></div>';
    return;
  }

  const activeMins = Math.round((data.attendance?.totalActiveSeconds || 0) / 60);
  const idleMins = Math.round((data.attendance?.totalIdleSeconds || 0) / 60);
  const totalMins = activeMins + idleMins;
  const activeHrs = (activeMins / 60).toFixed(1);
  const prodPct = totalMins > 0 ? Math.round((activeMins / totalMins) * 100) : 100;
  const clockIn = data.attendance?.clockInAt
    ? new Date(data.attendance.clockInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : '—';
  const clockOut = data.attendance?.clockOutAt
    ? new Date(data.attendance.clockOutAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : (data.attendance?.clockInAt ? 'Active Now' : '—');

  // Compute 24 Hourly Activity
  const hourlyStats = Array.from({ length: 24 }).map((_, h) => {
    let activeSec = 0;
    let breakSec = 0;

    (data.intervals || []).forEach((inv) => {
      const s = new Date(inv.startTime);
      const e = inv.endTime ? new Date(inv.endTime) : s;
      const sHour = s.getHours();
      const eHour = e.getHours();

      if (sHour <= h && eHour >= h) {
        const hStart = new Date(s);
        hStart.setHours(h, 0, 0, 0);
        const hEnd = new Date(s);
        hEnd.setHours(h, 59, 59, 999);

        const overlapStart = Math.max(s.getTime(), hStart.getTime());
        const overlapEnd = Math.min(e.getTime(), hEnd.getTime());
        const durSec = Math.max(0, Math.round((overlapEnd - overlapStart) / 1000));

        const isBreak = inv.isIdle || inv.category === 'IDLE' || inv.taskName === 'Break' || (inv.note && inv.note.includes('Break'));
        if (isBreak) {
          breakSec += durSec;
        } else {
          activeSec += durSec;
        }
      }
    });

    const workMins = Math.min(60, Math.round(activeSec / 60));
    const breakMins = Math.min(60 - workMins, Math.round(breakSec / 60));
    const workPct = Math.round((workMins / 60) * 100);
    const breakPct = Math.round((breakMins / 60) * 100);
    const label = h === 0 ? '12a' : (h < 12 ? h + 'a' : (h === 12 ? '12p' : (h - 12) + 'p'));

    return { hour: h, label, workMins, breakMins, workPct, breakPct, activeSec, breakSec };
  });

  // Filter intervals if an hour is clicked
  const filteredIntervals = selectedTimelineHour !== null
    ? (data.intervals || []).filter((inv) => {
        const s = new Date(inv.startTime).getHours();
        const e = inv.endTime ? new Date(inv.endTime).getHours() : s;
        return s <= selectedTimelineHour && e >= selectedTimelineHour;
      })
    : (data.intervals || []);

  const baseUrl = (serverUrlInput && serverUrlInput.value ? serverUrlInput.value : 'https://monitor.improxtech.com').trim().replace(/\/$/, '');

  container.innerHTML = `
    <!-- Attendance Overview Strip -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px;">
      <div>
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Clock In / Out</span>
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">${clockIn} → ${clockOut}</div>
      </div>
      <div>
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Active Work</span>
        <div style="font-size: 13px; font-weight: 800; color: #16a34a; margin-top: 2px;">${activeHrs} hrs (${activeMins}m)</div>
      </div>
      <div>
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Breaks / Away</span>
        <div style="font-size: 13px; font-weight: 800; color: #d97706; margin-top: 2px;">${idleMins} mins</div>
      </div>
      <div>
        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Productivity Score</span>
        <div style="font-size: 13px; font-weight: 800; color: #0284c7; margin-top: 2px;">${prodPct}% Productive</div>
      </div>
    </div>

    <!-- 24-Hour Segmented Bar Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 13px; font-weight: 800; color: #0f172a;">24-Hour Activity Bar</span>
        <span style="font-size: 11px; color: #64748b; font-weight: 600;">(Click any hour to filter task sessions below)</span>
      </div>
      <div style="display: flex; align-items: center; gap: 14px; font-size: 11px; font-weight: 700;">
        <div style="display: flex; align-items: center; gap: 5px;">
          <span style="width: 10px; height: 10px; border-radius: 3px; background: #22c55e;"></span>
          <span style="color: #475569;">Active Work</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <span style="width: 10px; height: 10px; border-radius: 3px; background: #f59e0b;"></span>
          <span style="color: #475569;">Break / Idle</span>
        </div>
      </div>
    </div>

    <!-- 24-Hour Segmented Meter Grid -->
    <div style="display: grid; grid-template-columns: repeat(24, 1fr); gap: 4px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px; margin-bottom: 24px;">
      ${hourlyStats.map((h) => {
        const isSelected = selectedTimelineHour === h.hour;
        const hasActivity = h.workMins > 0 || h.breakMins > 0;
        return `
          <div
            onclick="filterTimelineHour(${h.hour})"
            style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; height: 80px; padding: 4px 2px; border-radius: 8px; cursor: pointer; background: ${isSelected ? '#ffffff' : 'transparent'}; border: ${isSelected ? '2px solid #0284c7' : '1px solid transparent'}; transition: all 0.2s;"
          >
            <span style="font-size: 9px; font-weight: 800; color: #475569;">${h.label}</span>
            <div style="width: 100%; height: 44px; background: #e2e8f0; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column-reverse; margin: 2px 0;">
              ${hasActivity ? `
                <div style="height: ${h.workPct}%; background: #22c55e; width: 100%;"></div>
                <div style="height: ${h.breakPct}%; background: #f59e0b; width: 100%;"></div>
              ` : ''}
            </div>
            <span style="font-size: 9px; font-weight: 800; color: ${h.workMins > 0 ? '#16a34a' : '#94a3b8'};">
              ${h.workMins > 0 ? `${h.workMins}m` : '·'}
            </span>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Task Sessions Feed Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 13px; font-weight: 800; color: #0f172a;">
          ${selectedTimelineHour !== null ? `Hour ${hourlyStats[selectedTimelineHour].label} Sessions (${filteredIntervals.length})` : `All Task Sessions (${filteredIntervals.length})`}
        </span>
      </div>
      ${selectedTimelineHour !== null ? `
        <button onclick="filterTimelineHour(${selectedTimelineHour})" style="background: #e2e8f0; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #0f172a; cursor: pointer;">✕ Show All Hours</button>
      ` : ''}
    </div>

    <!-- Task Sessions List with Screenshots -->
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${filteredIntervals.length === 0 ? `
        <div style="padding: 20px; text-align: center; color: #64748b; font-size: 12px;">No task sessions recorded for this time slice.</div>
      ` : filteredIntervals.map((inv) => {
        const sTime = inv.startTime ? new Date(inv.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
        const eTime = inv.endTime ? new Date(inv.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
        const timeRange = sTime && eTime ? `${sTime} - ${eTime}` : (inv.timeRangeFormatted || 'Active');
        const isBreak = inv.isIdle || inv.category === 'IDLE' || inv.taskName === 'Break' || (inv.note && inv.note.includes('Break'));
        const isMeeting = inv.category === 'COMMUNICATION' || (inv.taskName && inv.taskName.toLowerCase().includes('meeting'));
        const badgeBg = isBreak ? '#fef3c7' : (isMeeting ? '#e0f2fe' : '#dcfce7');
        const badgeText = isBreak ? '#92400e' : (isMeeting ? '#0369a1' : '#166534');
        const badgeLabel = isBreak ? '☕ Break' : (isMeeting ? '💬 Meeting' : '💼 Work');

        // Match screenshots taken during this interval
        const intervalStart = new Date(inv.startTime).getTime();
        const intervalEnd = inv.endTime ? new Date(inv.endTime).getTime() : intervalStart + 60000;
        const matchingShots = (data.screenshots || []).filter((s) => {
          const t = new Date(s.takenAt).getTime();
          return t >= intervalStart - 5000 && t <= intervalEnd + 5000;
        });

        return `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-family: monospace; font-size: 11px; font-weight: 800; color: #475569;">${timeRange}</span>
                <span style="font-size: 13px; font-weight: 700; color: #0f172a;">${inv.taskName || inv.note || 'Productive Work'}</span>
                <span style="background: ${badgeBg}; color: ${badgeText}; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">${badgeLabel}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; font-weight: 800; color: #0284c7;">${inv.durationMinutes || 1}m</span>
                ${inv.appName ? `<span style="font-size: 11px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">${inv.appName}</span>` : ''}
              </div>
            </div>
            ${matchingShots.length > 0 ? `
              <div style="display: flex; gap: 8px; margin-top: 10px; overflow-x: auto; padding-top: 6px; border-top: 1px dashed #f1f5f9;">
                ${matchingShots.map((s) => {
                  const imgUrl = s.filePath.startsWith('http') ? s.filePath : `${baseUrl}${s.filePath}`;
                  const shotTime = new Date(s.takenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                  const shotTask = s.taskName || inv.taskName || 'Screen Capture';
                  return `
                    <div style="position: relative; cursor: pointer;" onclick="openScreenshotLightbox('${imgUrl}', '${shotTask.replace(/'/g, "\\\\'")}', '${shotTime}')">
                      <img src="${imgUrl}" alt="Thumbnail" style="width: 110px; height: 62px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;" onerror="this.src='https://via.placeholder.com/110x62?text=Screenshot'">
                      <span style="position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.65); color: #fff; font-size: 8px; font-weight: 700; padding: 1px 4px; border-radius: 3px; font-family: monospace;">${shotTime}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Load Screenshots Gallery
async function loadDesktopScreenshots(dateStr) {
  const container = document.getElementById('desktopShotsGrid');
  if (!container || !ipcRenderer) return;
  container.innerHTML = `
    <div class="desktop-loader-box" style="grid-column: 1 / -1;">
      <div class="desktop-spinner"></div>
      <p>Loading verified screen captures for ${dateStr}...</p>
    </div>
  `;

  try {
    const list = await ipcRenderer.invoke('get-my-screenshots', dateStr);
    if (!list || list.length === 0) {
      container.innerHTML = '<div style="padding: 50px 20px; color: #64748b; font-size: 13px; font-weight: 600; grid-column: 1 / -1; text-align: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; margin-top: 12px;"><p style="font-size: 14px; font-weight: 800; color: #1e293b;">No screenshots recorded for ' + dateStr + '</p><p style="font-size: 12px; color: #64748b; margin-top: 6px;">Click <span style="color: #10b981; font-weight: 800;">▶ START WORK</span> on Live Tracker to start automated screen captures.</p></div>';
      return;
    }

    const baseUrl = (serverUrlInput && serverUrlInput.value ? serverUrlInput.value : 'https://monitor.improxtech.com').trim().replace(/\/$/, '');

    container.innerHTML = list.map((s) => {
      const imgUrl = s.filePath.startsWith('http') ? s.filePath : `${baseUrl}${s.filePath}`;
      const timeFormatted = new Date(s.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const taskLabel = s.taskName || s.appName || 'Active Work';
      const isIdle = s.isIdle || s.category === 'IDLE';
      // 10-minute activity target formula: 70 keys (60%), 25 clicks (40%) = 100%
      const totalKeys = typeof s.intervalKeys === 'number' ? s.intervalKeys : (s.keystrokes || 0);
      const totalClicks = typeof s.intervalClicks === 'number' ? s.intervalClicks : (s.clicks || s.mouseClicks || 0);

      let actLevel = 0;
      if (typeof s.activityPercent === 'number') {
        actLevel = s.activityPercent;
      } else if (!isIdle && (totalKeys > 0 || totalClicks > 0)) {
        const keyScore = Math.min(1.0, totalKeys / 70);
        const clickScore = Math.min(1.0, totalClicks / 25);
        actLevel = (totalKeys >= 70 && totalClicks >= 25) ? 100 : Math.round((keyScore * 60) + (clickScore * 40));
      } else {
        actLevel = 0;
      }
      actLevel = Math.min(100, Math.max(0, actLevel));
      const strokeColor = actLevel >= 70 ? '#10b981' : (actLevel >= 30 ? '#f59e0b' : '#ef4444');
      const radius = 12;
      const circumference = 2 * Math.PI * radius;
      const strokeDashoffset = circumference - (actLevel / 100) * circumference;

      return `
        <div class="shot-card-item" style="border: 1px solid #cbd5e1; border-radius: 14px; overflow: hidden; background: #ffffff; display: flex; flex-direction: column; cursor: pointer;" onclick="openScreenshotLightbox('${imgUrl}', '${taskLabel.replace(/'/g, "\\\\'")}', '${timeFormatted}')">
          <div style="width: 100%; aspect-ratio: 16/9; background: #0f172a; overflow: hidden;">
            <img src="${imgUrl}" alt="${taskLabel}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/300x160?text=Screen+Preview'">
          </div>
          <div style="padding: 10px 12px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="min-width: 0;">
              <div style="font-size: 11px; font-family: monospace; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 4px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: #0284c7;"></span>
                <span>${timeFormatted}</span>
              </div>
              <div style="font-size: 10px; font-weight: 700; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${taskLabel}</div>
            </div>
            
            <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; shrink: 0;" title="Activity Level: ${actLevel}%">
              <svg style="width: 32px; height: 32px; transform: rotate(-90deg);">
                <circle cx="16" cy="16" r="${radius}" stroke="#e2e8f0" stroke-width="3" fill="transparent" />
                <circle cx="16" cy="16" r="${radius}" stroke="${strokeColor}" stroke-width="3" fill="transparent" stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" />
              </svg>
              <span style="position: absolute; font-size: 8px; font-weight: 900; color: #0f172a; font-family: monospace;">${actLevel}%</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = '<p style="color: #ef4444; font-size: 12px;">Failed to load screenshots.</p>';
  }
}

// Open Lightbox
window.openScreenshotLightbox = function(url, task, time) {
  if (lightboxImg) lightboxImg.src = url;
  if (lightboxTaskName) lightboxTaskName.textContent = task || 'Screenshot';
  if (lightboxTimestamp) lightboxTimestamp.textContent = time || '';
  if (screenshotLightboxModal) screenshotLightboxModal.classList.remove('hidden');
};

// Close Lightbox
if (btnCloseLightbox) {
  btnCloseLightbox.addEventListener('click', () => {
    if (screenshotLightboxModal) screenshotLightboxModal.classList.add('hidden');
  });
}

// Escape key to close lightbox
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (screenshotLightboxModal) screenshotLightboxModal.classList.add('hidden');
    if (settingsModal) settingsModal.classList.add('hidden');
    if (pauseModal) pauseModal.classList.add('hidden');
  }
});

// Helper to consolidate micro-intervals into continuous sessions
function consolidateAgentFrontSessions(intervals) {
  if (!intervals || !intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const sessions = [];
  let current = null;

  sorted.forEach((inv) => {
    const isBreak = inv.isIdle || inv.category === 'IDLE' || inv.taskName === 'Break' || (inv.note && inv.note.includes('Break'));
    const isMeeting = inv.category === 'COMMUNICATION' || (inv.taskName && (inv.taskName.toLowerCase().includes('meeting') || inv.taskName.toLowerCase().includes('call')));
    const taskName = (inv.taskName || inv.note || 'Productive Work').trim();
    const cat = isBreak ? 'IDLE' : (isMeeting ? 'COMMUNICATION' : (inv.category || 'WORK'));
    const appName = inv.appName || '';

    const sTime = new Date(inv.startTime);
    const eTime = inv.endTime ? new Date(inv.endTime) : new Date(sTime.getTime() + (inv.durationMinutes || 1) * 60000);
    const mins = inv.durationMinutes || Math.max(1, Math.round((eTime - sTime) / 60000));

    if (!current) {
      current = {
        startTime: sTime,
        endTime: eTime,
        taskName,
        category: cat,
        isBreak,
        isMeeting,
        totalMinutes: mins,
        apps: appName ? [appName] : []
      };
    } else {
      const prevEnd = current.endTime.getTime();
      const currStart = sTime.getTime();
      const isContiguous = (currStart - prevEnd) <= 5 * 60 * 1000;
      const isSameTask = current.taskName === taskName && current.category === cat;

      if (isContiguous && isSameTask) {
        current.endTime = eTime;
        current.totalMinutes += mins;
        if (appName && !current.apps.includes(appName)) {
          current.apps.push(appName);
        }
      } else {
        sessions.push(current);
        current = {
          startTime: sTime,
          endTime: eTime,
          taskName,
          category: cat,
          isBreak,
          isMeeting,
          totalMinutes: mins,
          apps: appName ? [appName] : []
        };
      }
    }
  });

  if (current) sessions.push(current);
  return sessions;
}

// Front Screen Activity Timeline Breakdown
async function loadFrontBreakdown() {
  const container = document.getElementById('frontSessionList');
  const countBadge = document.getElementById('frontSessionCount');
  if (!container || !ipcRenderer) return;

  try {
    const todayStr = getLocalDateString();
    const data = await ipcRenderer.invoke('get-my-timeline', todayStr);
    const intervals = data?.intervals || [];

    if (!intervals.length) {
      container.innerHTML = `
        <div class="empty-breakdown-state">
          <p>No active intervals recorded yet today. Type your task and click <strong>▶ START WORK</strong> above to start tracking!</p>
        </div>
      `;
      if (countBadge) countBadge.textContent = '0 Sessions';
      return;
    }

    const sessions = consolidateAgentFrontSessions(intervals);
    if (countBadge) countBadge.textContent = `${sessions.length} Session${sessions.length > 1 ? 's' : ''}`;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${sessions.map((sess) => {
          const sTime = sess.startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
          const eTime = sess.endTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
          const timeRange = `${sTime} - ${eTime}`;
          const badgeBg = sess.isBreak ? '#fef3c7' : (sess.isMeeting ? '#e0f2fe' : '#dcfce7');
          const badgeText = sess.isBreak ? '#92400e' : (sess.isMeeting ? '#0369a1' : '#166534');
          const badgeLabel = sess.isBreak ? '☕ Break' : (sess.isMeeting ? '💬 Meeting' : '💼 Work');
          const appsStr = sess.apps.length > 0 ? sess.apps.join(', ') : '';

          return `
            <div style="display: flex; align-items: center; justify-content: space-between; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-family: monospace; font-size: 11px; font-weight: 800; color: #475569;">${timeRange}</span>
                <span style="font-size: 13px; font-weight: 800; color: #0f172a;">${sess.taskName}</span>
                <span style="background: ${badgeBg}; color: ${badgeText}; font-size: 10px; font-weight: 800; padding: 3px 9px; border-radius: 6px;">${badgeLabel}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 13px; font-weight: 800; color: #0284c7;">${sess.totalMinutes}m</span>
                ${appsStr ? `<span style="font-size: 11px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 3px 8px; border-radius: 6px;">${appsStr}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (e) {
    console.warn('Failed to load front breakdown:', e);
  }
}

// Load Apps & Web History
async function loadDesktopApps(dateStr) {
  const container = document.getElementById('desktopAppsContainer');
  if (!container || !ipcRenderer) return;

  if (appsSubTab === 'stream') {
    container.innerHTML = `
      <div class="desktop-loader-box">
        <div class="desktop-spinner"></div>
        <p>Loading 20-second live telemetry stream for ${dateStr}...</p>
      </div>
    `;
    try {
      const data = await ipcRenderer.invoke('get-my-timeline', dateStr);
      const blocks = (data && data.activityBlocks) ? data.activityBlocks : [];
      if (blocks.length === 0) {
        container.innerHTML = '<div style="padding: 40px; color: #64748b; font-size: 13px; font-weight: 600; text-align: center;"><p>No 20-second telemetry heartbeat packets recorded yet for ' + dateStr + '.</p></div>';
        return;
      }

      container.innerHTML = `
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22c55e;"></span>
            <span style="font-size: 13px; font-weight: 800; color: #0f172a;">Real-Time 20-Second Activity Stream</span>
            <span style="background: #e0f2fe; color: #0369a1; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 12px;">${blocks.length} packets</span>
          </div>
          <span style="font-size: 11px; font-weight: 600; color: #64748b;">Updates every 20 seconds</span>
        </div>
        <div style="max-height: 480px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
            <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 2;">
              <tr style="border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 10px; text-transform: uppercase;">
                <th style="padding: 8px 10px;">Time</th>
                <th style="padding: 8px 10px;">Application</th>
                <th style="padding: 8px 10px;">Active Window Title</th>
                <th style="padding: 8px 10px;">Domain</th>
                <th style="padding: 8px 10px;">Input Activity</th>
                <th style="padding: 8px 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${[...blocks].sort((a, b) => new Date(a.recordedAt || 0) - new Date(b.recordedAt || 0)).slice(0, 200).map((b) => {
                const timeStr = b.recordedAt
                  ? new Date(b.recordedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
                  : '—';
                return `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 10px; font-family: monospace; font-size: 11px; font-weight: 700; color: #64748b; white-space: nowrap;">${timeStr}</td>
                    <td style="padding: 8px 10px; font-weight: 800; color: #0f172a; white-space: nowrap;">${b.appName || 'Desktop App'}</td>
                    <td style="padding: 8px 10px; color: #334155; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${b.windowTitle || '—'}</td>
                    <td style="padding: 8px 10px; font-weight: 700; color: #0284c7; white-space: nowrap;">${b.domain || '—'}</td>
                    <td style="padding: 8px 10px; font-family: monospace; font-size: 11px; color: #64748b; white-space: nowrap;">${b.mouseClicks || 0} clicks • ${b.keystrokes || 0} keys</td>
                    <td style="padding: 8px 10px; white-space: nowrap;">
                      <span style="background: ${b.isIdle ? '#fef3c7' : '#dcfce7'}; color: ${b.isIdle ? '#92400e' : '#166534'}; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800;">
                        ${b.isIdle ? 'IDLE' : 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      container.innerHTML = '<p style="color: #ef4444; font-size: 12px;">Failed to load live 20s stream.</p>';
    }
    return;
  }

  // Summary sub-tab
  container.innerHTML = `
    <div class="desktop-loader-box">
      <div class="desktop-spinner"></div>
      <p>Loading application and website history for ${dateStr}...</p>
    </div>
  `;
  try {
    const data = await ipcRenderer.invoke('get-my-analytics', dateStr);
    const appsList = Array.isArray(data) ? data : (data.apps || []);
    const domainsList = data.domains || [];

    if (appsList.length === 0 && domainsList.length === 0) {
      container.innerHTML = '<div style="padding: 30px; color: #64748b; font-size: 13px; font-weight: 600; text-align: center;"><p>No software or web activity logged for ' + dateStr + '.</p></div>';
      return;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Applications -->
        <div>
          <h4 style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span>💻</span> Software & Apps Used
          </h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left; color: #475569;">
                <th style="padding: 8px;">Application</th>
                <th style="padding: 8px;">Duration</th>
              </tr>
            </thead>
            <tbody>
              ${appsList.map((a) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; font-weight: 700; color: #0f172a;">${a.appName || 'Software'}</td>
                  <td style="padding: 8px; font-weight: 800; color: #0284c7;">${a.minutes}m</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Web Domains -->
        <div>
          <h4 style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span>🌐</span> Visited Websites & Web History
          </h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left; color: #475569;">
                <th style="padding: 8px;">Website Domain</th>
                <th style="padding: 8px;">Time Spent</th>
              </tr>
            </thead>
            <tbody>
              ${domainsList.length > 0 ? domainsList.map((d) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px; font-weight: 700; color: #0f172a;">${d.domain}</td>
                  <td style="padding: 8px; font-weight: 800; color: #16a34a;">${d.minutes}m</td>
                </tr>
              `).join('') : '<tr><td colspan="2" style="padding: 12px; color: #94a3b8; font-size: 11px;">No web browsing recorded.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<p style="color: #ef4444; font-size: 12px;">Failed to load analytics.</p>';
  }
}

// Load Detailed Logs & Employee Timesheet
async function loadDesktopLogs(dateStr) {
  const container = document.getElementById('desktopLogsContainer');
  if (!container || !ipcRenderer) return;
  container.innerHTML = `
    <div class="desktop-loader-box">
      <div class="desktop-spinner"></div>
      <p>Loading employee timesheet and productivity data for ${dateStr}...</p>
    </div>
  `;

  try {
    const [timelineData, reportsList] = await Promise.all([
      ipcRenderer.invoke('get-my-timeline', dateStr).catch(() => null),
      ipcRenderer.invoke('get-my-reports', dateStr).catch(() => [])
    ]);

    const attendance = timelineData?.attendance || {};
    const intervals = timelineData?.intervals || [];
    const list = (reportsList && reportsList.length > 0) ? reportsList : intervals;

    if ((!list || list.length === 0) && (!attendance || !attendance.clockInAt)) {
      container.innerHTML = '<div style="padding: 30px; color: #64748b; font-size: 13px; font-weight: 600; text-align: center;"><p>No timesheet or activity logs recorded for ' + dateStr + '.</p></div>';
      return;
    }

    const clockIn = attendance.clockInAt
      ? new Date(attendance.clockInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
      : '—';
    const clockOut = attendance.clockOutAt
      ? new Date(attendance.clockOutAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
      : (attendance.clockInAt ? 'Currently Working' : '—');

    const activeSec = attendance.totalActiveSeconds || 0;
    const idleSec = (attendance.totalIdleSeconds || 0) + (attendance.manualPauseSeconds || 0);
    const totalSec = attendance.totalWorkSeconds || (activeSec + idleSec);
    const activeHrs = (activeSec / 3600).toFixed(1);
    const activeMins = Math.round(activeSec / 60);
    const idleMins = Math.round(idleSec / 60);
    const prodScore = totalSec > 0 ? Math.min(100, Math.round((activeSec / totalSec) * 100)) : (activeSec > 0 ? 100 : 0);
    const status = attendance.status || (activeSec > 0 ? 'PRESENT' : 'STANDBY');

    // Calculate Hourly Productivity Graph (8 AM to 8 PM)
    const hourlyGraph = Array.from({ length: 13 }).map((_, idx) => {
      const h = idx + 8; // 8 AM to 8 PM
      let hActiveSec = 0;
      let hIdleSec = 0;

      intervals.forEach((inv) => {
        const s = new Date(inv.startTime);
        const e = inv.endTime ? new Date(inv.endTime) : s;
        if (s.getHours() <= h && e.getHours() >= h) {
          const hStart = new Date(s); hStart.setHours(h, 0, 0, 0);
          const hEnd = new Date(s); hEnd.setHours(h, 59, 59, 999);
          const oStart = Math.max(s.getTime(), hStart.getTime());
          const oEnd = Math.min(e.getTime(), hEnd.getTime());
          const dur = Math.max(0, Math.round((oEnd - oStart) / 1000));
          const isBreak = inv.isIdle || inv.category === 'IDLE' || inv.taskName === 'Break' || (inv.note && inv.note.includes('Break'));
          if (isBreak) hIdleSec += dur;
          else hActiveSec += dur;
        }
      });

      const hWorkMins = Math.min(60, Math.round(hActiveSec / 60));
      const hTotalMins = Math.min(60, Math.round((hActiveSec + hIdleSec) / 60));
      const hScore = hTotalMins > 0 ? Math.round((hWorkMins / hTotalMins) * 100) : (hWorkMins > 0 ? 100 : 0);
      const label = h === 12 ? '12 PM' : (h > 12 ? `${h - 12} PM` : `${h} AM`);

      return { hour: h, label, hWorkMins, hTotalMins, hScore };
    });

    container.innerHTML = `
      <!-- 1. COMPREHENSIVE TIMESHEET SUMMARY CARD -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
          <div>
            <h4 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0;">Daily Timesheet Summary</h4>
            <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">Official attendance and logged hours for ${dateStr}</p>
          </div>
          <span style="background: ${status === 'PRESENT' ? '#dcfce7' : (status === 'COMPLETED' ? '#e0f2fe' : '#f1f5f9')}; color: ${status === 'PRESENT' ? '#166534' : (status === 'COMPLETED' ? '#0369a1' : '#475569')}; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 999px;">
            ● ${status}
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Clock In & Out</span>
            <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 4px;">${clockIn}</div>
            <div style="font-size: 11px; font-weight: 600; color: #94a3b8; margin-top: 2px;">Out: ${clockOut}</div>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px;">
            <span style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Productive Work</span>
            <div style="font-size: 14px; font-weight: 800; color: #15803d; margin-top: 4px;">${activeHrs} hrs</div>
            <div style="font-size: 11px; font-weight: 600; color: #16a34a; margin-top: 2px;">${activeMins} active minutes</div>
          </div>

          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 14px;">
            <span style="font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase;">Breaks & Idle</span>
            <div style="font-size: 14px; font-weight: 800; color: #b45309; margin-top: 4px;">${idleMins} mins</div>
            <div style="font-size: 11px; font-weight: 600; color: #d97706; margin-top: 2px;">Pause & Away time</div>
          </div>

          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 14px;">
            <span style="font-size: 11px; font-weight: 700; color: #0369a1; text-transform: uppercase;">Productivity Score</span>
            <div style="font-size: 14px; font-weight: 800; color: #0284c7; margin-top: 4px;">${prodScore}%</div>
            <div style="width: 100%; height: 5px; background: #e0f2fe; border-radius: 3px; overflow: hidden; margin-top: 4px;">
              <div style="height: 100%; width: ${prodScore}%; background: #0284c7; border-radius: 3px;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. TIME-WISE PRODUCTIVITY GRAPH -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h4 style="font-size: 14px; font-weight: 800; color: #0f172a; margin: 0;">Time-Wise Hourly Productivity Graph</h4>
            <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">Productivity percentage and active work minutes throughout the day</p>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; font-size: 11px; font-weight: 700;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 10px; height: 10px; border-radius: 3px; background: #0284c7;"></span>
              <span style="color: #475569;">Productivity Rate</span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: flex-end; gap: 8px; height: 120px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 12px 10px 12px;">
          ${hourlyGraph.map((h) => {
            const barHeight = Math.max(8, Math.round((h.hWorkMins / 60) * 70));
            const hasData = h.hTotalMins > 0;
            return `
              <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;" title="${h.label}: ${h.hWorkMins}m active (${h.hScore}% productive)">
                <span style="font-size: 9px; font-weight: 800; color: ${hasData ? '#0284c7' : '#94a3b8'}; margin-bottom: 4px;">
                  ${hasData ? `${h.hScore}%` : ''}
                </span>
                <div style="width: 100%; max-width: 28px; height: ${hasData ? barHeight : 4}px; background: ${hasData ? (h.hScore > 75 ? '#0284c7' : '#f59e0b') : '#e2e8f0'}; border-radius: 4px; transition: height 0.3s;"></div>
                <span style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 6px; white-space: nowrap;">${h.label}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 3. DETAILED ACTIVITY LOGS TABLE -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
        <h4 style="font-size: 14px; font-weight: 800; color: #0f172a; margin: 0 0 14px 0;">Detailed Timesheet Interval Records</h4>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 10px; text-transform: uppercase;">
                <th style="padding: 10px;">Time Range</th>
                <th style="padding: 10px;">Task / Activity</th>
                <th style="padding: 10px;">Category</th>
                <th style="padding: 10px;">Duration</th>
                <th style="padding: 10px;">Productivity %</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((r) => {
                const timeDisplay = (r.from && r.to)
                  ? `${r.from} - ${r.to}`
                  : (r.startTime ? `${new Date(r.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })} - ${new Date(r.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}` : (r.timeRangeFormatted || 'Active'));
                const isBreak = r.category === 'IDLE' || r.taskName === 'Break' || r.note === 'Away / Idle Break' || (r.note && r.note.includes('Break'));
                const isMeeting = r.category === 'COMMUNICATION' || (r.taskName && r.taskName.toLowerCase().includes('meeting'));
                const catBg = isBreak ? '#fef3c7' : (isMeeting ? '#e0f2fe' : '#dcfce7');
                const catText = isBreak ? '#92400e' : (isMeeting ? '#0369a1' : '#166534');
                const catLabel = isBreak ? 'BREAK' : (isMeeting ? 'MEETING' : (r.category || 'WORK'));
                const actPercent = r.activityPercent !== undefined ? r.activityPercent : (isBreak ? 0 : 100);

                return `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px; font-family: monospace; font-size: 11px; font-weight: 700; color: #475569; white-space: nowrap;">${timeDisplay}</td>
                    <td style="padding: 10px; font-weight: 700; color: #0f172a;">${r.taskName || r.note || r.appName || 'Work'}</td>
                    <td style="padding: 10px;"><span style="background: ${catBg}; color: ${catText}; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 10px;">${catLabel}</span></td>
                    <td style="padding: 10px; font-weight: 800; color: #0284c7;">${r.durationMinutes || 1}m</td>
                    <td style="padding: 10px;">
                      <span style="background: ${actPercent > 70 ? '#dcfce7' : (actPercent > 40 ? '#fef3c7' : '#fee2e2')}; color: ${actPercent > 70 ? '#166534' : (actPercent > 40 ? '#92400e' : '#991b1b')}; padding: 3px 8px; border-radius: 999px; font-weight: 800; font-size: 10px;">
                        ${actPercent}%
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<p style="color: #ef4444; font-size: 12px;">Failed to load timesheet logs.</p>';
  }
}

// -------------------------------------------------------------
// 3. TRACKER CONTROLS & TIMERS
// -------------------------------------------------------------

// Format Seconds to H:MM:SS
function formatTimerDisplay(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return h + ':' + m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
  }
  return m + ':' + s.toString().padStart(2, '0');
}

function formatHoursMins(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) {
    return h + 'h ' + m.toString().padStart(2, '0') + 'm';
  }
  return m + 'm';
}

function startDigitalTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (isRunning && !isPaused && !isSystemIdle) {
      sessionSeconds++;
      if (todayTimer) todayTimer.textContent = formatTimerDisplay(sessionSeconds);
      if (displayTaskDuration) displayTaskDuration.textContent = formatHoursMins(sessionSeconds);
    }
  }, 1000);
}

function stopDigitalTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function setActiveCategoryPill(category, isPausedState) {
  catPills.forEach((p) => p.classList.remove('active'));
  if (isPausedState) {
    const breakPill = document.querySelector('.cat-pill[data-cat="IDLE"]');
    if (breakPill) breakPill.classList.add('active');
    currentCategory = 'IDLE';
  } else if (category === 'COMMUNICATION') {
    const meetPill = document.querySelector('.cat-pill[data-cat="COMMUNICATION"]');
    if (meetPill) meetPill.classList.add('active');
    currentCategory = 'COMMUNICATION';
  } else {
    const workPill = document.querySelector('.cat-pill[data-cat="WORK"]');
    if (workPill) workPill.classList.add('active');
    currentCategory = 'WORK';
  }
}

function setRunningState(running, paused = false, pauseReason = '') {
  isRunning = running;
  isPaused = paused;

  if (running && !paused) {
    if (btnPlay) btnPlay.classList.add('hidden');
    if (btnStop) {
      btnStop.classList.remove('hidden');
      const stopLabel = btnStop.querySelector('.btn-label');
      if (stopLabel) stopLabel.textContent = 'TAKE BREAK';
      const stopIcon = btnStop.querySelector('.btn-icon');
      if (stopIcon) stopIcon.textContent = '☕';
    }

    if (liveStatusPill) {
      liveStatusPill.className = 'status-indicator-pill working';
      if (liveStatusText) liveStatusText.textContent = currentCategory === 'COMMUNICATION' ? 'IN MEETING / CALL' : 'WORKING';
    }
    if (headerStatusDot) headerStatusDot.style.background = '#22c55e';
    startDigitalTimer();
  } else if (paused) {
    if (btnPlay) {
      btnPlay.classList.remove('hidden');
      const playLabel = btnPlay.querySelector('.btn-label');
      if (playLabel) playLabel.textContent = 'RESUME WORK';
      const playIcon = btnPlay.querySelector('.btn-icon');
      if (playIcon) playIcon.textContent = '▶️';
    }
    if (btnStop) btnStop.classList.add('hidden');

    if (liveStatusPill) {
      liveStatusPill.className = 'status-indicator-pill paused';
      if (liveStatusText) liveStatusText.textContent = pauseReason ? ('ON BREAK: ' + pauseReason) : 'ON BREAK';
    }
    if (headerStatusDot) headerStatusDot.style.background = '#f59e0b';
    stopDigitalTimer();
  } else {
    if (btnPlay) {
      btnPlay.classList.remove('hidden');
      const playLabel = btnPlay.querySelector('.btn-label');
      if (playLabel) playLabel.textContent = 'START WORK';
      const playIcon = btnPlay.querySelector('.btn-icon');
      if (playIcon) playIcon.textContent = '▶️';
    }
    if (btnStop) btnStop.classList.add('hidden');

    if (liveStatusPill) {
      liveStatusPill.className = 'status-indicator-pill standby';
      if (liveStatusText) liveStatusText.textContent = 'STANDBY';
    }
    if (headerStatusDot) headerStatusDot.style.background = '#38bdf8';
    stopDigitalTimer();
  }
}

// Category selection
catPills.forEach((pill) => {
  pill.addEventListener('click', async () => {
    const targetCat = pill.getAttribute('data-cat') || 'WORK';

    // If Take a Break is selected, show pause modal
    if (targetCat === 'IDLE') {
      if (pauseModal) pauseModal.classList.remove('hidden');
      return;
    }

    currentCategory = targetCat;
    setActiveCategoryPill(targetCat, false);

    const taskVal = (taskInput && taskInput.value ? taskInput.value : '').trim();
    let effectiveTask = taskVal;
    if (targetCat === 'COMMUNICATION' && (!effectiveTask || effectiveTask === 'General Work')) {
      effectiveTask = 'Team / Client Meeting';
      if (taskInput) taskInput.value = effectiveTask;
      if (displayTaskTitle) displayTaskTitle.textContent = effectiveTask;
    } else if (!effectiveTask) {
      effectiveTask = 'General Work';
    }

    if (ipcRenderer) {
      if (!isRunning) {
        // Not tracking yet: Start tracking with this category!
        await ipcRenderer.invoke('start-task', { taskName: effectiveTask, category: targetCat });
        setRunningState(true, false);
      } else if (isPaused) {
        // Was on break: Resume tracking with this category!
        await ipcRenderer.invoke('set-task-category', { category: targetCat, taskName: effectiveTask });
        setRunningState(true, false);
      } else {
        // Already running: Switch category dynamically
        await ipcRenderer.invoke('set-task-category', { category: targetCat, taskName: effectiveTask });
      }
    }
  });
});

// Unified Task Start & Add Handler with Instant Feedback & Loaders
let isAddingTask = false;

async function handleStartOrAddTask() {
  if (isAddingTask) return;
  isAddingTask = true;

  if (currentCategory === 'IDLE') {
    currentCategory = 'WORK';
  }
  setActiveCategoryPill(currentCategory, false);

  const task = (taskInput && taskInput.value ? taskInput.value : 'General Work').trim();
  currentTaskName = task;
  if (displayTaskTitle) displayTaskTitle.textContent = task;

  // Visual loader on button
  if (btnAddTask) {
    btnAddTask.disabled = true;
    btnAddTask.innerHTML = '<span class="agent-spinner-sm"></span> <span>Saving...</span>';
  }

  // Prepend instant visual loader in frontSessionList so employee sees immediate response
  const frontContainer = document.getElementById('frontSessionList');
  if (frontContainer) {
    const existingContent = frontContainer.innerHTML;
    frontContainer.innerHTML = `
      <div class="agent-inline-loader" id="taskAddingIndicator">
        <div class="agent-inline-spinner"></div>
        <span>Adding task session <strong>"${task}"</strong> and syncing timeline...</span>
      </div>
      ${existingContent}
    `;
  }

  try {
    if (ipcRenderer) {
      await ipcRenderer.invoke('start-task', { taskName: task, category: currentCategory });
    }
    setRunningState(true, false);
    await loadFrontBreakdown();
  } catch (err) {
    console.warn('Failed to start task:', err);
  } finally {
    if (btnAddTask) {
      btnAddTask.disabled = false;
      btnAddTask.innerHTML = '<span>✓</span> <span>Added</span>';
      setTimeout(() => {
        if (btnAddTask) {
          btnAddTask.innerHTML = '<span id="btnAddTaskIcon">➕</span> <span id="btnAddTaskText">Add Task</span>';
        }
      }, 1500);
    }
    isAddingTask = false;
  }
}

// Explicit Add Task Button
if (btnAddTask) {
  btnAddTask.addEventListener('click', handleStartOrAddTask);
}

// Play / Start Button
if (btnPlay) {
  btnPlay.addEventListener('click', handleStartOrAddTask);
}

// Enter in Task input adds task & starts tracking
if (taskInput) {
  taskInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      await handleStartOrAddTask();
    }
  });
}

// Stop / Pause Button
if (btnStop) {
  btnStop.addEventListener('click', () => {
    if (pauseModal) pauseModal.classList.remove('hidden');
  });
}

// Confirm Pause Modal
if (btnConfirmPause) {
  btnConfirmPause.addEventListener('click', async () => {
    const selected = document.querySelector('input[name="breakReason"]:checked');
    const reason = selected ? selected.value : 'Lunch Break';
    const comment = pauseCommentInput ? pauseCommentInput.value.trim() : '';

    if (ipcRenderer) {
      await ipcRenderer.invoke('stop-task', { reason, comment });
    }
    setRunningState(false, true, reason);
    setActiveCategoryPill('IDLE', true);
    if (pauseModal) pauseModal.classList.add('hidden');
    await loadFrontBreakdown();
  });
}

if (btnClosePause) btnClosePause.addEventListener('click', () => pauseModal && pauseModal.classList.add('hidden'));
if (btnCancelPause) btnCancelPause.addEventListener('click', () => pauseModal && pauseModal.classList.add('hidden'));

// Settings Modal
if (btnOpenSettings) {
  btnOpenSettings.addEventListener('click', async () => {
    if (ipcRenderer) {
      const state = await ipcRenderer.invoke('get-agent-state');
      if (state.userSettings) {
        if (chkAutoLaunch) chkAutoLaunch.checked = !!state.userSettings.launchAtStartup;
        if (chkAutoStart) chkAutoStart.checked = !!state.userSettings.autoStartTracking;
        if (chkMinimizeTray) chkMinimizeTray.checked = state.userSettings.minimizeToTray !== false;
      }
    }
    if (settingsModal) settingsModal.classList.remove('hidden');
  });
}

if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => settingsModal && settingsModal.classList.add('hidden'));
if (btnCancelSettings) btnCancelSettings.addEventListener('click', () => settingsModal && settingsModal.classList.add('hidden'));

if (btnSaveSettings) {
  btnSaveSettings.addEventListener('click', async () => {
    if (ipcRenderer) {
      await ipcRenderer.invoke('save-settings', {
        launchAtStartup: chkAutoLaunch ? chkAutoLaunch.checked : false,
        autoStartTracking: chkAutoStart ? chkAutoStart.checked : false,
        minimizeToTray: chkMinimizeTray ? chkMinimizeTray.checked : true
      });
    }
    if (settingsModal) settingsModal.classList.add('hidden');
  });
}

// Clock Out
if (btnClockOut) {
  btnClockOut.addEventListener('click', async () => {
    if (confirm("Are you sure you want to end today's shift and clock out? Tracking will stop.")) {
      if (ipcRenderer) {
        await ipcRenderer.invoke('clock-out-agent');
      }
    }
  });
}

// -------------------------------------------------------------
// 4. AUTHENTICATION & LOGIN SUBMIT
// -------------------------------------------------------------
async function handleLoginSubmit(e) {
  if (e) {
    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
  }

  if (errorBox) errorBox.classList.add('hidden');
  if (successBox) successBox.classList.add('hidden');

  let serverUrl = (serverUrlInput.value || 'https://monitor.improxtech.com').trim().replace(/\/$/, '');
  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
    serverUrl = 'http://' + serverUrl;
  }

  const email = (emailInput.value || '').trim();
  const password = (passwordInput.value || '').trim();

  if (!email || !password) {
    if (errorBox) {
      errorBox.textContent = '❌ Please enter both your work email and password.';
      errorBox.classList.remove('hidden');
    }
    return;
  }

  if (btnSubmit) btnSubmit.disabled = true;
  if (btnText) btnText.textContent = 'Connecting...';
  if (btnSpinner) btnSpinner.classList.remove('hidden');

  try {
    console.log('>>> Invoking agent-login via IPC with:', serverUrl, email);
    const res = await ipcRenderer.invoke('agent-login', { serverUrl, email, password });
    console.log('>>> agent-login IPC response:', res);

    if (res && res.success) {
      if (successBox) {
        successBox.textContent = '✅ Connected! Loading Workspace...';
        successBox.classList.remove('hidden');
      }
      showDashboardView({ user: res.user, isTracking: false, isPaused: false });
    } else {
      if (errorBox) {
        errorBox.textContent = res && res.message ? ('❌ ' + res.message) : '❌ Login failed. Please check your credentials.';
        errorBox.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error('>>> agent-login IPC caught error:', err);
    if (errorBox) {
      errorBox.textContent = '❌ ' + (err.message || 'Connection failed. Please check server URL.');
      errorBox.classList.remove('hidden');
    }
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
    if (btnText) btnText.textContent = 'Sign In & Connect';
    if (btnSpinner) btnSpinner.classList.add('hidden');
  }
}

if (btnSubmit) {
  btnSubmit.addEventListener('click', handleLoginSubmit);
}
if (loginForm) {
  loginForm.addEventListener('submit', handleLoginSubmit);
}
if (passwordInput) {
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLoginSubmit(e);
  });
}

function showLoginView() {
  if (loginView) loginView.classList.remove('hidden');
  if (agentDashboardView) agentDashboardView.classList.add('hidden');
}

function updateGreeting(name) {
  const h = new Date().getHours();
  let greet = 'Good morning';
  if (h >= 12 && h < 17) greet = 'Good afternoon';
  else if (h >= 17) greet = 'Good evening';
  const firstName = (name || 'Employee').split(' ')[0];
  const el = document.getElementById('greetingMessage');
  if (el) el.textContent = `${greet}, ${firstName}! 👋`;
}

function tickClock() {
  const clockEl = document.getElementById('liveClockDisplay');
  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
}
setInterval(tickClock, 1000);
tickClock();

function showDashboardView(state) {
  if (loginView) loginView.classList.add('hidden');
  if (agentDashboardView) agentDashboardView.classList.remove('hidden');

  const name = state.user?.name || 'Employee';
  if (userName) userName.textContent = name;
  if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
  if (userDepartment) userDepartment.textContent = state.user?.department || 'Design';

  updateGreeting(name);

  if (state.currentTask) {
    currentTaskName = state.currentTask;
    if (taskInput) taskInput.value = state.currentTask;
    if (displayTaskTitle) displayTaskTitle.textContent = state.currentTask;
  } else {
    if (displayTaskTitle) displayTaskTitle.textContent = 'Ready to track work';
  }

  const kpiWork = document.getElementById('kpiTodayWork');
  const kpiBreak = document.getElementById('kpiTodayBreak');
  if (kpiWork && state.activeHoursFormatted) kpiWork.textContent = state.activeHoursFormatted;
  if (kpiBreak && state.idleHoursFormatted) kpiBreak.textContent = state.idleHoursFormatted;

  loadFrontBreakdown();
  setRunningState(state.isTracking, state.isPaused, state.pauseReason);
  setActiveCategoryPill(state.taskCategory, state.isPaused);
}

// Refresh front breakdown every 30 seconds
setInterval(loadFrontBreakdown, 30000);

// Listen for state changes from Main Process
if (ipcRenderer) {
  ipcRenderer.on('agent-state-changed', (event, state) => {
    if (state.user) {
      isSystemIdle = !!state.isIdle;
      showDashboardView(state);
      setActiveCategoryPill(state.taskCategory, state.isPaused);

      if (todayActiveTime && state.activeHoursFormatted) {
        todayActiveTime.textContent = state.activeHoursFormatted;
      }
      if (todayBreakTime && state.idleHoursFormatted) {
        todayBreakTime.textContent = state.idleHoursFormatted;
      }
      if (typeof state.totalActiveSeconds === 'number') {
        sessionSeconds = state.totalActiveSeconds;
        if (todayTimer) todayTimer.textContent = formatTimerDisplay(sessionSeconds);
        if (displayTaskDuration) displayTaskDuration.textContent = formatHoursMins(sessionSeconds);
      }
      const kpiWork = document.getElementById('kpiTodayWork');
      const kpiBreak = document.getElementById('kpiTodayBreak');
      if (kpiWork && state.activeHoursFormatted) kpiWork.textContent = state.activeHoursFormatted;
      if (kpiBreak && state.idleHoursFormatted) kpiBreak.textContent = state.idleHoursFormatted;

      if (liveActiveAppText && state.currentApp) {
        liveActiveAppText.textContent = state.currentApp;
      }

      // If tracking is active but system is idle / screen off / black screen
      if (state.isTracking && !state.isPaused && isSystemIdle) {
        if (liveStatusPill) {
          liveStatusPill.className = 'status-indicator-pill standby';
          if (liveStatusText) liveStatusText.textContent = 'AWAY / IDLE';
        }
        if (headerStatusDot) headerStatusDot.style.background = '#f59e0b';
      }
    }
  });
}
