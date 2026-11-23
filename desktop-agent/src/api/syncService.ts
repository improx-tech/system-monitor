import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { OfflineQueue } from '../storage/offlineQueue';

export class SyncService {
  private serverUrl: string;
  private token: string | null = null;
  private offlineQueue: OfflineQueue;

  constructor(serverUrl: string, offlineQueue: OfflineQueue) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.offlineQueue = offlineQueue;
  }

  public setToken(token: string) {
    this.token = token;
  }

  public setServerUrl(url: string) {
    this.serverUrl = url.replace(/\/$/, '');
  }

  public async login(email: string, password: string) {
    const response = await axios.post(`${this.serverUrl}/api/auth/login`, { email, password });
    this.token = response.data.token;
    return response.data;
  }

  public async logout() {
    if (!this.token) return;
    try {
      await axios.post(
        `${this.serverUrl}/api/auth/logout`,
        {},
        { headers: { Authorization: `Bearer ${this.token}` } }
      );
    } catch (e) {}
  }

  public async clockOut() {
    if (!this.token) return;
    try {
      await axios.post(
        `${this.serverUrl}/api/activity/clock-out`,
        {},
        { headers: { Authorization: `Bearer ${this.token}` } }
      );
    } catch (e) {}
  }

  public async getMyScreenshots(date?: string) {
    if (!this.token) return [];
    try {
      const res = await axios.get(`${this.serverUrl}/api/employee/screenshots`, {
        headers: { Authorization: `Bearer ${this.token}` },
        params: { date }
      });
      return res.data.screenshots || [];
    } catch (e) {
      return [];
    }
  }

  public async getMyAnalytics(date?: string) {
    if (!this.token) return { apps: [], domains: [] };
    try {
      const res = await axios.get(`${this.serverUrl}/api/employee/analytics`, {
        headers: { Authorization: `Bearer ${this.token}` },
        params: { date }
      });
      return {
        apps: res.data.apps || [],
        domains: res.data.domains || []
      };
    } catch (e) {
      return { apps: [], domains: [] };
    }
  }

  public async sendActivityBatch(
    activities: any[],
    clicksPerMinute: number,
    keysPerMinute: number,
    currentStatus: 'ONLINE' | 'IDLE' | 'PAUSED',
    isPaused?: boolean,
    pauseReason?: string,
    pauseComment?: string,
    taskName?: string
  ): Promise<{ success: boolean; totalActiveSeconds?: number; totalIdleSeconds?: number }> {
    if (!this.token || activities.length === 0) return { success: false };

    try {
      const response = await axios.post(
        `${this.serverUrl}/api/activity/upload`,
        {
          activities,
          clicksPerMinute,
          keysPerMinute,
          currentStatus,
          isPaused: !!isPaused,
          pauseReason: pauseReason || null,
          pauseComment: pauseComment || null,
          taskName: taskName || null
        },
        {
          headers: { Authorization: `Bearer ${this.token}` },
          timeout: 10000
        }
      );

      this.flushOfflineQueue().catch(() => {});
      return {
        success: true,
        totalActiveSeconds: response.data.totalActiveSeconds || 0,
        totalIdleSeconds: response.data.totalIdleSeconds || 0
      };
    } catch (error) {
      console.warn('Network offline, enqueuing activities locally:', (error as any).message);
      for (const item of activities) {
        await this.offlineQueue.enqueueActivity(item).catch(() => {});
      }
      return { success: false };
    }
  }

  public async uploadScreenshot(filePath: string, metadata: any): Promise<boolean> {
    if (!this.token || !fs.existsSync(filePath)) return false;

    try {
      const form = new FormData();
      form.append('image', fs.createReadStream(filePath));
      form.append('displayIndex', String(metadata.displayIndex || 0));
      form.append('appName', metadata.appName || '');
      form.append('windowTitle', metadata.windowTitle || '');
      form.append('taskName', metadata.taskName || '');
      form.append('isIdle', String(metadata.isIdle || false));
      form.append('takenAt', metadata.takenAt || new Date().toISOString());

      await axios.post(`${this.serverUrl}/api/activity/screenshots/upload`, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${this.token}`
        },
        timeout: 30000
      });

      console.log('✅ Screenshot uploaded successfully');
      return true;
    } catch (error) {
      console.warn('Screenshot upload failed, enqueuing to local queue:', (error as any).message);
      await this.offlineQueue.enqueueScreenshot(filePath, metadata).catch(() => {});
      return false;
    }
  }

  public async flushOfflineQueue(): Promise<{ totalActiveSeconds?: number; totalIdleSeconds?: number } | void> {
    if (!this.token) return;

    let latestActive: number | undefined;
    let latestIdle: number | undefined;

    // Drain up to 10 batches of 50 activities per flush
    for (let batchNum = 0; batchNum < 10; batchNum++) {
      const pendingActivities = await this.offlineQueue.getPendingActivities(50);
      if (pendingActivities.length === 0) break;

      try {
        const batch = pendingActivities.map((p) => p.data);
        const res = await axios.post(
          `${this.serverUrl}/api/activity/upload`,
          { activities: batch, isCatchUp: true },
          { headers: { Authorization: `Bearer ${this.token}` }, timeout: 15000 }
        );

        const ids = pendingActivities.map((p) => p.id);
        await this.offlineQueue.removeActivities(ids);

        if (res.data) {
          if (typeof res.data.totalActiveSeconds === 'number') latestActive = res.data.totalActiveSeconds;
          if (typeof res.data.totalIdleSeconds === 'number') latestIdle = res.data.totalIdleSeconds;
        }
      } catch (err) {
        break;
      }
    }

    const pendingScreens = await this.offlineQueue.getPendingScreenshots(5);
    for (const screen of pendingScreens) {
      if (fs.existsSync(screen.imagePath)) {
        try {
          const form = new FormData();
          form.append('image', fs.createReadStream(screen.imagePath));
          form.append('displayIndex', String(screen.metadata.displayIndex || 0));
          form.append('appName', screen.metadata.appName || '');
          form.append('windowTitle', screen.metadata.windowTitle || '');
          form.append('isIdle', String(screen.metadata.isIdle || false));
          form.append('takenAt', screen.metadata.takenAt);

          await axios.post(`${this.serverUrl}/api/activity/screenshots/upload`, form, {
            headers: {
              ...form.getHeaders(),
              Authorization: `Bearer ${this.token}`
            },
            timeout: 30000
          });

          await this.offlineQueue.removeScreenshots([screen.id]);
          try {
            fs.unlinkSync(screen.imagePath);
          } catch (e) {}
        } catch (err) {
          break;
        }
      } else {
        await this.offlineQueue.removeScreenshots([screen.id]);
      }
    }
  }

  public async getMyTimeline(dateStr?: string) {
    if (!this.token) return null;
    try {
      const res = await axios.get(`${this.serverUrl}/api/employee/timeline`, {
        params: { date: dateStr },
        headers: { Authorization: `Bearer ${this.token}` }
      });
      return res.data;
    } catch (e) {
      return null;
    }
  }

  public async getMyDetailedReports(dateStr?: string) {
    if (!this.token) return null;
    try {
      const res = await axios.get(`${this.serverUrl}/api/employee/reports/detailed`, {
        params: { date: dateStr },
        headers: { Authorization: `Bearer ${this.token}` }
      });
      return res.data;
    } catch (e) {
      return null;
    }
  }

  public async getMyAttendanceToday(): Promise<{ totalActiveSeconds: number; totalIdleSeconds: number } | null> {
    if (!this.token) return null;
    try {
      const res = await axios.get(`${this.serverUrl}/api/employee/timesheet`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      if (res.data && res.data.timesheet) {
        return {
          totalActiveSeconds: res.data.timesheet.totalActiveSeconds || Math.round((res.data.timesheet.activeHours || 0) * 3600),
          totalIdleSeconds: res.data.timesheet.totalIdleSeconds || Math.round((res.data.timesheet.idleHours || 0) * 3600)
        };
      }
    } catch (e) {}
    return null;
  }
}