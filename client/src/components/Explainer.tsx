const STEPS = [
  {
    title: 'Keyword',
    bar: 'bg-teal',
    body: 'Full-text search ranks listings that share the shopper’s words. A SKU, an ISBN, or a brand lands on the first row. A paraphrase often lands nowhere useful.',
  },
  {
    title: 'Semantic',
    bar: 'bg-clay',
    body: 'The same catalogue is stored as vectors from a small local model. “Something to keep my feet warm” can surface slippers even when the title says neither feet nor warm.',
  },
  {
    title: 'Hybrid',
    bar: 'bg-ember',
    body: 'Reciprocal Rank Fusion adds the two lists without mixing their raw scores. A product in both lists outranks a product that only one method found.',
  },
];

export function Explainer() {
  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-10 lg:grid-cols-3">
      {STEPS.map((step) => (
        <article key={step.title} className="rounded-2xl border border-line bg-card p-5">
          <div className={`mb-4 h-1 w-12 rounded-full ${step.bar}`} />
          <h2 className="font-serif text-2xl tracking-tight">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
        </article>
      ))}
      <p className="px-1 text-sm leading-relaxed text-muted lg:col-span-3">
        Fusion score = 1/(60 + keyword rank) + 1/(60 + semantic rank). An exact SKU or ISBN is pinned
        first. The constant 60 is the one from Cormack, Clarke, and Buettcher, SIGIR 2009.
      </p>
    </div>
  );
}
