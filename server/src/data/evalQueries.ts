/**
 * Labelled queries for recall@10 and MRR.
 * Relevant SKUs are what a merchandiser would want in the top 10,
 * not "whatever the model happened to return".
 */
export type EvalQuery = {
  query: string;
  relevant: string[];
  note: string;
};

export const evalQueries: EvalQuery[] = [
  {
    query: 'something to keep my feet warm',
    relevant: ['KM-1001', 'KM-1002', 'KM-1003', 'KM-1004'],
    note: 'Paraphrase. Titles are slippers, socks, and a boot. “Warm” is only in the description.',
  },
  {
    query: 'gift for a braai lover',
    relevant: ['KM-2001', 'KM-2002', 'KM-2003', 'KM-2008', 'KM-2011', 'KM-2201'],
    note: 'Two listings say “braai”. Potjie, apron, boerewors, and the kettle grill do not.',
  },
  {
    query: 'school stationery',
    relevant: ['KM-3001', 'KM-3002', 'KM-3003', 'KM-3004', 'KM-3005', 'KM-3006', 'KM-3007'],
    note: 'Pencils, books, glue, a ruler, crayons, pens, a sharpener. School bags are distractors.',
  },
  {
    query: 'something for a pounding headache',
    relevant: ['KM-4001', 'KM-4002', 'KM-4003'],
    note: 'Pain tablets and a menthol roller. They never use the word headache.',
  },
  {
    query: 'keep drinks cold at the cricket',
    relevant: ['KM-5001', 'KM-5002', 'KM-5003'],
    note: 'Cooler, ice bricks, vacuum flask. Cricket gear is the lexical trap.',
  },
  {
    query: 'KM-1002',
    relevant: ['KM-1002'],
    note: 'Exact SKU. Keyword should win. The SKU is not in the embedded passage.',
  },
  {
    query: '9781776091234',
    relevant: ['KM-9101'],
    note: 'Exact ISBN, same idea as a SKU.',
  },
  {
    query: 'Russell Hobbs',
    relevant: ['KM-6001', 'KM-6002', 'KM-6003', 'KM-6004', 'KM-6005'],
    note: 'Brand string. Keyword should list those five appliances and nothing else.',
  },
  {
    query: 'maize meal',
    relevant: ['KM-7001', 'KM-7002', 'KM-7003'],
    note: 'The words are in the titles. Both methods should agree.',
  },
  {
    query: 'wireless headphones',
    relevant: ['KM-8003', 'KM-8004'],
    note: 'Control query where keyword and semantic should agree.',
  },
];
