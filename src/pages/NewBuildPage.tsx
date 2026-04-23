import type { BuildDraft, BuildSpec } from "@/shared/lib/types";

export function NewBuildPage() {
  const initialSpec: BuildSpec = {
    datasetId: "",
    title: "",
    description: "",
    sources: [],
    exports: [],
    metadata: {},
  };

  const draft: BuildDraft = {
    spec: initialSpec,
    status: "new",
    lastModified: new Date(0).toISOString(),
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-6 py-12">
      <h2 className="text-3xl font-semibold tracking-tight">New Build</h2>
      <p className="text-zinc-600 dark:text-zinc-300">
        Placeholder wizard for drafting, validating, and executing a new build
        specification.
      </p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Draft status: {draft.status}
      </p>
    </main>
  );
}
