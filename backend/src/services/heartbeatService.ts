import { prisma } from '../config/prisma';
import { socketService } from './socketService';
import { sanitizeAttendanceTimes, getCompanyTodayString } from '../utils/timeZone';

export function startHeartbeatSupervisor() {
  setInterval(async () => {
    try {
      const now = new Date();
      const todayStr = getCompanyTodayString(now);
      const awayThreshold = new Date(Date.now() - 40000); // 40 seconds of no telemetry
      const maxInactivityThreshold = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours

      // 1. Immediately ensure any employee who has clocked out today is marked OFFLINE (never PAUSED or ONLINE)
      await prisma.user.updateMany({
        where: {
          isActive: true,
          status: { not: 'OFFLINE' },
          attendances: {
            some: {
              date: todayStr,
              clockOutAt: { not: null }
            },
            none: {
              date: todayStr,
              clockOutAt: null
            }
          }
        },
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

      // 2. Detect users with an OPEN shift who stopped sending telemetry (laptop slept / screen locked)
      const inactiveUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          status: { in: ['ONLINE', 'IDLE'] },
          lastActiveAt: { lt: awayThreshold },
          attendances: {
            some: {
              date: todayStr,
              clockOutAt: null
            }
          }
        },
        select: { id: true, name: true, lastActiveAt: true }
      });

      for (const user of inactiveUsers) {
        // Transition active shift user to PAUSED (Break)
        await prisma.user.update({
          where: { id: user.id },
          data: {
            status: 'PAUSED',
            pauseReason: 'Laptop Sleep / Screen Locked'
          }
        });

        socketService.broadcastLiveActivity(user.id, {
          status: 'PAUSED',
          pauseReason: 'Laptop Sleep / Screen Locked',
          lastActiveAt: user.lastActiveAt || now
        });

        console.log(`🟡 [Heartbeat] Employee laptop asleep/inactive -> marked PAUSED on Break: ${user.name}`);
      }

      // 2. Broadcast live status for paused users with open shift & auto-clockout if inactive > 4 hours
      const pausedUsersWithOpenShift = await prisma.user.findMany({
        where: {
          isActive: true,
          status: 'PAUSED'
        },
        include: {
          attendances: {
            where: { clockOutAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      for (const user of pausedUsersWithOpenShift) {
        const openAtt = user.attendances[0];
        if (openAtt) {
          // If inactive for more than 4 hours, clock out cleanly at lastActiveAt
          if (user.lastActiveAt && user.lastActiveAt < maxInactivityThreshold) {
            await prisma.user.update({
              where: { id: user.id },
              data: { status: 'OFFLINE' }
            });
            await prisma.attendance.update({
              where: { id: openAtt.id },
              data: { clockOutAt: user.lastActiveAt || now }
            });
            socketService.broadcastLiveActivity(user.id, {
              status: 'OFFLINE',
              lastActiveAt: user.lastActiveAt || now
            });
            console.log(`⏰ [Heartbeat] Employee inactive > 4 hours -> Clocked out: ${user.name}`);
          } else {
            // Live broadcast for WebSocket UI without corrupting/double-incrementing DB records
            const sleepGapSec = user.lastActiveAt && (now.getTime() - user.lastActiveAt.getTime() > 40000)
              ? Math.floor((now.getTime() - user.lastActiveAt.getTime()) / 1000)
              : 0;

            const sanitized = sanitizeAttendanceTimes({
              clockInAt: openAtt.clockInAt,
              clockOutAt: openAtt.clockOutAt,
              totalActiveSeconds: openAtt.totalActiveSeconds,
              totalIdleSeconds: openAtt.totalIdleSeconds,
              manualPauseSeconds: (openAtt.manualPauseSeconds || 0) + sleepGapSec
            }, now);

            socketService.broadcastLiveActivity(user.id, {
              status: 'PAUSED',
              pauseReason: user.pauseReason || 'Laptop Sleep Break',
              totalIdleSeconds: sanitized.combinedBreakSeconds,
              lastActiveAt: user.lastActiveAt || now
            });
          }
        }
      }
    } catch (e) {
      // Ignore heartbeat errors
    }
  }, 15000);
}

