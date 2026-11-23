import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';

async function resetAdmins() {
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
    const existing = await prisma.user.findUnique({ where: { email: acc.email } });

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
      console.log(`✅ ${acc.name} updated: ${acc.email} / ${acc.pass}`);
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
      console.log(`✅ ${acc.name} created: ${acc.email} / ${acc.pass}`);
    }
  }

  process.exit(0);
}

resetAdmins().catch((err) => {
  console.error('Failed to reset admin passwords:', err);
  process.exit(1);
});
