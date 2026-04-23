const artifactCards = [
  "Generated files",
  "Manifest summary",
  "Download actions",
] as const;

export function ArtifactsPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          Artifacts
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Artifact viewer scaffold</h2>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-300">
          Reserve space for manifests, generated file paths, and output-specific actions.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {artifactCards.map((card) => (
          <section
            className="rounded-[1.75rem] border border-zinc-200/80 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/70"
            key={card}
          >
            <h3 className="text-lg font-medium tracking-tight">{card}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Placeholder content for future artifact API integration.
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
