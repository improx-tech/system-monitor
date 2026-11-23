import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';

export async function seedInitialAdmin() {
  try {
    const adminAccounts = [
      {
        email: 'admin@improx.com',
        pass: 'Admin@123456',
        name: 'System Admin'
      },
      {
        email: 'monitoradmin@improxgroup.com1234',
        pass: '#admin0089000#',
        name: 'Super Admin'
      }
    ];

    for (const acc of adminAccounts) {
      const hashedPassword = await bcrypt.hash(acc.pass, 10);
      const existing = await prisma.user.findUnique({
        where: { email: acc.email }
      });

      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: acc.name,
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true,
            status: 'OFFLINE'
          }
        });
        console.log(`✅ Admin account verified & updated: ${acc.email}`);
      } else {
        await prisma.user.create({
          data: {
            name: acc.name,
            email: acc.email,
            password: hashedPassword,
            role: 'ADMIN',
            department: 'Executive',
            shift: 'General',
            isActive: true,
            status: 'OFFLINE'
          }
        });
        console.log(`✅ Admin account created: ${acc.email}`);
      }
    }

    // Ensure SystemSetting exists
    const settings = await prisma.systemSetting.findUnique({ where: { id: 'global' } });
    if (!settings) {
      await prisma.systemSetting.create({
        data: {
          id: 'global',
          screenshotInterval: 10,
          idleThreshold: 1,
          retentionDays: 30,
          companyName: 'Improx Group'
        }
      });
      console.log('✅ Global System Settings initialized.');
    }
  } catch (error) {
    console.error('⚠️ Seeding error:', error);
  }
}

if (require.main === module) {
  seedInitialAdmin().then(() => process.exit(0));
}
