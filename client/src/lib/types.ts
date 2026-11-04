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

export type Example = {
  query: string;
  tag: string;
  note: string;
};

export type Health = {
  ok: boolean;
  products: number;
  embeddingReady: boolean;
  embeddingError: string | null;
  model: string;
  databaseError: string | null;
  rrfK: number;
};
