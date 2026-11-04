import { config, EMBEDDING_DIM, providerName } from './config.ts';

/**
 * Passage text that gets embedded.
 * SKU and ISBN stay out of this string on purpose. A code is not a description,
 * and leaving it out is what lets the semantic column miss an exact SKU that
 * the keyword column hits immediately.
 */
export function productPassage(product: {
  title: string;
  brand: string;
  category: string;
  description: string;
}): string {
  return `${product.title}. ${product.brand}. ${product.category}. ${product.description}`;
}

type Extractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist: () => number[] | number[][] }>;

let extractorPromise: Promise<Extractor> | null = null;

function queryPrefix(model: string): string {
  // bge-small was trained with an instruction on the query side only.
  if (model.includes('bge-')) {
    return 'Represent this sentence for searching relevant passages: ';
  }
  return '';
}

function prepare(text: string, kind: 'query' | 'passage'): string {
  if (providerName() === 'openai') return text;
  if (kind === 'query') return `${queryPrefix(config.embeddingModel)}${text}`;
  return text;
}

async function localExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { env, pipeline } = await import('@huggingface/transformers');
      env.cacheDir = config.cacheDir;
      env.allowLocalModels = false;
      const pipe = await pipeline('feature-extraction', config.embeddingModel, {
        dtype: 'q8',
      });
      return pipe as unknown as Extractor;
    })();
  }
  return extractorPromise;
}

/** Load the local model so the first search does not pay the startup cost. */
export async function preloadModel(): Promise<void> {
  if (providerName() === 'openai') return;
  await localExtractor();
}

export async function embedTexts(
  texts: string[],
  kind: 'query' | 'passage',
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const prepared = texts.map((text) => prepare(text, kind));
  const vectors = config.openAiKey ? await embedOpenAI(prepared) : await embedLocal(prepared);
  for (const vector of vectors) {
    if (vector.length !== EMBEDDING_DIM) {
      throw new Error(
        `Expected a ${EMBEDDING_DIM}-d embedding, got ${vector.length}. ` +
          'The products.embedding column is vector(384). Re-seed after changing model.',
      );
    }
  }
  return vectors;
}

async function embedLocal(texts: string[]): Promise<number[][]> {
  const extractor = await localExtractor();
  const vectors: number[][] = [];
  const batchSize = 16;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const output = await extractor(batch, { pooling: 'mean', normalize: true });
    const list = output.tolist();
    if (batch.length === 1 && typeof list[0] === 'number') {
      vectors.push(list as number[]);
    } else {
      vectors.push(...(list as number[][]));
    }
  }
  return vectors;
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openAiModel,
      input: texts,
      dimensions: EMBEDDING_DIM,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings failed (${response.status}): ${body.slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    data: { index: number; embedding: number[] }[];
  };
  return payload.data.sort((a, b) => a.index - b.index).map((row) => row.embedding);
}
