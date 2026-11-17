import '../src/env';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
const db = new PrismaClient();
async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD,
    customerPassword = process.env.SEED_CUSTOMER_PASSWORD;
  if (
    !adminPassword ||
    !customerPassword ||
    Math.min(adminPassword.length, customerPassword.length) < 10
  )
    throw new Error('Set SEED_ADMIN_PASSWORD and SEED_CUSTOMER_PASSWORD (10+ characters)');
  for (const [email, name, role, password] of [
    [
      process.env.SEED_ADMIN_EMAIL || 'admin@stockroom.local',
      'Blessing William',
      'ADMIN',
      adminPassword,
    ],
    ['customer@stockroom.local', 'Jamie Taylor', 'CUSTOMER', customerPassword],
  ] as const) {
    await db.user.upsert({
      where: { email },
      update: role === 'ADMIN' ? { name } : {},
      create: { email, name, role, passwordHash: await hash(password, 12) },
    });
  }
  const products = [
    ['QuietForm Headphones', 'Wireless sound. A little less noise.', 'Electronics', 4850000, 24],
    ['Arc Desk Lamp', 'A softer light for brighter ideas.', 'Workspace', 2450000, 18],
    ['Everyday Bottle', 'Stay refreshed, wherever the day goes.', 'Everyday', 1250000, 36],
    ['Daily Notes Notebook', 'Room for your next big little idea.', 'Workspace', 650000, 8],
    ['Minimal Wireless Keyboard', 'Less clutter. More flow.', 'Electronics', 3200000, 16],
    [
      'Carryall Canvas Tote Bag',
      'For the essentials and everything else.',
      'Accessories',
      950000,
      30,
    ],
    [
      'Pocket Bluetooth Speaker',
      'Good sound, wherever you find yourself.',
      'Electronics',
      1850000,
      6,
    ],
    ['Pebble Wireless Mouse', 'A natural fit for your daily rhythm.', 'Workspace', 1450000, 22],
  ] as const;
  for (const [i, p] of products.entries()) {
    const [name, description, category, priceMinor, stockQuantity] = p;
    const sku = `STK-${String(i + 1).padStart(3, '0')}`;
    await db.product.upsert({
      where: { sku },
      update: {},
      create: {
        sku,
        name,
        description,
        category,
        priceMinor,
        stockQuantity,
        imageUrls: [
          `/images/products/${['headphones.jpg', 'desk-lamp.jpg', 'bottle.jpg', 'notebook.jpg', 'keyboard.jpg', 'tote-bag.jpg', 'speaker.jpg', 'mouse.jpg'][i]}`,
        ],
      },
    });
  }
  console.log('Seed complete. Existing accounts and stock were preserved.');
}
main().finally(() => db.$disconnect());
