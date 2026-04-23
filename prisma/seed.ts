import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const categories = [
  { name: 'Tote Bags', slug: 'tote-bags' },
  { name: 'Die Cast Cars and Bikes', slug: 'die-cast-cars-and-bikes' },
  { name: 'Perfumes', slug: 'perfumes' },
  { name: 'Wall Posters', slug: 'wall-posters' },
  { name: 'Anime Figures', slug: 'anime-figures' },
  { name: 'Hot Wheels', slug: 'hot-wheels' },
  { name: 'Keychains', slug: 'keychains' },
  { name: 'Chocolate and Beverages', slug: 'chocolate-and-beverages' },
  { name: 'Aesthetic Items', slug: 'aesthetic-items' },
];

async function main() {
  console.log('Seeding categories...');
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: { name: cat.name, slug: cat.slug },
    });
  }
  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
