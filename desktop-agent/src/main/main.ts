import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, powerMonitor, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { OfflineQueue } from '../storage/offlineQueue';
import { SyncService } from '../api/syncService';
import { ScreenshotEngine } from '../tracking/screenshotEngine';
import { NativeTrackerSupervisor, TrackerSample } from '../tracking/activeWindow';
import { AutoUpdateManager } from '../tracking/autoUpdater';

class AgentApplication {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private offlineQueue: OfflineQueue;
  private syncService: SyncService;
  private screenshotEngine: ScreenshotEngine;
  private tracker: NativeTrackerSupervisor;
  private autoUpdater: AutoUpdateManager;

  private isTracking = false;
  private currentUser: any = null;
  private serverUrl = 'http://200.141.2.53';
  private configFilePath: string;

  private currentTask = '';
  private taskCategory = 'WORK';
  private userSettings = {
    launchAtStartup: false,
    autoStartTracking: true,
    trayNotifications: true,
    minimizeToTray: true,
    startStopShortcut: 'Ctrl+Alt+S',
    showHideShortcut: 'Ctrl+Alt+H'
  };

  private activityBuffer: any[] = [];
  private activeWindowTimer: NodeJS.Timeout | null = null;
  private screenshotTimer: NodeJS.Timeout | null = null;

  private screenshotIntervalMinutes = 10;
  private idleThresholdMinutes = 3; // 3 minutes idle/break threshold
  private sampleDurationSeconds = 20; // 20 seconds sample duration (3 logs per min)
  private lastSample: TrackerSample | null = null;
  private lastScreenshotTime = 0;
  private sleepStartTime = 0;
  private lastTickTimestamp = Date.now();

  constructor() {
    this.offlineQueue = new OfflineQueue();
    this.syncService = new SyncService(this.serverUrl, this.offlineQueue);
    this.screenshotEngine = new ScreenshotEngine();
    this.tracker = new NativeTrackerSupervisor(this.idleThresholdMinutes);
    this.autoUpdater = new AutoUpdateManager(this.serverUrl);

    const userDataPath = app ? app.getPath('userData') : path.join(process.env.APPDATA || '.', 'ImproxAgent');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this.configFilePath = path.join(userDataPath, 'agent_config.json');

    this.loadSavedConfig();
  }

