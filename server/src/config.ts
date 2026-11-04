import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root, whether this file is imported from src/ or scripts/. */
export const ROOT = path.resolve(here, '../..');

loadEnv({ path: path.join(ROOT, '.env') });

/** MiniLM is 384-d. The products.embedding column is vector(384). */
export const EMBEDDING_DIM = 384;

export const DEFAULT_MODEL = 'Xenova/bge-small-en-v1.5';

export const config = {
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://crossrank:crossrank@127.0.0.1:5433/crossrank',
  port: Number(process.env.PORT ?? 4317),
  embeddingModel: process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL,
  openAiKey: process.env.OPENAI_API_KEY?.trim() || '',
  openAiModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  rrfK: Number(process.env.RRF_K ?? 60),
  migrationPath: path.join(
    ROOT,
    'supabase/migrations/20241118120000_hybrid_search.sql',
  ),
  cacheDir: path.join(ROOT, '.cache/transformers'),
};

export function providerName(): 'openai' | 'local' {
  return config.openAiKey ? 'openai' : 'local';
}

export function modelLabel(): string {
  if (config.openAiKey) return config.openAiModel;
  return config.embeddingModel.replace(/^Xenova\//, '');
}
