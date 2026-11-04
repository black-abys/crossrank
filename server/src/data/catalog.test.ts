import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evalQueries } from './evalQueries.ts';
import { products, type SeedProduct } from './products.ts';

/**
 * The paraphrase demos only work if distractors own the obvious words and the
 * relevant listings do not. This file is the lock on that copy.
 */

const textOf = (product: SeedProduct) =>
  [product.title, product.brand, product.category, product.description, product.isbn ?? ''].join(' ');

const rules: { label: string; pattern: RegExp; allow: string[] }[] = [
  { label: 'feet', pattern: /\bfeet\b/i, allow: [] },
  { label: 'headache', pattern: /\bheadaches?\b/i, allow: [] },
  {
    label: 'warm',
    pattern: /\bwarm(?:ing|ed|ly)?\b/i,
    allow: ['KM-1001', 'KM-1002', 'KM-1003', 'KM-1004', 'KM-1101', 'KM-1102', 'KM-1103', 'KM-1104', 'KM-1105', 'KM-1106', 'KM-1111', 'KM-1112'],
  },
  {
    label: 'keep',
    pattern: /\bkeeps?\b|\bkeeping\b/i,
    allow: ['KM-1107', 'KM-1109', 'KM-1114', 'KM-5110'],
  },
  {
    label: 'something',
    pattern: /\bsomethings?\b/i,
    allow: ['KM-1108', 'KM-1110', 'KM-1113', 'KM-4001', 'KM-4002', 'KM-4003', 'KM-4105', 'KM-4106', 'KM-4107', 'KM-4108'],
  },
  { label: 'braai', pattern: /\bbraais?\b/i, allow: ['KM-2001', 'KM-2002'] },
  { label: 'gift', pattern: /\bgifts?\b|\bgifting\b/i, allow: ['KM-2102', 'KM-2104'] },
  { label: 'lover', pattern: /\blovers?\b/i, allow: ['KM-2101', 'KM-2103'] },
  {
    label: 'school',
    pattern: /\bschools?\b/i,
    allow: ['KM-3101', 'KM-3102', 'KM-3103', 'KM-3104', 'KM-3105', 'KM-3106', 'KM-3107', 'KM-3108', 'KM-3109', 'KM-3110', 'KM-3111', 'KM-3112'],
  },
  {
    label: 'stationery',
    pattern: /\bstationery\b/i,
    allow: ['KM-3001', 'KM-3002', 'KM-3003', 'KM-3004', 'KM-3005', 'KM-3006', 'KM-3007'],
  },
  {
    label: 'pound',
    pattern: /\bpounds?\b|\bpounding\b/i,
    allow: ['KM-4102', 'KM-4103', 'KM-4104'],
  },
  {
    label: 'cricket',
    pattern: /\bcrickets?\b/i,
    allow: ['KM-5101', 'KM-5105', 'KM-5106', 'KM-5107'],
  },
  {
    label: 'cold',
    pattern: /\bcold\b/i,
    allow: ['KM-5001', 'KM-5002', 'KM-5003', 'KM-5102', 'KM-5108'],
  },
  {
    label: 'drink',
    pattern: /\bdrinks?\b|\bdrinking\b/i,
    allow: ['KM-5103', 'KM-5109'],
  },
  {
    label: 'maize',
    pattern: /\bmaize\b/i,
    allow: ['KM-7001', 'KM-7002', 'KM-7003'],
  },
  {
    label: 'meal',
    pattern: /\bmeals?\b/i,
    allow: ['KM-7001', 'KM-7002', 'KM-7003'],
  },
];

describe('catalogue', () => {
  it('has a few hundred unique listings', () => {
    assert.ok(products.length >= 200 && products.length <= 500, `expected 200-500 products, got ${products.length}`);
    const skus = products.map((product) => product.sku);
    assert.equal(new Set(skus).size, skus.length);
    for (const product of products) {
      assert.ok(product.priceCents > 0, product.sku);
      assert.ok(product.title && product.description && product.brand && product.category);
    }
  });

  it('keeps controlled words on the listings that are supposed to carry them', () => {
    const leaks: string[] = [];
    for (const product of products) {
      const text = textOf(product);
      for (const rule of rules) {
        if (rule.pattern.test(text) && !rule.allow.includes(product.sku)) {
          leaks.push(`${product.sku} contains “${rule.label}”`);
        }
      }
    }
    assert.deepEqual(leaks, []);
  });

  it('puts the weak lexical hook in the description, not the title', () => {
    const bySku = new Map(products.map((product) => [product.sku, product]));
    for (const sku of ['KM-1001', 'KM-1002', 'KM-1003', 'KM-1004']) {
      const product = bySku.get(sku)!;
      assert.match(product.description, /\bwarm\b/i);
      assert.doesNotMatch(product.title, /\bwarm\b/i);
    }
    for (const sku of ['KM-3001', 'KM-3002', 'KM-3003', 'KM-3004', 'KM-3005', 'KM-3006', 'KM-3007']) {
      const product = bySku.get(sku)!;
      assert.match(product.description, /\bstationery\b/i);
      assert.doesNotMatch(product.title, /\bstationery\b|\bschool\b/i);
    }
    for (const sku of ['KM-5001', 'KM-5002', 'KM-5003']) {
      const product = bySku.get(sku)!;
      assert.match(product.description, /\bcold\b/i);
      assert.doesNotMatch(product.title, /\bcold\b|\bcricket\b|\bdrink/i);
    }
  });

  it('includes every SKU the eval set expects', () => {
    const skus = new Set(products.map((product) => product.sku));
    for (const query of evalQueries) {
      for (const sku of query.relevant) {
        assert.ok(skus.has(sku), `${query.query} expects missing ${sku}`);
      }
    }
    const book = products.find((product) => product.sku === 'KM-9101');
    assert.equal(book?.isbn, '9781776091234');
    assert.equal(products.find((product) => product.sku === 'KM-6001')?.brand, 'Russell Hobbs');
  });
});
