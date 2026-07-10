import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import Product from '@/models/Product';
import User from '@/models/User';

/**
 * Database seeder.
 *   npm run seed           — wipe and repopulate products + demo users
 *   npm run seed:destroy   — wipe only
 *
 * Demo credentials (change via env before seeding a public deployment):
 *   admin@nordcart.se / ADMIN_SEED_PASSWORD  (default: Admin1234!)
 *   demo@nordcart.se  / DEMO_SEED_PASSWORD   (default: Demo1234!)
 */

// Standalone script: Next.js isn't loading env for us, so read .env.local.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
} catch {
  // Env may already be provided by the shell (e.g. production seeding).
}

const seed = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('✖ MONGODB_URI is not set. Copy web/.env.example to web/.env.local first.');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const destroyOnly = process.argv.includes('--destroy');

  // Idempotent: always start from a clean slate so re-running never duplicates data.
  await Promise.all([Product.deleteMany(), User.deleteMany()]);
  // Align DB indexes with the schema (also drops indexes removed from the model).
  await Promise.all([Product.syncIndexes(), User.syncIndexes()]);
  console.log('✔ Cleared products and users, synced indexes');

  if (!destroyOnly) {
    const productsJson = await readFile(new URL('./products.json', import.meta.url), 'utf-8');
    const products = JSON.parse(productsJson) as Record<string, unknown>[];

    // create() (not insertMany) so the pre-save hooks run: slug generation
    // for products, password hashing for users.
    const created = await Product.create(products);
    console.log(`✔ Seeded ${created.length} products`);

    await User.create([
      {
        name: 'Astrid Admin',
        email: 'admin@nordcart.se',
        password: process.env.ADMIN_SEED_PASSWORD || 'Admin1234!',
        role: 'admin',
      },
      {
        name: 'Erik Demo',
        email: 'demo@nordcart.se',
        password: process.env.DEMO_SEED_PASSWORD || 'Demo1234!',
        role: 'user',
      },
    ]);
    console.log('✔ Seeded admin (admin@nordcart.se) and demo user (demo@nordcart.se)');
  }

  await mongoose.disconnect();
  console.log(destroyOnly ? '✔ Destroy complete' : '✔ Seed complete');
};

seed().catch(async (err) => {
  console.error('✖ Seeding failed:', err instanceof Error ? err.message : err);
  await mongoose.disconnect();
  process.exit(1);
});
