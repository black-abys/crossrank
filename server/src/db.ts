import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { config } from './config.ts';

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function applyMigration(): Promise<void> {
  const sql = await readFile(config.migrationPath, 'utf8');
  await pool.query(sql);
}

export async function productCount(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM products');
  return Number(rows[0]?.count ?? 0);
}

export async function checkDatabase(): Promise<{ ok: boolean; products: number; error?: string }> {
  try {
    const products = await productCount();
    return { ok: true, products };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database unreachable';
    return { ok: false, products: 0, error: message };
  }
}
