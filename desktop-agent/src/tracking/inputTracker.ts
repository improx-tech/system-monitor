import { powerMonitor } from 'electron';

let GetAsyncKeyState: any = null;

if (process.platform === 'win32') {
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    GetAsyncKeyState = user32.func('short GetAsyncKeyState(int vKey)');
  } catch (e) {
    console.warn('GetAsyncKeyState loader warning:', e);
  }
}

export class InputTracker {
  private clicksCount = 0;
  private keystrokesCount = 0;
  private idleThresholdSeconds = 60; // 1 minute default
  private pollingTimer: NodeJS.Timeout | null = null;

  constructor(idleThresholdMinutes = 1) {
    this.idleThresholdSeconds = idleThresholdMinutes * 60;
    this.startGlobalInputPolling();
  }

  public setIdleThreshold(minutes: number) {
    this.idleThresholdSeconds = minutes * 60;
  }

  private startGlobalInputPolling() {
    if (!GetAsyncKeyState) return;

    // Track state of mouse buttons and keys
    const previousState = new Uint8Array(256);

    this.pollingTimer = setInterval(() => {
      try {
        // 1. Mouse Clicks (Left=1, Right=2, Middle=4)
        for (const vk of [0x01, 0x02, 0x04]) {
          const state = GetAsyncKeyState(vk);
          const isDown = (state & 0x8000) !== 0;
          if (isDown && !previousState[vk]) {
            this.clicksCount++;
          }
          previousState[vk] = isDown ? 1 : 0;
        }

        // 2. Keyboard Keys (0x08 to 0xFE: Backspace, Tab, Enter, Shift, Ctrl, Alt, Space, A-Z, 0-9, etc.)
        for (let vk = 0x08; vk <= 0xFE; vk++) {
          // Skip mouse buttons already handled
          if (vk === 0x01 || vk === 0x02 || vk === 0x04) continue;

          const state = GetAsyncKeyState(vk);
          const isDown = (state & 0x8000) !== 0;
          if (isDown && !previousState[vk]) {
            this.keystrokesCount++;
          }
          previousState[vk] = isDown ? 1 : 0;
        }
      } catch (e) {}
    }, 50); // High-precision 50ms polling (<0.1% CPU)
  }

  public checkIdleState(): boolean {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    return idleSeconds >= this.idleThresholdSeconds;
  }

  public getAndResetMetrics(sampleDurationSeconds = 30) {
    const isIdle = this.checkIdleState();
    const clicks = this.clicksCount;
    const keys = this.keystrokesCount;

    // Reset counters for next sample window
    this.clicksCount = 0;
    this.keystrokesCount = 0;

    const clicksPerMinute = Math.round((clicks / sampleDurationSeconds) * 60);
    const keysPerMinute = Math.round((keys / sampleDurationSeconds) * 60);

    return {
      clicks,
      keystrokes: keys,
      clicksPerMinute,
      keysPerMinute,
      isIdle
    };
  }

  public destroy() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
  }
}