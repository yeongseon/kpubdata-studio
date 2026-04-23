import { Link } from "react-router-dom";
import type { BuildRun } from "@/shared/lib/types";

const quickActions = [
  {
    href: "/builds/new",
    label: "Create a new build",
    description: "Start a draft spec with source, export, and output scaffolding.",
  },
  {
    href: "/validate",
    label: "Review validation",
    description: "Inspect schema and spec feedback before a run leaves draft state.",
  },
  {
    href: "/artifacts",
    label: "Inspect artifacts",
    description: "Reserve a space for generated files, manifests, and download links.",
  },
];

export function HomePage() {
  const recentBuilds: BuildRun[] = [];

  return (
    <main className="flex flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.9fr)]">
        <div className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,244,245,0.95))] p-7 shadow-xl shadow-zinc-950/5 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_38%),linear-gradient(135deg,rgba(9,9,11,0.98),rgba(24,24,27,0.96))]">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-600 dark:text-emerald-400">
            Studio dashboard
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Build public-data workflows with a shell students can extend safely.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
            This scaffold keeps draft creation, validation, preview, and output review visible without hiding builder semantics behind heavy abstractions.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
              to="/builds/new"
            >
              Open build editor
            </Link>
            <Link
              className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              to="/builds"
            >
              Browse runs
            </Link>
          </div>
        </div>

        <section className="rounded-[2rem] border border-zinc-200/80 bg-white/80 p-6 shadow-lg shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                Recent builds
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">No runs yet</h3>
            </div>
            <span className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs uppercase tracking-[0.28em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              {recentBuilds.length} queued
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Recent run history will appear here once students wire the runs API into the dashboard cards.
          </p>
        </section>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
              Quick actions
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              Start from the workflow step you need
            </h3>
          </div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              className="rounded-[1.75rem] border border-zinc-200/80 bg-white/80 p-5 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-zinc-700"
              key={action.href}
              to={action.href}
            >
              <p className="text-lg font-medium tracking-tight">{action.label}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
