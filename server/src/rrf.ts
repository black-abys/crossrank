/**
 * Reciprocal Rank Fusion.
 *
 * Cormack, Clarke, and Buettcher (SIGIR 2009) merge ranked lists without
 * comparing the raw scores. That matters here because a ts_rank of 0.2 and a
 * cosine of 0.2 do not mean the same thing.
 *
 *   score(d) = Σ  1 / (k + rank_i(d))
 *
 * k is a constant, usually 60. Ranks are 1-based. A hit that appears in both
 * the keyword list and the semantic list beats a hit that appears in only one,
 * even when the single-list hit was ranked first there.
 *
 * The SQL in supabase/migrations/20241118120000_hybrid_search.sql implements
 * this same formula. Exact SKU / ISBN hits are then pinned to the front.
 * The pin is not part of RRF. An identifier the shopper typed in full should
 * not lose to a merely similar product.
 */

export const DEFAULT_RRF_K = 60;

export type RankedHit = {
  id: string;
  /** 1-based position in one retriever's list. */
  rank: number;
};

export type FusedHit = {
  id: string;
  /** Sum of reciprocal ranks. Higher is better. */
  score: number;
  keywordRank: number | null;
  semanticRank: number | null;
  exact: boolean;
};

export function rrfTerm(rank: number, k: number): number {
  return 1 / (k + rank);
}

/**
 * Collapse a list to the best (lowest) rank per id.
 * SQL row_number() never emits duplicates; this keeps hand-built lists honest.
 */
export function bestRanks(hits: RankedHit[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const hit of hits) {
    if (!hit.id) throw new Error('Ranked hit is missing an id');
    if (!Number.isInteger(hit.rank) || hit.rank < 1) {
      throw new Error(`Rank for ${hit.id} must be a positive integer, got ${hit.rank}`);
    }
    const prev = map.get(hit.id);
    if (prev == null || hit.rank < prev) map.set(hit.id, hit.rank);
  }
  return map;
}

function assertK(k: number): number {
  if (!Number.isInteger(k) || k < 1) {
    throw new Error(`RRF k must be a positive integer, got ${k}`);
  }
  return k;
}

/**
 * Pure Reciprocal Rank Fusion. No identifier pin.
 * Tie-break: higher score, then better keyword rank, then better semantic
 * rank, then id. The keyword tie-break is what a lone exact match uses when
 * it ties a lone semantic neighbour on the raw score.
 */
export function reciprocalRankFusion(
  keyword: RankedHit[],
  semantic: RankedHit[],
  k = DEFAULT_RRF_K,
): FusedHit[] {
  const constant = assertK(k);
  const keywordRanks = bestRanks(keyword);
  const semanticRanks = bestRanks(semantic);
  const ids = new Set([...keywordRanks.keys(), ...semanticRanks.keys()]);

  const fused: FusedHit[] = [];
  for (const id of ids) {
    const keywordRank = keywordRanks.get(id) ?? null;
    const semanticRank = semanticRanks.get(id) ?? null;
    let score = 0;
    if (keywordRank != null) score += rrfTerm(keywordRank, constant);
    if (semanticRank != null) score += rrfTerm(semanticRank, constant);
    fused.push({ id, score, keywordRank, semanticRank, exact: false });
  }

  fused.sort(compareFused);
  return fused;
}

/**
 * RRF, then move exact identifier matches to the front.
 * Ids in `exactIds` that neither list returned are still pinned, with a
 * keyword rank of 1. The SQL query always includes those rows in the keyword
 * list; this branch keeps the helper safe if a caller forgets.
 */
export function fuseRankedLists(options: {
  keyword: RankedHit[];
  semantic: RankedHit[];
  exactIds?: string[];
  k?: number;
}): FusedHit[] {
  const exactIds = options.exactIds ?? [];
  const fused = reciprocalRankFusion(options.keyword, options.semantic, options.k);
  const exact = new Set(exactIds.filter(Boolean));

  for (const id of exact) {
    if (!fused.some((hit) => hit.id === id)) {
      fused.push({
        id,
        score: 1,
        keywordRank: 1,
        semanticRank: null,
        exact: true,
      });
    }
  }

  for (const hit of fused) hit.exact = exact.has(hit.id);
  fused.sort(compareFused);
  return fused;
}

function compareFused(a: FusedHit, b: FusedHit): number {
  if (a.exact !== b.exact) return a.exact ? -1 : 1;
  if (a.score !== b.score) return b.score - a.score;
  const keywordDelta = rankOrLast(a.keywordRank) - rankOrLast(b.keywordRank);
  if (keywordDelta !== 0) return keywordDelta;
  const semanticDelta = rankOrLast(a.semanticRank) - rankOrLast(b.semanticRank);
  if (semanticDelta !== 0) return semanticDelta;
  return a.id.localeCompare(b.id);
}

function rankOrLast(rank: number | null): number {
  return rank ?? Number.POSITIVE_INFINITY;
}
