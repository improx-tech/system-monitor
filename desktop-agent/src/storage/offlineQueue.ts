import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface QueuedActivity {
  id: number;
  data: any;
  createdAt: string;
}

export interface QueuedScreenshot {
  id: number;
  imagePath: string;
  metadata: any;
  createdAt: string;
}

export class OfflineQueue {
  private queueFilePath: string;
  private screensQueueFilePath: string;

  constructor() {
    const userDataPath = app ? app.getPath('userData') : path.join(process.env.APPDATA || '.', 'ImproxAgent');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.queueFilePath = path.join(userDataPath, 'activities_queue.json');
    this.screensQueueFilePath = path.join(userDataPath, 'screenshots_queue.json');

    if (!fs.existsSync(this.queueFilePath)) {  
      fs.writeFileSync(this.queueFilePath, JSON.stringify([]));
    }
    if (!fs.existsSync(this.screensQueueFilePath)) {
      fs.writeFileSync(this.screensQueueFilePath, JSON.stringify([]));
    }
  }

  private readActivities(): QueuedActivity[] {
    try {
      if (fs.existsSync(this.queueFilePath)) {
        return JSON.parse(fs.readFileSync(this.queueFilePath, 'utf-8'));
      }
    } catch (e) {}
    return [];
  }

  private writeActivities(items: QueuedActivity[]) {
    try {
      fs.writeFileSync(this.queueFilePath, JSON.stringify(items, null, 2));
    } catch (e) {}
  }

  private readScreenshots(): QueuedScreenshot[] {
    try {
      if (fs.existsSync(this.screensQueueFilePath)) {
        return JSON.parse(fs.readFileSync(this.screensQueueFilePath, 'utf-8'));
      }
    } catch (e) {}
    return [];
  }

  private writeScreenshots(items: QueuedScreenshot[]) {
    try {
      fs.writeFileSync(this.screensQueueFilePath, JSON.stringify(items, null, 2));
    } catch (e) {}
  }

  public async enqueueActivity(activity: any): Promise<void> {
    const list = this.readActivities();
    list.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      data: activity,
      createdAt: new Date().toISOString()
    });
    this.writeActivities(list);
  }

  public async getPendingActivities(limit = 100): Promise<QueuedActivity[]> {
    const list = this.readActivities();
    return list.slice(0, limit);
  }

  public async removeActivities(ids: number[]): Promise<void> {
    const idSet = new Set(ids);
    const list = this.readActivities().filter((item) => !idSet.has(item.id));
    this.writeActivities(list);
  }

  public async enqueueScreenshot(imagePath: string, metadata: any): Promise<void> {
    const list = this.readScreenshots();
    list.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      imagePath,
      metadata,
      createdAt: new Date().toISOString()
    });
    this.writeScreenshots(list);
  }

  public async getPendingScreenshots(limit = 10): Promise<QueuedScreenshot[]> {
    const list = this.readScreenshots();
    return list.slice(0, limit);
  }

  public async removeScreenshots(ids: number[]): Promise<void> {
    const idSet = new Set(ids);
    const list = this.readScreenshots().filter((item) => !idSet.has(item.id));
    this.writeScreenshots(list);
  }
}