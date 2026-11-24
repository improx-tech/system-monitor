import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import axios from 'axios';

export class AutoUpdateManager {
  private currentVersion = '1.0.0';
  private updatePending = false;
  private downloadedInstallerPath: string | null = null;
  private serverUrl = 'http://200.141.2.53';
  private checkTimer: NodeJS.Timeout | null = null;

  constructor(serverUrl?: string) {
    if (serverUrl) this.serverUrl = serverUrl.replace(/\/$/, '');
    try {
      this.currentVersion = app ? app.getVersion() : '1.0.0';
    } catch (e) {
      this.currentVersion = '1.0.0';
    }
  }

  public setServerUrl(url: string) {
    if (url) this.serverUrl = url.replace(/\/$/, '');
  }

  public startPeriodicChecks() {
    if (this.checkTimer) clearInterval(this.checkTimer);
    // Initial check 10 seconds after app launch
    setTimeout(() => {
      this.checkForUpdates();
    }, 10000);

    // Check for updates every 1 hour (3600000 ms)
    this.checkTimer = setInterval(() => {
      this.checkForUpdates();
    }, 3600000);
  }

  public async checkForUpdates(): Promise<boolean> {
    try {
      const manifestUrl = `${this.serverUrl}/updates/latest.yml`;
      console.log(`🔍 Silent auto-update check against: ${manifestUrl}`);
      
      const res = await axios.get(manifestUrl, { timeout: 10000 });
      if (!res.data) return false;

      const rawText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const versionMatch = rawText.match(/version:\s*([0-9]+\.[0-9]+\.[0-9]+)/i);
      const exeMatch = rawText.match(/path:\s*([^\r\n]+)/i);

      if (!versionMatch) return false;
      const remoteVersion = versionMatch[1];
      const remoteExeName = exeMatch ? exeMatch[1].trim() : `Improx Monitoring System Setup ${remoteVersion}.exe`;

      if (this.isHigherVersion(remoteVersion, this.currentVersion)) {
        console.log(`🚀 New Desktop Agent update found: v${remoteVersion} (current: v${this.currentVersion})`);
        await this.downloadUpdateSilently(remoteVersion, remoteExeName);
        return true;
      } else {
        console.log(`✅ Desktop Agent is up to date (v${this.currentVersion}).`);
      }
    } catch (e: any) {
      console.log('Silent auto-update check deferred:', e.message);
    }
    return false;
  }

  private isHigherVersion(v1: string, v2: string): boolean {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      if (num1 > num2) return true;
      if (num1 < num2) return false;
    }
    return false;
  }

  private async downloadUpdateSilently(version: string, exeName: string) {
    try {
      const downloadUrl = `${this.serverUrl}/updates/${encodeURIComponent(exeName)}`;
      const userDataDir = app ? app.getPath('userData') : '.';
      const tempPath = path.join(userDataDir, `Improx-Update-${version}.exe`);

      if (fs.existsSync(tempPath)) {
        this.downloadedInstallerPath = tempPath;
        this.updatePending = true;
        console.log(`✅ Update v${version} already downloaded: ${tempPath}`);
        return;
      }

      console.log(`📥 Downloading update v${version} silently in background from ${downloadUrl}...`);
      const response = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', (err) => reject(err));
      });

      this.downloadedInstallerPath = tempPath;
      this.updatePending = true;
      console.log(`✅ Update v${version} downloaded silently to: ${tempPath}`);
    } catch (e: any) {
      console.warn('Failed to download update silently:', e.message);
    }
  }

  public hasPendingUpdate(): boolean {
    return this.updatePending && !!this.downloadedInstallerPath && fs.existsSync(this.downloadedInstallerPath);
  }

  public applyUpdateIfPending(): boolean {
    if (!this.hasPendingUpdate() || !this.downloadedInstallerPath) return false;

    console.log(`🔄 Applying Desktop Agent silent update (${this.downloadedInstallerPath}) during break/clock-out/shutdown...`);
    try {
      // Spawn installer with NSIS silent flag /S
      const child = spawn(this.downloadedInstallerPath, ['/S'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      this.updatePending = false;
      return true;
    } catch (e) {
      console.error('Failed to trigger silent update installer:', e);
      return false;
    }
  }
}
