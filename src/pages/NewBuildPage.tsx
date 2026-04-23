import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { validateSpec } from "@/features/validation/api";
import { buildSpecSchema, exportFormatSchema } from "@/shared/lib/schemas";
import type { BuildDraft, BuildSpec } from "@/shared/lib/types";

const exportFormats = exportFormatSchema.options;

interface BuildFormValues {
  datasetId: string;
  title: string;
  description: string;
  provider: string;
  sourceDataset: string;
  sourceParams: string;
  outputPath: string;
  exportFormats: Array<(typeof exportFormats)[number]>;
}

const initialValues: BuildFormValues = {
  datasetId: "",
  title: "",
  description: "",
  provider: "",
  sourceDataset: "",
  sourceParams: "{}",
  outputPath: "artifacts/builds/example",
  exportFormats: ["jsonl"],
};

function parseSourceParams(sourceParams: string) {
  try {
    const parsed = JSON.parse(sourceParams) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "Source params must be a JSON object." };
    }

    const entries = Object.entries(parsed);
    const values = Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));

    return { data: values };
  } catch {
    return { error: "Source params must be valid JSON." };
  }
}

function toBuildSpec(values: BuildFormValues): { spec?: BuildSpec; error?: string } {
  const parsedParams = parseSourceParams(values.sourceParams);

  if (parsedParams.error) {
    return { error: parsedParams.error };
  }

  const candidate: BuildSpec = {
    datasetId: values.datasetId,
    title: values.title,
    description: values.description,
    sources: [
      {
        provider: values.provider,
        dataset: values.sourceDataset,
        params: parsedParams.data ?? {},
      },
    ],
    exports: values.exportFormats.map((format) => ({
      format,
      options: format === "huggingface" ? { outputPath: values.outputPath } : undefined,
    })),
    metadata: {
      outputPath: values.outputPath,
    },
  };

  const result = buildSpecSchema.safeParse(candidate);

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid build spec." };
  }

  return { spec: result.data };
}

