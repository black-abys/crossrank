-- Hybrid product search for the Crossrank catalogue.
--
-- Lexical side:  Postgres full-text search (tsvector + ts_rank).
-- Semantic side: pgvector cosine distance on a 384-d embedding.
-- Fusion:        Reciprocal Rank Fusion (Cormack, Clarke, Buettcher, SIGIR 2009).
--
--   score(d) = 1 / (k + keyword_rank)  +  1 / (k + semantic_rank)
--
-- A list contributes 0 when it does not contain d. k defaults to 60.
-- Ranks are 1-based. Raw ts_rank and cosine are not on the same scale, so
-- fusion looks only at rank. The same formula is unit-tested in
-- server/src/rrf.ts — keep the two in sync.
--
-- Exact SKU and ISBN matches are pinned to the top of the keyword list and
-- the hybrid list. A typed identifier is not a concept, and a cosine
-- neighbour should not outrank a code the shopper entered in full. The pin
-- is separate from the RRF score and is covered by tests.

CREATE EXTENSION IF NOT EXISTS vector;

DROP FUNCTION IF EXISTS search_catalogue(text, vector, integer, integer, integer);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  brand text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  isbn text,
  embedding vector(384),
  -- Weights: A title/brand/sku, B category, C description.
  -- SKU and ISBN are indexed as a single simple-config token (km1002, not km + 1002)
  -- so a code search does not match every row that happens to contain "1002".
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', regexp_replace(lower(sku), '[^a-z0-9]', '', 'g')), 'A')
    || setweight(to_tsvector('simple', coalesce(regexp_replace(lower(isbn), '[^a-z0-9]', '', 'g'), '')), 'A')
    || setweight(to_tsvector('english', coalesce(brand, '')), 'A')
    || setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(category, '')), 'B')
    || setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED
);

