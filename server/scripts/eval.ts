/**
 * Recall@10 and MRR for keyword, semantic, and hybrid.
 * Run after `npm run seed`. Prints a markdown table and a short debug listing.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, modelLabel } from '../src/config.ts';
import { evalQueries } from '../src/data/evalQueries.ts';
import { pool } from '../src/db.ts';
import { searchCatalogue, type Hit, type MethodName } from '../src/search.ts';

const K = 10;

function recallAt(ranked: string[], relevant: string[], k: number): number {
  const top = new Set(ranked.slice(0, k));
  const hits = relevant.filter((sku) => top.has(sku)).length;
  return hits / relevant.length;
}

function mrr(ranked: string[], relevant: Set<string>): number {
  const index = ranked.findIndex((sku) => relevant.has(sku));
  return index < 0 ? 0 : 1 / (index + 1);
}

function fmt(value: number): string {
  return value.toFixed(3);
}

const methods: MethodName[] = ['keyword', 'semantic', 'hybrid'];
const totals = {
  keyword: { recall: 0, mrr: 0 },
  semantic: { recall: 0, mrr: 0 },
  hybrid: { recall: 0, mrr: 0 },
};

const lines: string[] = [];
lines.push('| Query | Keyword R@10 | Semantic R@10 | Hybrid R@10 | Keyword MRR | Semantic MRR | Hybrid MRR |');
lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');

for (const spec of evalQueries) {
  const result = await searchCatalogue(spec.query, K);
  const relevant = new Set(spec.relevant);
  const scores: Record<MethodName, { recall: number; mrr: number }> = {
    keyword: { recall: 0, mrr: 0 },
    semantic: { recall: 0, mrr: 0 },
    hybrid: { recall: 0, mrr: 0 },
  };

  console.log(`\n# ${spec.query}`);
  console.log(spec.note);
  for (const method of methods) {
    const hits: Hit[] = result[method];
    const ranked = hits.map((hit) => hit.sku);
    scores[method] = {
      recall: recallAt(ranked, spec.relevant, K),
      mrr: mrr(ranked, relevant),
    };
    totals[method].recall += scores[method].recall;
    totals[method].mrr += scores[method].mrr;
    const preview = hits
      .slice(0, 5)
      .map((hit) => `${hit.rank}. ${hit.sku} ${hit.title}`)
      .join(' | ');
    console.log(`  ${method.padEnd(8)} R@10 ${fmt(scores[method].recall)}  MRR ${fmt(scores[method].mrr)}  ${preview}`);
  }

  const q = spec.query.replaceAll('|', '\\|');
  lines.push(
    `| ${q} | ${fmt(scores.keyword.recall)} | ${fmt(scores.semantic.recall)} | ${fmt(scores.hybrid.recall)} | ${fmt(scores.keyword.mrr)} | ${fmt(scores.semantic.mrr)} | ${fmt(scores.hybrid.mrr)} |`,
  );
}

const n = evalQueries.length;
lines.push(
  `| **Macro average** | **${fmt(totals.keyword.recall / n)}** | **${fmt(totals.semantic.recall / n)}** | **${fmt(totals.hybrid.recall / n)}** | **${fmt(totals.keyword.mrr / n)}** | **${fmt(totals.semantic.mrr / n)}** | **${fmt(totals.hybrid.mrr / n)}** |`,
);

const header = [
  `Model: ${modelLabel()}. k = 10. ${n} labelled queries. Macro average is the unweighted mean.`,
  '',
].join('\n');

const markdown = `${header}\n${lines.join('\n')}\n`;
console.log(`\n${markdown}`);
await writeFile(path.join(ROOT, 'docs/eval-results.md'), markdown);
await pool.end();
