import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

prisma.$connect()
  .then(() => {
    console.log('[DB] Prisma connected successfully to database');
  })
  .catch((err: Error) => {
    console.error('[DB] Prisma Connection failed:', err.message);
  });
