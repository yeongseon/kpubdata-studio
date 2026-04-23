const validationSections = [
  {
    title: "Errors",
    description: "Blocking issues from `POST /validate` will be grouped here.",
  },
  {
    title: "Warnings",
    description: "Non-blocking feedback for metadata, export choices, and source parameters.",
  },
  {
    title: "Next actions",
    description: "Guide students toward fixing the draft or proceeding to preview and run stages.",
  },
];

export function ValidatePage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          Validate
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Validation result workspace</h2>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-300">
          This route is reserved for structured validation output tied to the current build spec.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {validationSections.map((section) => (
          <section
            className="rounded-[1.75rem] border border-zinc-200/80 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/70"
            key={section.title}
          >
            <h3 className="text-lg font-medium tracking-tight">{section.title}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {section.description}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
