import type { BuildRun } from "@/shared/lib/types";

export function HomePage() {
  const recentBuilds: BuildRun[] = [];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <h2 className="text-3xl font-semibold tracking-tight">KPubData Studio</h2>
      <p className="max-w-2xl text-zinc-600 dark:text-zinc-300">
        Studio is the control surface for configuring and running kpubdata-builder
        jobs. This home view will surface recent builds and quick actions for
        starting new pipeline runs.
      </p>

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h3 className="text-lg font-medium">Recent builds</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Placeholder: {recentBuilds.length} build runs available.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h3 className="text-lg font-medium">Quick actions</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Use the build wizard to validate specs, preview records, and execute a
          new run.
        </p>
      </section>
    </main>
  );
}
