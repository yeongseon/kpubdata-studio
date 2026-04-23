const previewColumns = ["column", "type", "sample"] as const;

export function PreviewPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          Preview
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Preview panel scaffold</h2>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-300">
          Placeholder table for dataset rows returned by the preview API stub.
        </p>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="grid grid-cols-3 gap-4 border-b border-zinc-200/80 px-6 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {previewColumns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        <div className="px-6 py-14 text-center">
          <p className="text-lg font-medium tracking-tight">No preview rows loaded</p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Hook `previewBuild` into this page to render column schemas and sample rows after spec validation.
          </p>
        </div>
      </section>
    </main>
  );
}
