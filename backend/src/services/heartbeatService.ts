import { prisma } from '../config/prisma';
import { socketService } from './socketService';

export function startHeartbeatSupervisor() {
  setInterval(async () => {
    try {
      const now = new Date();
      const awayThreshold = new Date(Date.now() - 40000); // 40 seconds of no telemetry
      const maxInactivityThreshold = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours

      // 1. Detect users who were ONLINE or IDLE but stopped sending telemetry (laptop slept / screen locked)
      const inactiveUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          status: { in: ['ONLINE', 'IDLE'] },
          lastActiveAt: { lt: awayThreshold }
        },
        select: { id: true, name: true, lastActiveAt: true }
      });

      for (const user of inactiveUsers) {
        // Transition user to PAUSED (Break)
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

      // 2. Accumulate break/idle time for all users currently on PAUSED break with an open shift
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
          // If inactive for more than 4 hours, clock out
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
            // While laptop is on sleep / break, add 15s break time every 15s tick
            await prisma.attendance.update({
              where: { id: openAtt.id },
              data: {
                totalIdleSeconds: { increment: 15 },
                totalWorkSeconds: { increment: 15 },
                pauseReason: user.pauseReason || 'Laptop Sleep Break'
              }
            });
          }
        }
      }
    } catch (e) {
      // Ignore heartbeat errors
    }
  }, 15000);
}
