import assert from 'node:assert/strict';
import { after, before, it } from 'node:test';
import { applyMigration, pool } from './db.ts';
import { rrfTerm } from './rrf.ts';

/** A unit vector. Cosine with itself is 1, and with a real MiniLM vector it is tiny. */
function oneHot(index: number): string {
  const values = Array.from({ length: 384 }, (_, i) => (i === index ? '1' : '0'));
  return `[${values.join(',')}]`;
}

type Row = {
  method: string;
  rank: number;
  score: number;
  keyword_rank: number | null;
  semantic_rank: number | null;
  exact_match: boolean;
  sku: string;
};

before(async () => {
  await applyMigration();
});

after(async () => {
  await pool.end();
});

it('SQL fusion matches the RRF formula and pins an exact SKU', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO products (sku, title, description, category, brand, price_cents, embedding)
       VALUES
         ('ZZXQ99', 'Plain kettle', 'A small kettle', 'Appliances', 'Test Co', 10000, NULL),
         ('ZZXQ98', 'Basin zzxq99', 'A wash basin', 'Home', 'Test Co', 8000, $1::vector)`,
      [oneHot(1)],
    );

    // Query embedding sits on the basin. The SKU query is the kettle's code.
    // The basin is in both lists, so raw RRF prefers it. The pin must not.
    const { rows } = await client.query<Row>(
      `SELECT method, rank, score, keyword_rank, semantic_rank, exact_match, sku
       FROM search_catalogue('ZZXQ99', $1::vector, 10, 60, 40)`,
      [oneHot(1)],
    );

    const of = (method: string) => rows.filter((row) => row.method === method);
    const keyword = of('keyword');
    const semantic = of('semantic');
    const hybrid = of('hybrid');

    assert.equal(keyword[0]?.sku, 'ZZXQ99');
    assert.equal(keyword[0]?.exact_match, true);
    assert.equal(keyword[1]?.sku, 'ZZXQ98');
    assert.equal(semantic[0]?.sku, 'ZZXQ98');

    const pinned = hybrid[0];
    const agreed = hybrid.find((row) => row.sku === 'ZZXQ98');
    assert.ok(pinned && agreed);
    assert.equal(pinned.sku, 'ZZXQ99');
    assert.equal(pinned.exact_match, true);
    assert.ok(Number(agreed.score) > Number(pinned.score), 'pin should override a higher RRF score');

    for (const row of hybrid) {
      const expected =
        (row.keyword_rank == null ? 0 : rrfTerm(Number(row.keyword_rank), 60)) +
        (row.semantic_rank == null ? 0 : rrfTerm(Number(row.semantic_rank), 60));
      assert.ok(Math.abs(Number(row.score) - expected) < 1e-4, `${row.sku} score ${row.score} != ${expected}`);
    }

    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
});
