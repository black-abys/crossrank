import type { ReactNode } from 'react';
import { formatZar, scoreLabel } from '../lib/format.ts';
import type { Hit, MethodName } from '../lib/types.ts';

export function HitCard({ hit, method }: { hit: Hit; method: MethodName }) {
  const score = scoreLabel(method, hit);
  return (
    <li className="border-b border-line/80 px-4 py-3 last:border-b-0">
      <div className="flex gap-3">
        <span className="w-8 shrink-0 pt-0.5 font-serif text-2xl leading-none text-ink/30 tabular-nums italic">
          {String(hit.rank).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] leading-snug font-medium">{hit.title}</h3>
            <p className="shrink-0 text-sm font-medium tabular-nums">{formatZar(hit.priceCents)}</p>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {hit.brand}
            <span className="px-1.5 text-line">/</span>
            {hit.category}
            <span className="px-1.5 text-line">/</span>
            <span className="font-mono text-xs tracking-tight">{hit.sku}</span>
          </p>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink/80">{hit.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {hit.exactMatch ? (
              <Badge tone="exact">Exact</Badge>
            ) : null}
            {method === 'hybrid' ? (
              <>
                {hit.keywordRank != null ? <Badge tone="keyword">Keyword #{hit.keywordRank}</Badge> : null}
                {hit.semanticRank != null ? <Badge tone="semantic">Semantic #{hit.semanticRank}</Badge> : null}
              </>
            ) : (
              <Badge tone={method === 'keyword' ? 'keyword' : 'semantic'}>
                {method === 'keyword' ? 'Keyword' : 'Semantic'}
              </Badge>
            )}
            <p className="ml-auto text-xs text-muted tabular-nums" title={score.title}>
              <span className="uppercase tracking-wide">{score.name}</span>{' '}
              <span className="font-medium text-ink">{score.value}</span>
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: 'keyword' | 'semantic' | 'exact';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'keyword'
      ? 'border-teal/30 bg-teal/8 text-teal'
      : tone === 'semantic'
        ? 'border-clay/30 bg-clay/8 text-clay'
        : 'border-ember/30 bg-ember text-card';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide ${toneClass}`}>
      {children}
    </span>
  );
}
