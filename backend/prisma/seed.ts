import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding process...');
  
  // Clear existing users to prevent conflicts
  await prisma.user.deleteMany({});
  
  const defaultPassword = 'password123';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

  const usersToCreate = [
    {
      name: 'Admin User',
      email: 'admin@example.com',
      role: Role.ADMIN,
    },
    {
      name: 'Sales User',
      email: 'sales@example.com',
      role: Role.SALES,
    },
    {
      name: 'Warehouse User',
      email: 'warehouse@example.com',
      role: Role.WAREHOUSE,
    },
    {
      name: 'Accounts User',
      email: 'accounts@example.com',
      role: Role.ACCOUNTS,
    },
  ];

  console.log('--- TEST CREDENTIALS ---');
  for (const userData of usersToCreate) {
    const user = await prisma.user.create({
      data: {
        ...userData,
        passwordHash,
      },
    });
    console.log(`Role: ${user.role} | Email: ${user.email} | Password: ${defaultPassword}`);
  }
  console.log('------------------------');
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