export function NewBuildPage() {
  const [validationState, setValidationState] = useState<{
    errors: string[];
    isValid: boolean;
    status: "idle" | "validating" | "validated";
  }>({
    errors: [],
    isValid: false,
    status: "idle",
  });
  const [submittedSpec, setSubmittedSpec] = useState<BuildSpec | null>(null);
  const {
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    register,
    setError,
    clearErrors,
    watch,
  } = useForm<BuildFormValues>({
    defaultValues: initialValues,
    mode: "onChange",
  });

  const values = watch();
  const specPreview = useMemo(() => toBuildSpec(values), [values]);

  const initialSpec: BuildSpec = specPreview.spec ?? {
    datasetId: "",
    title: "",
    description: "",
    sources: [],
    exports: [],
    metadata: {},
  };

  const draft: BuildDraft = {
    spec: initialSpec,
    status: validationState.isValid ? "validated" : isDirty ? "dirty" : "new",
    lastModified: new Date().toISOString(),
  };

  async function validateCurrentSpec() {
    clearErrors();
    setValidationState({ errors: [], isValid: false, status: "validating" });

    const nextSpec = toBuildSpec(watch());

    if (nextSpec.error || !nextSpec.spec) {
      setError("sourceParams", {
        type: "manual",
        message: nextSpec.error ?? "Unable to parse source parameters.",
      });
      setValidationState({
        errors: [nextSpec.error ?? "Unable to parse source parameters."],
        isValid: false,
        status: "idle",
      });
      return;
    }

    const result = await validateSpec(nextSpec.spec);

    if (!result.valid) {
      setValidationState({ errors: result.errors, isValid: false, status: "validated" });
      return;
    }

    setValidationState({ errors: [], isValid: true, status: "validated" });
    setSubmittedSpec(nextSpec.spec);
  }

  const onSubmit = handleSubmit(async (formValues) => {
    const nextSpec = toBuildSpec(formValues);

    if (nextSpec.error || !nextSpec.spec) {
      setError("sourceParams", {
        type: "manual",
        message: nextSpec.error ?? "Unable to parse source parameters.",
      });
      return;
    }

    setSubmittedSpec(nextSpec.spec);
  });

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
            New build
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Build draft editor scaffold</h2>
          <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-300">
            React Hook Form manages draft input while zod keeps the generated spec aligned with the shared domain model.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            to="/validate"
          >
            Open validation view
          </Link>
          <Link
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            to="/preview"
          >
            Open preview view
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.9fr)]">
        <form
          className="rounded-[2rem] border border-zinc-200/80 bg-white/80 p-6 shadow-lg shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-950/70"
          onSubmit={onSubmit}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4 lg:col-span-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                  Build identity
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">Dataset metadata</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Dataset ID</span>
                  <input
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                    placeholder="kma-daily-observations"
                    {...register("datasetId", { required: "Dataset ID is required." })}
                  />
                  {errors.datasetId ? (
                    <span className="text-sm text-rose-500">{errors.datasetId.message}</span>
                  ) : null}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium">Title</span>
                  <input
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                    placeholder="KMA daily observations"
                    {...register("title", { required: "Title is required." })}
                  />
                  {errors.title ? (
                    <span className="text-sm text-rose-500">{errors.title.message}</span>
                  ) : null}
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium">Description</span>
                <textarea
                  className="min-h-32 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                  placeholder="Explain what this build collects and how students should extend it."
                  {...register("description", { required: "Description is required." })}
                />
                {errors.description ? (
                  <span className="text-sm text-rose-500">{errors.description.message}</span>
                ) : null}
              </label>
            </section>

            <section className="space-y-4 lg:col-span-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                  Source selection
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">Provider and dataset</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Provider</span>
                  <input
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                    placeholder="datago"
                    {...register("provider", { required: "Provider is required." })}
                  />
                  {errors.provider ? (
                    <span className="text-sm text-rose-500">{errors.provider.message}</span>
                  ) : null}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium">Dataset</span>
                  <input
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                    placeholder="air-quality"
                    {...register("sourceDataset", { required: "Dataset is required." })}
                  />
                  {errors.sourceDataset ? (
                    <span className="text-sm text-rose-500">{errors.sourceDataset.message}</span>
                  ) : null}
                </label>
              </div>

              <label className="space-y-2 lg:col-span-2">
                <span className="text-sm font-medium">Params (JSON object)</span>
                <textarea
                  className="min-h-32 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                  {...register("sourceParams", { required: "Source params are required." })}
                />
                {errors.sourceParams ? (
                  <span className="text-sm text-rose-500">{errors.sourceParams.message}</span>
                ) : null}
              </label>
            </section>

            <section className="space-y-4 lg:col-span-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                  Export targets
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">Output selection</h3>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {exportFormats.map((format) => (
                  <label
                    className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70"
                    key={format}
                  >
                    <input type="checkbox" value={format} {...register("exportFormats")} />
                    <span className="text-sm font-medium capitalize">{format}</span>
                  </label>
                ))}
              </div>

              <label className="space-y-2 lg:col-span-2">
                <span className="text-sm font-medium">Output path</span>
                <input
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                  placeholder="artifacts/builds/air-quality"
                  {...register("outputPath", { required: "Output path is required." })}
                />
                {errors.outputPath ? (
                  <span className="text-sm text-rose-500">{errors.outputPath.message}</span>
                ) : null}
              </label>
            </section>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              disabled={isSubmitting || validationState.status === "validating"}
              onClick={() => void validateCurrentSpec()}
              type="button"
            >
              {validationState.status === "validating" ? "Validating…" : "Validate"}
            </button>
            <button
              className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-300"
              disabled={!validationState.isValid || isSubmitting}
              type="submit"
            >
              Save scaffold draft
            </button>
          </div>
        </form>

        <aside className="space-y-5">
          <section className="rounded-[2rem] border border-zinc-200/80 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/70">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
              Draft state
            </p>
            <p className="mt-3 text-lg font-medium tracking-tight">{draft.status}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Draft validation stays separate from server state so students can evolve the draft model later.
            </p>
          </section>

          <section className="rounded-[2rem] border border-zinc-200/80 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
                  Validation status
                </p>
                <p className="mt-2 text-lg font-medium tracking-tight">
                  {validationState.isValid ? "Spec is ready" : "Validation pending"}
                </p>
              </div>
              <span className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs uppercase tracking-[0.28em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                {validationState.errors.length} issues
              </span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
              {validationState.errors.length > 0 ? (
                validationState.errors.map((error) => (
                  <li className="rounded-2xl bg-rose-50 px-3 py-2 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200" key={error}>
                    {error}
                  </li>
                ))
              ) : (
                <li className="rounded-2xl bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                  Use the validate button to exercise the stubbed validation API.
                </li>
              )}
            </ul>
          </section>

          <section className="rounded-[2rem] border border-zinc-200/80 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/70">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
              Generated spec preview
            </p>
            <pre className="mt-4 overflow-x-auto rounded-[1.5rem] bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
              <code>{JSON.stringify(submittedSpec ?? specPreview.spec ?? draft.spec, null, 2)}</code>
            </pre>
          </section>
        </aside>
      </div>
    </main>
  );
}
