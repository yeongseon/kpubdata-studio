import { Link } from "react-router-dom";
import type { BuildRun } from "@/shared/lib/types";

export function BuildsPage() {
  const runs: BuildRun[] = [];

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
            Runs
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Build run history</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-300">
            Scaffold table for queued, running, and completed build executions.
          </p>
        </div>
        <Link
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          to="/builds/new"
        >
          New build draft
        </Link>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-white/80 shadow-lg shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] gap-4 border-b border-zinc-200/80 px-6 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span>Build</span>
          <span>Status</span>
          <span>Started</span>
          <span>Action</span>
        </div>

        {runs.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-lg font-medium tracking-tight">No build runs yet</p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Students can connect `listBuilds` and polling hooks here to populate the table with live run status.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
