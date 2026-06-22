import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admincreativecomet', 12);

  const users = [
    { name: 'Admin', email: 'hello@creativecomet.tn', role: 'ADMIN', passwordHash },
    { name: 'Adam Admin', email: 'adam@creativecomet.tn', role: 'ADMIN', passwordHash }
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash: u.passwordHash,
        role: 'ADMIN' // Set to ADMIN as requested
      },
      create: {
        name: u.name,
        email: u.email,
        passwordHash: u.passwordHash,
        role: 'ADMIN',
        plan: 'premium',
      }
    });

    // Also create empty user settings so dashboard works fine
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id }
    });

    console.log(`Seeded or updated user: ${u.email}`);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
