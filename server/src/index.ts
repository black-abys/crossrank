import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config, modelLabel, providerName } from './config.ts';
import { EXAMPLES } from './data/examples.ts';
import { checkDatabase, pool } from './db.ts';
import { preloadModel } from './embed.ts';
import { searchCatalogue } from './search.ts';

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

let embeddingReady = providerName() === 'openai';
let embeddingError: string | null = null;

app.get('/', (_req, res) => {
  res
    .type('text')
    .send('Crossrank API is running. Open the search bench on the Vite port (4318 in dev).');
});

app.get('/api/health', async (_req, res) => {
  const db = await checkDatabase();
  res.status(db.ok ? 200 : 503).json({
    ok: db.ok && !embeddingError,
    database: db.ok,
    products: db.products,
    databaseError: db.error ?? null,
    embeddingReady,
    embeddingError,
    model: modelLabel(),
    provider: providerName(),
    rrfK: config.rrfK,
  });
});

app.get('/api/examples', (_req, res) => {
  res.json({ examples: EXAMPLES });
});

app.get('/api/stats', async (_req, res) => {
  const db = await checkDatabase();
  if (!db.ok) {
    res.status(503).json({ error: db.error ?? 'Database unreachable' });
    return;
  }
  const { rows } = await pool.query<{ category: string; count: string }>(
    `SELECT category, count(*)::text AS count
     FROM products
     GROUP BY category
     ORDER BY category`,
  );
  res.json({
    products: db.products,
    categories: rows.map((row) => ({ category: row.category, count: Number(row.count) })),
    model: modelLabel(),
    provider: providerName(),
    rrfK: config.rrfK,
  });
});

app.post('/api/search', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  const limit = clampLimit(req.body?.limit);
  if (!query) {
    res.json({
      query: '',
      elapsedMs: 0,
      model: modelLabel(),
      provider: providerName(),
      rrfK: config.rrfK,
      keyword: [],
      semantic: [],
      hybrid: [],
    });
    return;
  }
  if (query.length > 200) {
    res.status(400).json({ error: 'Keep the query under 200 characters.' });
    return;
  }
  if (embeddingError) {
    res.status(503).json({ error: embeddingError });
    return;
  }
  const result = await searchCatalogue(query, limit);
  console.log(`search ${JSON.stringify(query)} ${result.elapsedMs}ms`);
  res.json(result);
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  const message = error instanceof Error ? error.message : 'Search failed';
  res.status(500).json({ error: message });
});

function clampLimit(value: unknown): number {
  const parsed = Number(value ?? 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(20, Math.round(parsed)));
}

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Crossrank API on http://127.0.0.1:${config.port}`);
});

void preloadModel()
  .then(() => {
    embeddingReady = true;
    console.log(`Embeddings ready (${modelLabel()})`);
  })
  .catch((error: unknown) => {
    embeddingError = error instanceof Error ? error.message : 'Embedding model failed to load';
    console.error(embeddingError);
  });
