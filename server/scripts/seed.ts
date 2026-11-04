import { config, modelLabel, providerName } from '../src/config.ts';
import { products } from '../src/data/products.ts';
import { applyMigration, pool } from '../src/db.ts';
import { embedTexts, productPassage } from '../src/embed.ts';

const skus = new Set<string>();
for (const product of products) {
  if (skus.has(product.sku)) throw new Error(`Duplicate SKU ${product.sku}`);
  skus.add(product.sku);
}

console.log(`Applying migration, then embedding ${products.length} listings (${providerName()}: ${modelLabel()})`);
await applyMigration();

const vectors: number[][] = [];
const chunk = 32;
for (let i = 0; i < products.length; i += chunk) {
  const slice = products.slice(i, i + chunk);
  const embedded = await embedTexts(slice.map(productPassage), 'passage');
  vectors.push(...embedded);
  console.log(`  embedded ${Math.min(i + chunk, products.length)}/${products.length}`);
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('TRUNCATE products');
  for (let i = 0; i < products.length; i += 1) {
    const product = products[i];
    await client.query(
      `INSERT INTO products (sku, title, description, category, brand, price_cents, isbn, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)`,
      [
        product.sku,
        product.title,
        product.description,
        product.category,
        product.brand,
        product.priceCents,
        product.isbn ?? null,
        JSON.stringify(vectors[i]),
      ],
    );
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}

const { rows } = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM products');
console.log(`Seeded ${rows[0].count} products into ${config.databaseUrl.replace(/:[^:@/]+@/, ':***@')}`);
await pool.end();
