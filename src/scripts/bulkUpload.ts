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

/**
 * Parses a data.txt file and returns a map of image number to product data.
 */
function parseDataFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    // Split the content by "Page <number>"
    const parts = content.split(/Page\s+(\d+)/i);
    const dataMap: Record<string, { title: string; category: string; description: string }> = {};

    // The first part is usually empty space before "Page 1".
    // Then parts[1] is the number (e.g., "1"), parts[2] is the content for page 1.
    for (let i = 1; i < parts.length; i += 2) {
        const pageNum = parts[i];
        const text = parts[i + 1];

        if (!text) continue;

        const titleMatch = text.match(/Product:\s*(.+)/i);
        const categoryMatch = text.match(/Category:\s*(.+)/i);
        const descMatch = text.match(/Product [Dd]escription:\s*([\s\S]+?)(?=\n\n|\n*$)/i);

        dataMap[pageNum] = {
            title: titleMatch ? titleMatch[1].trim() : `Unknown Product ${pageNum}`,
            category: categoryMatch ? categoryMatch[1].trim() : '',
            description: descMatch ? descMatch[1].trim() : ''
        };
    }
    
    return dataMap;
}

async function runMigration() {
    const rootDir = './Images'; // Root folder containing category folders

    if (!fs.existsSync(rootDir)) {
        console.error(`❌ Root directory ${rootDir} does not exist.`);
        return;
    }

    const categories = fs.readdirSync(rootDir);

    for (const categoryFolder of categories) {
        // Skip wall-posters as it was already processed using the old logic
        if (categoryFolder === 'wall-posters') continue;

        const folderPath = path.join(rootDir, categoryFolder);
        if (!fs.lstatSync(folderPath).isDirectory()) continue;

        // 1. Create or Get the Category
        const categoryName = categoryFolder.trim();
        // Sanitize slug: lowercase, replace non-alphanumeric chars with dashes
        const categorySlug = categoryFolder.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

        console.log(`\n===========================================`);
        console.log(`📁 Processing Category: ${categoryName}`);
        
        const dbCategory = await prisma.category.upsert({
            where: { slug: categorySlug },
            update: {},
            create: { name: categoryName, slug: categorySlug }
        });

        // 2. Parse data.txt inside the folder
        const dataFilePath = path.join(folderPath, 'data.txt');
        const productDataMap = parseDataFile(dataFilePath);

        const files = fs.readdirSync(folderPath);
        const imageFiles = files.filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i));

        console.log(`Found ${imageFiles.length} images and ${Object.keys(productDataMap).length} data entries.`);

        for (const file of imageFiles) {
            try {
                const filePath = path.join(folderPath, file);
                const fileNumber = file.split('.')[0]; // Get "1" from "1.jpg"

                // Match image to data
                const productData = productDataMap[fileNumber] || {
                    title: `${categoryName} Item #${fileNumber}`,
                    description: 'Description not available.'
                };

                console.log(`⏳ Uploading Image ${file} -> Title: "${productData.title}"...`);

                // 3. Upload to Cloudinary
                const upload = await cloudinary.uploader.upload(filePath, {
                    folder: `crazzzy/${categorySlug}`,
                    format: 'webp',
                });

                // 4. Save to Database
                // Generate a unique slug to avoid collisions
                const productSlug = `${categorySlug}-item-${fileNumber}-${Date.now()}`;

                await prisma.product.create({
                    data: {
                        title: productData.title,
                        slug: productSlug,
                        description: productData.description,
                        price: 999, // Placeholder starting price
                        stock: 10,  // Placeholder stock
                        categoryId: dbCategory.id,
                        imageUrl: upload.secure_url,
                        images: {
                            create: { imageUrl: upload.secure_url, publicId: upload.public_id }
                        }
                    }
                });
                console.log(`✅ Success: Saved "${productData.title}" to database.`);
            } catch (err) {
                console.error(`❌ Failed processing ${file}:`, err);
            }
        }
    }
    
    console.log(`\n🎉 Bulk upload script execution finished!`);
}

runMigration()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });