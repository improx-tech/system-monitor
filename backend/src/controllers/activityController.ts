import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { resolveAppInfo } from '../config/appCategories';
import { socketService } from '../services/socketService';
import { config } from '../config/environment';
import { getCompanyTodayString, sanitizeAttendanceTimes } from '../utils/timeZone';
import path from 'path';

export interface ActivityBatchItem {
  appName: string;
  processName?: string;
  windowTitle?: string;
  domain?: string;
  url?: string;
  taskName?: string;
  comment?: string;
  category?: 'WORK' | 'BROWSING' | 'COMMUNICATION' | 'ENTERTAINMENT' | 'IDLE' | 'OTHER';
  durationSeconds: number;
  mouseClicks: number;
  keystrokes: number;
  isIdle: boolean;
  recordedAt: string;
}

export async function uploadActivityBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      activities,
      currentStatus,
      isPaused,
      pauseReason,
      pauseComment,
      taskName,
      clicksPerMinute,
      keysPerMinute,
      isCatchUp
    } = req.body as {
      activities: ActivityBatchItem[];
      currentStatus?: 'ONLINE' | 'IDLE' | 'PAUSED';
      isPaused?: boolean;
      pauseReason?: string;
      pauseComment?: string;
      taskName?: string;
      clicksPerMinute?: number;
      keysPerMinute?: number;
      isCatchUp?: boolean;
    };

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      if (isPaused || currentStatus) {
        const now = new Date();
        const userStatus = isPaused ? 'PAUSED' : (currentStatus || 'ONLINE');
        await prisma.user.update({
          where: { id: userId },
          data: {
            status: userStatus,
            pauseReason: isPaused ? (pauseReason || 'Break') : null,
            pauseComment: isPaused ? (pauseComment || null) : null,
            lastActiveAt: now
          }
        });
        socketService.broadcastLiveActivity(userId, {
          status: userStatus,
          pauseReason: isPaused ? (pauseReason || 'Break') : null,
          pauseComment: isPaused ? (pauseComment || null) : null,
          lastActiveAt: now
        });
        const todayStr = getCompanyTodayString(now);
        const latestAtt = await prisma.attendance.findUnique({
          where: { userId_date: { userId, date: todayStr } }
        });
        const sanitized = latestAtt ? sanitizeAttendanceTimes(latestAtt, now) : { totalActiveSeconds: 0, combinedBreakSeconds: 0 };
        return res.status(200).json({
          success: true,
          message: 'Status updated',
          totalActiveSeconds: sanitized.totalActiveSeconds,
          totalIdleSeconds: sanitized.combinedBreakSeconds
        });
      }
      return res.status(400).json({ success: false, message: 'Invalid or empty activity batch' });
    }

    const now = new Date();
    const todayCompany = getCompanyTodayString(now);

    // Group duration seconds by actual calendar date in company timezone
    const dateGroups: Record<string, { active: number; idle: number; pause: number; minTime: Date }> = {};

    const isZeroInput = (clicksPerMinute === 0 || clicksPerMinute === undefined) && 
                        (keysPerMinute === 0 || keysPerMinute === undefined);

    const createRecords = activities.map((item) => {
      const isItemZeroInput = (item.mouseClicks === 0 || item.mouseClicks === undefined) &&
                              (item.keystrokes === 0 || item.keystrokes === undefined);
      const isLockOrDesktop = !item.appName ||
                              item.appName === 'Desktop' ||
                              item.appName === 'Lock Screen' ||
                              item.appName === 'explorer.exe' ||
                              item.appName === 'Unknown Application' ||
                              item.processName?.toLowerCase() === 'lockapp.exe' ||
                              item.processName?.toLowerCase() === 'logonui.exe' ||
                              item.processName?.toLowerCase() === 'explorer.exe';

      const lowerTask = (item.taskName || taskName || '').toLowerCase();
      const isMeetingOrCall = item.category === 'COMMUNICATION' ||
                              lowerTask.includes('meeting') ||
                              lowerTask.includes('call') ||
                              lowerTask.includes('discussion') ||
                              lowerTask.includes('client');

      // Zero keyboard/mouse input during sample (unless on active meeting/call),
      // lock screen, black screen, or explicit idle status is always counted as away/break.
      const isEffectiveIdle = !!item.isIdle || 
                              currentStatus === 'IDLE' || 
                              isLockOrDesktop ||
                              (!isMeetingOrCall && isZeroInput && isItemZeroInput);

      const activeTask = isEffectiveIdle ? 'Away / Idle Break' : (item.taskName || taskName || (isPaused ? (pauseReason || 'Break') : 'Active Task'));
      const { friendlyName, category } = resolveAppInfo(
        item.processName || item.appName,
        item.windowTitle,
        item.domain,
        isEffectiveIdle,
        item.category
      );

      const duration = item.durationSeconds || 5;
      const itemRecordTime = item.recordedAt ? new Date(item.recordedAt) : now;
      const itemDate = getCompanyTodayString(itemRecordTime);

      if (!dateGroups[itemDate]) {
        dateGroups[itemDate] = { active: 0, idle: 0, pause: 0, minTime: itemRecordTime };
      } else if (itemRecordTime < dateGroups[itemDate].minTime) {
        dateGroups[itemDate].minTime = itemRecordTime;
      }

      if (isPaused || currentStatus === 'PAUSED') {
        dateGroups[itemDate].pause += duration;
      } else if (isEffectiveIdle) {
        dateGroups[itemDate].idle += duration;
      } else {
        dateGroups[itemDate].active += duration;
      }

      return {
        userId,
        appName: isEffectiveIdle ? 'Away / Idle Break' : friendlyName,
        processName: item.processName || item.appName,
        windowTitle: isEffectiveIdle ? 'Screen Off / Inactivity Break' : (item.windowTitle || ''),
        domain: item.domain || null,
        url: item.url || null,
        taskName: activeTask,
        comment: item.comment || pauseComment || null,
        category: isEffectiveIdle ? 'IDLE' : category,
        durationSeconds: duration,
        mouseClicks: item.mouseClicks || 0,
        keystrokes: item.keystrokes || 0,
        isIdle: isEffectiveIdle,
        recordedAt: itemRecordTime
      };
    });

    await prisma.activityLog.createMany({
      data: createRecords
    });

    // Update Attendance per date accurately and clamp against physical wall-clock elapsed time
    for (const [dateKey, stats] of Object.entries(dateGroups)) {
      let existingAtt = await prisma.attendance.findUnique({
        where: { userId_date: { userId, date: dateKey } }
      });

      if (!existingAtt) {
        const sanitized = sanitizeAttendanceTimes({
          clockInAt: stats.minTime,
          clockOutAt: isCatchUp ? now : null,
          totalActiveSeconds: stats.active,
          totalIdleSeconds: stats.idle,
          manualPauseSeconds: stats.pause
        }, now);

        await prisma.attendance.create({
          data: {
            userId,
            date: dateKey,
            clockInAt: stats.minTime,
            clockOutAt: isCatchUp ? now : null,
            totalActiveSeconds: sanitized.totalActiveSeconds,
            totalIdleSeconds: sanitized.totalIdleSeconds,
            manualPauseSeconds: sanitized.manualPauseSeconds,
            totalWorkSeconds: sanitized.totalWorkSeconds,
            status: 'PRESENT',
            pauseReason: isPaused ? (pauseReason || 'Break') : null
          }
        });
      } else {
        const rawActive = (existingAtt.totalActiveSeconds || 0) + stats.active;
        const rawIdle = (existingAtt.totalIdleSeconds || 0) + stats.idle;
        const rawPause = ((existingAtt as any).manualPauseSeconds || 0) + stats.pause;

        const sanitized = sanitizeAttendanceTimes({
          clockInAt: existingAtt.clockInAt,
          clockOutAt: existingAtt.clockOutAt,
          totalActiveSeconds: rawActive,
          totalIdleSeconds: rawIdle,
          manualPauseSeconds: rawPause
        }, now);

        await prisma.attendance.update({
          where: { id: existingAtt.id },
          data: {
            ...(isCatchUp ? {} : { clockOutAt: null }),
            totalActiveSeconds: sanitized.totalActiveSeconds,
            totalIdleSeconds: sanitized.totalIdleSeconds,
            manualPauseSeconds: sanitized.manualPauseSeconds,
            totalWorkSeconds: sanitized.totalWorkSeconds,
            ...(isCatchUp ? {} : { pauseReason: isPaused ? (pauseReason || 'Break') : null })
          }
        });
      }
    }

    // Only update Live status if this is NOT a historical catch-up batch
    const latestItem = activities[activities.length - 1];
    const resolvedLatest = resolveAppInfo(
      latestItem.processName || latestItem.appName,
      latestItem.windowTitle,
      latestItem.domain,
      latestItem.isIdle,
      latestItem.category
    );

    const anyItemIdle = createRecords.some(r => r.isIdle);
    const userStatus = isPaused 
      ? 'PAUSED' 
      : ((anyItemIdle || currentStatus === 'IDLE') ? 'IDLE' : (currentStatus || 'ONLINE'));
    const activeCurrentTask = taskName || latestItem.taskName || (isPaused ? (pauseReason || 'Break') : (userStatus === 'IDLE' ? 'Away / Idle Break' : 'Active Task'));

    if (!isCatchUp) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: userStatus,
          pauseReason: isPaused ? (pauseReason || 'Break') : null,
          pauseComment: isPaused ? (pauseComment || null) : null,
          currentTask: activeCurrentTask,
          lastActiveAt: now,
          currentApp: resolvedLatest.friendlyName,
          currentTitle: latestItem.windowTitle || null,
          currentDomain: latestItem.domain || null
        }
      });

      socketService.broadcastLiveActivity(userId, {
        status: userStatus,
        pauseReason: isPaused ? (pauseReason || 'Break') : null,
        pauseComment: isPaused ? (pauseComment || null) : null,
        currentTask: activeCurrentTask,
        currentApp: resolvedLatest.friendlyName,
        currentTitle: latestItem.windowTitle,
        currentDomain: latestItem.domain,
        clicksPerMinute: clicksPerMinute || 0,
        keysPerMinute: keysPerMinute || 0,
        lastActiveAt: now
      });
    }

    // Fetch latest attendance for today's stats response to agent (fully clamped)
    const todayAtt = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: todayCompany } }
    });

    const sanitizedAtt = todayAtt
      ? sanitizeAttendanceTimes(todayAtt, now)
      : { totalActiveSeconds: 0, combinedBreakSeconds: 0 };

    return res.status(200).json({
      success: true,
      message: 'Processed ' + activities.length + ' activity entries',
      totalActiveSeconds: sanitizedAtt.totalActiveSeconds,
      totalIdleSeconds: sanitizedAtt.combinedBreakSeconds
    });
  } catch (error: any) {
    console.error('Activity upload error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process activity batch', error: error.message });
  }
}

