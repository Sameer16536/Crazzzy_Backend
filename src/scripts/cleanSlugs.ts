import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function sanitize(text: string) {
    return text.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

async function cleanSlugs() {
    console.log('--- Cleaning Slugs ---');

    // 1. Clean Category Slugs
    const categories = await prisma.category.findMany();
    for (const cat of categories) {
        const newSlug = sanitize(cat.slug);
        if (newSlug !== cat.slug) {
            console.log(`Updating Category: ${cat.slug} -> ${newSlug}`);
            await prisma.category.update({
                where: { id: cat.id },
                data: { slug: newSlug }
            }).catch(err => console.error(`Failed to update category ${cat.id}:`, err.message));
        }
    }

    // 2. Clean Product Slugs
    const products = await prisma.product.findMany();
    for (const prod of products) {
        const newSlug = sanitize(prod.slug);
        if (newSlug !== prod.slug) {
            console.log(`Updating Product: ${prod.slug} -> ${newSlug}`);
            await prisma.product.update({
                where: { id: prod.id },
                data: { slug: newSlug }
            }).catch(err => console.error(`Failed to update product ${prod.id}:`, err.message));
        }
    }

    console.log('--- Done! ---');
}

cleanSlugs().then(() => pool.end());
