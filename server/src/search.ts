import { config } from './config.ts';
import { pool } from './db.ts';
import { embedTexts } from './embed.ts';

export type MethodName = 'keyword' | 'semantic' | 'hybrid';

export type Hit = {
  rank: number;
  score: number;
  keywordRank: number | null;
  semanticRank: number | null;
  exactMatch: boolean;
  foundBy: Array<'keyword' | 'semantic'>;
  id: string;
  sku: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  priceCents: number;
};

export type SearchResponse = {
  query: string;
  elapsedMs: number;
  model: string;
  provider: 'openai' | 'local';
  rrfK: number;
  keyword: Hit[];
  semantic: Hit[];
  hybrid: Hit[];
};

type SearchRow = {
  method: MethodName;
  rank: number;
  score: number;
  keyword_rank: number | null;
  semantic_rank: number | null;
  exact_match: boolean;
  id: string;
  sku: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  price_cents: number;
};

export async function searchCatalogue(query: string, limit = 10): Promise<SearchResponse> {
  const started = Date.now();
  const [embedding] = await embedTexts([query], 'query');
  const vector = `[${embedding.join(',')}]`;
  const { rows } = await pool.query<SearchRow>(
    `SELECT method, rank, score, keyword_rank, semantic_rank, exact_match,
            id, sku, title, description, category, brand, price_cents
     FROM search_catalogue($1, $2::vector, $3, $4, 40)`,
    [query, vector, limit, config.rrfK],
  );

  const grouped: Record<MethodName, Hit[]> = {
    keyword: [],
    semantic: [],
    hybrid: [],
  };

  for (const row of rows) {
    const foundBy: Hit['foundBy'] = [];
    if (row.keyword_rank != null) foundBy.push('keyword');
    if (row.semantic_rank != null) foundBy.push('semantic');
    if (row.method === 'keyword' && !foundBy.includes('keyword')) foundBy.push('keyword');
    if (row.method === 'semantic' && !foundBy.includes('semantic')) foundBy.push('semantic');

    grouped[row.method].push({
      rank: Number(row.rank),
      score: Number(row.score),
      keywordRank: row.keyword_rank == null ? null : Number(row.keyword_rank),
      semanticRank: row.semantic_rank == null ? null : Number(row.semantic_rank),
      exactMatch: row.exact_match,
      foundBy,
      id: row.id,
      sku: row.sku,
      title: row.title,
      description: row.description,
      category: row.category,
      brand: row.brand,
      priceCents: row.price_cents,
    });
  }

  for (const method of Object.keys(grouped) as MethodName[]) {
    grouped[method].sort((a, b) => a.rank - b.rank);
  }

  return {
    query,
    elapsedMs: Date.now() - started,
    model: config.openAiKey ? config.openAiModel : config.embeddingModel,
    provider: config.openAiKey ? 'openai' : 'local',
    rrfK: config.rrfK,
    ...grouped,
  };
}