export async function clockOutHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'OFFLINE',
        pauseReason: null,
        pauseComment: null,
        currentTask: null,
        currentApp: null,
        currentTitle: null,
        currentDomain: null
      }
    });

    const activeAtt = await prisma.attendance.findFirst({
      where: { userId, clockOutAt: null },
      orderBy: { createdAt: 'desc' }
    });

    if (activeAtt) {
      await prisma.attendance.update({
        where: { id: activeAtt.id },
        data: { clockOutAt: now }
      });
    }

    return res.status(200).json({ success: true, message: 'Clocked out successfully' });
  } catch (error: any) {
    console.error('Clock out error:', error);
    return res.status(500).json({ success: false, message: 'Failed to clock out', error: error.message });
  }
}

export async function uploadScreenshotHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No screenshot file received' });
    }

    const { displayIndex, appName, windowTitle, taskName, isIdle, takenAt } = req.body;
    const now = takenAt ? new Date(takenAt) : new Date();

    const relativePath = path.relative(config.uploadDir, req.file.path).replace(/\\/g, '/');
    const screenshotUrl = '/uploads/' + relativePath;

    const screenshot = await prisma.screenshot.create({
      data: {
        userId,
        filePath: screenshotUrl,
        fileSize: req.file.size,
        displayIndex: displayIndex ? parseInt(displayIndex, 10) : 0,
        appName: appName || null,
        windowTitle: windowTitle || null,
        taskName: taskName || null,
        isIdle: isIdle === 'true' || isIdle === true,
        takenAt: now
      }
    });

    socketService.broadcastScreenshotNotification(userId, {
      screenshotId: screenshot.id,
      filePath: screenshotUrl,
      appName: screenshot.appName,
      windowTitle: screenshot.windowTitle,
      taskName: screenshot.taskName,
      isIdle: screenshot.isIdle,
      takenAt: screenshot.takenAt
    });

    return res.status(201).json({
      success: true,
      message: 'Screenshot saved and indexed successfully',
      screenshot
    });
  } catch (error: any) {
    console.error('Screenshot upload error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload screenshot', error: error.message });
  }
}