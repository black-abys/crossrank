import { useEffect, useState, type FormEvent } from 'react';
import { Column, MethodJump } from './components/Column.tsx';
import { Explainer } from './components/Explainer.tsx';
import { shortModel } from './lib/format.ts';
import type { Example, Health, SearchResponse } from './lib/types.ts';

const API = import.meta.env.VITE_API_URL ?? '';

const FALLBACK_EXAMPLES: Example[] = [
  { query: 'something to keep my feet warm', tag: 'Paraphrase', note: 'Slippers and socks. The titles never say “feet”.' },
  { query: 'gift for a braai lover', tag: 'Paraphrase', note: 'A potjie and a kettle grill, next to the listings that say “braai”.' },
  { query: 'school stationery', tag: 'Paraphrase', note: 'Pencils and exercise books, not the school backpack.' },
  { query: 'something for a pounding headache', tag: 'Paraphrase', note: 'Pain tablets, not a workout disc.' },
  { query: 'keep drinks cold at the cricket', tag: 'Paraphrase', note: 'A cooler chest, not the cricket bat.' },
  { query: 'KM-1002', tag: 'SKU', note: 'Keyword pins the code. Semantic has never seen the SKU.' },
  { query: '9781776091234', tag: 'ISBN', note: 'Same idea as a SKU: an identifier, not a concept.' },
  { query: 'Russell Hobbs', tag: 'Brand', note: 'The brand string is a lexical strength.' },
  { query: 'maize meal', tag: 'Exact words', note: 'Both methods should agree.' },
];

export default function App() {
  const initial = new URLSearchParams(window.location.search).get('q') ?? '';
  const [draft, setDraft] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [examples, setExamples] = useState<Example[]>(FALLBACK_EXAMPLES);
  const [health, setHealth] = useState<Health | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(initial ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${API}/api/examples`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { examples?: Example[] } | null) => {
        if (body?.examples?.length) setExamples(body.examples);
      })
      .catch(() => undefined);
    void fetch(`${API}/api/health`, { signal: controller.signal })
      .then((response) => response.json())
      .then((body: Health) => setHealth(body))
      .catch(() => setHealth(null));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    const url = new URL(window.location.href);
    if (trimmed) url.searchParams.set('q', trimmed);
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);

    if (!trimmed) return;

    const controller = new AbortController();
    setStatus('loading');
    setError(null);
    void fetch(`${API}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmed, limit: 10 }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(body.error || `Search failed (${response.status})`);
        return body as SearchResponse;
      })
      .then((body) => {
        setResult(body);
        setStatus('ready');
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setStatus('error');
        setResult(null);
        if (reason instanceof Error && reason.message) {
          setError(
            reason.message === 'Failed to fetch'
              ? 'The search API is not reachable. From the repo root, run npm run dev.'
              : reason.message,
          );
        } else {
          setError('Search failed.');
        }
      });

    return () => controller.abort();
  }, [query]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setQuery(draft.trim());
  }

  const activeNote = examples.find((example) => example.query === query)?.note;
  const showingResults = query.trim().length > 0 && status !== 'idle';
  const model = shortModel(result?.model ?? health?.model ?? 'bge-small-en-v1.5');
  const productCount = health?.products;

  return (
    <div className="flex min-h-svh flex-col lg:h-svh lg:overflow-hidden">
      <header className="shrink-0 bg-espresso text-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <p className="text-[11px] tracking-[0.18em] text-card/70 uppercase">Johannesburg</p>
          <p className="font-serif text-2xl tracking-tight italic">Crossrank</p>
          <p className="hidden text-sm text-card/80 sm:block">Katlego Mokwena</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl shrink-0 px-4 pt-5 pb-3">
        <p className="text-[11px] font-medium tracking-[0.16em] text-muted uppercase">Product search bench</p>
        <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="q">
            Search the catalogue
          </label>
          <input
            id="q"
            name="q"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Try “something to keep my feet warm”"
            autoComplete="off"
            className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-lg shadow-[0_1px_0_rgba(36,28,22,0.04)] outline-none placeholder:text-muted/80"
          />
          <button
            type="submit"
            className="rounded-2xl bg-espresso px-5 py-3 text-sm font-medium tracking-wide text-card uppercase"
          >
            Search
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((example) => {
            const selected = example.query === query;
            return (
              <button
                key={example.query}
                type="button"
                onClick={() => {
                  setDraft(example.query);
                  setQuery(example.query);
                }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-left text-sm ${
                  selected ? 'border-ink bg-ink text-card' : 'border-line bg-card text-ink hover:border-ink/40'
                }`}
              >
                <span className={`mr-2 text-[10px] tracking-[0.14em] uppercase ${selected ? 'text-card/70' : 'text-muted'}`}>
                  {example.tag}
                </span>
                {example.query}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>
            {productCount == null ? 'Catalogue' : `${productCount} listings`}
            {' · '}
            {model}
            {' · '}
            RRF k={health?.rrfK ?? result?.rrfK ?? 60}
          </span>
          {status === 'ready' && result ? <span className="tabular-nums">{result.elapsedMs} ms</span> : null}
          {health && !health.embeddingReady && !health.embeddingError ? (
            <span>The embedding model is loading. The first search waits for it.</span>
          ) : null}
          {health?.databaseError ? <span className="text-ember">Database: {health.databaseError}</span> : null}
          {health && health.products === 0 && !health.databaseError ? (
            <span>The catalogue is empty. Run npm run seed.</span>
          ) : null}
        </div>
      </div>

      {showingResults ? (
        <main className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col px-4 pb-4">
          <div className="mb-3 shrink-0">
            <h1 className="font-serif text-3xl tracking-tight text-balance sm:text-4xl">
              {query}
            </h1>
            {activeNote ? <p className="mt-1 max-w-3xl text-sm text-muted">{activeNote}</p> : null}
          </div>
          {error ? (
            <p role="alert" className="mb-3 rounded-2xl border border-ember/40 bg-card px-4 py-3 text-sm text-ember">
              {error}
            </p>
          ) : null}
          <MethodJump />
          <div
            aria-live="polite"
            className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3"
          >
            <Column method="keyword" hits={result?.keyword ?? []} loading={status === 'loading'} />
            <Column method="semantic" hits={result?.semantic ?? []} loading={status === 'loading'} />
            <Column method="hybrid" hits={result?.hybrid ?? []} loading={status === 'loading'} />
          </div>
          <footer className="shrink-0 pt-3 text-xs text-muted">
            Inspired by{' '}
            <a
              className="underline decoration-line underline-offset-2 hover:text-ink"
              href="https://medium.com/takealot-engineering/hybrid-product-search-at-takealot-24c6e97a84eb"
            >
              Takealot Engineering: Hybrid product search at Takealot
            </a>{' '}
            by Grant Zietsman. Prices in rand. Listings are original demo copy.
          </footer>
        </main>
      ) : (
        <main className="flex-1">
          <Explainer />
          <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted">
            Built in Johannesburg by Katlego Mokwena.{' '}
            <a
              className="underline decoration-line underline-offset-2 hover:text-ink"
              href="https://github.com/black-abys"
            >
              github.com/black-abys
            </a>
            . Inspired by{' '}
            <a
              className="underline decoration-line underline-offset-2 hover:text-ink"
              href="https://medium.com/takealot-engineering/hybrid-product-search-at-takealot-24c6e97a84eb"
            >
              Hybrid product search at Takealot
            </a>
            .
          </footer>
        </main>
      )}
    </div>
  );
}