  private loadSavedConfig() {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.serverUrl) this.serverUrl = data.serverUrl;
        if (data.token) {
          this.syncService.setToken(data.token);
          this.currentUser = data.user;
          this.refreshTodayAttendance();
        }
        if (data.screenshotInterval) this.screenshotIntervalMinutes = data.screenshotInterval;
        if (data.idleThreshold) this.idleThresholdMinutes = data.idleThreshold;
      }
    } catch (e) {}
  }

  private saveConfig() {
    try {
      const data = {
        serverUrl: this.serverUrl,
        user: this.currentUser,
        token: (this.syncService as any).token,
        screenshotInterval: this.screenshotIntervalMinutes,
        idleThreshold: this.idleThresholdMinutes
      };
      fs.writeFileSync(this.configFilePath, JSON.stringify(data, null, 2));
    } catch (e) {}
  }

  public init() {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      app.quit();
      return;
    }

    app.on('second-instance', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });

    app.whenReady().then(() => {
      this.createTray();
      this.setupIpcHandlers();
      this.setupAutoStart();

      // Start background silent auto-update checker
      this.autoUpdater.startPeriodicChecks();

      // Require explicit employee manual action to start work
      this.createLoginWindow();
    });

    app.on('before-quit', async () => {
      if (this.isTracking) {
        await this.syncService.logout().catch(() => {});
      }
      if (this.autoUpdater.hasPendingUpdate()) {
        this.autoUpdater.applyUpdateIfPending();
      }
      this.tracker.destroy();
    });

    powerMonitor.on('shutdown', async () => {
      if (this.isTracking) {
        await this.syncService.logout().catch(() => {});
      }
      if (this.autoUpdater.hasPendingUpdate()) {
        this.autoUpdater.applyUpdateIfPending();
      }
    });

    powerMonitor.on('suspend', async () => {
      console.log('💤 Laptop entered sleep mode / screen turned off.');
      if (this.isTracking) {
        this.sleepStartTime = Date.now();
        this.pauseTracking('Sleep Break', 'System entered sleep / lid closed');
      }
    });

    powerMonitor.on('lock-screen', async () => {
      console.log('🔒 Screen locked / display off.');
      if (this.isTracking && !this.sleepStartTime) {
        this.sleepStartTime = Date.now();
        this.pauseTracking('Screen Lock Break', 'Screen locked or display slept');
      }
    });

    powerMonitor.on('resume', async () => {
      console.log('⏰ System woke up from sleep.');
      if (this.isTracking) {
        if (this.sleepStartTime > 0) {
          const sleepDuration = Math.round((Date.now() - this.sleepStartTime) / 1000);
          const startTime = new Date(this.sleepStartTime);
          this.sleepStartTime = 0;
          if (sleepDuration >= 5) {
            await this.recordBreakTime(sleepDuration, 'Laptop Sleep Break', startTime);
          }
        }
        this.resumeTracking();
      }
    });

    powerMonitor.on('unlock-screen', async () => {
      console.log('🔓 Screen unlocked.');
      if (this.isTracking) {
        if (this.sleepStartTime > 0) {
          const sleepDuration = Math.round((Date.now() - this.sleepStartTime) / 1000);
          const startTime = new Date(this.sleepStartTime);
          this.sleepStartTime = 0;
          if (sleepDuration >= 5) {
            await this.recordBreakTime(sleepDuration, 'Screen Lock Break', startTime);
          }
        }
        if (this.isPaused && this.pauseReason.includes('Screen Lock')) {
          this.resumeTracking();
        }
      }
    });
  }

  private showAndFocusWindow() {
    if (!this.mainWindow) {
      this.createLoginWindow();
    } else {
      this.mainWindow.show();
      if (this.mainWindow.isMinimized()) this.mainWindow.restore();
      this.mainWindow.focus();
      this.mainWindow.setAlwaysOnTop(true);
      setTimeout(() => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.setAlwaysOnTop(false);
        }
      }, 500);
    }
  }

  private createLoginWindow() {
    if (this.mainWindow) {
      this.showAndFocusWindow();
      return;
    }

    this.mainWindow = new BrowserWindow({
      width: 980,
      height: 700,
      frame: true,
      show: true,
      skipTaskbar: false,
      resizable: true,
      minWidth: 880,
      minHeight: 600,
      backgroundColor: '#ffffff',
      title: 'improX Pro — Enterprise Work Tracker',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.mainWindow.setMenu(null);
    this.mainWindow.setMenuBarVisibility(false);
    this.mainWindow.setSkipTaskbar(false);

    const possiblePaths = [
      path.join(__dirname, '../ui/login.html'),
      path.join(__dirname, '../../src/ui/login.html'),
      path.join(app.getAppPath(), 'dist/ui/login.html'),
      path.join(app.getAppPath(), 'src/ui/login.html')
    ];

    let loaded = false;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.mainWindow.loadFile(p);
        loaded = true;
        break;
      }
    }

    if (!loaded) {
      this.mainWindow.loadFile(path.join(__dirname, '../ui/login.html'));
    }

    this.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[RENDERER CONSOLE] (${line}): ${message}`);
    });

    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private createTray() {
    const iconCandidates = [
      path.join(__dirname, '../assets/icon.ico'),
      path.join(__dirname, '../../assets/icon.ico'),
      path.join(process.resourcesPath || '.', 'assets/icon.ico'),
      path.join(app ? app.getAppPath() : '.', 'assets/icon.ico')
    ];

    let iconPath = '';
    for (const p of iconCandidates) {
      if (fs.existsSync(p)) {
        iconPath = p;
        break;
      }
    }

    const icon = iconPath
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createFromBuffer(
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVDhPY/wPBAxUAIwMDAwM/4GYgUr8n4GB4T+yHA4DqBrQ5fAYQNWALofHAKoGdDk8BlA1oMvhMQAAj4sN6K7bL5gAAAAASUVORK5CYII=',
            'base64'
          )
        );

    this.tray = new Tray(icon);
    this.tray.setToolTip('Improx Monitoring Agent - Active');
    this.updateTrayMenu();

    this.tray.on('click', () => {
      this.showAndFocusWindow();
    });

    this.tray.on('double-click', () => {
      this.showAndFocusWindow();
    });
  }

  private updateTrayMenu() {
    if (!this.tray) return;

    const employeeName = this.currentUser ? this.currentUser.name : 'Not Logged In';
    const statusText = !this.currentUser
      ? 'Offline'
      : this.isTracking
      ? this.lastSample?.isIdle
        ? '🟡 Away (Break / Idle)'
        : '🟢 Tracking (Active)'
      : '🔴 Paused';

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Improx Monitoring v1.0', enabled: false },
      { label: 'Employee: ' + employeeName, enabled: false },
      { label: 'Status: ' + statusText, enabled: false },
      { type: 'separator' },
      {
        label: 'Open Agent Dashboard',
        click: () => this.createLoginWindow()
      },
      {
        label: this.isTracking ? 'Pause Tracking' : 'Resume Tracking',
        enabled: !!this.currentUser,
        click: () => {
          if (this.isTracking) this.pauseTracking('Break');
          else this.resumeTracking();
        }
      },
      { type: 'separator' },
      {
        label: 'Logout',
        enabled: !!this.currentUser,
        click: async () => {
          await this.logout();
        }
      },
      {
        label: 'Clock Out & Exit',
        click: async () => {
          this.isTracking = false;
          if (this.activeWindowTimer) clearInterval(this.activeWindowTimer);
          if (this.screenshotTimer) clearInterval(this.screenshotTimer);
          await this.syncService.clockOut().catch(() => {});
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private setupAutoStart() {
    try {
      app.setLoginItemSettings({
        openAtLogin: false
      });
    } catch (e) {}
  }

  private isPaused = false;
  private pauseReason = '';
  private pauseComment = '';
  private totalActiveSeconds = 0;
  private totalIdleSeconds = 0;

  public pauseTracking(reason: string, comment?: string) {
    this.isPaused = true;
    this.pauseReason = reason || 'Break';
    this.pauseComment = comment || '';
    this.updateTrayMenu();
    this.notifyUIState();
    console.log(`🟡 Tracking paused: ${this.pauseReason} (${this.pauseComment})`);
    
    // Apply downloaded updates silently during breaks
    if (this.autoUpdater.hasPendingUpdate()) {
      console.log('⏸️ Employee paused/took a break. Applying background auto-update now...');
      this.autoUpdater.applyUpdateIfPending();
    }
  }

  public resumeTracking() {
    this.isPaused = false;
    this.pauseReason = '';
    this.pauseComment = '';
    this.updateTrayMenu();
    this.notifyUIState();
    console.log('🟢 Tracking resumed');
  }

  private formatSeconds(sec: number): string {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }

  public async recordBreakTime(durationSeconds: number, reason: string, occurredAt: Date) {
    if (durationSeconds <= 0) return;
    console.log(`☕ Recording ${durationSeconds}s break for: ${reason}`);

    this.totalIdleSeconds += durationSeconds;
    this.notifyUIState();

    const breakItem = {
      appName: 'Break',
      processName: 'System Sleep / Lock',
      windowTitle: reason,
      domain: null,
      url: null,
      taskName: this.currentTask || 'Break',
      category: 'IDLE',
      durationSeconds,
      mouseClicks: 0,
      keystrokes: 0,
      isIdle: true,
      recordedAt: occurredAt.toISOString()
    };

    try {
      const res = await this.syncService.sendActivityBatch(
        [breakItem],
        0,
        0,
        'PAUSED',
        true,
        reason,
        reason,
        this.currentTask
      );
      if (res && res.success) {
        if (typeof res.totalActiveSeconds === 'number') this.totalActiveSeconds = res.totalActiveSeconds;
        if (typeof res.totalIdleSeconds === 'number') this.totalIdleSeconds = res.totalIdleSeconds;
      }
    } catch (e) {
      await this.offlineQueue.enqueueActivity(breakItem).catch(() => {});
    }

    this.updateTrayMenu();
    this.notifyUIState();
  }

  public async refreshTodayAttendance() {
    try {
      const att = await this.syncService.getMyAttendanceToday();
      if (att) {
        this.totalActiveSeconds = att.totalActiveSeconds;
        this.totalIdleSeconds = att.totalIdleSeconds;
        this.notifyUIState();
      }
    } catch (e) {}
  }

  private notifyUIState() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('agent-state-changed', {
        isTracking: this.isTracking,
        isPaused: this.isPaused,
        currentTask: this.currentTask,
        taskCategory: this.taskCategory,
        pauseReason: this.pauseReason,
        pauseComment: this.pauseComment,
        user: this.currentUser,
        serverUrl: this.serverUrl,
        totalActiveSeconds: this.totalActiveSeconds,
        totalIdleSeconds: this.totalIdleSeconds,
        activeHoursFormatted: this.formatSeconds(this.totalActiveSeconds),
        idleHoursFormatted: this.formatSeconds(this.totalIdleSeconds),
        userSettings: this.userSettings
      });
    }
  }

  private setupIpcHandlers() {
    ipcMain.on('window-minimize', () => {
      if (this.mainWindow) this.mainWindow.minimize();
    });

    ipcMain.on('window-close', () => {
      if (this.mainWindow) this.mainWindow.hide();
    });

    ipcMain.handle('clock-out-agent', async () => {
      this.isTracking = false;
      this.isPaused = false;
      if (this.activeWindowTimer) clearInterval(this.activeWindowTimer);
      if (this.screenshotTimer) clearInterval(this.screenshotTimer);
      await this.syncService.clockOut().catch(() => {});
      this.currentUser = null;
      this.syncService.setToken('');
      this.saveConfig();
      this.updateTrayMenu();
      app.quit();
      return { success: true };
    });

    ipcMain.handle('get-my-screenshots', async (evt, date) => {
      return await this.syncService.getMyScreenshots(date);
    });

    ipcMain.handle('capture-screenshot-now', async () => {
      try {
        console.log('📸 Manual screenshot capture requested by employee');
        await this.performScreenshotCapture();
        const dateStr = new Date().toISOString().split('T')[0];
        const shots = await this.syncService.getMyScreenshots(dateStr);
        return { success: true, screenshots: shots };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    });

    ipcMain.handle('get-my-analytics', async (evt, date) => {
      return await this.syncService.getMyAnalytics(date);
    });

    ipcMain.handle('get-my-timeline', async (evt, date) => {
      return await this.syncService.getMyTimeline(date);
    });

    ipcMain.handle('get-my-reports', async (evt, date) => {
      return await this.syncService.getMyDetailedReports(date);
    });

    ipcMain.handle('get-agent-state', () => {
      return {
        isTracking: this.isTracking,
        isPaused: this.isPaused,
        currentTask: this.currentTask,
        taskCategory: this.taskCategory,
        pauseReason: this.pauseReason,
        pauseComment: this.pauseComment,
        user: this.currentUser,
        serverUrl: this.serverUrl,
        activeHoursFormatted: this.formatSeconds(this.totalActiveSeconds),
        idleHoursFormatted: this.formatSeconds(this.totalIdleSeconds),
        userSettings: this.userSettings,
        teamSettings: {
          screenshotsPerHour: Math.round(60 / this.screenshotIntervalMinutes),
          screenshotIntervalMinutes: this.screenshotIntervalMinutes,
          autoPauseMinutes: this.idleThresholdMinutes,
          allowOfflineTime: true,
          trackDomains: true
        }
      };
    });

    ipcMain.handle('start-task', (event, { taskName, category }) => {
      this.currentTask = (taskName || 'General Work').trim();
      this.taskCategory = category || 'WORK';
      this.isPaused = false;
      this.pauseReason = '';
      this.pauseComment = '';
      if (!this.isTracking) {
        this.startTracking();
      } else {
        this.resumeTracking();
      }
      this.notifyUIState();

      // Trigger instant screenshot 2 seconds after starting work/task (if not captured recently)
      setTimeout(() => {
        if (this.isTracking && !this.isPaused) {
          const now = Date.now();
          if (now - this.lastScreenshotTime > 15000) {
            this.performScreenshotCapture();
          }
        }
      }, 2000);

      return { success: true, isTracking: true, currentTask: this.currentTask };
    });

    ipcMain.handle('stop-task', (event, { reason, comment } = {}) => {
      if (reason || comment) {
        this.pauseTracking(reason || 'Break', comment || '');
      } else {
        this.pauseTracking('Break', '');
      }
      return { success: true, isPaused: true };
    });

    ipcMain.handle('save-settings', (event, settings) => {
      this.userSettings = { ...this.userSettings, ...settings };
      if (this.userSettings.launchAtStartup !== undefined) {
        app.setLoginItemSettings({ openAtLogin: !!this.userSettings.launchAtStartup });
      }
      this.saveConfig();
      return { success: true };
    });

    ipcMain.handle('pause-agent', (event, { reason, comment }) => {
      this.pauseTracking(reason, comment);
      return { success: true, isPaused: true };
    });

    ipcMain.handle('resume-agent', () => {
      this.resumeTracking();
      return { success: true, isPaused: false };
    });

    ipcMain.handle('agent-login', async (event, { serverUrl, email, password }) => {
      console.log('>>> ipcMain received agent-login for:', email, 'server:', serverUrl);
      try {
        this.serverUrl = serverUrl;
        this.syncService.setServerUrl(serverUrl);
        const data = await this.syncService.login(email, password);
        console.log('>>> syncService.login succeeded for user:', data.user?.name);

        this.currentUser = data.user;
        if (data.settings?.screenshotInterval) {
          this.screenshotIntervalMinutes = data.settings.screenshotInterval;
        }
        if (data.settings?.idleThreshold) {
          this.idleThresholdMinutes = data.settings.idleThreshold;
          this.tracker.setIdleThreshold(this.idleThresholdMinutes);
        }

        this.saveConfig();
        await this.refreshTodayAttendance();
        // Standby mode: tracking starts manually when user types task note & presses Play/Start
        this.notifyUIState();
        return { success: true, user: data.user, isTracking: false };
      } catch (err: any) {
        console.error('Agent login error:', err.response?.data || err.message);
        return { success: false, message: err.response?.data?.message || err.message || 'Login failed' };
      }
    });
  }

  public startTracking() {
    if (this.isTracking) return;
    this.isTracking = true;
    this.isPaused = false;
    this.updateTrayMenu();
    this.notifyUIState();
    console.log('🟢 Tracking started for:', this.currentUser?.name, 'on task:', this.currentTask);

    this.lastTickTimestamp = Date.now();
    // 1. Poll Native Tracker every 20 seconds
    this.activeWindowTimer = setInterval(async () => {
      const now = Date.now();
      const elapsedSinceLastTick = now - this.lastTickTimestamp;
      this.lastTickTimestamp = now;

      // Detect if system slept or froze between ticks
      if (elapsedSinceLastTick > (this.sampleDurationSeconds * 1000 + 15000)) {
        const sleepGapSeconds = Math.round((elapsedSinceLastTick - this.sampleDurationSeconds * 1000) / 1000);
        if (sleepGapSeconds >= 10) {
          const gapStartTime = new Date(now - elapsedSinceLastTick);
          console.log(`⏳ Detected ${sleepGapSeconds}s gap between ticks (laptop was asleep). Crediting as break.`);
          await this.recordBreakTime(sleepGapSeconds, 'Laptop Sleep / Inactive Break', gapStartTime);
        }
      }

      const sample = await this.tracker.getSample();
      this.lastSample = sample;

      const lowerTask = (this.currentTask || '').toLowerCase();
      const isMeetingOrProductiveTask =
        this.taskCategory === 'COMMUNICATION' ||
        lowerTask.includes('meeting') ||
        lowerTask.includes('call') ||
        lowerTask.includes('discussion') ||
        lowerTask.includes('client') ||
        lowerTask.includes('paperwork');

      const effectiveIdle = this.isPaused ? true : (isMeetingOrProductiveTask ? false : sample.isIdle);

      const logItem = {
        appName: sample.appName,
        processName: sample.processName,
        windowTitle: sample.windowTitle,
        domain: sample.domain,
        url: null,
        taskName: this.currentTask,
        category: this.taskCategory,
        durationSeconds: this.sampleDurationSeconds,
        mouseClicks: sample.clicks,
        keystrokes: sample.keys,
        isIdle: effectiveIdle,
        recordedAt: new Date().toISOString()
      };

      const clicksPerMin = this.isPaused ? 0 : Math.round((sample.clicks / this.sampleDurationSeconds) * 60);
      const keysPerMin = this.isPaused ? 0 : Math.round((sample.keys / this.sampleDurationSeconds) * 60);
      const currentStatus = this.isPaused ? 'PAUSED' : (effectiveIdle ? 'IDLE' : 'ONLINE');

      console.log(`📡 [20s Telemetry] Task: ${this.currentTask} | App: ${sample.appName} | Status: ${currentStatus}`);

      const res = await this.syncService.sendActivityBatch(
        [logItem],
        clicksPerMin,
        keysPerMin,
        currentStatus,
        this.isPaused,
        this.pauseReason,
        this.pauseComment,
        this.currentTask
      );

      if (res.success) {
        if (typeof res.totalActiveSeconds === 'number') this.totalActiveSeconds = res.totalActiveSeconds;
        if (typeof res.totalIdleSeconds === 'number') this.totalIdleSeconds = res.totalIdleSeconds;
      }

      this.updateTrayMenu();
      this.notifyUIState();
    }, this.sampleDurationSeconds * 1000);

    // 2. Screenshot Capture Interval (Every 10 minutes)
    const msInterval = this.screenshotIntervalMinutes * 60 * 1000;
    if (this.screenshotTimer) clearInterval(this.screenshotTimer);
    this.screenshotTimer = setInterval(async () => {
      await this.performScreenshotCapture();
    }, msInterval);
  }

  private async performScreenshotCapture() {
    if (this.isPaused) {
      console.log('⏸️ Tracking is paused. Skipping screenshot capture.');
      return;
    }
    const now = Date.now();
    if (now - this.lastScreenshotTime < 10000) {
      console.log('⏸️ Skipping duplicate screenshot capture (captured <10s ago).');
      return;
    }
    this.lastScreenshotTime = now;
    try {
      console.log('📸 Taking screen capture...');
      const screens = await this.screenshotEngine.captureAllScreens();
      const sample = this.lastSample || await this.tracker.getSample();

      for (const screen of screens) {
        console.log('📤 Uploading screenshot:', screen.filePath);
        await this.syncService.uploadScreenshot(screen.filePath, {
          displayIndex: screen.displayIndex,
          appName: sample.appName,
          windowTitle: sample.windowTitle,
          taskName: this.currentTask,
          isIdle: sample.isIdle,
          takenAt: screen.takenAt
        });
        this.screenshotEngine.cleanupTempFile(screen.filePath);
      }
    } catch (e) {
      console.warn('Screenshot capture routine error:', e);
    }
  }

  public stopTracking() {
    this.isTracking = false;
    if (this.activeWindowTimer) clearInterval(this.activeWindowTimer);
    if (this.screenshotTimer) clearInterval(this.screenshotTimer);
    this.updateTrayMenu();
  }

  public async logout() {
    this.stopTracking();
    await this.syncService.logout();
    this.currentUser = null;
    this.syncService.setToken('');
    this.saveConfig();
    this.updateTrayMenu();
    this.createLoginWindow();
  }
}

const agent = new AgentApplication();
agent.init();