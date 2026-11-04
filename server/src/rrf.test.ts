import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fuseRankedLists,
  reciprocalRankFusion,
  rrfTerm,
  type RankedHit,
} from './rrf.ts';

const keyword = (ids: string[]): RankedHit[] =>
  ids.map((id, index) => ({ id, rank: index + 1 }));

describe('reciprocal rank fusion', () => {
  it('uses 1 / (k + rank)', () => {
    assert.equal(rrfTerm(1, 60), 1 / 61);
    assert.equal(rrfTerm(2, 60), 1 / 62);
  });

  it('keeps a single list in order', () => {
    const fused = reciprocalRankFusion(keyword(['a', 'b', 'c']), []);
    assert.deepEqual(
      fused.map((hit) => hit.id),
      ['a', 'b', 'c'],
    );
    assert.equal(fused[0].score, 1 / 61);
    assert.equal(fused[0].semanticRank, null);
  });

  it('scores a hit in both lists above a hit in only one', () => {
    // The classic reason to fuse: agreement beats a lone first place.
    const fused = reciprocalRankFusion(
      keyword(['lamp', 'slipper']),
      keyword(['slipper', 'boot']),
    );
    assert.equal(fused[0].id, 'slipper');
    assert.ok(fused[0].score > fused.find((hit) => hit.id === 'lamp')!.score);
    assert.equal(fused[0].keywordRank, 2);
    assert.equal(fused[0].semanticRank, 1);
  });

  it('matches a hand-computed example', () => {
    // keyword ranks: a1 b2 c3. semantic ranks: b1 d2 a3.
    const fused = reciprocalRankFusion(keyword(['a', 'b', 'c']), keyword(['b', 'd', 'a']), 60);
    const byId = Object.fromEntries(fused.map((hit) => [hit.id, hit.score]));
    assert.equal(byId.a, 1 / 61 + 1 / 63);
    assert.equal(byId.b, 1 / 62 + 1 / 61);
    assert.equal(byId.d, 1 / 62);
    assert.equal(byId.c, 1 / 63);
    assert.deepEqual(
      fused.map((hit) => hit.id),
      ['b', 'a', 'd', 'c'],
    );
  });

  it('breaks a pure score tie toward the keyword list, then id', () => {
    const fused = reciprocalRankFusion(keyword(['m-sku']), keyword(['m-vector']), 60);
    assert.equal(fused[0].score, fused[1].score);
    assert.equal(fused[0].id, 'm-sku');
  });

  it('uses the best rank when one list repeats an id', () => {
    const fused = reciprocalRankFusion(
      [
        { id: 'a', rank: 4 },
        { id: 'a', rank: 1 },
      ],
      [],
    );
    assert.equal(fused[0].keywordRank, 1);
    assert.equal(fused[0].score, 1 / 61);
  });

  it('returns an empty list when both inputs are empty', () => {
    assert.deepEqual(reciprocalRankFusion([], []), []);
  });

  it('rejects a rank below 1 and a non-positive k', () => {
    assert.throws(() => reciprocalRankFusion([{ id: 'a', rank: 0 }], []));
    assert.throws(() => reciprocalRankFusion(keyword(['a']), [], 0));
    assert.throws(() => reciprocalRankFusion([{ id: '', rank: 1 }], []));
  });

  it('does not mutate the input arrays', () => {
    const lexical = keyword(['b', 'a']);
    const semantic = keyword(['a']);
    const before = JSON.stringify({ lexical, semantic });
    reciprocalRankFusion(lexical, semantic);
    assert.equal(JSON.stringify({ lexical, semantic }), before);
  });
});

describe('exact identifier pin', () => {
  it('pins an exact id ahead of a higher RRF score', () => {
    // semantic+keyword agreement would otherwise beat a keyword-only code.
    const fused = fuseRankedLists({
      keyword: keyword(['sku-1', 'both']),
      semantic: keyword(['both']),
      exactIds: ['sku-1'],
    });
    assert.equal(fused[0].id, 'sku-1');
    assert.equal(fused[0].exact, true);
    assert.ok(fused[1].score > fused[0].score);
  });

  it('still pins an exact id that neither list returned', () => {
    const fused = fuseRankedLists({
      keyword: [],
      semantic: keyword(['other']),
      exactIds: ['sku-9'],
    });
    assert.equal(fused[0].id, 'sku-9');
    assert.equal(fused[0].exact, true);
  });

  it('leaves ordinary fusion alone when nothing is exact', () => {
    const plain = reciprocalRankFusion(keyword(['a', 'b']), keyword(['b']));
    const wrapped = fuseRankedLists({
      keyword: keyword(['a', 'b']),
      semantic: keyword(['b']),
    });
    assert.deepEqual(
      wrapped.map(({ id, score }) => ({ id, score })),
      plain.map(({ id, score }) => ({ id, score })),
    );
  });
});