CREATE INDEX IF NOT EXISTS products_search_idx ON products USING gin (search_vector);
CREATE INDEX IF NOT EXISTS products_embedding_hnsw ON products USING hnsw (embedding vector_cosine_ops);
CREATE UNIQUE INDEX IF NOT EXISTS products_isbn_unique ON products (isbn) WHERE isbn IS NOT NULL;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_read ON products;
CREATE POLICY products_read ON products
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION search_catalogue(
  query_text text,
  query_embedding vector(384),
  match_count integer DEFAULT 10,
  rrf_k integer DEFAULT 60,
  candidate_count integer DEFAULT 40
)
RETURNS TABLE (
  method text,
  rank integer,
  score real,
  keyword_rank integer,
  semantic_rank integer,
  exact_match boolean,
  id uuid,
  sku text,
  title text,
  description text,
  category text,
  brand text,
  price_cents integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      btrim(coalesce(query_text, '')) AS q,
      regexp_replace(lower(btrim(coalesce(query_text, ''))), '[^a-z0-9]', '', 'g') AS norm,
      greatest(1, least(coalesce(match_count, 10), 50)) AS lim,
      greatest(1, coalesce(rrf_k, 60)) AS k,
      greatest(
        greatest(1, least(coalesce(match_count, 10), 50)),
        least(greatest(coalesce(candidate_count, 40), 1), 200)
      ) AS cand
  ),
  -- English lexemes of the query, OR-ed. OR (not AND) is what makes this
  -- behave like a small BM25: a listing can match on one word and rank
  -- higher when more of the words hit. Stop-words are already gone.
  -- Lexemes that are not plain tokens (for example "-1002" from "KM-1002")
  -- are dropped so they cannot be parsed as negation.
  lexemes AS (
    SELECT u.lexeme
    FROM params p
    CROSS JOIN LATERAL unnest(to_tsvector('english', p.q)) AS u(lexeme, positions, weights)
    WHERE p.q <> ''
      AND u.lexeme ~ '^[a-z0-9]+$'
  ),
  english_q AS (
    SELECT
      CASE
        WHEN (SELECT count(*) FROM lexemes) = 0 THEN NULL::tsquery
        ELSE (
          SELECT to_tsquery('english', string_agg('''' || lexeme || '''', ' | ' ORDER BY lexeme))
          FROM lexemes
        )
      END AS tsq
  ),
  -- Squashed query as one simple token, so "KM-1002" looks up "km1002".
  simple_q AS (
    SELECT
      CASE
        WHEN length(p.norm) >= 2 THEN plainto_tsquery('simple', p.norm)
        ELSE NULL::tsquery
      END AS tsq
    FROM params p
  ),
  query_tsq AS (
    SELECT
      CASE
        WHEN e.tsq IS NULL THEN s.tsq
        WHEN s.tsq IS NULL THEN e.tsq
        ELSE e.tsq || s.tsq
      END AS tsq
    FROM english_q e
    CROSS JOIN simple_q s
  ),
  keyword_hits AS (
    SELECT
      p.id,
      p.sku,
      p.title,
      p.description,
      p.category,
      p.brand,
      p.price_cents,
      (
        regexp_replace(lower(p.sku), '[^a-z0-9]', '', 'g') = params.norm
        AND length(params.norm) >= 4
      )
      OR (
        p.isbn IS NOT NULL
        AND regexp_replace(lower(p.isbn), '[^a-z0-9]', '', 'g') = params.norm
        AND length(params.norm) >= 10
      ) AS exact_match,
      (lower(p.brand) = lower(params.q) AND length(params.q) >= 2) AS brand_exact,
      CASE
        WHEN query_tsq.tsq IS NULL THEN 0::real
        ELSE ts_rank(p.search_vector, query_tsq.tsq)::real
      END AS lexical_score
    FROM products p
    CROSS JOIN params
    CROSS JOIN query_tsq
    WHERE params.q <> ''
      AND (
        (query_tsq.tsq IS NOT NULL AND p.search_vector @@ query_tsq.tsq)
        OR (
          regexp_replace(lower(p.sku), '[^a-z0-9]', '', 'g') = params.norm
          AND length(params.norm) >= 4
        )
        OR (
          p.isbn IS NOT NULL
          AND regexp_replace(lower(p.isbn), '[^a-z0-9]', '', 'g') = params.norm
          AND length(params.norm) >= 10
        )
        OR (lower(p.brand) = lower(params.q) AND length(params.q) >= 2)
      )
  ),
  keyword_top AS (
    SELECT *
    FROM (
      SELECT
        keyword_hits.*,
        (row_number() OVER (
          ORDER BY exact_match DESC, brand_exact DESC, lexical_score DESC, sku ASC
        ))::integer AS keyword_rank
      FROM keyword_hits
    ) ranked
    WHERE keyword_rank <= (SELECT cand FROM params)
  ),
  semantic_top AS (
    SELECT
      p.id,
      p.sku,
      p.title,
      p.description,
      p.category,
      p.brand,
      p.price_cents,
      (row_number() OVER (
        ORDER BY p.embedding <=> query_embedding, p.sku ASC
      ))::integer AS semantic_rank,
      (1 - (p.embedding <=> query_embedding))::real AS semantic_score
    FROM products p
    CROSS JOIN params
    WHERE p.embedding IS NOT NULL
      AND params.q <> ''
      AND query_embedding IS NOT NULL
    ORDER BY p.embedding <=> query_embedding, p.sku ASC
    LIMIT (SELECT cand FROM params)
  ),
  fused AS (
    SELECT
      coalesce(k.id, s.id) AS id,
      coalesce(k.sku, s.sku) AS sku,
      coalesce(k.title, s.title) AS title,
      coalesce(k.description, s.description) AS description,
      coalesce(k.category, s.category) AS category,
      coalesce(k.brand, s.brand) AS brand,
      coalesce(k.price_cents, s.price_cents) AS price_cents,
      k.keyword_rank,
      s.semantic_rank,
      coalesce(k.exact_match, false) AS exact_match,
      (
        CASE
          WHEN k.keyword_rank IS NOT NULL THEN 1.0 / (params.k + k.keyword_rank)
          ELSE 0
        END
        + CASE
          WHEN s.semantic_rank IS NOT NULL THEN 1.0 / (params.k + s.semantic_rank)
          ELSE 0
        END
      )::real AS rrf_score
    FROM keyword_top k
    FULL OUTER JOIN semantic_top s ON s.id = k.id
    CROSS JOIN params
  ),
  keyword_method AS (
    SELECT
      'keyword'::text AS method,
      keyword_rank AS rank,
      lexical_score AS score,
      keyword_rank,
      NULL::integer AS semantic_rank,
      exact_match,
      id,
      sku,
      title,
      description,
      category,
      brand,
      price_cents
    FROM keyword_top
    WHERE keyword_rank <= (SELECT lim FROM params)
  ),
  semantic_method AS (
    SELECT
      'semantic'::text AS method,
      semantic_rank::integer AS rank,
      semantic_score AS score,
      NULL::integer AS keyword_rank,
      semantic_rank::integer AS semantic_rank,
      false AS exact_match,
      id,
      sku,
      title,
      description,
      category,
      brand,
      price_cents
    FROM semantic_top
    WHERE semantic_rank <= (SELECT lim FROM params)
  ),
  hybrid_ranked AS (
    SELECT
      'hybrid'::text AS method,
      (row_number() OVER (
        ORDER BY
          exact_match DESC,
          rrf_score DESC,
          keyword_rank ASC NULLS LAST,
          semantic_rank ASC NULLS LAST,
          sku ASC
      ))::integer AS rank,
      rrf_score AS score,
      keyword_rank,
      semantic_rank,
      exact_match,
      id,
      sku,
      title,
      description,
      category,
      brand,
      price_cents
    FROM fused
  )
  SELECT * FROM keyword_method
  UNION ALL
  SELECT * FROM semantic_method
  UNION ALL
  SELECT * FROM hybrid_ranked WHERE hybrid_ranked.rank <= (SELECT lim FROM params);
$$;

COMMENT ON FUNCTION search_catalogue(text, vector, integer, integer, integer) IS
  'Keyword (tsvector), semantic (pgvector cosine), and Reciprocal Rank Fusion (k=60).';

-- Supabase roles do not exist on a plain Docker Postgres. Grant when they do.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON products TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION search_catalogue(text, vector, integer, integer, integer)
      TO anon, authenticated, service_role;
  END IF;
END $$;
