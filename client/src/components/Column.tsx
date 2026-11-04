import { HitCard } from './HitCard.tsx';
import type { Hit, MethodName } from '../lib/types.ts';

const META: Record<
  MethodName,
  { title: string; kicker: string; blurb: string; bar: string }
> = {
  keyword: {
    title: 'Keyword',
    kicker: 'Lexical',
    blurb: 'Postgres full-text. Strong on brands, SKUs, and the words printed on the listing.',
    bar: 'bg-teal',
  },
  semantic: {
    title: 'Semantic',
    kicker: 'Vector',
    blurb: 'A local embedding model. It can match the idea when the words are different.',
    bar: 'bg-clay',
  },
  hybrid: {
    title: 'Hybrid',
    kicker: 'RRF k = 60',
    blurb: '1/(60 + keyword rank) + 1/(60 + semantic rank). Agreement climbs.',
    bar: 'bg-ember',
  },
};

export function Column({
  method,
  hits,
  loading,
}: {
  method: MethodName;
  hits: Hit[];
  loading: boolean;
}) {
  const meta = META[method];
  return (
    <section
      id={method}
      aria-label={`${meta.title} results`}
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_1px_0_rgba(36,28,22,0.04)]"
    >
      <header className="shrink-0 border-b border-line px-4 pt-3 pb-3">
        <div className={`mb-3 h-1 w-12 rounded-full ${meta.bar}`} />
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-[1.65rem] leading-none tracking-tight">{meta.title}</h2>
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">{meta.kicker}</p>
        </div>
        <p className="mt-2 text-sm leading-snug text-muted">{meta.blurb}</p>
      </header>
      <div className="lg:min-h-0 lg:flex-1 lg:overflow-auto">
        {loading ? (
          <SkeletonList />
        ) : hits.length === 0 ? (
          <p className="px-4 py-8 text-sm leading-relaxed text-muted">
            {method === 'keyword'
              ? 'No listing shares these words.'
              : method === 'semantic'
                ? 'No embedded neighbour in range.'
                : 'Nothing to fuse yet.'}
          </p>
        ) : (
          <ol>{hits.map((hit) => <HitCard key={hit.id} hit={hit} method={method} />)}</ol>
        )}
      </div>
    </section>
  );
}

function SkeletonList() {
  return (
    <ul aria-hidden="true" className="divide-y divide-line/80">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="px-4 py-4">
          <div className="h-4 w-2/3 animate-pulse rounded bg-line" />
          <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-line/80" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-line/70" />
        </li>
      ))}
    </ul>
  );
}

export function MethodJump() {
  const items: MethodName[] = ['keyword', 'semantic', 'hybrid'];
  return (
    <nav className="sticky top-0 z-20 -mx-4 mb-3 flex gap-2 overflow-auto bg-paper/95 px-4 py-2 backdrop-blur lg:hidden">
      {items.map((method) => (
        <a
          key={method}
          href={`#${method}`}
          className="shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-sm capitalize"
        >
          {method === 'hybrid' ? 'Hybrid' : method}
        </a>
      ))}
    </nav>
  );
}
