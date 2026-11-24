import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { buildTimelineIntervals } from './adminController';
import { extractYouTubeVideoTitle } from '../config/appCategories';
import { getCompanyTodayString, getDayBounds, sanitizeAttendanceTimes } from '../utils/timeZone';

export async function getMyProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        shift: user.shift,
        role: user.role,
        status: user.status,
        currentTask: (user as any).currentTask || null,
        pauseReason: (user as any).pauseReason || null,
        pauseComment: (user as any).pauseComment || null,
        currentApp: user.currentApp
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMyScreenshots(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const dateStr = (req.query.date as string) || getCompanyTodayString();
    const { startOfDay, endOfDay } = getDayBounds(dateStr);

    const screenshots = await prisma.screenshot.findMany({
      where: {
        userId,
        takenAt: { gte: startOfDay, lte: endOfDay }
      },
      orderBy: { takenAt: 'desc' }
    });

    // Compute exact 10-minute activity score (70 keys, 25 clicks = 100%) for each screenshot
    const enrichedScreenshots = await Promise.all(
      screenshots.map(async (shot) => {
        const windowStart = new Date(shot.takenAt.getTime() - 10 * 60 * 1000);
        const windowEnd = shot.takenAt;

        const agg = await prisma.activityLog.aggregate({
          where: {
            userId,
            recordedAt: { gte: windowStart, lte: windowEnd }
          },
          _sum: {
            keystrokes: true,
            mouseClicks: true
          }
        });

        const totalKeys = agg._sum.keystrokes || 0;
        const totalClicks = agg._sum.mouseClicks || 0;

        const keyScore = Math.min(1.0, totalKeys / 70);
        const clickScore = Math.min(1.0, totalClicks / 25);

        let activityPercent = Math.round((keyScore * 60) + (clickScore * 40));
        if (totalKeys >= 70 && totalClicks >= 25) {
          activityPercent = 100;
        }
        if (shot.isIdle || (totalKeys === 0 && totalClicks === 0)) {
          activityPercent = 0;
        }

        return {
          ...shot,
          activityPercent: Math.min(100, Math.max(0, activityPercent)),
          intervalKeys: totalKeys,
          intervalClicks: totalClicks
        };
      })
    );

    return res.status(200).json({ success: true, date: dateStr, screenshots: enrichedScreenshots });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMyTimeline(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const dateStr = (req.query.date as string) || getCompanyTodayString();
    const { startOfDay, endOfDay } = getDayBounds(dateStr);

    const [user, logs, attendance, screenshots, offlineTimes] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, department: true, shift: true, currentTask: true }
      }),
      prisma.activityLog.findMany({
        where: {
          userId,
          recordedAt: { gte: startOfDay, lte: endOfDay }
        },
        orderBy: { recordedAt: 'asc' }
      }),
      prisma.attendance.findUnique({
        where: { userId_date: { userId, date: dateStr } }
      }),
      prisma.screenshot.findMany({
        where: {
          userId,
          takenAt: { gte: startOfDay, lte: endOfDay }
        },
        orderBy: { takenAt: 'asc' },
        select: { id: true, filePath: true, appName: true, windowTitle: true, taskName: true, takenAt: true, isIdle: true }
      }),
      prisma.offlineTime.findMany({
        where: {
          userId,
          date: dateStr
        },
        orderBy: { startTime: 'asc' }
      })
    ]);

    const intervals = buildTimelineIntervals(logs, screenshots, offlineTimes);

    const now = new Date();
    const sanitizedAtt = attendance ? sanitizeAttendanceTimes(attendance, now) : null;

    return res.status(200).json({
      success: true,
      user,
      date: dateStr,
      attendance: sanitizedAtt ? {
        ...attendance,
        totalActiveSeconds: sanitizedAtt.totalActiveSeconds,
        totalIdleSeconds: sanitizedAtt.combinedBreakSeconds,
        manualPauseSeconds: sanitizedAtt.manualPauseSeconds,
        totalWorkSeconds: sanitizedAtt.totalWorkSeconds
      } : {
        clockInAt: null,
        clockOutAt: null,
        totalActiveSeconds: 0,
        totalIdleSeconds: 0,
        manualPauseSeconds: 0,
        totalWorkSeconds: 0
      },
      activityBlocks: logs,
      intervals,
      screenshots,
      offlineTimes
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMyTimesheet(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const dateStr = (req.query.date as string) || getCompanyTodayString();

    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: dateStr } }
    });

    if (!attendance) {
      return res.status(200).json({
        success: true,
        timesheet: {
          activeHours: 0,
          idleHours: 0,
          totalHours: 0,
          productivityScore: 0,
          status: 'OFFLINE'
        }
      });
    }

    const now = new Date();
    const sanitized = sanitizeAttendanceTimes(attendance, now);
    const activeHours = parseFloat((sanitized.totalActiveSeconds / 3600).toFixed(2));
    const idleHours = parseFloat((sanitized.combinedBreakSeconds / 3600).toFixed(2));
    const totalHours = parseFloat((sanitized.totalWorkSeconds / 3600).toFixed(2));
    const productivityScore = totalHours > 0 ? Math.min(100, Math.round((activeHours / totalHours) * 100)) : 0;

    return res.status(200).json({
      success: true,
      timesheet: {
        clockInAt: attendance.clockInAt,
        clockOutAt: attendance.clockOutAt,
        totalActiveSeconds: sanitized.totalActiveSeconds,
        totalIdleSeconds: sanitized.combinedBreakSeconds,
        manualPauseSeconds: sanitized.manualPauseSeconds,
        totalWorkSeconds: sanitized.totalWorkSeconds,
        activeHours,
        idleHours,
        totalHours,
        productivityScore,
        status: attendance.status,
        pauseReason: (attendance as any).pauseReason || null
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMyAnalytics(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const dateStr = (req.query.date as string) || getCompanyTodayString();
    const { startOfDay, endOfDay } = getDayBounds(dateStr);

    const appUsage = await prisma.activityLog.groupBy({
      by: ['appName', 'category'],
      where: {
        userId,
        recordedAt: { gte: startOfDay, lte: endOfDay }
      },
      _sum: { durationSeconds: true, mouseClicks: true, keystrokes: true },
      orderBy: { _sum: { durationSeconds: 'desc' } },
      take: 15
    });

    const apps = appUsage.map(item => ({
      appName: item.appName,
      category: item.category,
      minutes: Math.round((item._sum.durationSeconds || 0) / 60),
      clicks: item._sum.mouseClicks || 0,
      keystrokes: item._sum.keystrokes || 0
    }));

    // Web domain usage breakdown
    const domainUsage = await prisma.activityLog.groupBy({
      by: ['domain'],
      where: {
        userId,
        domain: { not: null },
        recordedAt: { gte: startOfDay, lte: endOfDay }
      },
      _sum: { durationSeconds: true },
      orderBy: { _sum: { durationSeconds: 'desc' } },
      take: 15
    });

    const domains = domainUsage
      .filter(d => d.domain && d.domain.trim() !== '')
      .map(d => ({
        domain: d.domain,
        minutes: Math.max(1, Math.round((d._sum.durationSeconds || 0) / 60))
      }));

    // Category distribution breakdown
    const categoryStats = await prisma.activityLog.groupBy({
      by: ['category'],
      where: {
        userId,
        recordedAt: { gte: startOfDay, lte: endOfDay }
      },
      _sum: { durationSeconds: true }
    });

    const categories = categoryStats.map(c => ({
      category: c.category,
      minutes: Math.round((c._sum.durationSeconds || 0) / 60),
      hours: parseFloat(((c._sum.durationSeconds || 0) / 3600).toFixed(2))
    }));

    return res.status(200).json({ success: true, date: dateStr, apps, domains, categories });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// Add Offline Time (Employee Portal)
export async function addMyOfflineTime(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { date, startTime, endTime, taskName, category, reason } = req.body;
    if (!date || !startTime || !endTime || !taskName) {
      return res.status(400).json({ success: false, message: 'Missing required offline time parameters' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    const durationSeconds = durationMinutes * 60;

    const offlineRecord = await prisma.offlineTime.create({
      data: {
        userId,
        date,
        startTime: start,
        endTime: end,
        durationMinutes,
        taskName,
        category: category || 'WORK',
        reason: reason || null
      }
    });

    // Update attendance
    const existingAtt = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date } }
    });

    if (existingAtt) {
      await prisma.attendance.update({
        where: { id: existingAtt.id },
        data: {
          totalActiveSeconds: { increment: durationSeconds },
          totalWorkSeconds: { increment: durationSeconds }
        }
      });
    } else {
      await prisma.attendance.create({
        data: {
          userId,
          date,
          clockInAt: start,
          clockOutAt: end,
          totalActiveSeconds: durationSeconds,
          totalWorkSeconds: durationSeconds,
          status: 'PRESENT'
        }
      });
    }

    return res.status(201).json({ success: true, message: 'Offline time logged successfully', offlineTime: offlineRecord });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMyOfflineTimes(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const dateStr = (req.query.date as string) || getCompanyTodayString();
    const records = await prisma.offlineTime.findMany({
      where: { userId, date: dateStr },
      orderBy: { startTime: 'asc' }
    });

    return res.status(200).json({ success: true, date: dateStr, offlineTimes: records });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteMyOfflineTime(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const record = await prisma.offlineTime.findFirst({ where: { id, userId } });
    if (!record) return res.status(404).json({ success: false, message: 'Offline time record not found' });

    const durationSeconds = (record.durationMinutes || 0) * 60;
    await prisma.offlineTime.delete({ where: { id } });

    const att = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: record.date } }
    });

    if (att) {
      await prisma.attendance.update({
        where: { id: att.id },
        data: {
          totalActiveSeconds: Math.max(0, att.totalActiveSeconds - durationSeconds),
          totalWorkSeconds: Math.max(0, att.totalWorkSeconds - durationSeconds)
        }
      });
    }

    return res.status(200).json({ success: true, message: 'Offline time record deleted' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// YouTube & Web Browsing History for Employee Portal
export async function getMyYouTubeHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const dateStr = (req.query.date as string) || getCompanyTodayString();
    const { startOfDay, endOfDay } = getDayBounds(dateStr);

    const ytLogs = await prisma.activityLog.findMany({
      where: {
        userId,
        recordedAt: { gte: startOfDay, lte: endOfDay },
        OR: [
          { domain: { contains: 'youtube', mode: 'insensitive' } },
          { windowTitle: { contains: 'YouTube', mode: 'insensitive' } }
        ]
      },
      orderBy: { recordedAt: 'desc' }
    });

    const videoMap: Record<string, { title: string; totalSeconds: number; visitCount: number; lastWatchedAt: Date }> = {};

    for (const log of ytLogs) {
      const title = extractYouTubeVideoTitle(log.windowTitle) || 'YouTube Video';
      if (!videoMap[title]) {
        videoMap[title] = {
          title,
          totalSeconds: 0,
          visitCount: 0,
          lastWatchedAt: log.recordedAt
        };
      }
      videoMap[title].totalSeconds += log.durationSeconds || 20;
      videoMap[title].visitCount += 1;
      if (log.recordedAt > videoMap[title].lastWatchedAt) {
        videoMap[title].lastWatchedAt = log.recordedAt;
      }
    }

    const videos = Object.values(videoMap).map((v) => ({
      title: v.title,
      totalMinutes: Math.round(v.totalSeconds / 60),
      visitCount: v.visitCount,
      lastWatchedAt: v.lastWatchedAt
    })).sort((a, b) => b.totalMinutes - a.totalMinutes);

    return res.status(200).json({ success: true, date: dateStr, videos });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMyDetailedReports(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { date, dateFrom, dateTo } = req.query as { date?: string; dateFrom?: string; dateTo?: string };
    const targetDate = date || new Date().toISOString().split('T')[0];

    const whereClause: any = { userId };
    if (dateFrom && dateTo) {
      whereClause.recordedAt = {
        gte: new Date(`${dateFrom}T00:00:00.000Z`),
        lte: new Date(`${dateTo}T23:59:59.999Z`)
      };
    } else {
      whereClause.recordedAt = {
        gte: new Date(`${targetDate}T00:00:00.000Z`),
        lte: new Date(`${targetDate}T23:59:59.999Z`)
      };
    }

    const activities = await prisma.activityLog.findMany({
      where: whereClause,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { recordedAt: 'asc' }
    });

    const offlineRecords = await prisma.offlineTime.findMany({
      where: { userId, date: targetDate },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    const detailedRows: any[] = [];
    let currentBlock: any = null;

    for (const act of activities) {
      const actTime = new Date(act.recordedAt);
      const appTitle = act.appName || act.windowTitle || 'vs code';

      if (
        !currentBlock ||
        currentBlock.taskName !== appTitle ||
        actTime.getTime() - currentBlock.lastTime.getTime() > 10 * 60 * 1000
      ) {
        if (currentBlock) {
          const durationMins = Math.max(1, Math.round((currentBlock.lastTime.getTime() - currentBlock.startTime.getTime()) / 60000));
          detailedRows.push({
            id: currentBlock.id,
            date: currentBlock.dateStr,
            employeeName: currentBlock.userName,
            project: 'No project',
            from: currentBlock.startTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }),
            to: currentBlock.lastTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }),
            startTime: currentBlock.startTime.toISOString(),
            endTime: currentBlock.lastTime.toISOString(),
            durationMinutes: durationMins,
            activityPercent: Math.min(100, Math.round(((currentBlock.activeCount || 1) / (currentBlock.totalCount || 1)) * 100))
          });
        }

        currentBlock = {
          id: act.id,
          userName: act.user.name,
          dateStr: act.recordedAt.toISOString().split('T')[0],
          taskName: appTitle,
          startTime: actTime,
          lastTime: actTime,
          activeCount: act.isIdle ? 0 : 1,
          totalCount: 1
        };
      } else {
        currentBlock.lastTime = actTime;
        currentBlock.totalCount += 1;
        if (!act.isIdle) currentBlock.activeCount += 1;
      }
    }

    if (currentBlock) {
      const durationMins = Math.max(1, Math.round((currentBlock.lastTime.getTime() - currentBlock.startTime.getTime()) / 60000));
      detailedRows.push({
        id: currentBlock.id,
        date: currentBlock.dateStr,
        employeeName: currentBlock.userName,
        project: 'No project',
        from: currentBlock.startTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }),
        to: currentBlock.lastTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }),
        startTime: currentBlock.startTime.toISOString(),
        endTime: currentBlock.lastTime.toISOString(),
        durationMinutes: durationMins,
        activityPercent: Math.min(100, Math.round(((currentBlock.activeCount || 1) / (currentBlock.totalCount || 1)) * 100))
      });
    }

    for (const off of offlineRecords) {
      detailedRows.push({
        id: off.id,
        date: off.date,
        employeeName: off.user.name,
        project: 'No project',
        note: `${off.reason} [offline]`,
        from: off.startTime,
        to: off.endTime,
        durationMinutes: off.durationMinutes,
        activityPercent: 100
      });
    }

    const appMap: Record<string, number> = {};
    let totalSec = 0;

    for (const act of activities) {
      const name = act.appName || act.domain || 'vs code';
      appMap[name] = (appMap[name] || 0) + act.durationSeconds;
      totalSec += act.durationSeconds;
    }

    const colorPalette = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

    const appsAndUrls = Object.entries(appMap)
      .map(([name, sec], idx) => {
        const mins = Math.round(sec / 60);
        const percent = totalSec > 0 ? Math.round((sec / totalSec) * 100) : 0;
        return {
          name,
          minutes: mins,
          percentage: percent,
          color: colorPalette[idx % colorPalette.length]
        };
      })
      .sort((a, b) => b.minutes - a.minutes);

    return res.status(200).json({
      success: true,
      detailedRows,
      appsAndUrls,
      totalDurationMinutes: Math.round(totalSec / 60)
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
