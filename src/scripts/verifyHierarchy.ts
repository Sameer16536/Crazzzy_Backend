import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function verify() {
    const parent = await prisma.category.findUnique({
        where: { slug: 'wall-posters' },
        include: { children: true }
    });

    if (!parent) {
        console.log('❌ Parent category "wall-posters" not found.');
    } else {
        console.log(`✅ Parent: ${parent.name}`);
        if (parent.children.length === 0) {
            console.log('⚠️ No sub-categories found linked to this parent.');
        } else {
            console.log('📂 Sub-categories found:');
            parent.children.forEach(c => console.log(`   - ${c.name} (slug: ${c.slug})`));
        }
    }
}

verify().then(() => pool.end());
