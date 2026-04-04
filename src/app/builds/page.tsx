import type { BuildRun } from "@/lib/types";

export default function BuildRunsPage() {
  const runs: BuildRun[] = [];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Build Runs</h1>
      <p className="text-zinc-600 dark:text-zinc-300">
        Placeholder list of builder executions and their latest statuses.
      </p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Total runs: {runs.length}
      </p>
    </main>
  );
}
