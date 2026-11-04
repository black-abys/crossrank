/** Chips in the search bench. The eval set in evalQueries.ts uses the same wording. */
export const EXAMPLES = [
  {
    query: 'something to keep my feet warm',
    tag: 'Paraphrase',
    note: 'Slippers and socks. The titles never say “feet”.',
  },
  {
    query: 'gift for a braai lover',
    tag: 'Paraphrase',
    note: 'A potjie and a kettle grill, next to the listings that actually say “braai”.',
  },
  {
    query: 'school stationery',
    tag: 'Paraphrase',
    note: 'Pencils and exercise books, not the school backpack.',
  },
  {
    query: 'something for a pounding headache',
    tag: 'Paraphrase',
    note: 'Pain tablets, not a workout disc.',
  },
  {
    query: 'keep drinks cold at the cricket',
    tag: 'Paraphrase',
    note: 'A cooler chest, not the cricket bat.',
  },
  {
    query: 'KM-1002',
    tag: 'SKU',
    note: 'Keyword pins the code. Semantic has never seen the SKU.',
  },
  {
    query: '9781776091234',
    tag: 'ISBN',
    note: 'Same idea as a SKU: an identifier, not a concept.',
  },
  {
    query: 'Russell Hobbs',
    tag: 'Brand',
    note: 'The brand string is a lexical strength.',
  },
  {
    query: 'maize meal',
    tag: 'Exact words',
    note: 'Both methods should agree.',
  },
] as const;
