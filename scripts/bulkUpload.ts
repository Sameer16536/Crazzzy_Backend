import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function runMigration() {
    const rootDir = './wall-posters'; // Your local folder path
    const parentCategorySlug = 'wall-posters';

    // 1. Get or Create Parent Category
    let parent = await prisma.category.findUnique({ where: { slug: parentCategorySlug } });
    if (!parent) {
        parent = await prisma.category.create({ data: { name: 'Wall Posters', slug: parentCategorySlug } });
    }

    const subFolders = fs.readdirSync(rootDir);

    for (const folder of subFolders) {
        const folderPath = path.join(rootDir, folder);
        if (!fs.lstatSync(folderPath).isDirectory()) continue;

        // 2. Create Sub-category
        const subCategoryName = folder.replace(/([A-Z])/g, ' $1').trim(); // "AnimeFeb" -> "Anime Feb"
        const subCategorySlug = folder.toLowerCase();

        const subCat = await prisma.category.upsert({
            where: { slug: subCategorySlug },
            update: {},
            create: { name: subCategoryName, slug: subCategorySlug, parentId: parent.id }
        });

        const files = fs.readdirSync(folderPath);
        console.log(`Processing ${files.length} images in ${subCategoryName}...`);

        for (const file of files) {
            try {
                const filePath = path.join(folderPath, file);
                const posterNumber = file.split('.')[0]; // Get "1" from "1.jpg"

                // 3. Upload to Cloudinary
                const upload = await cloudinary.uploader.upload(filePath, {
                    folder: `crazzzy/wall-posters/${subCategorySlug}`,
                    format: 'webp',
                });

                // 4. Save to Database with Searchable Title
                const title = `${subCategoryName} Poster #${posterNumber}`;
                const slug = `${subCategorySlug}-poster-${posterNumber}`;

                await prisma.product.create({
                    data: {
                        title,
                        slug,
                        price: 180, // Default price for posters
                        stock: 100,
                        categoryId: subCat.id,
                        imageUrl: upload.secure_url,
                        images: {
                            create: { imageUrl: upload.secure_url, publicId: upload.public_id, }
                        }
                    }
                });
                console.log(`✅ Uploaded: ${title}`);
            } catch (err) {
                console.error(`❌ Failed: ${file}`, err);
            }
        }
    }
}

runMigration();