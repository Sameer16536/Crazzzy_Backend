import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting manual database patch...');
  
  try {
    // Add missing columns to orders table
    await prisma.$executeRawUnsafe(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_number" VARCHAR(255);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier_name" VARCHAR(100);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "estimated_delivery" TIMESTAMP;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP;`);
    
    // Add missing columns to order_items table
    await prisma.$executeRawUnsafe(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "product_variant_id" INTEGER;`);
    
    console.log('✅ Database columns successfully added!');
  } catch (error) {
    console.error('❌ Error patching database:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
