# Crossrank

A product-search bench for a catalogue of 427 made-up South African listings. One query is ranked three ways, side by side: keyword, semantic, and hybrid.

Keyword search is Postgres full-text (`tsvector` + `ts_rank`). Semantic search is a local 384-dimensional embedding compared with pgvector cosine distance. Hybrid search merges the two lists with Reciprocal Rank Fusion. Prices are in rand. Nothing here was scraped from a shop.

Built by Katlego Mokwena, Johannesburg. [github.com/black-abys](https://github.com/black-abys).

Inspired by Takealot Engineering: [Hybrid product search at Takealot](https://medium.com/takealot-engineering/hybrid-product-search-at-takealot-24c6e97a84eb) by Grant Zietsman (18 Nov 2024).

## What the three columns are doing

The Takealot post adds a semantic retriever next to the existing lexical one, then merges them, because a query like “something to keep my feet warm” should find socks even though the shopper never typed “socks”.

On this bench:

- **Keyword** is strong on brands, SKUs, and ISBNs. It is weak on paraphrases, and it happily ranks a “warm” lamp above a slipper.
- **Semantic** matches the idea. It has no idea what `KM-1002` means, because the SKU is not part of the embedded text.
- **Hybrid** is what you would ship. Agreement between the two lists climbs. A typed SKU or ISBN is pinned first.

Try the chips. “something to keep my feet warm”, “something for a pounding headache”, and `KM-1002` are the three that show the difference most clearly.

## How Reciprocal Rank Fusion works

Reciprocal Rank Fusion (Cormack, Clarke, and Buettcher, SIGIR 2009) merges ranked lists without comparing their raw scores. A `ts_rank` of 0.15 and a cosine of 0.15 are not the same kind of number, so the fusion only looks at position. With the usual constant `k = 60` and ranks starting at 1, a product’s score is `1/(60 + keyword rank)` plus `1/(60 + semantic rank)`, and a list that does not contain the product contributes nothing. A slipper that is 20th for keywords and 2nd for vectors therefore beats a lamp that is 1st for keywords and missing from the vector list. An exact SKU or ISBN is then pinned above that sum: a code the shopper typed in full should not lose to a merely similar product. The formula lives in [`server/src/rrf.ts`](server/src/rrf.ts) and in the SQL function [`search_catalogue`](supabase/migrations/20241118120000_hybrid_search.sql).

## Architecture

```mermaid
flowchart LR
  UI["React search bench"] --> API["Node API"]
  API --> EMB["Local bge-small-en-v1.5<br/>or OpenAI, if a key is set"]
  API --> RPC["search_catalogue"]
  RPC --> FTS["tsvector keyword"]
  RPC --> VEC["pgvector cosine"]
  FTS --> RRF["Reciprocal Rank Fusion, k = 60"]
  VEC --> RRF
  RRF --> UI
```

The browser only talks to the Node API. The API embeds the query and calls one Postgres function, which returns all three lists. Product vectors are computed once, by `npm run seed`, with the same model.

## Run locally

Needs Docker, Node 20+, and no API key. The first seed downloads the embedding model (about 30 MB) into `.cache/`.

```bash
docker compose up -d
cp .env.example .env
npm install
npm run seed
npm run dev
```

Open [http://127.0.0.1:4318](http://127.0.0.1:4318). The API is on port 4317. Postgres is on port 5433 (`crossrank` / `crossrank`).

```bash
npm test      # RRF unit tests, catalogue checks, SQL integration test
npm run eval  # recall@10 and MRR, rewrites docs/eval-results.md
```

Set `OPENAI_API_KEY` to embed with `text-embedding-3-small` at 384 dimensions instead. Re-seed after switching. The key is optional.

`EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2` is a drop-in alternative. Same column width. Re-seed if you change it. The default is `Xenova/bge-small-en-v1.5` because it is the same size class and better at short-query retrieval.

## Deploy on Supabase and Vercel

**Database.** Create a Supabase project and run [`supabase/migrations/20241118120000_hybrid_search.sql`](supabase/migrations/20241118120000_hybrid_search.sql) in the SQL editor, or with `supabase db push`. The migration enables `pgvector`, builds the `tsvector` column, and creates `search_catalogue`. From a laptop that can run the model:

```bash
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres" npm run seed
```

**API.** `server/` is a small Node process. Host it somewhere that can run ONNX (a VM, Fly, Railway). Point `DATABASE_URL` at Supabase. Vercel serverless is a poor fit for the local model, so the API stays a long-running process. `OPENAI_API_KEY` on that host is the serverless-friendly alternative, again followed by a re-seed.

**UI.** Deploy `client/` to Vercel as a Vite app. Set `VITE_API_URL` to the API origin at build time. [`client/vercel.json`](client/vercel.json) rewrites the SPA routes.

Any client that can produce a 384-d vector can also call `search_catalogue` directly.

## Evaluation

Ten labelled queries, recall@10 and mean reciprocal rank. The model is `bge-small-en-v1.5`. `npm run eval` reprints this table.

| Query | Keyword R@10 | Semantic R@10 | Hybrid R@10 | Keyword MRR | Semantic MRR | Hybrid MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| something to keep my feet warm | 0.000 | 1.000 | 1.000 | 0.000 | 1.000 | 1.000 |
| gift for a braai lover | 0.333 | 0.333 | 0.333 | 0.500 | 1.000 | 1.000 |
| school stationery | 0.000 | 0.429 | 0.143 | 0.000 | 0.125 | 0.111 |
| something for a pounding headache | 0.000 | 1.000 | 1.000 | 0.000 | 0.500 | 1.000 |
| keep drinks cold at the cricket | 0.000 | 0.667 | 1.000 | 0.000 | 0.500 | 0.250 |
| KM-1002 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 | 1.000 |
| 9781776091234 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 | 1.000 |
| Russell Hobbs | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| maize meal | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| wireless headphones | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| **Macro average** | **0.533** | **0.643** | **0.848** | **0.550** | **0.613** | **0.836** |

Hybrid leads both averages. On the paraphrase and the identifier queries it keeps the method that was right. On “school stationery” and “keep drinks cold at the cricket” it does not, because the salient word (“school”, “cricket”) is in both lists and fusion trusts that agreement.

## Screenshots

“something to keep my feet warm”. Keyword returns lamps. Semantic returns socks and slippers. Hybrid puts the slippers first, and the badges show the keyword rank that was too low to see in the first column.

![Keyword, semantic, and hybrid results for a paraphrase about warm feet](docs/screenshots/feet-warm-desktop.png)

`KM-1002`. Keyword and hybrid pin the merino socks. Semantic, which never saw the SKU, returns an HDMI cable.

![Exact SKU query where keyword and hybrid agree and semantic does not](docs/screenshots/sku-desktop.png)

“something for a pounding headache”. Keyword returns a garter and a novel. Hybrid promotes the menthol roller and the pain tablets.

![Headache query where hybrid promotes pain tablets the keyword list missed](docs/screenshots/headache-desktop.png)

The same feet query on a phone. Columns stack, with jumps for Keyword, Semantic, and Hybrid.

![Mobile layout of the feet query](docs/screenshots/feet-warm-mobile.png)

## Tests

`npm test` covers:

- the RRF score `1/(k + rank)`, both-list agreement, tie-breaks, and the exact-id pin
- catalogue rules, so the paraphrase queries do not accidentally contain the words they are supposed to miss
- a Postgres check that `search_catalogue` uses that same score and still pins an exact SKU when raw RRF would prefer something else

## Limitations

This is a miniature of the Takealot post, not a copy of their stack. They moved from a CLIP prototype to Vertex `text-embedding-004` (512-d, 8-bit) in front of a large lexical engine, and measured about a 6% lift in search click-through. Here the lexical engine is Postgres full-text, the model is a 33M-parameter local encoder, and the catalogue is 427 original listings.

A few queries show the small model’s limits. It does not reliably connect “braai” with a potjie or a kettle grill unless the listing already says “braai”, so hybrid cannot recover a product semantic search never retrieved. “School” and “cricket” are such strong tokens that both retrievers rank the backpack and the cricket ball first. Fusion then agrees with them.

Identifiers are handled with an explicit pin on top of RRF. Textbook RRF would tie a unique keyword hit with a unique semantic hit, and a code search would look arbitrary.

There is no checkout, no auth, and no image embeddings. The post’s later interest in visual search is out of scope.
