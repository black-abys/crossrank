import type { Hit, MethodName } from './types.ts';

/** Retail style: "R 1 299.00". en-ZA currency uses a comma, which reads oddly on a shelf. */
export function formatZar(cents: number): string {
  const [whole, frac] = (cents / 100).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `R ${grouped}.${frac}`;
}

export function scoreLabel(method: MethodName, hit: Hit): { value: string; name: string; title: string } {
  if (method === 'keyword') {
    return {
      value: hit.score.toFixed(3),
      name: 'ts_rank',
      title: 'Postgres ts_rank. Higher means the query words landed in a heavier field, such as the title.',
    };
  }
  if (method === 'semantic') {
    const percent = Math.round(hit.score * 100);
    return {
      value: `${percent}%`,
      name: 'cosine',
      title: `Cosine similarity ${hit.score.toFixed(3)}. 100% would be the same vector.`,
    };
  }
  return {
    value: hit.score.toFixed(4),
    name: 'rrf',
    title: 'Reciprocal Rank Fusion. 1/(60+keyword rank) + 1/(60+semantic rank).',
  };
}

export function shortModel(model: string): string {
  return model.replace(/^Xenova\//, '');
}
